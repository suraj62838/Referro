/**
 * Root App component with React Router.
 * All routes except /login are wrapped in RequireAuth (route guard).
 * Default route redirects to /dashboard.
 */

import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Board from "./pages/Board.jsx";
import Apply from "./pages/Apply.jsx";
import Post from "./pages/Post.jsx";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes — redirect to /login if no valid JWT */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/board"
        element={
          <RequireAuth>
            <Board />
          </RequireAuth>
        }
      />
      <Route
        path="/apply"
        element={
          <RequireAuth>
            <Apply />
          </RequireAuth>
        }
      />
      <Route
        path="/post"
        element={
          <RequireAuth>
            <Post />
          </RequireAuth>
        }
      />

      {/* Catch-all: redirect to dashboard (which itself redirects to login if unauthenticated) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
