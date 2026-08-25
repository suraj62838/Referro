import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { authFetch } from "../api.js";
import { TopBar, Field } from "../components/ui.jsx";
import AppLayout from "../components/AppLayout.jsx";
import { Loader2, Pencil, Sparkles, Building2, MapPin } from "lucide-react";

export default function Post() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [jd, setJd] = useState("");

  const [mode, setMode] = useState("manual"); // "manual" | "ai"
  const [seniority, setSeniority] = useState("Mid-level");
  const [skills, setSkills] = useState("");
  const [notes, setNotes] = useState("");
  const [generatingJd, setGeneratingJd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateJd = async (e) => {
    e.preventDefault();
    if (!role.trim()) {
      setError("Role title is required to generate a job description.");
      return;
    }

    try {
      setGeneratingJd(true);
      setError("");

      const res = await authFetch(
        "/job-postings/generate-jd/",
        {
          method: "POST",
          body: JSON.stringify({
            role_title: role,
            seniority: seniority,
            key_skills: skills,
            notes: notes,
          }),
        },
        accessToken
      );

      if (res.ok) {
        const data = await res.json();
        setJd(data.jd_text || "");
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to generate job description.");
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setGeneratingJd(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      setError("Company name and Role title are required.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const res = await authFetch(
        "/job-postings/",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: company,
            role_title: role,
            location: location,
            recruiter_email: email,
            jd_text: jd,
            is_active: true,
          }),
        },
        accessToken
      );

      if (res.ok) {
        navigate("/board");
      } else {
        const errData = await res.json();
        const msg = Object.entries(errData)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        setError(msg || "Failed to publish job posting.");
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="rise" style={{ maxWidth: 960, margin: "0 auto" }}>
        <TopBar
          title="Post a job"
          subtitle="Share a referral opening with the community"
        />

        {/* 2-Column Layout */}
        <div
          style={{
            display: "flex",
            gap: 28,
            alignItems: "flex-start",
            marginTop: 20,
          }}
        >
          {/* Main Content Form (Max 640px) */}
          <div style={{ flex: 1, maxWidth: 640, minWidth: 0 }}>
            {/* Mode toggle */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 22,
                background: "var(--paper-raised)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 4,
                width: "fit-content",
              }}
            >
              {[
                ["manual", "Write manually", Pencil],
                ["ai", "Write with AI", Sparkles],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 16px",
                    borderRadius: 7,
                    border: "none",
                    background: mode === id ? "var(--ink)" : "transparent",
                    color: mode === id ? "var(--paper)" : "var(--ink)",
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {error && (
              <div
                style={{
                  background: "var(--rust-bg)",
                  color: "var(--rust-fg)",
                  border: "1px solid var(--rust)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 20,
                  fontSize: 14,
                }}
              >
                {error}
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
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
                <Field
                  label="Role title"
                  placeholder="e.g. Backend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                <Field
                  label="Location"
                  placeholder="e.g. Remote / Bangalore"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Field
                  label="Recruiter email (optional)"
                  placeholder="e.g. jobs@acme.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {mode === "ai" && (
                <div
                  style={{
                    background: "var(--paper-raised)",
                    border: "1.5px dashed var(--line)",
                    borderRadius: 12,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: "var(--rust)",
                    }}
                  >
                    <Sparkles size={15} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      AI will draft the JD from these inputs
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 14,
                    }}
                  >
                    <label style={{ display: "block" }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ink-soft)",
                          marginBottom: 6,
                          fontWeight: 600,
                        }}
                      >
                        Seniority
                      </div>
                      <select
                        value={seniority}
                        onChange={(e) => setSeniority(e.target.value)}
                        style={{
                          width: "100%",
                          border: "1.5px solid var(--line)",
                          background: "var(--paper)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          fontSize: 14,
                          outline: "none",
                          color: "var(--ink)",
                        }}
                      >
                        <option>Junior</option>
                        <option>Mid-level</option>
                        <option>Senior</option>
                        <option>Staff</option>
                      </select>
                    </label>
                    <Field
                      label="Key skills"
                      placeholder="e.g. Django, Postgres, AWS"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                  </div>
                  <label style={{ display: "block" }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft)",
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Anything else? (optional)
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. remote-first, small team, on-call rotation"
                      style={{
                        width: "100%",
                        border: "1.5px solid var(--line)",
                        background: "var(--paper)",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 14,
                        outline: "none",
                        resize: "vertical",
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
                    type="button"
                    onClick={handleGenerateJd}
                    disabled={generatingJd}
                    style={{
                      background: "var(--rust)",
                      color: "var(--paper)",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 18px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      opacity: generatingJd ? 0.7 : 1,
                      width: "fit-content",
                    }}
                  >
                    {generatingJd ? (
                      <Loader2
                        className="spin"
                        size={14}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {generatingJd ? "Generating..." : "Generate JD"}
                  </button>
                </div>
              )}

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
                  Job description {mode === "ai" && jd ? "(edit as needed)" : ""}
                </div>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  rows={7}
                  placeholder={
                    mode === "manual"
                      ? "Paste or write the job description details..."
                      : "Generated JD will appear here — edit freely"
                  }
                  style={{
                    width: "100%",
                    border: "1.5px solid var(--line)",
                    background: "var(--paper-raised)",
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 14,
                    outline: "none",
                    resize: "vertical",
                    lineHeight: 1.6,
                    color: "var(--ink)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--rust)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 10,
                  background: "var(--ink)",
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
                {submitting && (
                  <Loader2
                    className="spin"
                    size={15}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                )}
                Publish posting
              </button>
            </form>
          </div>

          {/* 280px Sticky Right Rail: Live Job Board Listing Preview */}
          <div
            style={{
              width: 280,
              flexShrink: 0,
              position: "sticky",
              top: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--ink-soft)",
              }}
            >
              Live Board Preview
            </div>

            {/* Mock Job Board Card */}
            <div
              style={{
                background: "var(--paper-raised)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15.5 }}>
                    {role || "Role title"}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Building2 size={13} /> {company || "Company name"}
                  </div>
                </div>
                <span
                  style={{
                    background: "var(--sage-bg)",
                    color: "var(--sage-fg)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 20,
                  }}
                >
                  Referral
                </span>
              </div>

              {location && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <MapPin size={12} /> {location}
                </div>
              )}

              {/* JD Preview */}
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-soft)",
                  marginTop: 10,
                  lineHeight: 1.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {jd || "Job description details will update live as you write or generate..."}
              </p>

              <button
                disabled
                style={{
                  marginTop: 14,
                  width: "100%",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
