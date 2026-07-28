/**
 * ApplicationDetail — full detail view for a job application.
 * Phase 6: Enhanced with timeline, reply display, sent email card,
 *          and manual status update buttons.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { checkApplicationReplies, fetchApplicationDetail, updateApplicationStatus } from "../api.js";
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
} from "lucide-react";

/* ── TimelineRow ─────────────────────────────────────────────── */

function TimelineRow({ icon: Icon, label, detail, active, highlight, isLast }) {
  return (
    <div style={{ display: "flex", gap: 14, position: "relative" }}>
      {/* Vertical connector line */}
      {!isLast && (
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 34,
            bottom: -14,
            width: 2,
            background: active ? "var(--line)" : "var(--line)",
            opacity: 0.5,
          }}
        />
      )}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
        <div
          style={{
            width: 34,
            height: 34,
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
            size={15}
            color={active || highlight ? "var(--paper)" : "var(--ink-soft)"}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: active ? "var(--ink)" : "var(--ink-soft)",
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ReplyCard ────────────────────────────────────────────────── */

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
          .replace(/<a\b[^>]*href=["']?([^"'\s>]+)[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
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
  return String(children).split(/(https?:\/\/[^\s<>()]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noreferrer" style={{ color: "var(--rust)" }}>
        {part}
      </a>
    ) : part
  );
}

function ReplyCard({ reply }) {
  const message = cleanEmailText(reply.body || reply.snippet) || "(No preview available)";

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

  return (
    <div
      style={{
        background: "var(--paper-raised)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 18px",
        marginBottom: 10,
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
              fontSize: 13.5,
              color: "var(--ink)",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            <EmailText>{message}</EmailText>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-soft)",
              marginTop: 6,
            }}
          >
            {formatDate(reply.received_at)}
          </div>
        </div>
      </div>
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
      // Re-fetch full detail to get updated nested data
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
            className="spin"
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

  // 1. Email sent step
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

  // 2. Reply steps
  if (hasReplies) {
    replyLogs.slice().reverse().forEach((reply, i) => {
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

  // 3. Current status step
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

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <AppLayout>
      <div className="rise" style={{ maxWidth: 640 }}>
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
            marginBottom: 18,
            padding: 0,
          }}
        >
          <ArrowLeft size={15} /> All applications
        </button>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 26,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 500 }}>{app.role_title}</h1>
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
            {app.recruiter_email && (
              <div
                style={{
                  color: "var(--ink-soft)",
                  fontSize: 13.5,
                  marginTop: 4,
                }}
              >
                Recruiter:{" "}
                <a
                  href={`mailto:${app.recruiter_email}`}
                  style={{ color: "var(--rust)", textDecoration: "none" }}
                >
                  {app.recruiter_email}
                </a>
              </div>
            )}
          </div>
          <StatusPill status={app.status} />
        </div>

        {/* ── Timeline ───────────────────────────────────────── */}
        <div
          style={{
            background: "var(--paper-raised)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "4px 0",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "12px 20px 8px",
              fontSize: 12.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
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

        {/* ── Replies section ────────────────────────────────── */}
        {hasReplies && (
          <div
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
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
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Replies ({replyLogs.length})
              </h3>
            </div>
            {replyLogs.map((reply) => (
              <ReplyCard key={reply.id} reply={reply} />
            ))}
          </div>
        )}

        {/* ── Sent email card ────────────────────────────────── */}
        {sentEmail && (
          <div
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 22,
              marginBottom: 24,
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
              <Send size={15} color="var(--ink-soft)" />
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Outreach Email
              </h3>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                marginBottom: 10,
              }}
            >
              Sent {formatDateTime(sentEmail.sent_at)}
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14.5,
                marginBottom: 8,
              }}
            >
              {sentEmail.subject}
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                color: "var(--ink-soft)",
                padding: "12px 14px",
                background: "var(--paper)",
                borderRadius: 8,
                border: "1px solid var(--line)",
                maxHeight: 260,
                overflow: "auto",
              }}
              className="scrollbar-thin"
            >
              <EmailText>{cleanEmailText(sentEmail.body)}</EmailText>
            </div>
          </div>
        )}

        {/* ── Update Status Actions ──────────────────────────── */}
        <div
          style={{
            background: "var(--paper-raised)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Update Application Status
          </h3>
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
                  border:
                    app.status === val
                      ? `1px solid ${fg}`
                      : "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  opacity: updating ? 0.7 : 1,
                  cursor: app.status === val ? "default" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Job Description details ────────────────────────── */}
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
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Job Description
            </h3>
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                color: "var(--ink-soft)",
              }}
            >
              {app.jd_text}
            </p>
          </div>
        )}

        {/* ── Danger Zone / Delete ────────────────────────────── */}
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
            <div
              style={{
                fontWeight: 600,
                fontSize: 14.5,
                color: "var(--rust-fg)",
              }}
            >
              Danger Zone
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              Permanently delete this job application.
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
              <Loader2
                className="spin"
                size={15}
                style={{ animation: "spin 1s linear infinite" }}
              />
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
