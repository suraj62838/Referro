/**
 * ResumeSection — component for account settings / dashboard
 * displays active resume metadata, allows uploading, replacing, and deleting a resume.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { getResume, uploadResume, deleteResume } from "../api.js";
import { FileText, Upload, RefreshCw, Trash2, Loader2, CheckCircle } from "lucide-react";

export default function ResumeSection() {
  const { accessToken } = useAuth();
  const fileInputRef = useRef(null);

  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchResume = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getResume(accessToken);
      setResume(data);
    } catch {
      setError("Could not load resume status.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchResume();
  }, [fetchResume]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick checks
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5 MB limit.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");
      const updated = await uploadResume(file, accessToken);
      setResume(updated);
      setSuccess("Resume uploaded successfully! Auto-attached to outreach emails.");
    } catch (err) {
      setError(err.message || "Failed to upload resume.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to remove your active resume?")) return;
    try {
      setDeleting(true);
      setError("");
      setSuccess("");
      await deleteResume(accessToken);
      setResume(null);
      setSuccess("Resume removed.");
    } catch (err) {
      setError(err.message || "Failed to delete resume.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      style={{
        background: "var(--paper-raised)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 28,
      }}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx"
        style={{ display: "none" }}
        id="resume-file-input"
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
            Active Resume
          </h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "2px 0 0 0" }}>
            Auto-attached to every outreach email and reply.
          </p>
        </div>

        {resume && !loading && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              id="replace-resume-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || deleting}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {uploading ? (
                <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <RefreshCw size={14} />
              )}
              Replace
            </button>

            <button
              id="delete-resume-btn"
              onClick={handleDelete}
              disabled={uploading || deleting}
              style={{
                background: "var(--rust-bg)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--rust-fg)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {deleting ? (
                <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Trash2 size={14} />
              )}
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div
          style={{
            background: "var(--rust-bg)",
            color: "var(--rust-fg)",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "var(--sage-bg)",
            color: "var(--sage-fg)",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CheckCircle size={14} /> {success}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--ink-soft)",
            fontSize: 14,
            padding: "12px 0",
          }}
        >
          <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
          Checking resume...
        </div>
      )}

      {/* Resume Card (Active) */}
      {!loading && resume && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "var(--sage-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={20} color="var(--sage-fg)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {resume.original_filename}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              Uploaded on {formatDate(resume.uploaded_at)}
            </div>
          </div>
        </div>
      )}

      {/* No Resume State */}
      {!loading && !resume && (
        <div
          style={{
            border: "2px dashed var(--line)",
            borderRadius: 8,
            padding: "24px 20px",
            textAlign: "center",
            background: "var(--paper)",
          }}
        >
          <Upload size={24} color="var(--ink-soft)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            No resume uploaded yet
          </p>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
            PDF preferred, max size 5 MB.
          </p>
          <button
            id="upload-resume-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: "var(--rust)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {uploading ? (
              <Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Upload size={15} />
            )}
            Upload resume
          </button>
        </div>
      )}
    </div>
  );
}
