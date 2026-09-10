import type { ClaimWithDetails } from "../../../../lib/data/claims";
import {
  NOT_AVAILABLE_IN_APP,
  formatClaimAmount,
  formatClaimDate,
  formatPatientName,
  formatProviderName,
} from "../../../../lib/data/claimDisplay";
import {
  formatWorkflowStatusLabel,
  readStoredWorkflowStatus,
} from "../../../../lib/data/opportunityWorkflow";

interface Props {
  claim: ClaimWithDetails;
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function ClaimSummary({ claim }: Props) {
  return (
    <div
      id="claim-summary"
      className="rounded-2xl border bg-white p-6 shadow-sm"
    >
      <h2 className="mb-6 text-xl font-bold">Claim Summary</h2>

      <div className="space-y-4">
        <Row label="Patient" value={formatPatientName(claim.patient)} />
        <Row label="Provider" value={formatProviderName(claim.provider)} />
        <Row label="Status" value={claim.status} />
        <Row
          label="Office queue"
          value={
            claim.opportunity
              ? formatWorkflowStatusLabel(
                  readStoredWorkflowStatus({
                    workflow_status: claim.opportunity.workflow_status,
                    completed: claim.opportunity.completed,
                  })
                )
              : "No linked opportunity"
          }
        />
        <Row
          label="Insurance"
          value={claim.insurance_company?.trim() || "Missing"}
        />
        <Row label="Procedure" value={NOT_AVAILABLE_IN_APP} />
        <Row label="Amount billed" value={formatClaimAmount(claim.amount_billed)} />
        <Row label="Amount paid" value={formatClaimAmount(claim.amount_paid)} />
        <Row
          label="Remaining balance"
          value={formatClaimAmount(claim.remaining_balance)}
        />
        <Row
          label="Submitted"
          value={formatClaimDate(claim.submitted_at)}
        />
        <Row label="Paid" value={formatClaimDate(claim.paid_at)} />
      </div>

      {claim.denial_reason?.trim() ? (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Denial reason</p>
          <p className="mt-1 text-sm text-red-800">{claim.denial_reason}</p>
        </div>
      ) : null}
    </div>
  );
}
