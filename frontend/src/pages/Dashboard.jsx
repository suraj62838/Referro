/**
 * Dashboard — list of the user's applications, backed by the real API.
 * Matches the Dashboard component from the App.jsx prototype.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { authFetch } from "../api.js";
import { TopBar, StatusPill } from "../components/ui.jsx";
import AppLayout from "../components/AppLayout.jsx";
import {
  Plus,
  Building2,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function Dashboard() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/job-applications/", {}, accessToken);
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      } else {
        setError("Failed to load applications.");
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const counts = applications.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const statusCards = [
    ["Sent", counts.sent || 0, "var(--amber-bg)", "var(--amber-fg)"],
    ["Replied", counts.replied || 0, "var(--sage-bg)", "var(--sage-fg)"],
    ["Interview", counts.interview || 0, "var(--ink-bg)", "var(--ink-fg)"],
    ["Closed", counts.rejected || 0, "var(--rust-bg)", "var(--rust-fg)"],
  ];

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const lastActivityText = (app) => {
    if (app.status === "replied") return "Reply received";
    if (app.status === "interview") return "Interview scheduled";
    if (app.status === "rejected") return "Closed";
    return "Awaiting response";
  };

  return (
    <AppLayout>
      <div className="rise">
        <TopBar
          title="Your applications"
          subtitle={`${applications.length} tracked · ${counts.replied || 0} replies waiting on you`}
          action={
            <button
              id="new-application-btn"
              onClick={() => navigate("/board")}
              style={{
                background: "var(--rust)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={16} /> New application
            </button>
          }
        />

        {/* Status summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {statusCards.map(([label, n, bg, fg]) => (
            <div
              key={label}
              style={{
                background: "var(--paper-raised)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div className="display" style={{ fontSize: 26, fontWeight: 600 }}>
                {n}
              </div>
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    background: bg,
                    color: fg,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 20,
                  }}
                >
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Loading / Error / Empty states */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 60,
              color: "var(--ink-soft)",
              gap: 10,
            }}
          >
            <Loader2 size={20} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            Loading applications...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
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
        )}

        {!loading && !error && applications.length === 0 && (
          <div
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "48px 20px",
              textAlign: "center",
            }}
          >
            <Building2 size={32} color="var(--ink-soft)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              No applications yet
            </p>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 18 }}>
              Head to the job board and start applying.
            </p>
            <button
              onClick={() => navigate("/board")}
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 8,
                padding: "10px 22px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Browse job board
            </button>
          </div>
        )}

        {/* Application list */}
        {!loading && !error && applications.length > 0 && (
          <div
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {applications.map((app, i) => (
              <div
                key={app.id}
                onClick={() => navigate(`/application/${app.id}`)}
                className="card-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  cursor: "pointer",
                  borderLeft: "3px solid transparent",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={18} color="var(--ink-soft)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{app.role_title}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                    {app.company_name}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                    width: 170,
                    flexShrink: 0,
                  }}
                >
                  {lastActivityText(app)} · {formatDate(app.created_at)}
                </div>
                <StatusPill status={app.status} />
                <ChevronRight size={16} color="var(--ink-soft)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
