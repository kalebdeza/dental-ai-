"use client";

import { useState } from "react";

import {
  Brain,
  Sparkles,
  DollarSign,
  Loader2,
  Copy,
} from "lucide-react";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  formatPatientName,
  formatProcedureName,
} from "../../../../lib/data/claimDisplay";

interface Props {
  claim: ClaimWithDetails;
}

export default function AIClaimCopilot({ claim }: Props) {
  const remaining = Number(claim.remaining_balance);

    const [loading, setLoading] = useState(false);

const [narrative, setNarrative] = useState("");

async function generateNarrative() {
  try {
    setLoading(true);

    const response = await fetch("/api/claims/narrative", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        patientName: formatPatientName(claim.patient),

        procedureName: formatProcedureName(null),

        procedureCode: "Not available",

        insuranceEstimate:
          claim.amount_billed,
      }),
    });

    const data = await response.json();

    setNarrative(data.narrative);
  } finally {
    setLoading(false);
  }
}

function copyNarrative() {
  navigator.clipboard.writeText(narrative);
}

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl">

      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-7 w-7 text-cyan-400" />
        <h2 className="text-2xl font-bold">
          AI Claim Copilot
        </h2>
      </div>

      <p className="text-slate-300">
        Based on this claim, here is the recommended action.
      </p>

      <div className="mt-8 space-y-5">

        <div className="rounded-xl bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />

            <span className="font-semibold">
              AI Recommendation
            </span>
          </div>

          <p className="mt-3 text-slate-300">
            Submit this completed procedure to insurance immediately.
            The procedure is complete and the expected reimbursement
            is significant.
          </p>
        </div>

        <div className="rounded-xl bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />

            <span className="font-semibold">
              Recoverable Revenue
            </span>
          </div>

          <div className="mt-3 text-4xl font-bold text-emerald-400">
            ${remaining.toLocaleString()}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">

          <button
  onClick={generateNarrative}
  className="rounded-xl bg-blue-600 py-3 font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
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

          <button className="rounded-xl bg-violet-600 py-3 font-medium hover:bg-violet-700">
            Generate Appeal
          </button>

          <button className="rounded-xl bg-emerald-600 py-3 font-medium hover:bg-emerald-700">
            Submit Claim
          </button>

          <button className="rounded-xl bg-slate-700 py-3 font-medium hover:bg-slate-600">
            Email Insurance
          </button>

          {narrative && (
  <div className="mt-8 rounded-xl bg-white/5 p-6">

    <div className="flex items-center justify-between">

      <h3 className="font-semibold">
        Insurance Narrative
      </h3>

      <button
        onClick={copyNarrative}
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
)}

        </div>

      </div>

    </div>
  );
}