import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Send, ArrowUpRight, CheckCircle2, RefreshCw } from "lucide-react";

const FONT_IMPORT =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Karla:wght@400;500;600;700&display=swap";

function GlobalStyle() {
  return (
    <style>{`
      @import url('${FONT_IMPORT}');
      .job-app {
        --paper: #F6F1E6;
        --paper-raised: #FCFAF3;
        --ink: #23241F;
        --ink-soft: #5B5B52;
        --rust: #B84B2A;
        --rust-dark: #8F3A20;
        --rust-bg: #F2DCD2;
        --rust-fg: #8F3A20;
        --sage: #4F6D4F;
        --sage-bg: #DEE7D6;
        --sage-fg: #3C5A3C;
        --amber-bg: #F1E3C2;
        --amber-fg: #7A5A19;
        --line: #DCD4C0;
        font-family: 'Karla', sans-serif;
        color: var(--ink);
        background: var(--paper);
        min-height: 100%;
        position: relative;
      }
      .job-app h1, .job-app h2, .job-app h3, .job-app .display {
        font-family: 'Fraunces', serif;
        letter-spacing: -0.01em;
      }
      .job-app ::selection { background: var(--rust); color: var(--paper); }
      .grain {
        position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E");
      }
      @keyframes riseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .rise { animation: riseIn 0.5s cubic-bezier(.2,.7,.3,1) both; }
      .job-app button { font-family: 'Karla', sans-serif; cursor: pointer; }
      .job-app input { font-family: 'Karla', sans-serif; }
    `}</style>
  );
}

function Logo({ size = 26 }) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: "var(--ink)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Send size={size * 0.55} color="var(--paper)" strokeWidth={2} />
      </div>
      <span className="display" style={{ fontSize: 19, fontWeight: 600 }}>
        Referro
      </span>
    </div>
  );
}

export default function VerifyEmail() {
  const { user, confirmEmailVerification, triggerResendCode, logout } = useAuth();
  const navigate = useNavigate();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  const inputsRef = useRef([]);

  // 60-second timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    // Handle paste or single digit typing
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split("");
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      inputsRef.current[nextIndex]?.focus();
    } else {
      newDigits[index] = value;
      setDigits(newDigits);

      if (value && index < 5) {
        inputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits of the code.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      await confirmEmailVerification(code);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError("");
    setMessage("");
    setResending(true);

    try {
      await triggerResendCode();
      setMessage("A new 6-digit code has been sent to your email.");
      setCooldown(60);
    } catch (err) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="job-app" style={{ minHeight: "100vh", display: "flex" }}>
      <GlobalStyle />
      <div className="grain" />
      <div
        style={{
          flex: "1 1 100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="rise"
          style={{
            maxWidth: 440,
            width: "100%",
            background: "var(--paper-raised)",
            border: "1.5px solid var(--line)",
            borderRadius: 16,
            padding: "40px 36px",
            boxShadow: "0 4px 20px rgba(35, 36, 31, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <Logo size={24} />
            <button
              onClick={logout}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                color: "var(--ink-soft)",
                textDecoration: "underline",
              }}
            >
              Sign out
            </button>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
            Check your email.
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5, lineHeight: 1.5, marginBottom: 28 }}>
            We've sent a 6-digit verification code to{" "}
            <strong style={{ color: "var(--ink)" }}>{user?.email || "your email address"}</strong>.
            <br />
            <span style={{ fontSize: 13, color: "var(--ink-soft)", opacity: 0.85, marginTop: 6, display: "block" }}>
              Please check your <strong>Spam/Junk folder</strong> if it doesn't appear in your Inbox.
            </span>
          </p>

          {error && (
            <div
              style={{
                background: "var(--rust-bg)",
                color: "var(--rust-fg)",
                border: "1px solid var(--rust)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13.5,
                marginBottom: 20,
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                background: "var(--sage-bg)",
                color: "var(--sage-fg)",
                border: "1px solid var(--sage)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13.5,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                marginBottom: 28,
              }}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputsRef.current[idx] = el)}
                  type="text"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  style={{
                    width: 46,
                    height: 54,
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: 600,
                    fontFamily: "'Fraunces', serif",
                    color: "var(--ink)",
                    background: "var(--paper)",
                    border: "1.5px solid var(--line)",
                    borderRadius: 10,
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--rust)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || digits.join("").length !== 6}
              style={{
                width: "100%",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 8,
                padding: "13px 0",
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading || digits.join("").length !== 6 ? 0.6 : 1,
              }}
            >
              {loading ? "Verifying..." : "Verify email"}{" "}
              <ArrowUpRight size={16} />
            </button>
          </form>

          <div
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 14,
              color: "var(--ink-soft)",
            }}
          >
            Didn't receive a code?{" "}
            {cooldown > 0 ? (
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                Resend in {cooldown}s
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--rust)",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {resending ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Sending...
                  </>
                ) : (
                  "Resend code"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
