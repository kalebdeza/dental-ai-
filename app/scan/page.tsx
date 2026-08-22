"use client";

export default function RevenueScanPage() {
  return (
    <main style={{ padding: "40px" }}>
      <h1>AI Revenue Scan</h1>

      <p>
        Analyze your practice data to identify missed revenue opportunities.
      </p>

      <div
        style={{
          marginTop: "30px",
          padding: "30px",
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 8px 24px rgba(0,0,0,.08)",
          maxWidth: "700px",
        }}
      >
        <h2>Revenue Scan</h2>

        <p>
          Scan imported claims, procedures, insurance payments, and patient
          records to find recoverable revenue.
        </p>

        <button
          style={{
            marginTop: "20px",
            padding: "14px 24px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          🔍 Start Revenue Scan
        </button>
      </div>
    </main>
  );
}