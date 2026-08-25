import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  checkApplicationReplies,
  draftReply,
  fetchApplicationDetail,
  sendReply,
  updateApplicationStatus,
} from "../api.js";
import { StatusPill } from "../components/ui.jsx";
import AppLayout from "../components/AppLayout.jsx";
import {
  ArrowLeft,
  Building2,
  Send,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Loader2,
  Mail,
  Sparkles,
  Edit3,
  FileText,
  Calendar,
} from "lucide-react";

/* ── TimelineRow ─────────────────────────────────────────────── */

function TimelineRow({ icon: Icon, label, detail, active, highlight, isLast }) {
  return (
    <div style={{ display: "flex", gap: 14, position: "relative" }}>
      {!isLast && (
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 34,
            bottom: -14,
            width: 2,
            background: "var(--line)",
            opacity: 0.5,
          }}
        />
      )}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: highlight
              ? "var(--sage-fg)"
              : active
              ? "var(--ink)"
              : "var(--paper)",
            border: active ? "none" : "1.5px solid var(--line)",
            zIndex: 1,
          }}
        >
          <Icon
            size={14}
            color={active || highlight ? "var(--paper)" : "var(--ink-soft)"}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: active ? "var(--ink)" : "var(--ink-soft)",
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function cleanEmailText(value) {
  let text = String(value || "").trim();

  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.body === "string") text = parsed.body;
    } catch {
      const body = text.match(/"body"\s*:\s*("(?:\\.|[^"])*")\s*[,}]?\s*$/s);
      if (body) {
        try {
          text = JSON.parse(body[1]);
        } catch {
          // Normal email text is not JSON.
        }
      }
    }

    const decoded = new DOMParser()
      .parseFromString(
        text
          .replace(
            /<a\b[^>]*href=["']?([^"'\s>]+)[^>]*>(.*?)<\/a>/gi,
            "$2 ($1)"
          )
          .replace(/<\s*br\s*\/?>|<\/?(?:p|div|li|tr|h[1-6])\b[^>]*>/gi, "\n"),
        "text/html"
      )
      .body.textContent;
    if (decoded === text) break;
    text = decoded;
  }

  return text
    .replace(/\s+On\s[\s\S]{0,200}?\swrote:\s*[\s\S]*$/i, "")
    .replace(/\n[-_]{3,}\s*(?:Original|Forwarded) Message[\s\S]*$/i, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function EmailText({ children }) {
  return String(children)
    .split(/(https?:\/\/[^\s<>()]+)/g)
    .map((part, index) =>
      /^https?:\/\//.test(part) ? (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--rust)" }}
        >
          {part}
        </a>
      ) : (
        part
      )
    );
}

/* ── ReplyCard ───────────────────────────────────────────────── */

