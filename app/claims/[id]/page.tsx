"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getClaimWithDetails } from "../../../lib/data/claims";

import ClaimHero from "./components/ClaimHero";
import ClaimSummary from "./components/ClaimSummary";
import AIRecommendation from "./components/AIRecommendation";

import type { ClaimWithDetails } from "../../../lib/data/claims";
import AIClaimCopilot from "./components/AIClaimCopilot";

export default function ClaimWorkspace() {
  const params = useParams();

  const [claim, setClaim] = useState<ClaimWithDetails | null>(null);

  useEffect(() => {
    loadClaim();
  }, []);

  async function loadClaim() {
    try {
      const data = await getClaimWithDetails(params.id as string);
      setClaim(data);
    } catch (error) {
      console.error(error);
    }
  }

  if (!claim) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Loading claim...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-8">

      <ClaimHero claim={claim} />

      <div className="grid gap-6 lg:grid-cols-3">

        <ClaimSummary claim={claim} />

        <div className="lg:col-span-2">
          <AIClaimCopilot claim={claim} />
        </div>

      </div>

    </main>
  );
}