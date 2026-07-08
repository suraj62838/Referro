import React, { useState } from "react";
import {
  Mail, Briefcase, Send, Plus, LogOut, Search, Sparkles, ChevronRight,
  Clock, CheckCircle2, XCircle, ArrowUpRight, Building2, MapPin, FileText,
  X, ArrowLeft, LayoutGrid, Inbox, Wand2, Pencil, ChevronDown, Bell, User,
  ClipboardPaste, Upload, CheckCircle, AlertTriangle
} from "lucide-react";

const FONT_IMPORT = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Karla:wght@400;500;600;700&display=swap";

const COMPANIES = [
  { id: 1, company: "Northlane Data", role: "Backend Engineer", location: "Remote", tags: ["Django", "Postgres", "AWS"], postedBy: "referral" },
  { id: 2, company: "Verdant Robotics", role: "Frontend Engineer", location: "Bangalore", tags: ["React", "TypeScript"], postedBy: "referral" },
  { id: 3, company: "Fieldstone Labs", role: "Full Stack Developer", location: "Remote", tags: ["Python", "React", "Docker"], postedBy: "referral" },
  { id: 4, company: "Circuit & Vine", role: "Platform Engineer", location: "Hyderabad", tags: ["Kubernetes", "Go"], postedBy: "referral" },
];

const APPLICATIONS = [
  { id: 1, company: "Meridian Systems", role: "Software Engineer II", status: "replied", sentDate: "Jul 2", lastActivity: "Reply received Jul 5" },
  { id: 2, company: "Northlane Data", role: "Backend Engineer", status: "sent", sentDate: "Jul 6", lastActivity: "Awaiting response" },
  { id: 3, company: "Amberwood Tech", role: "Full Stack Developer", status: "interview", sentDate: "Jun 28", lastActivity: "Interview scheduled Jul 12" },
  { id: 4, company: "Palisade Cloud", role: "DevOps Engineer", status: "rejected", sentDate: "Jun 20", lastActivity: "Closed Jun 30" },
  { id: 5, company: "Ridgeline AI", role: "ML Engineer", status: "sent", sentDate: "Jul 7", lastActivity: "Awaiting response" },
];