function ReplyCard({
  reply,
  appId,
  accessToken,
  onReplySent,
  roleTitle,
  companyName,
}) {
  const [composing, setComposing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const message =
    cleanEmailText(reply.body || reply.snippet) || "(No preview available)";

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleStartManual = () => {
    setSubject(`Re: Application for ${roleTitle} at ${companyName}`);
    setBody("");
    setError("");
    setComposing(true);
  };

  const handleStartAIDraft = async () => {
    try {
      setDrafting(true);
      setError("");
      setComposing(true);
      setSubject(`Re: Application for ${roleTitle} at ${companyName}`);
      setBody("");
      const draft = await draftReply(appId, reply.id, accessToken);
      setSubject(
        draft.subject || `Re: Application for ${roleTitle} at ${companyName}`
      );
      setBody(draft.body || "");
    } catch (err) {
      setError(err.message || "Failed to generate AI reply draft.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSendReply = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    try {
      setSending(true);
      setError("");
      await sendReply(
        appId,
        reply.id,
        subject.trim(),
        body.trim(),
        accessToken
      );
      setComposing(false);
      if (onReplySent) onReplySent();
    } catch (err) {
      setError(err.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--paper-raised)",
        border: reply.responded
          ? "1px solid var(--sage-fg)"
          : "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 12,
        transition: "border-color 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              {formatDate(reply.received_at)}
            </span>
            {reply.responded && (
              <span
                id={`responded-badge-${reply.id}`}
                style={{
                  background: "var(--sage-bg)",
                  color: "var(--sage-fg)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CheckCircle2 size={12} /> Responded
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: "var(--ink)",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            <EmailText>{message}</EmailText>
          </div>
        </div>
      </div>

      {!composing && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid var(--line)",
          }}
        >
          <button
            id={`reply-manual-btn-${reply.id}`}
            onClick={handleStartManual}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Edit3 size={12} /> Write manually
          </button>

          <button
            id={`reply-ai-btn-${reply.id}`}
            onClick={handleStartAIDraft}
            disabled={drafting}
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 6,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {drafting ? (
              <Loader2
                size={12}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Sparkles size={12} />
            )}
            Draft with AI
          </button>
        </div>
      )}

      {composing && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--line)",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              marginBottom: 8,
              color: "var(--ink)",
            }}
          >
            Replying to recruiter:
          </div>

          {error && (
            <div
              style={{
                background: "var(--rust-bg)",
                color: "var(--rust-fg)",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}

          {drafting && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--ink-soft)",
                marginBottom: 10,
              }}
            >
              <Loader2
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Drafting reply with AI...
            </div>
          )}

          {!drafting && (
            <>
              <div style={{ marginBottom: 8 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    marginBottom: 4,
                  }}
                >
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line..."
                  id={`reply-subject-input-${reply.id}`}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    fontSize: 13,
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--paper)",
                  }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    marginBottom: 4,
                  }}
                >
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your reply..."
                  rows={5}
                  id={`reply-body-input-${reply.id}`}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: 13,
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--paper)",
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />
              </div>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  disabled={sending}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "var(--ink-soft)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id={`send-reply-btn-${reply.id}`}
                  onClick={handleSendReply}
                  disabled={sending}
                  style={{
                    background: "var(--rust)",
                    color: "var(--paper)",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {sending ? (
                    <Loader2
                      size={13}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    <Send size={13} />
                  )}
                  Send reply
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadApplication = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApplicationDetail(id, accessToken);
      setApp(data);
    } catch (err) {
      setError(err.message || "Failed to load application details.");
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  useEffect(() => {
    const synchronizeReplies = async () => {
      try {
        await checkApplicationReplies(id, accessToken);
        setApp(await fetchApplicationDetail(id, accessToken));
      } catch {
        // Do not interrupt the page when background synchronization fails.
      }
    };

    synchronizeReplies();
    const interval = setInterval(synchronizeReplies, 30000);
    return () => clearInterval(interval);
  }, [id, accessToken]);

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdating(true);
      await updateApplicationStatus(id, newStatus, accessToken);
      const full = await fetchApplicationDetail(id, accessToken);
      setApp(full);
    } catch (err) {
      alert(err.message || "Failed to update status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this application? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      setDeleting(true);
      const { authFetch } = await import("../api.js");
      const res = await authFetch(
        `/job-applications/${id}/`,
        { method: "DELETE" },
        accessToken
      );
      if (res.ok) {
        navigate("/dashboard");
      } else {
        alert("Failed to delete application.");
      }
    } catch {
      alert("Network error deleting application.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ── Loading / Error states ──────────────────────────────── */

  if (loading) {
    return (
      <AppLayout>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 100,
            color: "var(--ink-soft)",
            gap: 10,
          }}
        >
          <Loader2
            size={24}
            style={{ animation: "spin 1s linear infinite" }}
          />
          Loading application details...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="rise" style={{ maxWidth: 640 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: "var(--ink-soft)",
              fontSize: 13.5,
              marginBottom: 18,
              padding: 0,
            }}
          >
            <ArrowLeft size={15} /> Back to applications
          </button>
          <div
            style={{
              background: "var(--rust-bg)",
              color: "var(--rust-fg)",
              border: "1px solid var(--rust)",
              borderRadius: 12,
              padding: "16px 20px",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!app) return null;

  /* ── Derived data ────────────────────────────────────────── */

  const emailLogs = app.email_logs || [];
  const replyLogs = app.reply_logs || [];
  const sentEmail = emailLogs.length > 0 ? emailLogs[0] : null;
  const hasReplies = replyLogs.length > 0;

  /* ── Build timeline steps ────────────────────────────────── */

  const timelineSteps = [];

  if (sentEmail) {
    timelineSteps.push({
      icon: Send,
      label: "Email sent",
      detail: `Sent on ${formatDate(sentEmail.sent_at)} · "${sentEmail.subject}"`,
      active: true,
      highlight: false,
    });
  } else {
    timelineSteps.push({
      icon: Send,
      label: "Application created",
      detail: `Created on ${formatDate(app.created_at)}`,
      active: true,
      highlight: false,
    });
  }

  if (hasReplies) {
    replyLogs
      .slice()
      .reverse()
      .forEach((reply, i) => {
        timelineSteps.push({
          icon: Inbox,
          label: i === 0 ? "HR replied" : `Follow-up reply`,
          detail: reply.snippet
            ? `${cleanEmailText(reply.body || reply.snippet).substring(0, 80)}${cleanEmailText(reply.body || reply.snippet).length > 80 ? "…" : ""}`
            : `Reply received ${formatDate(reply.received_at)}`,
          active: true,
          highlight: true,
        });
      });
  }

  if (app.status === "interview") {
    timelineSteps.push({
      icon: CheckCircle2,
      label: "Interview scheduled",
      detail: "In progress",
      active: true,
      highlight: false,
    });
  } else if (app.status === "rejected") {
    timelineSteps.push({
      icon: XCircle,
      label: "Application closed",
      detail: "Rejected",
      active: true,
      highlight: false,
    });
  } else if (app.status === "sent") {
    timelineSteps.push({
      icon: Clock,
      label: "Awaiting reply",
      detail: "No response detected yet",
      active: false,
      highlight: false,
    });
  }

  const STATUS_PILLS = [
    ["sent", "Sent", "var(--amber-bg)", "var(--amber-fg)"],
    ["replied", "Replied", "var(--sage-bg)", "var(--sage-fg)"],
    ["interview", "Interview", "var(--ink-bg)", "var(--ink-fg)"],
    ["rejected", "Closed", "var(--rust-bg)", "var(--rust-fg)"],
  ];

  return (
    <AppLayout>
      <div className="rise" style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
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
          <ArrowLeft size={15} /> All applications
        </button>

        {/* 2-Column Layout */}
        <div
          style={{
            display: "flex",
            gap: 28,
            alignItems: "flex-start",
          }}
        >
          {/* Main Content (Max 640px) */}
          <div style={{ flex: 1, maxWidth: 640, minWidth: 0 }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 500 }}>
                  {app.role_title}
                </h1>
                <div
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: 15,
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Building2 size={14} /> {app.company_name}
                </div>
              </div>
              <StatusPill status={app.status} />
            </div>

            {/* Timeline */}
            <div
              style={{
                background: "var(--paper-raised)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "4px 0",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  padding: "12px 18px 6px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--ink-soft)",
                }}
              >
                Timeline
              </div>
              {timelineSteps.map((step, i) => (
                <TimelineRow
                  key={i}
                  icon={step.icon}
                  label={step.label}
                  detail={step.detail}
                  active={step.active}
                  highlight={step.highlight}
                  isLast={i === timelineSteps.length - 1}
                />
              ))}
            </div>

            {/* Replies section */}
            {hasReplies && (
              <div
                style={{
                  background: "var(--paper-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 18,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <Mail size={16} color="var(--sage-fg)" />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                    Replies ({replyLogs.length})
                  </h3>
                </div>
                {replyLogs.map((reply) => (
                  <ReplyCard
                    key={reply.id}
                    reply={reply}
                    appId={app.id}
                    accessToken={accessToken}
                    onReplySent={loadApplication}
                    roleTitle={app.role_title}
                    companyName={app.company_name}
                  />
                ))}
              </div>
            )}

            {/* Sent email card */}
            {sentEmail && (
              <div
                style={{
                  background: "var(--paper-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Send size={15} color="var(--ink-soft)" />
                  <h3 style={{ fontSize: 15.5, fontWeight: 600 }}>
                    Outreach Email
                  </h3>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                  }}
                >
                  Sent {formatDateTime(sentEmail.sent_at)}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  {sentEmail.subject}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    color: "var(--ink-soft)",
                    padding: "12px 14px",
                    background: "var(--paper)",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    maxHeight: 240,
                    overflow: "auto",
                  }}
                  className="scrollbar-thin"
                >
                  <EmailText>{cleanEmailText(sentEmail.body)}</EmailText>
                </div>
              </div>
            )}

            {/* Job Description */}
            {app.jd_text && (
              <div
                style={{
                  background: "var(--paper-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--ink-soft)",
                  }}
                >
                  Job Description
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    color: "var(--ink-soft)",
                  }}
                >
                  {app.jd_text}
                </p>
              </div>
            )}

            {/* Danger Zone / Delete */}
            <div
              style={{
                border: "1px solid var(--rust-bg)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(184, 75, 42, 0.03)",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--rust-fg)",
                  }}
                >
                  Danger Zone
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                  Delete this job application permanently.
                </div>
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: "var(--rust)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? (
                  <Loader2
                    size={14}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete Application
              </button>
            </div>
          </div>

          {/* 280px Sticky Right Rail */}
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
            {/* Compact Status Switcher */}
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
                Status Switcher
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {STATUS_PILLS.map(([val, label, bg, fg]) => {
                  const active = app.status === val;
                  return (
                    <button
                      key={val}
                      disabled={updating || active}
                      onClick={() => handleStatusChange(val)}
                      style={{
                        background: active ? bg : "var(--paper)",
                        color: active ? fg : "var(--ink)",
                        border: active
                          ? `1px solid ${fg}`
                          : "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        textAlign: "center",
                        opacity: updating ? 0.7 : 1,
                        cursor: active ? "default" : "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Facts Card */}
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
                Quick Facts
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Mail
                    size={14}
                    color="var(--ink-soft)"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                      Recruiter Email
                    </div>
                    {app.recruiter_email ? (
                      <a
                        href={`mailto:${app.recruiter_email}`}
                        style={{
                          color: "var(--rust)",
                          textDecoration: "none",
                          fontWeight: 600,
                          wordBreak: "break-all",
                        }}
                      >
                        {app.recruiter_email}
                      </a>
                    ) : (
                      <span style={{ color: "var(--ink-soft)" }}>Not specified</span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <FileText
                    size={14}
                    color="var(--sage-fg)"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                      Attached Resume
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--sage-fg)" }}>
                      Active resume attached
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Send
                    size={14}
                    color="var(--ink-soft)"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                      Sending Mailbox
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                      Connected Gmail
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Calendar
                    size={14}
                    color="var(--ink-soft)"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                      Created Date
                    </div>
                    <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                      {formatDate(app.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
