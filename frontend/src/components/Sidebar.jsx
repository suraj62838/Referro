/**
 * Sidebar — persistent navigation matching App.jsx prototype.
 * Shows Applications, Job board, Post a job, and user info.
 */

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  LayoutGrid,
  Briefcase,
  Plus,
  Send,
  LogOut,
} from "lucide-react";

function Logo({ size = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

const NAV_ITEMS = [
  { path: "/dashboard", label: "Applications", icon: LayoutGrid },
  { path: "/board", label: "Job board", icon: Briefcase },
  { path: "/post", label: "Post a job", icon: Plus },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userInitial = user?.email ? user.email[0].toUpperCase() : "?";

  return (
    <div
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: "1px solid var(--line)",
        padding: "26px 18px",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: "0 8px" }}>
        <Logo />
      </div>

      <div
        style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 3 }}
      >
        {NAV_ITEMS.map((it) => {
          const active =
            location.pathname === it.path ||
            (location.pathname.startsWith("/application/") && it.path === "/dashboard") ||
            (location.pathname === "/apply" && it.path === "/board");
          const Icon = it.icon;
          return (
            <button
              key={it.path}
              id={`nav-${it.path.slice(1)}`}
              onClick={() => navigate(it.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--paper)" : "var(--ink)",
                fontSize: 14.5,
                fontWeight: 500,
                textAlign: "left",
                transition: "background .15s ease",
              }}
            >
              <Icon size={17} strokeWidth={2} /> {it.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--line)",
          paddingTop: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 12px",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--rust-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--rust-fg)",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email || "User"}
            </div>
          </div>
          <LogOut
            size={15}
            onClick={handleLogout}
            style={{ color: "var(--ink-soft)", cursor: "pointer", flexShrink: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
