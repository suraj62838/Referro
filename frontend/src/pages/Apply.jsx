import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  authFetch,
  authFetchMultipart,
  checkEmailAccount,
  getOAuthConnectUrl,
  sendEmail,
  getResume,
} from "../api.js";
import { Field } from "../components/ui.jsx";
import AppLayout from "../components/AppLayout.jsx";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ClipboardPaste,
  Upload,
  Send,
  Wand2,
  Sparkles,
  Mail,
  ExternalLink,
  Paperclip,
  CheckCircle2,
  Building2,
} from "lucide-react";

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function SourceTabs({ source, setSource }) {
  const tabs = [
    ["paste", "Paste text", ClipboardPaste],
    ["upload", "Upload file", Upload],
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 20,
        background: "var(--paper-raised)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 4,
        width: "fit-content",
      }}
    >
      {tabs.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => setSource(id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            borderRadius: 7,
            border: "none",
            background: source === id ? "var(--ink)" : "transparent",
            color: source === id ? "var(--paper)" : "var(--ink)",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

export default function Apply() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();
  const fileInputRef = useRef(null);

  const jobPosting = location.state?.jobPosting;
  const isFromBoard = !!jobPosting;

  const [source, setSource] = useState("paste");
  const [company, setCompany] = useState(jobPosting?.company_name || "");
  const [role, setRole] = useState(jobPosting?.role_title || "");
  const [email, setEmail] = useState(jobPosting?.recruiter_email || "");
  const [jd, setJd] = useState(jobPosting?.jd_text || "");
  const [detectedEmail, setDetectedEmail] = useState(false);

  const [appId, setAppId] = useState(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [fileState, setFileState] = useState("idle"); // idle -> parsing -> done
  const [error, setError] = useState("");

  // Phase 5: inbox connection state
  const [inboxStatus, setInboxStatus] = useState(null); // null = loading, object = result
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Phase 9: resume status
  const [resumeInfo, setResumeInfo] = useState(undefined); // undefined = loading, null = none, object = has resume

  // Auto-detect email when JD text changes (only when pasting manually)
  useEffect(() => {
    if (isFromBoard) return;
    if (source !== "paste") return;
    if (jd) {
      const emailMatch = extractEmail(jd);
      if (emailMatch) {
        setEmail(emailMatch);
        setDetectedEmail(true);
      } else {
        setDetectedEmail(false);
      }
    }
  }, [jd, isFromBoard, source]);

  // Check inbox connection on mount
  useEffect(() => {
    let cancelled = false;
    checkEmailAccount(accessToken).then((data) => {
      if (!cancelled) setInboxStatus(data);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Fetch active resume on mount
  useEffect(() => {
    let cancelled = false;
    getResume(accessToken)
      .then((data) => { if (!cancelled) setResumeInfo(data); })
      .catch(() => { if (!cancelled) setResumeInfo(null); });
    return () => { cancelled = true; };
  }, [accessToken]);

  // Handle parsing file uploads via the extraction endpoint
  const handleFileUpload = async (file) => {
    if (!file) return;
    try {
      setFileState("parsing");
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetchMultipart(
        "/job-applications/extract/",
        formData,
        accessToken
      );

      if (res.ok) {
        const data = await res.json();
        setJd(data.jd_text || "");
        if (data.recruiter_email) {
          setEmail(data.recruiter_email);
          setDetectedEmail(true);
        } else {
          setDetectedEmail(false);
        }
        setFileState("done");
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to extract text from file.");
        setFileState("idle");
      }
    } catch {
      setError("Network error — could not reach the server to parse file.");
      setFileState("idle");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!company.trim() || !role.trim()) {
      setError("Company name and Role title are required.");
      return;
    }
    if (!email.trim()) {
      setError("Recruiter email is required.");
      return;
    }

    let targetAppId = appId;

    try {
      setSubmitting(true);
      setError("");

      // Create application if not already created
      if (!targetAppId) {
        const res = await authFetch(
          "/job-applications/",
          {
            method: "POST",
            body: JSON.stringify({
              job_posting: jobPosting?.id || null,
              company_name: company,
              role_title: role,
              recruiter_email: email,
              jd_text: jd,
              status: "sent",
            }),
          },
          accessToken
        );

        if (res.ok) {
          const createdApp = await res.json();
          targetAppId = createdApp.id;
          setAppId(targetAppId);
        } else {
          const errData = await res.json();
          const msg = Object.entries(errData)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
          setError(msg || "Failed to create job application.");
          setSubmitting(false);
          return;
        }
      }

      // Now draft the email using the application ID
      const draftRes = await authFetch(
        `/job-applications/${targetAppId}/draft-email/`,
        {
          method: "POST",
        },
        accessToken
      );

      if (draftRes.ok) {
        const data = await draftRes.json();
        setDraftSubject(data.subject || "");
        setDraftBody(data.body || "");
      } else {
        const errData = await draftRes.json();
        setError(
          errData.detail ||
            "Failed to draft email with AI, but application was saved."
        );
      }
    } catch {
      setError("Network error — failed to generate AI email draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!appId) return;
    try {
      setSubmitting(true);
      setError("");
      const draftRes = await authFetch(
        `/job-applications/${appId}/draft-email/`,
        {
          method: "POST",
        },
        accessToken
      );

      if (draftRes.ok) {
        const data = await draftRes.json();
        setDraftSubject(data.subject || "");
        setDraftBody(data.body || "");
      } else {
        const errData = await draftRes.json();
        setError(errData.detail || "Failed to regenerate email draft.");
      }
    } catch {
      setError("Network error — failed to regenerate AI email draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!appId || !draftSubject.trim() || !draftBody.trim()) return;

    try {
      setSending(true);
      setError("");
      await sendEmail(appId, draftSubject, draftBody, accessToken);
      setSendSuccess(true);
      setTimeout(() => navigate("/dashboard", { state: { sent: true } }), 1200);
    } catch (err) {
      setError(err.message || "Failed to send email.");
      setSending(false);
    }
  };

  const handleConnectInbox = async () => {
    try {
      setError("");
      const authUrl = await getOAuthConnectUrl(accessToken);
      window.location.href = authUrl;
    } catch (err) {
      setError(err.message || "Failed to start Gmail connection.");
    }
  };

  const isInboxLoading = inboxStatus === null;
  const isConnected = inboxStatus?.connected === true;
  const hasDraft = !!draftBody;

  return (
    <AppLayout>
      <div className="rise" style={{ maxWidth: 960, margin: "0 auto" }}>
        <button
          onClick={() => navigate(isFromBoard ? "/board" : "/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: "var(--ink-soft)",
            fontSize: 13.5,
            marginBottom: 16,
            padding: 0,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>
            {isFromBoard ? `Apply to ${jobPosting.role_title}` : "New application"}
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
            {isFromBoard
              ? `Details pre-filled from ${jobPosting.company_name}'s posting.`
              : "Bring in the job description any way that's easiest."}
          </p>
        </div>

        {/* Two-column layout: Left = Max 640px Main Content, Right = 280px Sticky Rail */}
        <div
          style={{
            display: "flex",
            gap: 28,
            alignItems: "flex-start",
          }}
        >
          {/* Main Content Area (Max Width 640px) */}
          <div style={{ flex: 1, maxWidth: 640, minWidth: 0 }}>
            {error && (
              <div
                style={{
                  background: "var(--rust-bg)",
                  color: "var(--rust-fg)",
                  border: "1px solid var(--rust)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 20,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            {!hasDraft ? (
              /* Form State */
              <div
                style={{
                  background: "var(--paper-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 24,
                }}
              >
                {!isFromBoard && (
                  <SourceTabs source={source} setSource={setSource} />
                )}

                {!isFromBoard && source === "upload" && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    style={{
                      border: "1.5px dashed var(--line)",
                      borderRadius: 12,
                      padding: "24px 18px",
                      textAlign: "center",
                      marginBottom: 18,
                      cursor: "pointer",
                      background: "var(--paper)",
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e.target.files?.[0])}
                      accept=".pdf,.docx,.doc,image/*"
                      style={{ display: "none" }}
                    />
                    {fileState === "parsing" ? (
                      <p
                        style={{
                          fontSize: 13.5,
                          color: "var(--ink-soft)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Loader2
                          className="spin"
                          size={16}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                        Reading file and extracting text...
                      </p>
                    ) : fileState === "done" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          color: "var(--sage-fg)",
                        }}
                      >
                        <CheckCircle size={16} />
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                          JD extracted from file below
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload
                          size={20}
                          color="var(--ink-soft)"
                          style={{ marginBottom: 6, margin: "0 auto" }}
                        />
                        <p
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            marginTop: 6,
                          }}
                        >
                          Drop a PDF, DOCX, or screenshot
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          or click to browse
                        </p>
                      </>
                    )}
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 14,
                    }}
                  >
                    <Field
                      label="Company"
                      placeholder="e.g. Stripe"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      disabled={isFromBoard}
                      required
                    />
                    <Field
                      label="Role title"
                      placeholder="e.g. Software Engineer"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={isFromBoard}
                      required
                    />
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "var(--ink-soft)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Recruiter email
                      </span>
                      {email && detectedEmail && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: "var(--sage-bg)",
                            color: "var(--sage-fg)",
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 20,
                          }}
                        >
                          <CheckCircle size={10} /> Auto-detected from JD
                        </span>
                      )}
                      {!email && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: "var(--amber-bg)",
                            color: "var(--amber-fg)",
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 20,
                          }}
                        >
                          <AlertTriangle size={10} /> Not found — enter manually
                        </span>
                      )}
                    </div>
                    <input
                      type="email"
                      placeholder="recruiter@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setDetectedEmail(false);
                      }}
                      required
                      style={{
                        width: "100%",
                        border: "1.5px solid var(--line)",
                        background: "var(--paper)",
                        borderRadius: 8,
                        padding: "11px 14px",
                        fontSize: 14.5,
                        color: "var(--ink)",
                        outline: "none",
                      }}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "var(--rust)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "var(--line)")
                      }
                    />
                  </div>

                  <label style={{ display: "block" }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink-soft)",
                        marginBottom: 6,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Job description
                    </div>
                    <textarea
                      value={jd}
                      onChange={(e) => setJd(e.target.value)}
                      disabled={isFromBoard}
                      rows={9}
                      placeholder="Paste the job description text here..."
                      style={{
                        width: "100%",
                        border: "1.5px solid var(--line)",
                        background: "var(--paper)",
                        borderRadius: 8,
                        padding: 14,
                        fontSize: 14,
                        outline: "none",
                        resize: "vertical",
                        lineHeight: 1.6,
                        color: "var(--ink)",
                      }}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "var(--rust)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "var(--line)")
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      marginTop: 4,
                      background: "var(--rust)",
                      color: "var(--paper)",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 22px",
                      fontSize: 14.5,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      opacity: submitting ? 0.7 : 1,
                      width: "fit-content",
                    }}
                  >
                    {submitting ? (
                      <Loader2
                        className="spin"
                        size={15}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {submitting
                      ? "Drafting email with AI..."
                      : "Draft email with AI"}
                  </button>
                </form>
              </div>
            ) : (
              /* Draft Review State */
              <div
                style={{
                  background: "var(--paper-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Wand2 size={18} color="var(--rust)" />
                  <h2 style={{ fontSize: 20, fontWeight: 500 }}>
                    Draft ready — review before sending
                  </h2>
                </div>
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: 13.5,
                    marginBottom: 20,
                  }}
                >
                  Nothing sends until you click send below.
                </p>

                {/* Send success banner */}
                {sendSuccess && (
                  <div
                    style={{
                      background: "var(--sage-bg)",
                      color: "var(--sage-fg)",
                      border: "1px solid var(--sage-fg)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      marginBottom: 18,
                      fontSize: 13.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={16} />
                    Email sent successfully! Redirecting...
                  </div>
                )}

                {/* Connect inbox banner */}
                {!isInboxLoading && !isConnected && !sendSuccess && (
                  <div
                    style={{
                      background: "var(--amber-bg)",
                      border: "1px solid var(--amber-fg)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      marginBottom: 18,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Mail
                      size={20}
                      color="var(--amber-fg)"
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                          color: "var(--ink)",
                          marginBottom: 2,
                        }}
                      >
                        Connect Gmail to send
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                        We need access to send outreach on your behalf.
                      </div>
                    </div>
                    <button
                      onClick={handleConnectInbox}
                      style={{
                        background: "var(--ink)",
                        color: "var(--paper)",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 14px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <ExternalLink size={12} />
                      Connect
                    </button>
                  </div>
                )}

                {/* Connected indicator */}
                {!isInboxLoading && isConnected && !sendSuccess && (
                  <div
                    style={{
                      background: "var(--sage-bg)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      color: "var(--sage-fg)",
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={13} />
                    Sending from {inboxStatus.email}
                  </div>
                )}

                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      borderBottom: "1px solid var(--line)",
                      padding: "12px 16px",
                    }}
                  >
                    <input
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      placeholder="Email subject..."
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        fontSize: 15,
                        fontWeight: 600,
                        outline: "none",
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    rows={12}
                    placeholder="Email body content..."
                    style={{
                      width: "100%",
                      border: "none",
                      padding: 16,
                      fontSize: 14,
                      lineHeight: 1.65,
                      outline: "none",
                      resize: "vertical",
                      background: "transparent",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleSend}
                    disabled={
                      sending || sendSuccess || !isConnected || isInboxLoading
                    }
                    style={{
                      background: isConnected
                        ? "var(--rust)"
                        : "var(--ink-soft)",
                      color: "var(--paper)",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 22px",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor:
                        isConnected && !sending && !sendSuccess
                          ? "pointer"
                          : "not-allowed",
                      opacity: sending || sendSuccess || !isConnected ? 0.7 : 1,
                    }}
                  >
                    {sending ? (
                      <Loader2
                        className="spin"
                        size={15}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : sendSuccess ? (
                      <CheckCircle size={15} />
                    ) : (
                      <Send size={15} />
                    )}
                    {sending
                      ? "Sending..."
                      : sendSuccess
                      ? "Sent!"
                      : "Send from my inbox"}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={submitting || sending || sendSuccess}
                    style={{
                      background: "transparent",
                      color: "var(--ink)",
                      border: "1.5px solid var(--line)",
                      borderRadius: 8,
                      padding: "12px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    {submitting && (
                      <Loader2
                        className="spin"
                        size={15}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    )}
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 280px Sticky Right Rail (Contextual supporting cards) */}
          <div
            style={{
              width: 280,
              flexShrink: 0,
              position: "sticky",
              top: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* "Before you send" Checklist Card */}
            <div
              style={{
                background: "var(--paper-raised)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--ink-soft)",
                  marginBottom: 12,
                }}
              >
                Before you send
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 12.5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: email ? "var(--ink)" : "var(--ink-soft)",
                  }}
                >
                  <CheckCircle2
                    size={15}
                    color={email ? "var(--sage-fg)" : "var(--ink-soft)"}
                  />
                  <span>
                    {email ? (
                      <>
                        Recruiter confirmed:{" "}
                        <strong style={{ fontWeight: 600 }}>{email}</strong>
                      </>
                    ) : (
                      "Recruiter email pending"
                    )}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: resumeInfo ? "var(--ink)" : "var(--amber-fg)",
                  }}
                >
                  <Paperclip
                    size={15}
                    color={resumeInfo ? "var(--sage-fg)" : "var(--amber-fg)"}
                  />
                  {resumeInfo === undefined ? (
                    <span style={{ color: "var(--ink-soft)" }}>Checking resume…</span>
                  ) : resumeInfo ? (
                    <span>
                      Resume:{" "}
                      <strong style={{ fontWeight: 600 }}>
                        {resumeInfo.original_filename}
                      </strong>
                    </span>
                  ) : (
                    <span>
                      No resume —{" "}
                      <a
                        href="/profile"
                        style={{
                          color: "var(--amber-fg)",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        upload one
                      </a>
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--ink)",
                  }}
                >
                  <Sparkles size={15} color="var(--rust)" />
                  <span>Tone check: Professional & concise</span>
                </div>
              </div>
            </div>

            {/* "Sending Summary" Card */}
            <div
              style={{
                background: "var(--paper-raised)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--ink-soft)",
                  marginBottom: 10,
                }}
              >
                Target & Mailbox
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 12.5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    color: "var(--ink-soft)",
                  }}
                >
                  <Building2 size={14} />
                  <span>
                    Sending to{" "}
                    <strong style={{ color: "var(--ink)" }}>
                      {company || "Company"}
                    </strong>
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    color: "var(--ink-soft)",
                  }}
                >
                  <Mail size={14} />
                  <span>
                    From{" "}
                    <strong style={{ color: "var(--ink)" }}>
                      {isConnected ? inboxStatus.email : "Not connected"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
