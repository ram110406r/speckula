"use client";

export default function GlobalErrorPage() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>Please refresh or try again.</p>
      <button
        onClick={() => window.location.reload()}
        style={{ marginTop: 16, padding: "8px 20px", background: "#c04a2b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
      >
        Refresh
      </button>
    </div>
  );
}
