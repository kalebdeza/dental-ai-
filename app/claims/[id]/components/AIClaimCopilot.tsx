"use client";

import { useState } from "react";
import {
  Brain,
  Copy,
  DollarSign,
  Loader2,
} from "lucide-react";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  formatClaimAmount,
  formatPatientName,
  formatProcedureName,
} from "../../../../lib/data/claimDisplay";
import { getClaimWorkflowBucket } from "../../../../lib/data/claimWorkflow";

interface Props {
  claim: ClaimWithDetails;
  generatedLetter: string;
}

export default function AIClaimCopilot({ claim, generatedLetter }: Props) {
  const remaining = Number(claim.remaining_balance);
  const bucket = getClaimWorkflowBucket(claim);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function generateNarrative() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/claims/narrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientName: formatPatientName(claim.patient),
          procedureName: formatProcedureName(null),
          procedureCode: "Not available",
          insuranceEstimate: claim.amount_billed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Narrative generation is unavailable.");
        return;
      }

      setNarrative(data.narrative ?? "");
    } finally {
      setLoading(false);
    }
  }

  function copyText(value: string) {
    navigator.clipboard.writeText(value);
  }

  const showNarrative = bucket === "draft";
  const letter = generatedLetter.trim();

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl">
      <div className="mb-6 flex items-center gap-3">
        <Brain className="h-7 w-7 text-cyan-400" />
        <h2 className="text-2xl font-bold">AI Claim Copilot</h2>
      </div>

      <p className="text-slate-300">
        Tools below use the existing claim narrative and appeal APIs. They do
        not submit claims to a payer.
      </p>

      <div className="mt-8 space-y-5">
        <div className="rounded-xl bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold">Remaining balance</span>
          </div>
          <div className="mt-3 text-4xl font-bold text-emerald-400">
            {formatClaimAmount(remaining)}
          </div>
        </div>

        {showNarrative ? (
          <button
            type="button"
            onClick={generateNarrative}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Narrative"
            )}
          </button>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-white/5 p-4 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {narrative ? (
          <div className="rounded-xl bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Insurance Narrative</h3>
              <button
                type="button"
                onClick={() => copyText(narrative)}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-slate-300">
              {narrative}
            </p>
          </div>
        ) : null}

        {letter ? (
          <div className="rounded-xl bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Appeal letter</h3>
              <button
                type="button"
                onClick={() => copyText(letter)}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-slate-300">{letter}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
