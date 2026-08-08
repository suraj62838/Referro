/**
 * Route guard — redirects to /login if no valid JWT.
 * Handles the loading state of initial token recovery.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#5b5b52" }}>
        Loading authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Gate unverified users to /verify-email
  if (!user?.is_verified && location.pathname !== "/verify-email") {
    return <Navigate to="/verify-email" replace />;
  }

  // If already verified and trying to access /verify-email, go to dashboard
  if (user?.is_verified && location.pathname === "/verify-email") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
