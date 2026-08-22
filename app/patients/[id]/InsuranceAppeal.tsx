"use client";

import { useState } from "react";

interface Props {
  patient: any;
  claims: any[];
}

export default function InsuranceAppeal({
  patient,
  claims,
}: Props) {
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateAppeal() {
    setLoading(true);

    try {
      const res = await fetch("/api/generate-appeal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient,
          claims,
        }),
      });

      const data = await res.json();
      setLetter(data.letter);
    } finally {
      setLoading(false);
    }
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
      <h2>📄 Insurance Appeal</h2>

      <button
        onClick={generateAppeal}
        style={{
          marginTop: 20,
          padding: "12px 20px",
          background: "#16a34a",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {loading ? "Generating..." : "Generate Appeal Letter"}
      </button>

      {letter && (
        <textarea
          value={letter}
          readOnly
          style={{
            width: "100%",
            height: 350,
            marginTop: 20,
            padding: 16,
            borderRadius: 10,
          }}
        />
      )}
    </section>
  );
}