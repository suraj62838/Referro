/**
 * Auth provider implementing an in-memory + refresh-token strategy.
 * - Access token is kept strictly in-memory (React state) to prevent XSS.
 * - Refresh token is persisted in sessionStorage (survives page refresh within the tab session).
 * - On app initialization, a silent refresh is performed if a refresh token is present.
 * - Auto-refresh runs periodically to keep the access token valid.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import apiFetch from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem("referro_refresh");
    sessionStorage.removeItem("referro_user");
  }, []);

  // Silent refresh helper
  const performRefresh = useCallback(
    async (refreshToken) => {
      try {
        const res = await apiFetch("/auth/refresh/", {
          method: "POST",
          body: JSON.stringify({ refresh: refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.access);
          if (data.refresh) {
            sessionStorage.setItem("referro_refresh", data.refresh);
          }
          return data.access;
        } else {
          logout();
          return null;
        }
      } catch (err) {
        console.error("Failed to refresh token:", err);
        logout();
        return null;
      }
    },
    [logout]
  );

  // Initialize: attempt silent refresh if refresh token exists in sessionStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedRefresh = sessionStorage.getItem("referro_refresh");
      const storedUser = sessionStorage.getItem("referro_user");
      if (storedRefresh) {
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        await performRefresh(storedRefresh);
      }
      setLoading(false);
    };
    initAuth();
  }, [performRefresh]);

  // Set up periodic automatic silent refresh (e.g. every 28 minutes for a 30min token)
  useEffect(() => {
    if (!accessToken) return;

    const refreshInterval = 28 * 60 * 1000;
    const interval = setInterval(() => {
      const storedRefresh = sessionStorage.getItem("referro_refresh");
      if (storedRefresh) {
        performRefresh(storedRefresh);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [accessToken, performRefresh]);

  const login = useCallback(async (email, password) => {
    const res = await apiFetch("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Invalid login credentials");
    }

    const data = await res.json();
    setAccessToken(data.access);
    setUser(data.user);
    sessionStorage.setItem("referro_refresh", data.refresh);
    sessionStorage.setItem("referro_user", JSON.stringify(data.user));
    return data.user;
  }, []);

  const signup = useCallback(async (email, password) => {
    const res = await apiFetch("/auth/signup/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errData = await res.json();
      const message = Object.entries(errData)
        .map(
          ([field, msgs]) =>
            `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`
        )
        .join(" | ");
      throw new Error(message || "Signup failed");
    }

    const data = await res.json();
    setAccessToken(data.access);
    setUser(data.user);
    sessionStorage.setItem("referro_refresh", data.refresh);
    sessionStorage.setItem("referro_user", JSON.stringify(data.user));
    return data.user;
  }, []);

  const isAuthenticated = !!accessToken;

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        signup,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
