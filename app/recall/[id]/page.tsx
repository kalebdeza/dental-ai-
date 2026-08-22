"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OpportunityCard from "@/app/components/OpportunityCard";

type Recall = {
  id: string;
  patient: string;
  opportunity_type: string;
  reason: string | null;
  estimated_value: number;
  priority: string;
  recommendedAction: string | null;
  completed: boolean;
};

export default function RecallDetail() {
  const params = useParams();
  const router = useRouter();

  const [recall, setRecall] =
    useState<Recall | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/recall");

        if (!res.ok) {
          throw new Error(
            "Failed to load recall opportunities."
          );
        }

        const data = await res.json();

        const found = data.find(
          (item: Recall) =>
            item.id === String(params.id)
        );

        setRecall(found ?? null);
      } catch (error) {
        console.error(
          "Failed to load recall:",
          error
        );
      }
    }

    load();
  }, [params]);

  if (!recall) {
    return (
      <main style={{ padding: 30 }}>
        <h2>Loading...</h2>
      </main>
    );
  }

  const revenue = Number(
    recall.estimated_value ?? 0
  );

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 30,
      }}
    >
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: 24,
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: "#2563eb",
          color: "white",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <OpportunityCard
        title="Recall Opportunity"
        patient={recall.patient}
        type={recall.opportunity_type}
        status={
          recall.completed
            ? "Completed"
            : "Open"
        }
        priority={recall.priority}
        revenue={revenue}
        recommendation={
          recall.recommendedAction ??
          recall.reason ??
          "Contact the patient and schedule the overdue recall."
        }
        primaryAction="📅 Schedule Patient"
        details={
          <>
            <p>
              <strong>Opportunity:</strong>{" "}
              {recall.reason ??
                "Overdue recall"}
            </p>

            <p>
              <strong>Priority:</strong>{" "}
              {recall.priority}
            </p>

            <p>
              <strong>Estimated Value:</strong>{" "}
              ${revenue.toLocaleString()}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {recall.completed
                ? "Completed"
                : "Open"}
            </p>
          </>
        }
        onPrimaryAction={() => {
          alert(
            "Schedule patient feature coming soon."
          );
        }}
        onComplete={() => {
          alert(
            "Mark complete feature coming soon."
          );
        }}
      />
    </main>
  );
}