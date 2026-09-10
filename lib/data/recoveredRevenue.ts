import { paginateSupabaseQuery } from "../cron/paginateSupabase.ts";
import type { SchedulerPracticeContext } from "../cron/schedulerContext.ts";
import {
  ATTRIBUTION_STATUS_ACTIVE,
  ATTRIBUTION_STATUS_REVERSED,
  planPracticeAttributions,
  sumActiveAttributedAmount,
  type AttributionClaim,
  type AttributionMutation,
  type AttributionOpportunity,
  type AttributionProcedure,
  type StoredAttribution,
  type StoredClaimProc,
} from "./paymentAttribution.ts";
import { DATE_CP_UI_LABEL } from "../opendental/claimProc.ts";

export const RECOVERED_REVENUE_TITLE = "Recovered Revenue";

export const RECOVERED_REVENUE_EXPLANATION =
  "Insurance payments attributed to opportunities identified by Dental AI.";

export const ATTRIBUTION_DISCLAIMER =
  "Insurance payment attributed to this opportunity.";

export type ClaimRecoveryState = "none" | "partial" | "recovered";

export type ClaimRecoverySummary = {
  opportunityId: string | null;
  identifiedEstimatedValue: number;
  creditedAmount: number;
  remainingOpportunityAmount: number;
  paymentPostedOn: string | null;
  paymentPostedLabel: typeof DATE_CP_UI_LABEL;
  state: ClaimRecoveryState;
  disclaimer: typeof ATTRIBUTION_DISCLAIMER;
};

export type RecoveredRevenueDetail = {
  attributionId: string;
  opportunityId: string;
  claimId: string | null;
  claimNumber: string | null;
  patientId: string | null;
  patientName: string;
  creditedAmount: number;
  paymentPostedOn: string;
  identifiedEstimatedValue: number;
  source: "opendental_claimproc";
};

export type RecoveredRevenueMetrics = {
  recoveredRevenue: number;
  details: RecoveredRevenueDetail[];
};

export function recoveryState(
  creditedAmount: number,
  identifiedEstimatedValue: number
): ClaimRecoveryState {
  if (creditedAmount <= 0) {
    return "none";
  }

  if (creditedAmount + 0.009 < identifiedEstimatedValue) {
    return "partial";
  }

  return "recovered";
}

export function summarizeClaimRecovery(input: {
  opportunityId: string | null;
  identifiedEstimatedValue: number;
  creditedAmount: number;
  paymentPostedOn: string | null;
}): ClaimRecoverySummary {
  const identified = Number(input.identifiedEstimatedValue ?? 0);
  const credited = Number(input.creditedAmount ?? 0);

  return {
    opportunityId: input.opportunityId,
    identifiedEstimatedValue: identified,
    creditedAmount: credited,
    remainingOpportunityAmount: Math.max(identified - credited, 0),
    paymentPostedOn: input.paymentPostedOn,
    paymentPostedLabel: DATE_CP_UI_LABEL,
    disclaimer: ATTRIBUTION_DISCLAIMER,
    state: recoveryState(credited, identified),
  };
}

export function emptyClaimRecovery(
  opportunityId: string | null = null,
  identifiedEstimatedValue = 0
): ClaimRecoverySummary {
  return summarizeClaimRecovery({
    opportunityId,
    identifiedEstimatedValue,
    creditedAmount: 0,
    paymentPostedOn: null,
  });
}

type QueryClient = {
  from: (table: string) => any;
};

