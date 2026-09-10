import {
  evaluateClaimProcEligibility,
  isPaymentDateAfterIdentification,
  sourceIdKey,
  type MappedClaimProc,
} from "../opendental/claimProc.ts";

export const ATTRIBUTION_STATUS_ACTIVE = "active" as const;
export const ATTRIBUTION_STATUS_REVERSED = "reversed" as const;

export const REVERSAL_REASON_INELIGIBLE = "claimproc_no_longer_eligible";
export const REVERSAL_REASON_DELETED = "claimproc_deleted_or_absent";
export const REVERSAL_REASON_NO_MATCH = "claimproc_no_matching_opportunity";
export const REVERSAL_REASON_DATE = "payment_date_not_after_identified_at";
export const REVERSAL_REASON_CAP = "identified_cap_exhausted";
export const REVERSAL_REASON_DISMISSED = "opportunity_dismissed";

export type AttributionOpportunity = {
  id: string;
  practice_id: string;
  opportunity_type: string;
  patient_id: string | null;
  claim_id: string | null;
  procedure_id: string | null;
  identified_at: string;
  identified_estimated_value: number;
  workflow_status: string;
  close_reason: string | null;
};

export type AttributionClaim = {
  id: string;
  practice_id: string;
  source_claim_id: string;
  amount_paid?: number;
  paid_at?: string | null;
};

export type AttributionProcedure = {
  id: string;
  practice_id: string;
  source_procedure_id: string;
};

export type StoredClaimProc = MappedClaimProc & {
  id: string;
  practice_id: string;
  absent_from_sync_at?: string | null;
};

export type StoredAttribution = {
  id: string;
  practice_id: string;
  opportunity_id: string;
  claimproc_id: string;
  source_claimproc_id: number;
  credited_amount: number;
  payment_dated_at: string;
  identified_at_snapshot: string;
  cap_snapshot: number;
  status: string;
};

export type AttributionMatchFailure =
  | "not_claim_opportunity"
  | "missing_claim_id"
  | "claim_source_mismatch"
  | "procedure_required_but_claimproc_unlinked"
  | "procedure_conflict"
  | "dismissed";

export type CreditDecision = {
  claimprocId: string;
  sourceClaimProcId: number;
  opportunityId: string | null;
  credit: number;
  paymentDatedAt: string | null;
  identifiedAtSnapshot: string | null;
  capSnapshot: number | null;
  skipReason: string | null;
};

export type AttributionMutation =
  | {
      kind: "insert";
      opportunityId: string;
      claimprocId: string;
      sourceClaimProcId: number;
      creditedAmount: number;
      paymentDatedAt: string;
      identifiedAtSnapshot: string;
      capSnapshot: number;
    }
  | {
      kind: "adjust";
      attributionId: string;
      opportunityId: string;
      claimprocId: string;
      sourceClaimProcId: number;
      previousCreditedAmount: number;
      creditedAmount: number;
      paymentDatedAt: string;
    }
  | {
      kind: "reverse";
      attributionId: string;
      opportunityId: string;
      claimprocId: string;
      sourceClaimProcId: number;
      previousCreditedAmount: number;
      reason: string;
    };

export function isClaimOpportunity(
  opportunity: Pick<AttributionOpportunity, "opportunity_type">
): boolean {
  return opportunity.opportunity_type === "Claim";
}

export function isDismissedOpportunity(
  opportunity: Pick<AttributionOpportunity, "workflow_status" | "close_reason">
): boolean {
  return (
    opportunity.workflow_status === "dismissed" ||
    opportunity.close_reason === "office_dismissed"
  );
}