const STATUS_STYLE = {
  sent: { bg: "var(--amber-bg)", fg: "var(--amber-fg)", label: "Sent", icon: Clock },
  replied: { bg: "var(--sage-bg)", fg: "var(--sage-fg)", label: "Replied", icon: Mail },
  interview: { bg: "var(--ink-bg)", fg: "var(--ink-fg)", label: "Interview", icon: CheckCircle2 },
  rejected: { bg: "var(--rust-bg)", fg: "var(--rust-fg)", label: "Closed", icon: XCircle },
};

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
      .card-hover { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
      .card-hover:hover { transform: translateY(-2px); border-color: var(--rust); box-shadow: 0 8px 20px -12px rgba(35,36,31,0.35); }
      .underline-grow { position: relative; }
      .underline-grow::after {
        content: ''; position: absolute; left: 0; bottom: -2px; height: 1.5px; width: 0%;
        background: var(--rust); transition: width .25s ease;
      }
      .underline-grow:hover::after { width: 100%; }
      .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
      .scrollbar-thin::-webkit-scrollbar-thumb { background: var(--line); border-radius: 3px; }
    `}</style>
  );
}

function Logo({ size = 22 }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{
        width: size, height: size, background: "var(--ink)", borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>
        <Send size={size * 0.55} color="var(--paper)" strokeWidth={2} />
      </div>
      <span className="display" style={{ fontSize: 19, fontWeight: 600 }}>Referro</span>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  return (
    <div className="job-app" style={{ minHeight: "100vh", display: "flex" }}>
      <div className="grain" />
      <div style={{ flex: "1 1 46%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px", position: "relative", zIndex: 1 }}>
        <div className="rise" style={{ maxWidth: 360, margin: "0 auto", width: "100%" }}>
          <Logo size={26} />
          <h1 style={{ fontSize: 32, marginTop: 36, marginBottom: 6, fontWeight: 500 }}>
            {mode === "login" ? "Welcome back." : "Start applying."}
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 15, marginBottom: 32 }}>
            {mode === "login" ? "Sign in to pick up where you left off." : "One account. Every application, tracked."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && (
              <Field label="Full name" placeholder="Ada Sharma" />
            )}
            <Field label="Email" placeholder="you@example.com" />
            <Field label="Password" placeholder="••••••••" type="password" />
          </div>

          <button
            onClick={onAuth}
            style={{
              marginTop: 24, width: "100%", background: "var(--ink)", color: "var(--paper)",
              border: "none", borderRadius: 8, padding: "13px 0", fontSize: 15, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            {mode === "login" ? "Sign in" : "Create account"} <ArrowUpRight size={16} />
          </button>

          <p style={{ marginTop: 22, fontSize: 14, color: "var(--ink-soft)", textAlign: "center" }}>
            {mode === "login" ? "New here? " : "Already have an account? "}
            <span
              className="underline-grow"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ color: "var(--rust)", fontWeight: 600, cursor: "pointer" }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </span>
          </p>
        </div>
      </div>

      <div style={{
        flex: "1 1 54%", background: "var(--ink)", position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(184,75,42,0.35), transparent 45%), radial-gradient(circle at 80% 75%, rgba(79,109,79,0.3), transparent 45%)"
        }} />
        <div className="rise" style={{ position: "relative", zIndex: 1, maxWidth: 420, padding: 40 }}>
          <p className="display" style={{ color: "var(--paper)", fontSize: 30, lineHeight: 1.35, fontWeight: 500 }}>
            "Every JD becomes a letter worth reading — and every reply, worth seeing."
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 20 }}>
            {[["148", "Emails sent"], ["37", "Replies"], ["9", "Interviews"]].map(([n, l]) => (
              <div key={l}>
                <div className="display" style={{ color: "var(--paper)", fontSize: 22, fontWeight: 600 }}>{n}</div>
                <div style={{ color: "rgba(246,241,230,0.6)", fontSize: 12.5 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, type = "text" }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <input
        type={type}
        placeholder={placeholder}
        style={{
          width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)",
          borderRadius: 8, padding: "11px 14px", fontSize: 14.5, color: "var(--ink)", outline: "none"
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--rust)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
      />
    </label>
  );
}

function Sidebar({ view, setView, onLogout }) {
  const items = [
    { id: "dashboard", label: "Applications", icon: LayoutGrid },
    { id: "board", label: "Job board", icon: Briefcase },
    { id: "post", label: "Post a job", icon: Plus },
  ];
  return (
    <div style={{
      width: 232, flexShrink: 0, borderRight: "1px solid var(--line)", padding: "26px 18px",
      display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0
    }}>
      <div style={{ padding: "0 8px" }}><Logo /></div>
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((it) => {
          const active = view === it.id || (view === "detail" && it.id === "dashboard") || (view === "apply" && it.id === "board");
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
                border: "none", background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--paper)" : "var(--ink)", fontSize: 14.5, fontWeight: 500,
                textAlign: "left", transition: "background .15s ease"
              }}
            >
              <Icon size={17} strokeWidth={2} /> {it.label}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--rust-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rust-fg)", fontWeight: 700, fontSize: 13 }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Ada Sharma</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>ada@mail.com</div>
          </div>
          <LogOut size={15} onClick={onLogout} style={{ color: "var(--ink-soft)" }} />
        </div>
      </div>
    </div>
  );
}

function TopBar({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 500 }}>{title}</h1>
        {subtitle && <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.fg,
      fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20
    }}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

function Dashboard({ setView, setSelectedApp }) {
  const counts = APPLICATIONS.reduce((acc, a) => ((acc[a.status] = (acc[a.status] || 0) + 1), acc), {});
  return (
    <div className="rise">
      <TopBar
        title="Your applications"
        subtitle={`${APPLICATIONS.length} tracked · ${counts.replied || 0} replies waiting on you`}
        action={
          <button onClick={() => setView("board")} style={{
            background: "var(--rust)", color: "var(--paper)", border: "none", borderRadius: 8,
            padding: "10px 18px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6
          }}><Plus size={16} /> New application</button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          ["Sent", counts.sent || 0, "var(--amber-bg)", "var(--amber-fg)"],
          ["Replied", counts.replied || 0, "var(--sage-bg)", "var(--sage-fg)"],
          ["Interview", counts.interview || 0, "var(--ink-bg)", "var(--ink-fg)"],
          ["Closed", counts.rejected || 0, "var(--rust-bg)", "var(--rust-fg)"],
        ].map(([label, n, bg, fg]) => (
          <div key={label} style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px" }}>
            <div className="display" style={{ fontSize: 26, fontWeight: 600 }}>{n}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ background: bg, color: fg, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {APPLICATIONS.map((app, i) => (
          <div
            key={app.id}
            onClick={() => { setSelectedApp(app); setView("detail"); }}
            className="card-hover"
            style={{
              display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
              borderTop: i === 0 ? "none" : "1px solid var(--line)", cursor: "pointer", borderLeft: "3px solid transparent"
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}><Building2 size={18} color="var(--ink-soft)" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{app.role}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{app.company}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", width: 170, flexShrink: 0 }}>{app.lastActivity}</div>
            <StatusPill status={app.status} />
            <ChevronRight size={16} color="var(--ink-soft)" />
          </div>
        ))}
      </div>
    </div>
  );
}

function JobBoard({ setView, setSelectedJob }) {
  return (
    <div className="rise">
      <TopBar
        title="Job board"
        subtitle="Referral postings from the community"
        action={
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--ink-soft)" }} />
            <input placeholder="Search roles, companies..." style={{
              border: "1px solid var(--line)", background: "var(--paper-raised)", borderRadius: 8,
              padding: "9px 14px 9px 34px", fontSize: 13.5, width: 240, outline: "none"
            }} />
          </div>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {COMPANIES.map((job) => (
          <div key={job.id} className="card-hover" style={{
            background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 12, padding: 20
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16.5 }}>{job.role}</div>
                <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                  <Building2 size={13} /> {job.company}
                </div>
              </div>
              <span style={{ background: "var(--sage-bg)", color: "var(--sage-fg)", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>Referral</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 12, display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={13} /> {job.location}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {job.tags.map((t) => (
                <span key={t} style={{ fontSize: 11.5, border: "1px solid var(--line)", padding: "3px 9px", borderRadius: 20, color: "var(--ink-soft)" }}>{t}</span>
              ))}
            </div>
            <button
              onClick={() => { setSelectedJob(job); setView("apply"); }}
              style={{
                marginTop: 16, width: "100%", background: "var(--ink)", color: "var(--paper)", border: "none",
                borderRadius: 8, padding: "9px 0", fontSize: 13.5, fontWeight: 600
              }}
            >Apply</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCK_JD_FROM_FILE = `Backend Engineer — Fieldstone Labs

We're growing our platform team and looking for someone comfortable owning services end-to-end. You'll work with Python, Postgres, and Docker.

Reach out to hiring@fieldstonelabs.com with your background.`;

function SourceTabs({ source, setSource }) {
  const tabs = [
    ["paste", "Paste text", ClipboardPaste],
    ["upload", "Upload file", Upload],
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 10, padding: 4, width: "fit-content" }}>
      {tabs.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => setSource(id)}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 7, border: "none",
            background: source === id ? "var(--ink)" : "transparent", color: source === id ? "var(--paper)" : "var(--ink)",
            fontSize: 13.5, fontWeight: 600
          }}
        ><Icon size={14} /> {label}</button>
      ))}
    </div>
  );
}

function EmailField({ email, setEmail, detected }) {
  return (
    <label>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Recruiter email</span>
        {email && detected && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "var(--sage-bg)", color: "var(--sage-fg)", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>
            <CheckCircle size={10} /> Detected from JD
          </span>
        )}
        {!email && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "var(--amber-bg)", color: "var(--amber-fg)", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>
            <AlertTriangle size={10} /> Not found — enter manually
          </span>
        )}
      </div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recruiter@company.com" style={{
        width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)",
        borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none"
      }} />
    </label>
  );
}

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function ApplyFlow({ selectedJob, setView }) {
  const [stage, setStage] = useState("form"); // form -> review
  const isFromBoard = !!selectedJob;
  const [source, setSource] = useState("paste");
  const [jd, setJd] = useState(selectedJob ? `We're looking for a ${selectedJob.role} to join ${selectedJob.company}. You'll work across ${selectedJob.tags.join(", ")}, collaborating closely with a small, senior team.` : "");
  const [email, setEmail] = useState(selectedJob ? "careers@" + selectedJob.company.toLowerCase().replace(/[^a-z]/g, "") + ".com" : "");
  const [fileState, setFileState] = useState("idle"); // idle -> parsing -> done

  if (stage === "review") {
    return <EmailReview onBack={() => setStage("form")} onSend={() => setView("dashboard")} company={selectedJob?.company || "the company"} />;
  }

  const handleFileDrop = () => {
    setFileState("parsing");
    setTimeout(() => {
      setJd(MOCK_JD_FROM_FILE);
      setEmail(extractEmail(MOCK_JD_FROM_FILE));
      setFileState("done");
    }, 800);
  };

  return (
    <div className="rise" style={{ maxWidth: 640 }}>
      <button onClick={() => setView(isFromBoard ? "board" : "dashboard")} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-soft)",
        fontSize: 13.5, marginBottom: 18, padding: 0
      }}><ArrowLeft size={15} /> Back</button>

      <h1 style={{ fontSize: 25, fontWeight: 500, marginBottom: 4 }}>{isFromBoard ? `Apply to ${selectedJob.role}` : "New application"}</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 22 }}>
        {isFromBoard ? "Job details are pre-filled from the posting — edit anything before generating your email." : "Bring in the job description any way that's easiest."}
      </p>

      {!isFromBoard && <SourceTabs source={source} setSource={setSource} />}

      {!isFromBoard && source === "upload" && (
        <div
          onClick={handleFileDrop}
          style={{
            border: "1.5px dashed var(--line)", borderRadius: 12, padding: "28px 20px", textAlign: "center",
            marginBottom: 18, cursor: "pointer", background: "var(--paper-raised)"
          }}
        >
          {fileState === "parsing" ? (
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>Reading file and extracting text...</p>
          ) : fileState === "done" ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "var(--sage-fg)" }}>
              <CheckCircle size={16} /><span style={{ fontSize: 13.5, fontWeight: 600 }}>JD extracted from file below</span>
            </div>
          ) : (
            <>
              <Upload size={20} color="var(--ink-soft)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13.5, fontWeight: 600 }}>Drop a PDF, DOCX, or screenshot</p>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 3 }}>or click to browse</p>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <label>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Job description</div>
          <textarea
            value={jd}
            onChange={(e) => { setJd(e.target.value); if (!isFromBoard) setEmail(extractEmail(e.target.value)); }}
            rows={7}
            style={{
              width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)",
              borderRadius: 8, padding: 14, fontSize: 14, outline: "none", resize: "vertical", lineHeight: 1.6
            }}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Company</div>
            <input defaultValue={selectedJob?.company || ""} style={{
              width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)",
              borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none"
            }} />
          </label>
          <EmailField email={email} setEmail={setEmail} detected={!!email} />
        </div>
      </div>

      <button
        onClick={() => setStage("review")}
        style={{
          marginTop: 26, background: "var(--rust)", color: "var(--paper)", border: "none", borderRadius: 8,
          padding: "12px 22px", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8
        }}
      ><Sparkles size={16} /> Draft email with AI</button>
    </div>
  );
}

function EmailReview({ onBack, onSend, company }) {
  const [subject, setSubject] = useState(`Application for the role at ${company}`);
  const [body, setBody] = useState(
`Hi there,

I came across the opening at ${company} and wanted to reach out directly. The scope of the role lines up closely with what I've been building over the past few years, and I'd welcome the chance to talk through how I could contribute.

I've attached my resume for context. Happy to share more detail on any of the projects mentioned.

Best,
Ada`
  );
  return (
    <div className="rise" style={{ maxWidth: 640 }}>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-soft)",
        fontSize: 13.5, marginBottom: 18, padding: 0
      }}><ArrowLeft size={15} /> Back to details</button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Wand2 size={17} color="var(--rust)" />
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Draft ready — review before sending</h1>
      </div>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 22 }}>Nothing sends until you approve it.</p>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ borderBottom: "1px solid var(--line)", padding: "12px 18px" }}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{
            width: "100%", border: "none", background: "transparent", fontSize: 15, fontWeight: 600, outline: "none"
          }} />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={11}
          style={{ width: "100%", border: "none", padding: 18, fontSize: 14.5, lineHeight: 1.7, outline: "none", resize: "vertical", background: "transparent" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onSend} style={{
          background: "var(--rust)", color: "var(--paper)", border: "none", borderRadius: 8,
          padding: "12px 22px", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8
        }}><Send size={15} /> Send from my inbox</button>
        <button style={{
          background: "transparent", color: "var(--ink)", border: "1.5px solid var(--line)", borderRadius: 8,
          padding: "12px 22px", fontSize: 14.5, fontWeight: 600
        }}>Regenerate</button>
      </div>
    </div>
  );
}

function PostJob({ setView }) {
  const [mode, setMode] = useState("manual");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [seniority, setSeniority] = useState("Mid-level");
  const [notes, setNotes] = useState("");
  const [jd, setJd] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setJd(`We're hiring a ${seniority} ${role || "Software Engineer"} to join our team. You'll work primarily with ${skills || "our core stack"}, owning features end-to-end alongside a small, senior group. ${notes ? notes + " " : ""}We move quickly, write things down, and care more about judgment than years of experience.`);
      setGenerating(false);
    }, 900);
  };

  return (
    <div className="rise" style={{ maxWidth: 640 }}>
      <TopBar title="Post a job" subtitle="Share a referral opening with the community" />

      <div style={{ display: "flex", gap: 8, marginBottom: 22, background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[["manual", "Write manually", Pencil], ["ai", "Write with AI", Sparkles]].map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 7, border: "none",
              background: mode === id ? "var(--ink)" : "transparent", color: mode === id ? "var(--paper)" : "var(--ink)",
              fontSize: 13.5, fontWeight: 600
            }}
          ><Icon size={14} /> {label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <label>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Company</div>
          <input style={{ width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }} />
        </label>
        <label>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Role title</div>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend Engineer" style={{ width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }} />
        </label>
      </div>

      {mode === "ai" ? (
        <div style={{ background: "var(--paper-raised)", border: "1.5px dashed var(--line)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16, color: "var(--rust)" }}>
            <Sparkles size={15} /><span style={{ fontSize: 13, fontWeight: 700 }}>AI will draft the JD from these inputs</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <label>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600 }}>Seniority</div>
              <select value={seniority} onChange={(e) => setSeniority(e.target.value)} style={{ width: "100%", border: "1.5px solid var(--line)", background: "var(--paper)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}>
                <option>Junior</option><option>Mid-level</option><option>Senior</option><option>Staff</option>
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600 }}>Key skills</div>
              <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Django, Postgres, AWS" style={{ width: "100%", border: "1.5px solid var(--line)", background: "var(--paper)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }} />
            </label>
          </div>
          <label>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600 }}>Anything else? (optional)</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. remote-first, small team, on-call rotation" style={{ width: "100%", border: "1.5px solid var(--line)", background: "var(--paper)", borderRadius: 8, padding: 12, fontSize: 14, outline: "none", resize: "vertical" }} />
          </label>
          <button onClick={generate} disabled={generating} style={{
            marginTop: 14, background: "var(--rust)", color: "var(--paper)", border: "none", borderRadius: 8,
            padding: "10px 18px", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, opacity: generating ? 0.7 : 1
          }}><Sparkles size={14} /> {generating ? "Generating..." : "Generate JD"}</button>
        </div>
      ) : null}

      <label>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Job description {mode === "ai" && jd ? "(edit as needed)" : ""}
        </div>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={7}
          placeholder={mode === "manual" ? "Write the job description..." : "Generated JD will appear here — edit freely"}
          style={{ width: "100%", border: "1.5px solid var(--line)", background: "var(--paper-raised)", borderRadius: 8, padding: 14, fontSize: 14, outline: "none", resize: "vertical", lineHeight: 1.6 }}
        />
      </label>

      <button onClick={() => setView("board")} style={{
        marginTop: 22, background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 8,
        padding: "12px 22px", fontSize: 14.5, fontWeight: 600
      }}>Publish posting</button>
    </div>
  );
}

function ApplicationDetail({ app, setView }) {
  if (!app) return null;
  const s = STATUS_STYLE[app.status];
  return (
    <div className="rise" style={{ maxWidth: 640 }}>
      <button onClick={() => setView("dashboard")} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-soft)",
        fontSize: 13.5, marginBottom: 18, padding: 0
      }}><ArrowLeft size={15} /> All applications</button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500 }}>{app.role}</h1>
          <div style={{ color: "var(--ink-soft)", fontSize: 14.5, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={14} /> {app.company}
          </div>
        </div>
        <StatusPill status={app.status} />
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 12, padding: 4 }}>
        <TimelineRow icon={Send} label="Email sent" detail={app.sentDate} active />
        {(app.status === "replied" || app.status === "interview") && (
          <TimelineRow icon={Inbox} label="HR replied" detail={app.lastActivity} active highlight />
        )}
        {app.status === "interview" && (
          <TimelineRow icon={CheckCircle2} label="Interview scheduled" detail="Jul 12, 3:00 PM" active />
        )}
        {app.status === "rejected" && (
          <TimelineRow icon={XCircle} label="Application closed" detail="Jun 30" active />
        )}
        {app.status === "sent" && (
          <TimelineRow icon={Clock} label="Awaiting reply" detail="No response yet" />
        )}
      </div>

      {app.status === "replied" && (
        <div style={{ marginTop: 18, background: "var(--sage-bg)", border: "1px solid var(--sage-fg)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, color: "var(--sage-fg)" }}>
            <Mail size={14} /><span style={{ fontSize: 12.5, fontWeight: 700 }}>Reply from HR</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)" }}>
            "Thanks for reaching out — your background looks like a strong fit. Could you share your availability for a quick call this week?"
          </p>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ icon: Icon, label, detail, active, highlight }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: highlight ? "var(--sage-fg)" : active ? "var(--ink)" : "var(--paper)",
        border: active ? "none" : "1.5px solid var(--line)"
      }}>
        <Icon size={15} color={active ? "var(--paper)" : "var(--ink-soft)"} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: active ? "var(--ink)" : "var(--ink-soft)" }}>{label}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{detail}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("dashboard");
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  if (!authed) return (<><GlobalStyle /><AuthScreen onAuth={() => setAuthed(true)} /></>);

  return (
    <div className="job-app" style={{ display: "flex", minHeight: "100vh" }}>
      <GlobalStyle />
      <Sidebar view={view} setView={setView} onLogout={() => setAuthed(false)} />
      <div className="scrollbar-thin" style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
        {view === "dashboard" && <Dashboard setView={setView} setSelectedApp={setSelectedApp} />}
        {view === "board" && <JobBoard setView={setView} setSelectedJob={setSelectedJob} />}
        {view === "apply" && <ApplyFlow selectedJob={selectedJob} setView={setView} />}
        {view === "post" && <PostJob setView={setView} />}
        {view === "detail" && <ApplicationDetail app={selectedApp} setView={setView} />}
      </div>
    </div>
  );
}
