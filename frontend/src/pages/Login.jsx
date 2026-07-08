import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Send, ArrowUpRight } from "lucide-react";

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
        --ink-bg: #23241F;
        --ink-fg: #F6F1E6;
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
      .job-app input, .job-app textarea, .job-app select { font-family: 'Karla', sans-serif; }
      .underline-grow { position: relative; }
      .underline-grow::after {
        content: ''; position: absolute; left: 0; bottom: -2px; height: 1.5px; width: 0%;
        background: var(--rust); transition: width .25s ease;
      }
      .underline-grow:hover::after { width: 100%; }
    `}</style>
  );
}

function Logo({ size = 22 }) {
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
          justify: "center",
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

function Field({ label, placeholder, type = "text", value, onChange }) {
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
        required
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
      />
    </label>
  );
}

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="job-app" style={{ minHeight: "100vh", display: "flex" }}>
      <GlobalStyle />
      <div className="grain" />
      <div
        style={{
          flex: "1 1 46%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 64px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <form
          className="rise"
          onSubmit={handleSubmit}
          style={{ maxWidth: 360, margin: "0 auto", width: "100%" }}
        >
          <Logo size={26} />
          <h1
            style={{
              fontSize: 32,
              marginTop: 36,
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            {mode === "login" ? "Welcome back." : "Start applying."}
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 15, marginBottom: 32 }}>
            {mode === "login"
              ? "Sign in to pick up where you left off."
              : "One account. Every application, tracked."}
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

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field
              label="Email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 24,
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
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              "Please wait..."
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}{" "}
            <ArrowUpRight size={16} />
          </button>

          <p
            style={{
              marginTop: 22,
              fontSize: 14,
              color: "var(--ink-soft)",
              textAlign: "center",
            }}
          >
            {mode === "login" ? "New here? " : "Already have an account? "}
            <span
              className="underline-grow"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              style={{
                color: "var(--rust)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </span>
          </p>
        </form>
      </div>

      <div
        style={{
          flex: "1 1 54%",
          background: "var(--ink)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(184,75,42,0.35), transparent 45%), radial-gradient(circle at 80% 75%, rgba(79,109,79,0.3), transparent 45%)",
          }}
        />
        <div
          className="rise"
          style={{ position: "relative", zIndex: 1, maxWidth: 420, padding: 40 }}
        >
          <p
            className="display"
            style={{
              color: "var(--paper)",
              fontSize: 30,
              lineHeight: 1.35,
              fontWeight: 500,
            }}
          >
            "Every JD becomes a letter worth reading — and every reply, worth
            seeing."
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 20 }}>
            {[
              ["148", "Emails sent"],
              ["37", "Replies"],
              ["9", "Interviews"],
            ].map(([n, l]) => (
              <div key={l}>
                <div
                  className="display"
                  style={{
                    color: "var(--paper)",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                >
                  {n}
                </div>
                <div style={{ color: "rgba(246,241,230,0.6)", fontSize: 12.5 }}>
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
