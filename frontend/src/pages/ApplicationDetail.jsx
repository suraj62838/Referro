import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { authFetch } from "../api.js";
import { TopBar, StatusPill } from "../components/ui.jsx";
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
} from "lucide-react";

function TimelineRow({ icon: Icon, label, detail, active, highlight }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: highlight ? "var(--sage-fg)" : active ? "var(--ink)" : "var(--paper)",
          border: active ? "none" : "1.5px solid var(--line)",
        }}
      >
        <Icon size={15} color={active ? "var(--paper)" : "var(--ink-soft)"} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: active ? "var(--ink)" : "var(--ink-soft)" }}>
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{detail}</div>
      </div>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchApplication = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/job-applications/${id}/`, {}, accessToken);
      if (res.ok) {
        const data = await res.json();
        setApp(data);
      } else if (res.status === 404) {
        setError("Application not found.");
      } else {
        setError("Failed to load application details.");
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdating(true);
      const res = await authFetch(
        `/job-applications/${id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        },
        accessToken
      );
      if (res.ok) {
        const updated = await res.json();
        setApp(updated);
      } else {
        alert("Failed to update status.");
      }
    } catch {
      alert("Network error updating status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this application? This action cannot be undone.")) {
      return;
    }
    try {
      setDeleting(true);
      const res = await authFetch(
        `/job-applications/${id}/`,
        {
          method: "DELETE",
        },
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
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 100, color: "var(--ink-soft)", gap: 10 }}>
          <Loader2 className="spin" size={24} style={{ animation: "spin 1s linear infinite" }} />
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
          <button onClick={() => navigate("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 18, padding: 0 }}>
            <ArrowLeft size={15} /> Back to applications
          </button>
          <div style={{ background: "var(--rust-bg)", color: "var(--rust-fg)", border: "1px solid var(--rust)", borderRadius: 12, padding: "16px 20px", fontSize: 14 }}>
            {error}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!app) return null;

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
          <ArrowLeft size={15} /> All applications
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 500 }}>{app.role_title}</h1>
            <div style={{ color: "var(--ink-soft)", fontSize: 15, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Building2 size={14} /> {app.company_name}
            </div>
            {app.recruiter_email && (
              <div style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 4 }}>
                Recruiter: <a href={`mailto:${app.recruiter_email}`} style={{ color: "var(--rust)", textDecoration: "none" }}>{app.recruiter_email}</a>
              </div>
            )}
          </div>
          <StatusPill status={app.status} />
        </div>

        {/* Timeline representation */}
        <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
          <TimelineRow icon={Send} label="Email sent" detail={`Applied on ${formatDate(app.created_at)}`} active />
          
          {(app.status === "replied" || app.status === "interview") && (
            <TimelineRow icon={Inbox} label="HR replied" detail="Response received" active highlight />
          )}

          {app.status === "interview" && (
            <TimelineRow icon={CheckCircle2} label="Interview scheduled" detail="In progress" active />
          )}

          {app.status === "rejected" && (
            <TimelineRow icon={XCircle} label="Application closed" detail="Rejected" active />
          )}

          {app.status === "sent" && (
            <TimelineRow icon={Clock} label="Awaiting reply" detail="No response detected yet" />
          )}
        </div>

        {/* Update Status Actions */}
        <div
          style={{
            background: "var(--paper-raised)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Update Application Status</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              ["sent", "Sent", "var(--amber-bg)", "var(--amber-fg)"],
              ["replied", "Replied", "var(--sage-bg)", "var(--sage-fg)"],
              ["interview", "Interview", "var(--ink-bg)", "var(--ink-fg)"],
              ["rejected", "Closed", "var(--rust-bg)", "var(--rust-fg)"],
            ].map(([val, label, bg, fg]) => (
              <button
                key={val}
                disabled={updating || app.status === val}
                onClick={() => handleStatusChange(val)}
                style={{
                  background: app.status === val ? bg : "transparent",
                  color: app.status === val ? fg : "var(--ink)",
                  border: app.status === val ? `1px solid ${fg}` : "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  opacity: updating ? 0.7 : 1,
                  cursor: app.status === val ? "default" : "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Job Description details */}
        {app.jd_text && (
          <div
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 22,
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Job Description
            </h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--ink-soft)" }}>
              {app.jd_text}
            </p>
          </div>
        )}

        {/* Danger Zone / Delete */}
        <div
          style={{
            border: "1px solid var(--rust-bg)",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(184, 75, 42, 0.03)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--rust-fg)" }}>Danger Zone</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Permanently delete this job application.</div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: "var(--rust)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? (
              <Loader2 className="spin" size={15} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Trash2 size={15} />
            )}
            Delete Application
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