export function claimProcMatchesOpportunity(input: {
  opportunity: AttributionOpportunity;
  claim: AttributionClaim | null;
  procedure: AttributionProcedure | null;
  claimProc: StoredClaimProc;
}): { matches: boolean; reason: AttributionMatchFailure | null } {
  const { opportunity, claim, procedure, claimProc } = input;

  if (!isClaimOpportunity(opportunity)) {
    return { matches: false, reason: "not_claim_opportunity" };
  }

  if (!opportunity.claim_id) {
    return { matches: false, reason: "missing_claim_id" };
  }

  if (!claim || claim.id !== opportunity.claim_id) {
    return { matches: false, reason: "claim_source_mismatch" };
  }

  const opportunityClaimKey = sourceIdKey(claim.source_claim_id);
  const claimProcClaimKey = sourceIdKey(claimProc.source_claim_id);

  if (
    !opportunityClaimKey ||
    !claimProcClaimKey ||
    opportunityClaimKey !== claimProcClaimKey
  ) {
    return { matches: false, reason: "claim_source_mismatch" };
  }

  if (opportunity.procedure_id) {
    if (!claimProc.source_procedure_id) {
      return {
        matches: false,
        reason: "procedure_required_but_claimproc_unlinked",
      };
    }

    const opportunityProcKey = sourceIdKey(procedure?.source_procedure_id);
    const claimProcProcKey = sourceIdKey(claimProc.source_procedure_id);

    if (
      !opportunityProcKey ||
      !claimProcProcKey ||
      opportunityProcKey !== claimProcProcKey
    ) {
      return { matches: false, reason: "procedure_conflict" };
    }
  }

  return { matches: true, reason: null };
}

export function rankMatchingOpportunities(
  matches: AttributionOpportunity[]
): AttributionOpportunity[] {
  return [...matches].sort((left, right) => {
    const leftProc = left.procedure_id ? 0 : 1;
    const rightProc = right.procedure_id ? 0 : 1;

    if (leftProc !== rightProc) {
      return leftProc - rightProc;
    }

    const identified = left.identified_at.localeCompare(right.identified_at);

    if (identified !== 0) {
      return identified;
    }

    return left.id.localeCompare(right.id);
  });
}

export function selectAttributionWinner(
  matches: AttributionOpportunity[]
): AttributionOpportunity | null {
  const creditable = matches.filter(
    (opportunity) => !isDismissedOpportunity(opportunity)
  );

  if (creditable.length === 0) {
    return null;
  }

  return rankMatchingOpportunities(creditable)[0] ?? null;
}

export function remainingCapForOpportunity(
  opportunity: Pick<AttributionOpportunity, "identified_estimated_value">,
  existingCredits: Array<Pick<StoredAttribution, "credited_amount" | "status">>,
  excludeClaimProcId?: string,
  existing?: Array<Pick<StoredAttribution, "claimproc_id">>
): number {
  const used = existingCredits.reduce((sum, row, index) => {
    if (row.status !== ATTRIBUTION_STATUS_ACTIVE) {
      return sum;
    }

    if (
      excludeClaimProcId &&
      existing?.[index]?.claimproc_id === excludeClaimProcId
    ) {
      return sum;
    }

    return sum + Number(row.credited_amount ?? 0);
  }, 0);

  return Math.max(Number(opportunity.identified_estimated_value ?? 0) - used, 0);
}

export function remainingCap(
  identifiedEstimatedValue: number,
  activeCredits: number[]
): number {
  const used = activeCredits.reduce((sum, value) => sum + Number(value ?? 0), 0);
  return Math.max(Number(identifiedEstimatedValue ?? 0) - used, 0);
}

export function creditForEligiblePayment(input: {
  insPayAmt: number;
  remainingCap: number;
  dateCp: string | null;
  identifiedAt: string;
}): number {
  if (!isPaymentDateAfterIdentification(input.dateCp, input.identifiedAt)) {
    return 0;
  }

  if (input.remainingCap <= 0) {
    return 0;
  }

  return Math.min(Number(input.insPayAmt ?? 0), input.remainingCap);
}

