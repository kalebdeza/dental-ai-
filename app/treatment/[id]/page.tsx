"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OpportunityCard from "@/app/components/OpportunityCard";

type TreatmentOpportunity = {
  id: string;
  patient: string;
  opportunity_type: string;
  reason: string | null;
  estimated_value: number;
  priority: string;
  recommendedAction: string | null;
  completed: boolean;
};

export default function TreatmentDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [opportunity, setOpportunity] =
    useState<TreatmentOpportunity | null>(null);

  useEffect(() => {
    async function loadOpportunity() {
      try {
        const res = await fetch("/api/treatment");

        if (!res.ok) {
          throw new Error(
            "Failed to load treatment opportunity."
          );
        }

        const data = await res.json();

        const found = data.find(
          (item: TreatmentOpportunity) =>
            item.id === String(params.id)
        );

        setOpportunity(found ?? null);
      } catch (error) {
        console.error(
          "Failed to load treatment opportunity:",
          error
        );
      }
    }

    loadOpportunity();
  }, [params]);

  if (!opportunity) {
    return (
      <main style={{ padding: 30 }}>
        <h2>Loading...</h2>
      </main>
    );
  }

  const revenue = Number(
    opportunity.estimated_value ?? 0
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
        title="Treatment Opportunity"
        patient={opportunity.patient}
        type={opportunity.opportunity_type}
        status={
          opportunity.completed
            ? "Completed"
            : "Open"
        }
        priority={opportunity.priority}
        revenue={revenue}
        recommendation={
          opportunity.recommendedAction ??
          opportunity.reason ??
          "Review this treatment opportunity."
        }
        primaryAction="📅 Schedule Patient"
        details={
          <>
            <p>
              <strong>Opportunity:</strong>{" "}
              {opportunity.reason ??
                "Treatment opportunity"}
            </p>

            <p>
              <strong>Priority:</strong>{" "}
              {opportunity.priority}
            </p>

            <p>
              <strong>Estimated Value:</strong>{" "}
              ${revenue.toLocaleString()}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {opportunity.completed
                ? "Completed"
                : "Open"}
            </p>
          </>
        }
        onPrimaryAction={() => {
          alert(
            "Schedule Patient feature coming soon."
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