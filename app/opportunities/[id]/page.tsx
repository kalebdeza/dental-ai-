"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function loadOpportunity() {
      try {
        const res = await fetch(
          `/api/opportunities/workflow?id=${String(params.id)}`
        );

        if (res.status === 404) {
          setMessage("Opportunity not found.");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to load opportunity.");
        }

        const data = await res.json();
        const opportunity = data.opportunity as {
          id: string;
          opportunity_type: string;
          claim_id: string | null;
        } | null;

        if (!opportunity) {
          setMessage("Opportunity not found.");
          return;
        }

        if (opportunity.opportunity_type === "Recall") {
          router.replace(`/recall/${opportunity.id}`);
          return;
        }

        if (opportunity.opportunity_type === "Treatment") {
          router.replace(`/treatment/${opportunity.id}`);
          return;
        }

        if (
          opportunity.opportunity_type === "Claim" &&
          opportunity.claim_id
        ) {
          router.replace(`/claims/${opportunity.claim_id}`);
          return;
        }

        setMessage("This opportunity does not have an Action Center.");
      } catch {
        console.error("Failed to load opportunity.");
        setMessage("Could not load this opportunity.");
      }
    }

    void loadOpportunity();
  }, [params.id, router]);

  return (
    <main style={{ padding: 30 }}>
      <h2>{message}</h2>
    </main>
  );
}