export function planClaimProcAttribution(input: {
  claimProc: StoredClaimProc;
  opportunities: AttributionOpportunity[];
  claimsById: Map<string, AttributionClaim>;
  proceduresById: Map<string, AttributionProcedure>;
  existingByClaimProcId: Map<string, StoredAttribution>;
  activeCreditsByOpportunity: Map<string, number>;
}): AttributionMutation | null {
  const { claimProc } = input;
  const existing = input.existingByClaimProcId.get(claimProc.id);
  const eligibility = evaluateClaimProcEligibility(claimProc);

  if (
    existing &&
    existing.status === ATTRIBUTION_STATUS_ACTIVE &&
    eligibility.eligible
  ) {
    const existingOpportunity = input.opportunities.find(
      (opportunity) => opportunity.id === existing.opportunity_id
    );

    if (existingOpportunity && isDismissedOpportunity(existingOpportunity)) {
      return null;
    }
  }

  const matches = input.opportunities.filter((opportunity) => {
    if (opportunity.practice_id !== claimProc.practice_id) {
      return false;
    }

    const claim = opportunity.claim_id
      ? input.claimsById.get(opportunity.claim_id) ?? null
      : null;
    const procedure = opportunity.procedure_id
      ? input.proceduresById.get(opportunity.procedure_id) ?? null
      : null;

    return claimProcMatchesOpportunity({
      opportunity,
      claim,
      procedure,
      claimProc,
    }).matches;
  });

  const winner = eligibility.eligible
    ? selectAttributionWinner(matches)
    : null;

  if (!winner || !eligibility.eligible) {
    if (
      existing &&
      existing.status === ATTRIBUTION_STATUS_ACTIVE &&
      Number(existing.credited_amount) > 0
    ) {
      return {
        kind: "reverse",
        attributionId: existing.id,
        opportunityId: existing.opportunity_id,
        claimprocId: claimProc.id,
        sourceClaimProcId: claimProc.source_claimproc_id,
        previousCreditedAmount: Number(existing.credited_amount),
        reason: eligibility.eligible
          ? REVERSAL_REASON_NO_MATCH
          : REVERSAL_REASON_INELIGIBLE,
      };
    }

    return null;
  }

  if (isDismissedOpportunity(winner) && !existing) {
    return null;
  }

  if (existing && isDismissedOpportunity(winner) && existing.opportunity_id === winner.id) {
    return null;
  }

  const otherCredits =
    input.activeCreditsByOpportunity.get(winner.id) ?? 0;
  const excludingCurrent =
    existing &&
    existing.opportunity_id === winner.id &&
    existing.status === ATTRIBUTION_STATUS_ACTIVE
      ? otherCredits - Number(existing.credited_amount)
      : otherCredits;
  const cap = remainingCap(
    winner.identified_estimated_value,
    [Math.max(excludingCurrent, 0)]
  );
  const credit = creditForEligiblePayment({
    insPayAmt: claimProc.ins_pay_amt,
    remainingCap: cap,
    dateCp: claimProc.date_cp,
    identifiedAt: winner.identified_at,
  });

  if (credit <= 0) {
    if (
      existing &&
      existing.status === ATTRIBUTION_STATUS_ACTIVE &&
      Number(existing.credited_amount) > 0
    ) {
      const beforeIdentified = !isPaymentDateAfterIdentification(
        claimProc.date_cp,
        winner.identified_at
      );

      return {
        kind: "reverse",
        attributionId: existing.id,
        opportunityId: existing.opportunity_id,
        claimprocId: claimProc.id,
        sourceClaimProcId: claimProc.source_claimproc_id,
        previousCreditedAmount: Number(existing.credited_amount),
        reason: beforeIdentified ? REVERSAL_REASON_DATE : REVERSAL_REASON_CAP,
      };
    }

    return null;
  }

  if (!claimProc.date_cp) {
    return null;
  }

  if (!existing) {
    return {
      kind: "insert",
      opportunityId: winner.id,
      claimprocId: claimProc.id,
      sourceClaimProcId: claimProc.source_claimproc_id,
      creditedAmount: credit,
      paymentDatedAt: claimProc.date_cp,
      identifiedAtSnapshot: winner.identified_at,
      capSnapshot: Number(winner.identified_estimated_value),
    };
  }

  if (existing.status === ATTRIBUTION_STATUS_REVERSED) {
    if (existing.opportunity_id !== winner.id) {
      return {
        kind: "insert",
        opportunityId: winner.id,
        claimprocId: claimProc.id,
        sourceClaimProcId: claimProc.source_claimproc_id,
        creditedAmount: credit,
        paymentDatedAt: claimProc.date_cp,
        identifiedAtSnapshot: winner.identified_at,
        capSnapshot: Number(winner.identified_estimated_value),
      };
    }
  }

  if (
    existing.opportunity_id === winner.id &&
    existing.status === ATTRIBUTION_STATUS_ACTIVE &&
    Number(existing.credited_amount) === credit &&
    existing.payment_dated_at === claimProc.date_cp
  ) {
    return null;
  }

  if (
    existing.status === ATTRIBUTION_STATUS_ACTIVE &&
    existing.opportunity_id !== winner.id
  ) {
    return {
      kind: "reverse",
      attributionId: existing.id,
      opportunityId: existing.opportunity_id,
      claimprocId: claimProc.id,
      sourceClaimProcId: claimProc.source_claimproc_id,
      previousCreditedAmount: Number(existing.credited_amount),
      reason: REVERSAL_REASON_NO_MATCH,
    };
  }

  return {
    kind: "adjust",
    attributionId: existing.id,
    opportunityId: winner.id,
    claimprocId: claimProc.id,
    sourceClaimProcId: claimProc.source_claimproc_id,
    previousCreditedAmount: Number(existing.credited_amount),
    creditedAmount: credit,
    paymentDatedAt: claimProc.date_cp,
  };
}

