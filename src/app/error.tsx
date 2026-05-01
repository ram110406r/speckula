"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 24px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
          {error.message || "An unexpected error occurred."}
          {error.digest ? ` (ref: ${error.digest})` : null}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <button
            onClick={reset}
            style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#c04a2b", color: "#fff", cursor: "pointer", fontSize: 14 }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #d1d5db", background: "transparent", cursor: "pointer", fontSize: 14 }}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
