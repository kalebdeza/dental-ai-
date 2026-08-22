"use client";

import { useState } from "react";

interface Props {
  patient: any;
  recalls: any[];
}

export default function RecallEmail({
  patient,
  recalls,
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateEmail() {
    setLoading(true);

    const res = await fetch("/api/generate-recall-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patient,
        recalls,
      }),
    });

    const data = await res.json();

    setEmail(data.email);
    setLoading(false);
  }

  return (
    <section
      style={{
        marginTop: 40,
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h2>📧 Recall Email</h2>

      <button
        onClick={generateEmail}
        style={{
          marginTop: 20,
          padding: "12px 20px",
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {loading ? "Generating..." : "Generate Recall Email"}
      </button>

      {email && (
        <textarea
          value={email}
          readOnly
          style={{
            marginTop: 20,
            width: "100%",
            height: 300,
            padding: 16,
            borderRadius: 10,
            fontSize: 15,
          }}
        />
      )}
    </section>
  );
}