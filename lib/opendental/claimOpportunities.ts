import {
  isBillableCompletedProcedure,
  isClaimAwaitingSubmission,
} from "./status.ts";

export type ClaimOpportunityProcedure = {
  id: string;
  patient_id: string;
  fee: number | null;
  status: string | null;
};

export type ClaimOpportunityClaim = {
  id: string;
  patient_id: string;
  status: string | null;
  amount_billed: number | null;
  remaining_balance: number | null;
};

export type ClaimOpportunity = {
  patient_id: string;
  claim_id: string | null;
  procedure_id: string;
  priority: string;
  estimated_value: number;
  confidence_score: number;
  reason: string;
  recommended_action: string;
};

export function buildClaimOpportunities(
  procedures: ClaimOpportunityProcedure[],
  claims: ClaimOpportunityClaim[]
): ClaimOpportunity[] {
  const opportunities: ClaimOpportunity[] = [];

  for (const procedure of procedures) {
    if (!isBillableCompletedProcedure(procedure.status)) {
      continue;
    }

    const procedureFee = Number(procedure.fee ?? 0);

    if (procedureFee <= 0) {
      continue;
    }

    const matchingClaims = claims.filter(
      (claim) =>
        claim.patient_id === procedure.patient_id &&
        Number(claim.amount_billed ?? 0) === procedureFee
    );

    const matchingClaim =
      matchingClaims.find(
        (claim) => Number(claim.remaining_balance ?? 0) > 0
      ) ?? matchingClaims[0];

    if (!matchingClaim) {
      opportunities.push({
        patient_id: procedure.patient_id,
        claim_id: null,
        procedure_id: procedure.id,
        priority: "High",
        estimated_value: procedureFee,
        confidence_score: 70,
        reason: "Completed procedure with no matching insurance claim.",
        recommended_action: "Review and submit the insurance claim.",
      });
      continue;
    }

    if (isClaimAwaitingSubmission(matchingClaim.status)) {
      opportunities.push({
        patient_id: procedure.patient_id,
        claim_id: matchingClaim.id,
        procedure_id: procedure.id,
        priority: "High",
        estimated_value: procedureFee,
        confidence_score: 90,
        reason:
          "Completed procedure with an insurance claim that has not been submitted.",
        recommended_action: "Review and submit the insurance claim.",
      });
      continue;
    }

    const remainingBalance = Number(matchingClaim.remaining_balance ?? 0);

    if (remainingBalance > 0) {
      opportunities.push({
        patient_id: procedure.patient_id,
        claim_id: matchingClaim.id,
        procedure_id: procedure.id,
        priority:
          remainingBalance >= procedureFee * 0.5 ? "High" : "Medium",
        estimated_value: remainingBalance,
        confidence_score: 95,
        reason:
          "Insurance claim has an outstanding balance that may still be recoverable.",
        recommended_action:
          "Review the claim status and follow up on the outstanding insurance balance.",
      });
    }
  }

  return opportunities;
}
