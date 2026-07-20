/**
 * Reusable UI primitives matching App.jsx prototype.
 * TopBar, StatusPill, Field.
 */

import {
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ── Status definitions ──────────────────────────────────────── */

export const STATUS_STYLE = {
  sent: { bg: "var(--amber-bg)", fg: "var(--amber-fg)", label: "Sent", icon: Clock },
  replied: { bg: "var(--sage-bg)", fg: "var(--sage-fg)", label: "Replied", icon: Mail },
  interview: { bg: "var(--ink-bg)", fg: "var(--ink-fg)", label: "Interview", icon: CheckCircle2 },
  rejected: { bg: "var(--rust-bg)", fg: "var(--rust-fg)", label: "Closed", icon: XCircle },
};

/* ── TopBar ───────────────────────────────────────────────────── */

export function TopBar({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 28,
      }}
    >
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 500 }}>{title}</h1>
        {subtitle && (
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginTop: 4 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ── StatusPill ────────────────────────────────────────────────── */

export function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.sent;
  const Icon = s.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: s.bg,
        color: s.fg,
        fontSize: 12,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 20,
      }}
    >
      <Icon size={12} /> {s.label}
    </span>
  );
}

/* ── Field ─────────────────────────────────────────────────────── */

export function Field({ label, placeholder, type = "text", value, onChange, ...rest }) {
  return (
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
        {label}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          border: "1.5px solid var(--line)",
          background: "var(--paper-raised)",
          borderRadius: 8,
          padding: "11px 14px",
          fontSize: 14.5,
          color: "var(--ink)",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--rust)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
        {...rest}
      />
    </label>
  );
}
