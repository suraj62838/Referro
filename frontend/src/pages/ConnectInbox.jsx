import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { getOAuthConnectUrl } from "../api.js";
import AppLayout from "../components/AppLayout.jsx";
import { Mail, Loader2, ExternalLink, Shield } from "lucide-react";

/**
 * ConnectInbox — standalone page at /connect-inbox.
 *
 * Shows a "Connect your Gmail" CTA. Clicking the button:
 * 1. Calls GET /api/email-accounts/oauth/connect/ to get the auth URL
 * 2. Redirects the current tab to Google's OAuth consent screen
 * 3. After consent, Google redirects to Django callback which redirects
 *    back to /dashboard?connected=1
 */
export default function ConnectInbox() {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError("");
      const authUrl = await getOAuthConnectUrl(accessToken);
      // Redirect the current tab to Google's OAuth consent screen
      window.location.href = authUrl;
    } catch (err) {
      setError(err.message || "Failed to start OAuth flow.");
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="rise" style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--rust-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Mail size={32} color="var(--rust)" />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 8 }}>
          Connect your Gmail
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14.5, lineHeight: 1.7, marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
          Referro sends outreach emails from <strong>your real mailbox</strong> so
          recruiter replies land right in your inbox. We only request send and
          read-only access — nothing else.
        </p>

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

        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            background: "var(--rust)",
            color: "var(--paper)",
            border: "none",
            borderRadius: 10,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? (
            <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <ExternalLink size={17} />
          )}
          {loading ? "Redirecting to Google..." : "Connect Gmail account"}
        </button>

        {/* Trust badges */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--ink-soft)", fontSize: 13 }}>
            <Shield size={14} />
            <span>OAuth 2.0 — we never see or store your password</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--ink-soft)", fontSize: 13 }}>
            <Shield size={14} />
            <span>Tokens encrypted at rest with Fernet (AES-128)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--ink-soft)", fontSize: 13 }}>
            <Shield size={14} />
            <span>Gmail-only for now — Outlook coming soon</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
