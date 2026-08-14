/**
 * Authentication provider
 *
 * - Access token is kept in React state.
 * - Refresh token is stored in localStorage so login survives
 *   page refreshes and browser sessions.
 * - Access token is automatically refreshed periodically.
 * - Temporary network/server errors do NOT immediately log the user out.
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

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);

    localStorage.removeItem("referro_refresh");
    localStorage.removeItem("referro_user");
  }, []);

  // --------------------------------------------------
  // Refresh access token
  // --------------------------------------------------

  const performRefresh = useCallback(
    async (refreshToken) => {
      try {
        const res = await apiFetch("/auth/refresh/", {
          method: "POST",
          body: JSON.stringify({
            refresh: refreshToken,
          }),
        });

        // Refresh token is invalid/expired
        if (res.status === 401 || res.status === 403) {
          console.warn("Refresh token expired or invalid.");
          logout();
          return null;
        }

        // Server/network problem
        if (!res.ok) {
          console.warn(
            "Temporary refresh failure:",
            res.status
          );

          // IMPORTANT:
          // Do NOT logout the user here.
          return null;
        }

        const data = await res.json();

        if (!data.access) {
          console.warn("No access token received.");
          return null;
        }

        setAccessToken(data.access);

        // If refresh token rotation is enabled,
        // save the new refresh token.
        if (data.refresh) {
          localStorage.setItem(
            "referro_refresh",
            data.refresh
          );
        }

        return data.access;
      } catch (err) {
        console.error(
          "Temporary refresh/network error:",
          err
        );

        // IMPORTANT:
        // Do NOT logout on network errors.
        return null;
      }
    },
    [logout]
  );

  // --------------------------------------------------
  // Initialize authentication
  // --------------------------------------------------

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedRefresh =
          localStorage.getItem("referro_refresh");

        const storedUser =
          localStorage.getItem("referro_user");

        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (err) {
            console.error(
              "Failed to parse stored user:",
              err
            );

            localStorage.removeItem("referro_user");
          }
        }

        if (storedRefresh) {
          await performRefresh(storedRefresh);
        }
      } catch (err) {
        console.error(
          "Authentication initialization failed:",
          err
        );
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [performRefresh]);

  // --------------------------------------------------
  // Automatic token refresh
  // --------------------------------------------------

  useEffect(() => {
    if (!accessToken) return;

    // Refresh every 28 minutes
    const refreshInterval = 28 * 60 * 1000;

    const interval = setInterval(async () => {
      const storedRefresh =
        localStorage.getItem("referro_refresh");

      if (storedRefresh) {
        await performRefresh(storedRefresh);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [accessToken, performRefresh]);

  // --------------------------------------------------
  // Login
  // --------------------------------------------------

  const login = useCallback(async (email, password) => {
    const res = await apiFetch("/auth/login/", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!res.ok) {
      let errData = {};

      try {
        errData = await res.json();
      } catch {
        // Ignore invalid JSON error responses
      }

      throw new Error(
        errData.detail || "Invalid login credentials"
      );
    }

    const data = await res.json();

    setAccessToken(data.access);
    setUser(data.user);

    localStorage.setItem(
      "referro_refresh",
      data.refresh
    );

    localStorage.setItem(
      "referro_user",
      JSON.stringify(data.user)
    );

    return data.user;
  }, []);

  // --------------------------------------------------
  // Signup
  // --------------------------------------------------

  const signup = useCallback(async (email, password) => {
    const res = await apiFetch("/auth/signup/", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!res.ok) {
      let errData = {};

      try {
        errData = await res.json();
      } catch {
        // Ignore invalid JSON error responses
      }

      const message = Object.entries(errData)
        .map(
          ([field, msgs]) =>
            `${field}: ${Array.isArray(msgs)
              ? msgs.join(" ")
              : msgs
            }`
        )
        .join(" | ");

      throw new Error(
        message || "Signup failed"
      );
    }

    const data = await res.json();

    setAccessToken(data.access);
    setUser(data.user);

    localStorage.setItem(
      "referro_refresh",
      data.refresh
    );

    localStorage.setItem(
      "referro_user",
      JSON.stringify(data.user)
    );

    return data.user;
  }, []);

  // --------------------------------------------------
  // Email verification
  // --------------------------------------------------

  const confirmEmailVerification = useCallback(
    async (code) => {
      const {
        verifyEmail: apiVerifyEmail,
      } = await import("../api.js");

      const data = await apiVerifyEmail(
        code,
        accessToken
      );

      if (data.is_verified) {
        setUser((prevUser) => {
          const updated = {
            ...prevUser,
            is_verified: true,
          };

          localStorage.setItem(
            "referro_user",
            JSON.stringify(updated)
          );

          return updated;
        });
      }

      return data;
    },
    [accessToken]
  );

  // --------------------------------------------------
  // Resend verification code
  // --------------------------------------------------

  const triggerResendCode = useCallback(
    async () => {
      const {
        resendVerificationCode,
      } = await import("../api.js");

      return await resendVerificationCode(
        accessToken
      );
    },
    [accessToken]
  );

  const isAuthenticated = !!accessToken;

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        signup,
        confirmEmailVerification,
        triggerResendCode,
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

  if (!ctx) {
    throw new Error(
      "useAuth must be used within <AuthProvider>"
    );
  }

  return ctx;
}