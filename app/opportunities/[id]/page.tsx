"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import OpportunityCard from "@/app/components/OpportunityCard";

type Opportunity = {
  id: string;
  patient: string;
  opportunity_type: string;
  reason: string | null;
  estimated_value: number;
  priority: string;
  recommendedAction: string | null;
  completed: boolean;
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [opportunity, setOpportunity] =
    useState<Opportunity | null>(null);

  useEffect(() => {
    async function loadOpportunity() {
      try {
        const res = await fetch(
          "/api/opportunities"
        );

        if (!res.ok) {
          throw new Error(
            "Failed to load opportunity."
          );
        }

        const data = await res.json();

        const match = data.find(
          (item: Opportunity) =>
            item.id === String(params.id)
        );

        setOpportunity(match ?? null);
      } catch (error) {
        console.error(
          "Failed to load opportunity:",
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

  const type =
    opportunity.opportunity_type;

  const title =
    type === "Claim"
      ? "Insurance Claim Opportunity"
      : type === "Recall"
        ? "Recall Opportunity"
        : "Treatment Opportunity";

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
        title={title}
        patient={opportunity.patient}
        type={type}
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
          "Review this revenue opportunity."
        }
        primaryAction={
          type === "Claim"
            ? "💰 Review Claim"
            : type === "Recall"
              ? "📞 Contact Patient"
              : "📋 Review Treatment"
        }
        details={
          <>
            <p>
              <strong>Type:</strong>{" "}
              {type}
            </p>

            <p>
              <strong>Opportunity:</strong>{" "}
              {opportunity.reason ??
                "Revenue opportunity"}
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
            `${type} action coming soon.`
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