export async function loadPracticeRecoveredRevenue(
  client: QueryClient,
  practiceId: string
): Promise<RecoveredRevenueMetrics> {
  if (!practiceId.trim()) {
    throw new Error("Practice id is required.");
  }

  const attributions = await paginateSupabaseQuery<StoredAttribution>(() =>
    client
      .from("opportunity_payment_attributions")
      .select(
        "id, practice_id, opportunity_id, claimproc_id, source_claimproc_id, credited_amount, payment_dated_at, identified_at_snapshot, cap_snapshot, status"
      )
      .eq("practice_id", practiceId)
      .eq("status", ATTRIBUTION_STATUS_ACTIVE)
      .order("id")
  );

  const scoped = attributions.filter(
    (row) => row.practice_id === practiceId && row.status === ATTRIBUTION_STATUS_ACTIVE
  );

  const recoveredRevenue = sumActiveAttributedAmount(scoped, practiceId);

  if (scoped.length === 0) {
    return { recoveredRevenue: 0, details: [] };
  }

  const opportunityIds = [...new Set(scoped.map((row) => row.opportunity_id))];
  const opportunities = await paginateSupabaseQuery<{
    id: string;
    practice_id: string;
    claim_id: string | null;
    patient_id: string | null;
    identified_estimated_value: number;
  }>(() =>
    client
      .from("revenue_opportunities")
      .select("id, practice_id, claim_id, patient_id, identified_estimated_value")
      .eq("practice_id", practiceId)
      .in("id", opportunityIds)
      .order("id")
  );

  const opportunityById = new Map(
    opportunities
      .filter((row) => row.practice_id === practiceId)
      .map((row) => [row.id, row])
  );

  const claimIds = [
    ...new Set(
      opportunities
        .map((row) => row.claim_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const patientIds = [
    ...new Set(
      opportunities
        .map((row) => row.patient_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const claims =
    claimIds.length > 0
      ? await paginateSupabaseQuery<{
          id: string;
          practice_id: string;
          claim_number: string | null;
        }>(() =>
          client
            .from("claims")
            .select("id, practice_id, claim_number")
            .eq("practice_id", practiceId)
            .in("id", claimIds)
            .order("id")
        )
      : [];

  const patients =
    patientIds.length > 0
      ? await paginateSupabaseQuery<{
          id: string;
          practice_id: string;
          first_name: string;
          last_name: string;
        }>(() =>
          client
            .from("patients")
            .select("id, practice_id, first_name, last_name")
            .eq("practice_id", practiceId)
            .in("id", patientIds)
            .order("id")
        )
      : [];

  const claimById = new Map(
    claims.filter((row) => row.practice_id === practiceId).map((row) => [row.id, row])
  );
  const patientById = new Map(
    patients
      .filter((row) => row.practice_id === practiceId)
      .map((row) => [row.id, row])
  );

  const details: RecoveredRevenueDetail[] = scoped.map((row) => {
    const opportunity = opportunityById.get(row.opportunity_id);
    const claim = opportunity?.claim_id
      ? claimById.get(opportunity.claim_id)
      : null;
    const patient = opportunity?.patient_id
      ? patientById.get(opportunity.patient_id)
      : null;

    return {
      attributionId: row.id,
      opportunityId: row.opportunity_id,
      claimId: opportunity?.claim_id ?? null,
      claimNumber: claim?.claim_number ?? null,
      patientId: opportunity?.patient_id ?? null,
      patientName: patient
        ? `${patient.first_name} ${patient.last_name}`.trim() || "Unknown patient"
        : "Unknown patient",
      creditedAmount: Number(row.credited_amount ?? 0),
      paymentPostedOn: row.payment_dated_at,
      identifiedEstimatedValue: Number(
        opportunity?.identified_estimated_value ?? row.cap_snapshot ?? 0
      ),
      source: "opendental_claimproc",
    };
  });

  return { recoveredRevenue, details };
}

export async function loadOpportunityRecoverySummary(
  client: QueryClient,
  practiceId: string,
  opportunityId: string | null,
  identifiedEstimatedValue: number
): Promise<ClaimRecoverySummary> {
  if (!opportunityId) {
    return emptyClaimRecovery(null, identifiedEstimatedValue);
  }

  const rows = await paginateSupabaseQuery<StoredAttribution>(() =>
    client
      .from("opportunity_payment_attributions")
      .select(
        "id, practice_id, opportunity_id, claimproc_id, source_claimproc_id, credited_amount, payment_dated_at, identified_at_snapshot, cap_snapshot, status"
      )
      .eq("practice_id", practiceId)
      .eq("opportunity_id", opportunityId)
      .eq("status", ATTRIBUTION_STATUS_ACTIVE)
      .order("payment_dated_at")
  );

  const scoped = rows.filter(
    (row) =>
      row.practice_id === practiceId &&
      row.opportunity_id === opportunityId &&
      row.status === ATTRIBUTION_STATUS_ACTIVE
  );

  const creditedAmount = scoped.reduce(
    (sum, row) => sum + Number(row.credited_amount ?? 0),
    0
  );
  const paymentPostedOn =
    scoped.length > 0 ? scoped[scoped.length - 1]?.payment_dated_at ?? null : null;

  return summarizeClaimRecovery({
    opportunityId,
    identifiedEstimatedValue,
    creditedAmount,
    paymentPostedOn,
  });
}

export async function applyAttributionMutations(
  context: Pick<SchedulerPracticeContext, "supabase" | "practiceId">,
  mutations: AttributionMutation[],
  syncedAt: string
): Promise<void> {
  for (const mutation of mutations) {
    if (mutation.kind === "insert") {
      const { data, error } = await context.supabase
        .from("opportunity_payment_attributions")
        .insert([
          {
            practice_id: context.practiceId,
            opportunity_id: mutation.opportunityId,
            claimproc_id: mutation.claimprocId,
            source_claimproc_id: mutation.sourceClaimProcId,
            credited_amount: mutation.creditedAmount,
            payment_dated_at: mutation.paymentDatedAt,
            identified_at_snapshot: mutation.identifiedAtSnapshot,
            cap_snapshot: mutation.capSnapshot,
            status: ATTRIBUTION_STATUS_ACTIVE,
            reversed_at: null,
            reversal_reason: null,
            updated_at: syncedAt,
          },
        ])
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      const attributionId = data?.id;

      if (attributionId) {
        const eventError = (
          await context.supabase.from("opportunity_payment_attribution_events").insert([
            {
              practice_id: context.practiceId,
              attribution_id: attributionId,
              opportunity_id: mutation.opportunityId,
              claimproc_id: mutation.claimprocId,
              source_claimproc_id: mutation.sourceClaimProcId,
              event_type: "credit",
              previous_credited_amount: 0,
              credited_amount: mutation.creditedAmount,
              reason: null,
            },
          ])
        ).error;

        if (eventError) {
          throw eventError;
        }
      }

      continue;
    }

    if (mutation.kind === "adjust") {
      const { error } = await context.supabase
        .from("opportunity_payment_attributions")
        .update({
          opportunity_id: mutation.opportunityId,
          credited_amount: mutation.creditedAmount,
          payment_dated_at: mutation.paymentDatedAt,
          status: ATTRIBUTION_STATUS_ACTIVE,
          reversed_at: null,
          reversal_reason: null,
          updated_at: syncedAt,
        })
        .eq("id", mutation.attributionId)
        .eq("practice_id", context.practiceId);

      if (error) {
        throw error;
      }

      const eventError = (
        await context.supabase.from("opportunity_payment_attribution_events").insert([
          {
            practice_id: context.practiceId,
            attribution_id: mutation.attributionId,
            opportunity_id: mutation.opportunityId,
            claimproc_id: mutation.claimprocId,
            source_claimproc_id: mutation.sourceClaimProcId,
            event_type: "adjust",
            previous_credited_amount: mutation.previousCreditedAmount,
            credited_amount: mutation.creditedAmount,
            reason: null,
          },
        ])
      ).error;

      if (eventError) {
        throw eventError;
      }

      continue;
    }

    const { error } = await context.supabase
      .from("opportunity_payment_attributions")
      .update({
        credited_amount: 0,
        status: ATTRIBUTION_STATUS_REVERSED,
        reversed_at: syncedAt,
        reversal_reason: mutation.reason,
        updated_at: syncedAt,
      })
      .eq("id", mutation.attributionId)
      .eq("practice_id", context.practiceId);

    if (error) {
      throw error;
    }

    const eventError = (
      await context.supabase.from("opportunity_payment_attribution_events").insert([
        {
          practice_id: context.practiceId,
          attribution_id: mutation.attributionId,
          opportunity_id: mutation.opportunityId,
          claimproc_id: mutation.claimprocId,
          source_claimproc_id: mutation.sourceClaimProcId,
          event_type: "reverse",
          previous_credited_amount: mutation.previousCreditedAmount,
          credited_amount: 0,
          reason: mutation.reason,
        },
      ])
    ).error;

    if (eventError) {
      throw eventError;
    }
  }
}

export async function loadAttributionInputs(
  context: SchedulerPracticeContext
): Promise<{
  claimProcs: StoredClaimProc[];
  opportunities: AttributionOpportunity[];
  claims: AttributionClaim[];
  procedures: AttributionProcedure[];
  existing: StoredAttribution[];
}> {
  const [claimProcs, opportunities, claims, procedures, existing] =
    await Promise.all([
      paginateSupabaseQuery<StoredClaimProc>(() =>
        context.supabase
          .from("opendental_claimprocs")
          .select(
            "id, practice_id, source_claimproc_id, source_claim_id, source_procedure_id, source_patient_id, ins_pay_amt, ins_pay_est, status, write_off, claim_payment_num, date_cp, date_entry, proc_date, fee_billed, ded_applied, copay_amt, is_transfer, is_overpay, claim_adj_reason_codes, absent_from_sync_at"
          )
          .eq("practice_id", context.practiceId)
          .eq("integration_id", context.integrationId)
          .order("id")
      ),
      paginateSupabaseQuery<AttributionOpportunity>(() =>
        context.supabase
          .from("revenue_opportunities")
          .select(
            "id, practice_id, opportunity_type, patient_id, claim_id, procedure_id, identified_at, identified_estimated_value, workflow_status, close_reason"
          )
          .eq("practice_id", context.practiceId)
          .eq("opportunity_type", "Claim")
          .order("id")
      ),
      paginateSupabaseQuery<AttributionClaim>(() =>
        context.supabase
          .from("claims")
          .select("id, practice_id, source_claim_id, amount_paid, paid_at")
          .eq("practice_id", context.practiceId)
          .order("id")
      ),
      paginateSupabaseQuery<AttributionProcedure>(() =>
        context.supabase
          .from("procedures")
          .select("id, practice_id, source_procedure_id")
          .eq("practice_id", context.practiceId)
          .order("id")
      ),
      paginateSupabaseQuery<StoredAttribution>(() =>
        context.supabase
          .from("opportunity_payment_attributions")
          .select(
            "id, practice_id, opportunity_id, claimproc_id, source_claimproc_id, credited_amount, payment_dated_at, identified_at_snapshot, cap_snapshot, status"
          )
          .eq("practice_id", context.practiceId)
          .order("id")
      ),
    ]);

  return {
    claimProcs: claimProcs.filter((row) => row.practice_id === context.practiceId),
    opportunities: opportunities.filter(
      (row) => row.practice_id === context.practiceId
    ),
    claims: claims.filter((row) => row.practice_id === context.practiceId),
    procedures: procedures.filter((row) => row.practice_id === context.practiceId),
    existing: existing.filter((row) => row.practice_id === context.practiceId),
  };
}

export async function runPaymentAttribution(
  context: SchedulerPracticeContext,
  syncedAt: string = new Date().toISOString()
): Promise<{ mutations: number }> {
  const input = await loadAttributionInputs(context);
  const mutations = planPracticeAttributions(input);
  await applyAttributionMutations(context, mutations, syncedAt);
  return { mutations: mutations.length };
}
