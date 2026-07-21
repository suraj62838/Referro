/**
 * API helper — thin wrapper around fetch for backend calls.
 * Phase 0: basic setup pointing at Django dev server.
 * Phase 1: JWT header injection via auth context.
 * Phase 2: Added authFetch that auto-attaches the JWT from sessionStorage,
 *          plus typed helpers for CRUD endpoints.
 * Phase 3: Added authFetchMultipart for file uploads (FormData).
 * Phase 5: Added email account + send-email helpers.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

/**
 * Make a raw API request (no auth header).
 * @param {string} path - API path (e.g. "/health/")
 * @param {object} options - fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  return response;
}

/**
 * Make an authenticated API request.
 * Retrieves the access token from the AuthContext via a callback,
 * or falls back to a provided token.
 * @param {string} path
 * @param {object} options
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Response>}
 */
export async function authFetch(path, options = {}, accessToken = null) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { ...options, headers });
  return response;
}

/**
 * Make an authenticated multipart API request (for file uploads).
 * Does NOT set Content-Type — the browser auto-sets the boundary for FormData.
 * @param {string} path
 * @param {FormData} formData
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Response>}
 */
export async function authFetchMultipart(path, formData, accessToken = null) {
  const url = `${API_BASE}${path}`;
  const headers = {};

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  return response;
}

// ── Phase 5 helpers ───────────────────────────────────────────

/**
 * Check whether the current user has a connected email account.
 * @param {string} accessToken
 * @returns {Promise<{connected: boolean, email: string|null, provider: string|null}>}
 */
export async function checkEmailAccount(accessToken) {
  const res = await authFetch("/email-accounts/me/", {}, accessToken);
  if (res.ok) {
    return await res.json();
  }
  return { connected: false, email: null, provider: null };
}

/**
 * Get the OAuth authorization URL to connect Gmail.
 * @param {string} accessToken
 * @returns {Promise<string>} The Google OAuth URL to redirect to
 */
export async function getOAuthConnectUrl(accessToken) {
  const res = await authFetch("/email-accounts/oauth/connect/", {}, accessToken);
  if (res.ok) {
    const data = await res.json();
    return data.auth_url;
  }
  throw new Error("Failed to get OAuth connect URL");
}

/**
 * Send the reviewed email via the user's connected Gmail account.
 * @param {number} appId - Job application ID
 * @param {string} subject
 * @param {string} body
 * @param {string} accessToken
 * @returns {Promise<{success: boolean, thread_id: string, status: string}>}
 */
export async function sendEmail(appId, subject, body, accessToken) {
  const res = await authFetch(
    `/job-applications/${appId}/send-email/`,
    {
      method: "POST",
      body: JSON.stringify({ subject, body }),
    },
    accessToken
  );
  if (res.ok) {
    return await res.json();
  }
  const errData = await res.json();
  throw new Error(errData.detail || "Failed to send email");
}

export default apiFetch;
