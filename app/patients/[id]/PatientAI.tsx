"use client";

import { useEffect, useState } from "react";

interface Props {
  patient: any;
  treatments: any[];
  claims: any[];
  recalls: any[];
}

export default function PatientAI({
  patient,
  treatments,
  claims,
  recalls,
}: Props) {
  const [recommendation, setRecommendation] = useState("Analyzing patient...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAI() {
      try {
        const res = await fetch("/api/patient-ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patient,
            treatments,
            claims,
            recalls,
          }),
        });

        const data = await res.json();

        setRecommendation(data.recommendation);
      } catch (err) {
        setRecommendation("Unable to generate AI recommendation.");
      } finally {
        setLoading(false);
      }
    }

    loadAI();
  }, [patient, treatments, claims, recalls]);

  return (
    <section
      style={{
        marginTop: 40,
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 24,
        background: "#f8fafc",
      }}
    >
      <h2>🤖 AI Recommendation</h2>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.7,
          marginTop: 16,
        }}
      >
        {loading ? "Analyzing patient..." : recommendation}
      </div>
    </section>
  );
}