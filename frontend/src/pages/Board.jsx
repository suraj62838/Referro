/**
 * Job Board — API-backed list of all active job postings.
 * Matches the JobBoard component from the App.jsx prototype.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { authFetch } from "../api.js";
import { TopBar } from "../components/ui.jsx";
import AppLayout from "../components/AppLayout.jsx";
import {
  Search,
  Building2,
  MapPin,
  Loader2,
  Briefcase,
} from "lucide-react";

export default function Board() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchPostings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/job-postings/", {}, accessToken);
      if (res.ok) {
        const data = await res.json();
        setPostings(data);
      } else {
        setError("Failed to load job postings.");
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchPostings();
  }, [fetchPostings]);

  const filtered = postings.filter((job) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      job.role_title.toLowerCase().includes(q) ||
      job.company_name.toLowerCase().includes(q) ||
      (job.location || "").toLowerCase().includes(q)
    );
  });

  const handleApply = (job) => {
    // Navigate to apply page with job posting data in state
    navigate("/apply", { state: { jobPosting: job } });
  };

  return (
    <AppLayout>
      <div className="rise">
        <TopBar
          title="Job board"
          subtitle="Referral postings from the community"
          action={
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  color: "var(--ink-soft)",
                }}
              />
              <input
                id="board-search"
                placeholder="Search roles, companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--paper-raised)",
                  borderRadius: 8,
                  padding: "9px 14px 9px 34px",
                  fontSize: 13.5,
                  width: 240,
                  outline: "none",
                }}
              />
            </div>
          }
        />

        {/* Loading */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 60,
              color: "var(--ink-soft)",
              gap: 10,
            }}
          >
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            Loading postings...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "var(--rust-bg)",
              color: "var(--rust-fg)",
              border: "1px solid var(--rust)",
              borderRadius: 12,
              padding: "16px 20px",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "48px 20px",
              textAlign: "center",
            }}
          >
            <Briefcase size={32} color="var(--ink-soft)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {search ? "No matching postings" : "No postings yet"}
            </p>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 18 }}>
              {search
                ? "Try a different search term."
                : "Be the first to share a referral opening!"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/post")}
                style={{
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Post a job
              </button>
            )}
          </div>
        )}

        {/* Posting cards */}
        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            {filtered.map((job) => (
              <div
                key={job.id}
                className="card-hover"
                style={{
                  background: "var(--paper-raised)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16.5 }}>
                      {job.role_title}
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: "var(--ink-soft)",
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Building2 size={13} /> {job.company_name}
                    </div>
                  </div>
                  <span
                    style={{
                      background: "var(--sage-bg)",
                      color: "var(--sage-fg)",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 20,
                    }}
                  >
                    Referral
                  </span>
                </div>

                {job.location && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-soft)",
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <MapPin size={13} /> {job.location}
                  </div>
                )}

                {/* Show a preview of JD if available */}
                {job.jd_text && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      marginTop: 10,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {job.jd_text}
                  </p>
                )}

                <button
                  onClick={() => handleApply(job)}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    background: "var(--ink)",
                    color: "var(--paper)",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 0",
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
