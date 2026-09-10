import { Brain, Sparkles } from "lucide-react";

import type { ClaimWithDetails } from "../../../../lib/data/claims";
import { buildClaimAssistantView } from "../../../../lib/data/claimAssistant";

interface Props {
  claim: ClaimWithDetails;
}

export default function AIRecommendation({ claim }: Props) {
  const view = buildClaimAssistantView({
    claim,
    patient: claim.patient,
    provider: claim.provider,
    opportunity: claim.opportunity,
  });

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <Brain className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold">Recommended next step</h2>
      </div>

      <div className="space-y-4 text-slate-700">
        <p>{view.recommendedNextStep}</p>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">What the office should know</p>
          </div>
          <p className="mt-2 text-blue-900">{view.why}</p>
        </div>
      </div>
    </div>
  );
}
