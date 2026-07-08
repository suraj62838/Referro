/**
 * API helper — thin wrapper around fetch for backend calls.
 * Phase 0: basic setup pointing at Django dev server.
 * Phase 1 will add JWT header injection and token refresh logic.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

/**
 * Make an API request.
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

export default apiFetch;
