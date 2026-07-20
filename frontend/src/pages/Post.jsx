import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { authFetch } from "../api.js";
import { TopBar, Field } from "../components/ui.jsx";
import AppLayout from "../components/AppLayout.jsx";
import { Loader2 } from "lucide-react";

export default function Post() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [jd, setJd] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      <div className="rise" style={{ maxWidth: 640 }}>
        <TopBar title="Post a job" subtitle="Share a referral opening with the community" />

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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
              rows={7}
              placeholder="Paste or write the job description details..."
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
              <Loader2 className="spin" size={15} style={{ animation: "spin 1s linear infinite" }} />
            )}
            Publish posting
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
