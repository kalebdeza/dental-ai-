import { Brain, Sparkles } from "lucide-react";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import { getClaimNextAction } from "../../../../lib/data/claimWorkflow";

interface Props {
  claim: ClaimWithDetails;
}

export default function AIRecommendation({ claim }: Props) {
  const next = getClaimNextAction(claim, claim.opportunity);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <Brain className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold">{next.title}</h2>
      </div>

      <div className="space-y-4 text-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-500">What should happen next</p>
          <p className="mt-1">{next.what}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">Why</p>
          <p className="mt-1">{next.why}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">Recommended action</p>
          </div>
          <p className="mt-2 text-blue-900">{next.recommendedAction}</p>
          <p className="mt-2 text-xs text-blue-700">
            {next.source === "opportunity"
              ? "From the stored claim opportunity for this practice."
              : "From this claim’s current status and balances."}
          </p>
        </div>
      </div>
    </div>
  );
}
