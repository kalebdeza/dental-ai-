import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  formatClaimDate,
  formatProcedureName,
} from "../../../../lib/data/claimDisplay";

interface Props {
  claim: ClaimWithDetails;
}

export default function ClaimSummary({ claim }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">

      <h2 className="mb-6 text-xl font-bold">
        Claim Summary
      </h2>

      <div className="space-y-4">

        <div className="flex justify-between">
          <span className="text-slate-500">Procedure</span>
          <span className="font-medium">{formatProcedureName(null)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Amount</span>
          <span className="font-bold text-green-600">
            ${Number(claim.amount_billed).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <span>{claim.status}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Submitted</span>
          <span>
            {formatClaimDate(claim.submitted_at ?? claim.created_at)}
          </span>
        </div>

      </div>

    </div>
  );
}