export function planPracticeAttributions(input: {
  claimProcs: StoredClaimProc[];
  opportunities: AttributionOpportunity[];
  claims: AttributionClaim[];
  procedures: AttributionProcedure[];
  existing: StoredAttribution[];
}): AttributionMutation[] {
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const proceduresById = new Map(
    input.procedures.map((procedure) => [procedure.id, procedure])
  );
  const existingByClaimProcId = new Map<string, StoredAttribution>();

  for (const row of input.existing) {
    if (row.status === ATTRIBUTION_STATUS_ACTIVE) {
      existingByClaimProcId.set(row.claimproc_id, row);
      continue;
    }

    if (!existingByClaimProcId.has(row.claimproc_id)) {
      existingByClaimProcId.set(row.claimproc_id, row);
    }
  }

  const activeCreditsByOpportunity = new Map<string, number>();

  for (const row of input.existing) {
    if (row.status !== ATTRIBUTION_STATUS_ACTIVE) {
      continue;
    }

    activeCreditsByOpportunity.set(
      row.opportunity_id,
      (activeCreditsByOpportunity.get(row.opportunity_id) ?? 0) +
        Number(row.credited_amount ?? 0)
    );
  }

  const mutations: AttributionMutation[] = [];
  const claimedClaimProcs = new Set<string>();

  for (const claimProc of input.claimProcs) {
    const mutation = planClaimProcAttribution({
      claimProc,
      opportunities: input.opportunities,
      claimsById,
      proceduresById,
      existingByClaimProcId,
      activeCreditsByOpportunity,
    });

    if (!mutation) {
      continue;
    }

    if (claimedClaimProcs.has(claimProc.id) && mutation.kind === "insert") {
      continue;
    }

    if (mutation.kind === "insert" || mutation.kind === "adjust") {
      claimedClaimProcs.add(claimProc.id);
      const current =
        mutation.kind === "adjust" ? mutation.previousCreditedAmount : 0;
      const next = mutation.creditedAmount;
      const opportunityId = mutation.opportunityId;
      activeCreditsByOpportunity.set(
        opportunityId,
        (activeCreditsByOpportunity.get(opportunityId) ?? 0) - current + next
      );
    }

    if (mutation.kind === "reverse") {
      activeCreditsByOpportunity.set(
        mutation.opportunityId,
        Math.max(
          (activeCreditsByOpportunity.get(mutation.opportunityId) ?? 0) -
            mutation.previousCreditedAmount,
          0
        )
      );
    }

    mutations.push(mutation);
  }

  for (const existing of input.existing) {
    if (existing.status !== ATTRIBUTION_STATUS_ACTIVE) {
      continue;
    }

    const stillPresent = input.claimProcs.some(
      (row) => row.id === existing.claimproc_id
    );

    if (stillPresent) {
      continue;
    }

    mutations.push({
      kind: "reverse",
      attributionId: existing.id,
      opportunityId: existing.opportunity_id,
      claimprocId: existing.claimproc_id,
      sourceClaimProcId: existing.source_claimproc_id,
      previousCreditedAmount: Number(existing.credited_amount),
      reason: REVERSAL_REASON_DELETED,
    });
  }

  return mutations;
}

export function sumActiveAttributedAmount(
  rows: Array<Pick<StoredAttribution, "credited_amount" | "status" | "practice_id">>,
  practiceId: string
): number {
  return rows.reduce((sum, row) => {
    if (row.practice_id !== practiceId) {
      return sum;
    }

    if (row.status !== ATTRIBUTION_STATUS_ACTIVE) {
      return sum;
    }

    return sum + Number(row.credited_amount ?? 0);
  }, 0);
}
