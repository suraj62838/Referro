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

// ── Phase 6 helpers ───────────────────────────────────────────

/**
 * Fetch full application detail including email_logs and reply_logs.
 * @param {number} appId - Job application ID
 * @param {string} accessToken
 * @returns {Promise<object>} Full application object with nested logs
 */
export async function fetchApplicationDetail(appId, accessToken) {
  const res = await authFetch(`/job-applications/${appId}/`, {}, accessToken);
  if (res.ok) {
    return await res.json();
  }
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.detail || "Failed to load application details");
}

export async function checkApplicationReplies(appId, accessToken) {
  const res = await authFetch(
    `/job-applications/${appId}/check-replies/`,
    { method: "POST" },
    accessToken
  );
  if (res.ok) return res.json();
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.detail || "Failed to check for replies");
}

/**
 * Update a job application's status.
 * @param {number} appId - Job application ID
 * @param {string} newStatus - One of: sent, replied, interview, rejected
 * @param {string} accessToken
 * @returns {Promise<object>} Updated application object
 */
export async function updateApplicationStatus(appId, newStatus, accessToken) {
  const res = await authFetch(
    `/job-applications/${appId}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    },
    accessToken
  );
  if (res.ok) {
    return await res.json();
  }
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.detail || "Failed to update status");
}

// ── Phase 10 helpers ──────────────────────────────────────────

/**
 * AI-draft a reply to a specific HR ReplyLog.
 * @param {number} appId - Job application ID
 * @param {number} replyLogId - ReplyLog ID
 * @param {string} accessToken
 * @returns {Promise<{subject: string, body: string}>}
 */
export async function draftReply(appId, replyLogId, accessToken) {
  const res = await authFetch(
    `/job-applications/${appId}/draft-reply/`,
    {
      method: "POST",
      body: JSON.stringify({ reply_log_id: replyLogId }),
    },
    accessToken
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new Error(data.detail || "Failed to draft reply");
}

/**
 * Send a reply to an HR ReplyLog via connected mailbox.
 * @param {number} appId - Job application ID
 * @param {number} replyLogId - ReplyLog ID
 * @param {string} subject
 * @param {string} body
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
export async function sendReply(appId, replyLogId, subject, body, accessToken) {
  const res = await authFetch(
    `/job-applications/${appId}/send-reply/`,
    {
      method: "POST",
      body: JSON.stringify({ reply_log_id: replyLogId, subject, body }),
    },
    accessToken
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new Error(data.detail || "Failed to send reply");
}


// ── Phase 8 helpers ───────────────────────────────────────────

/**
 * Verify account using 6-digit email code.
 * @param {string} code
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
export async function verifyEmail(code, accessToken) {
  const res = await authFetch(
    "/auth/verify-email/",
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
    accessToken
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new Error(data.detail || "Verification failed");
}

/**
 * Request a new verification code.
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
export async function resendVerificationCode(accessToken) {
  const res = await authFetch(
    "/auth/resend-code/",
    { method: "POST" },
    accessToken
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new Error(data.detail || "Failed to resend code");
}

// ── Phase 9 helpers ───────────────────────────────────────────

/**
 * Get the current user's active resume metadata.
 * @param {string} accessToken
 * @returns {Promise<{id: number, original_filename: string, uploaded_at: string}|null>}
 */
export async function getResume(accessToken) {
  const res = await authFetch("/resume/", {}, accessToken);
  if (res.status === 404) return null;
  if (res.ok) return await res.json();
  throw new Error("Failed to fetch resume");
}

/**
 * Upload (or replace) the user's active resume.
 * @param {File} file - The resume file to upload
 * @param {string} accessToken
 * @returns {Promise<{id: number, original_filename: string, uploaded_at: string}>}
 */
export async function uploadResume(file, accessToken) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetchMultipart("/resume/", formData, accessToken);
  const data = await res.json().catch(() => ({}));
  if (res.ok || res.status === 201) return data;
  throw new Error(data.detail || "Failed to upload resume");
}

/**
 * Delete the user's active resume.
 * @param {string} accessToken
 * @returns {Promise<void>}
 */
export async function deleteResume(accessToken) {
  const res = await authFetch("/resume/", { method: "DELETE" }, accessToken);
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(data.detail || "Failed to delete resume");
}

export default apiFetch;
