import { supabase } from "../supabase";
import type { Tables } from "../database.types";

import { resolveSolePracticeId } from "./resolvePracticeId";
import type { OpportunityActivityRow } from "./opportunityWorkflow";
import type { ClaimRecoverySummary } from "./recoveredRevenue";
import {
  emptyClaimRecovery,
  loadOpportunityRecoverySummary,
} from "./recoveredRevenue";

export type { ClaimRecoverySummary };

export type Claim = Tables<"claims">;
export type Patient = Tables<"patients">;
export type Provider = Tables<"providers">;

/**
 * Claims have no procedure_id in the schema, so procedure cannot be loaded
 * as a related row. patient_id is required, but the patient row can still
 * be missing. provider_id is nullable.
 */
export type ClaimOpportunitySummary = {
  id: string;
  reason: string | null;
  recommended_action: string | null;
  estimated_value: number;
  priority: string;
  completed: boolean;
  workflow_status: string;
  snoozed_until: string | null;
  identified_estimated_value?: number;
};

export interface ClaimWithDetails extends Claim {
  patient: Patient | null;
  provider: Provider | null;
  opportunity: ClaimOpportunitySummary | null;
  activities: OpportunityActivityRow[];
  recovery: ClaimRecoverySummary;
}

export async function getClaims(): Promise<Claim[]> {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    return [];
  }

  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("practice_id", practiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getClaim(id: string): Promise<Claim> {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    throw new Error("Practice not resolved.");
  }

  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practiceId)
    .single();

  if (error) throw error;

  return data;
}

type QueryClient = {
  from: (table: string) => any;
};

export async function loadPracticeClaimWithDetails(
  client: QueryClient,
  practiceId: string,
  claimId: string
): Promise<ClaimWithDetails | null> {
  const { data: claim, error: claimError } = await client
    .from("claims")
    .select("*")
    .eq("id", claimId)
    .eq("practice_id", practiceId)
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claim || claim.practice_id !== practiceId) {
    return null;
  }

  const [{ data: patient }, { data: provider }, { data: opportunities }] =
    await Promise.all([
      client
        .from("patients")
        .select("*")
        .eq("id", claim.patient_id)
        .eq("practice_id", practiceId)
        .maybeSingle(),

      claim.provider_id
        ? client
            .from("providers")
            .select("*")
            .eq("id", claim.provider_id)
            .eq("practice_id", practiceId)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      client
        .from("revenue_opportunities")
        .select(
          "id, reason, recommended_action, estimated_value, identified_estimated_value, priority, completed, workflow_status, snoozed_until"
        )
        .eq("practice_id", practiceId)
        .eq("claim_id", claim.id)
        .eq("opportunity_type", "Claim")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  const opportunity = opportunities?.[0]
    ? {
        id: opportunities[0].id,
        reason: opportunities[0].reason,
        recommended_action: opportunities[0].recommended_action,
        estimated_value: opportunities[0].estimated_value,
        identified_estimated_value: opportunities[0].identified_estimated_value,
        priority: opportunities[0].priority,
        completed: opportunities[0].completed,
        workflow_status: opportunities[0].workflow_status,
        snoozed_until: opportunities[0].snoozed_until,
      }
    : null;

  let activities: OpportunityActivityRow[] = [];

  if (opportunity) {
    const { data: activityRows, error: activitiesError } = await client
      .from("opportunity_activities")
      .select("*")
      .eq("practice_id", practiceId)
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: true });

    if (activitiesError) throw activitiesError;
    activities = activityRows ?? [];
  }

  const recovery = await loadOpportunityRecoverySummary(
    client,
    practiceId,
    opportunity?.id ?? null,
    Number(opportunity?.identified_estimated_value ?? 0)
  );

  return {
    ...claim,
    patient: patient ?? null,
    provider: provider ?? null,
    opportunity,
    activities,
    recovery: opportunity
      ? recovery
      : emptyClaimRecovery(null, 0),
  };
}

export async function getClaimWithDetails(
  id: string
): Promise<ClaimWithDetails> {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    throw new Error("Practice not resolved.");
  }

  const details = await loadPracticeClaimWithDetails(supabase, practiceId, id);

  if (!details) {
    throw new Error("Claim not found.");
  }

  return details;
}
