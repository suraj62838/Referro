/**
 * Dashboard — list of the user's applications.
 * Phase 0: placeholder.
 * Phase 1: welcome user and add logout button.
 */

import { useAuth } from "../auth/AuthContext.jsx";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div
      style={{
        padding: 40,
        fontFamily: "sans-serif",
        lineHeight: 1.6,
        color: "#23241f",
      }}
    >
      <h1 style={{ marginBottom: 12 }}>Dashboard (Placeholder)</h1>
      <p style={{ marginBottom: 6 }}>
        Welcome, <strong>{user?.email}</strong>!
      </p>
      <p style={{ color: "#5b5b52", marginBottom: 24 }}>
        Your applications list will be built here in Phase 2.
      </p>
      <button
        onClick={logout}
        style={{
          padding: "10px 18px",
          background: "#23241f",
          color: "#f6f1e6",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}
