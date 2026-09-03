import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";
import { assertSchedulerPracticeContext } from "./schedulerContext.ts";

export const SCHEDULER_OPPORTUNITY_TYPES = [
  "Claim",
  "Recall",
  "Treatment",
] as const;

export type SchedulerOpportunityType =
  (typeof SCHEDULER_OPPORTUNITY_TYPES)[number];

export type SchedulerOpportunityInsert = {
  patient_id?: string | null;
  claim_id?: string | null;
  procedure_id?: string | null;
  priority: string;
  estimated_value: number;
  confidence_score?: number | null;
  reason?: string | null;
  recommended_action?: string | null;
};

const DELETE_ID_CHUNK = 500;
const INSERT_CHUNK = 500;

function isSchedulerOpportunityType(
  value: string
): value is SchedulerOpportunityType {
  return (SCHEDULER_OPPORTUNITY_TYPES as readonly string[]).includes(value);
}

/**
 * Replace incomplete opportunities of a single type for one practice.
 *
 * Inserts the next set first so a failed insert cannot wipe the previous
 * incomplete rows. Completed opportunities are never deleted.
 * practice_id and opportunity_type come from the scheduler context / typed
 * argument, never from caller-supplied row fields.
 */
export async function replaceOpenOpportunitiesByType(
  context: SchedulerPracticeContext,
  opportunityType: SchedulerOpportunityType,
  opportunities: SchedulerOpportunityInsert[]
): Promise<{ created: number }> {
  assertSchedulerPracticeContext(context);

  if (!isSchedulerOpportunityType(opportunityType)) {
    throw new Error("Unsupported scheduler opportunity type.");
  }

  const existing = await paginateSupabaseQuery<{ id: string }>(() =>
    context.supabase
      .from("revenue_opportunities")
      .select("id")
      .eq("practice_id", context.practiceId)
      .eq("opportunity_type", opportunityType)
      .eq("completed", false)
      .order("id")
  );

  const previousIds = existing.map((row) => row.id);

  if (opportunities.length > 0) {
    for (let index = 0; index < opportunities.length; index += INSERT_CHUNK) {
      const chunk = opportunities.slice(index, index + INSERT_CHUNK);
      const rows = chunk.map((opportunity) => ({
        practice_id: context.practiceId,
        patient_id: opportunity.patient_id ?? null,
        claim_id: opportunity.claim_id ?? null,
        procedure_id: opportunity.procedure_id ?? null,
        opportunity_type: opportunityType,
        priority: opportunity.priority,
        estimated_value: opportunity.estimated_value,
        confidence_score: opportunity.confidence_score ?? null,
        reason: opportunity.reason ?? null,
        recommended_action: opportunity.recommended_action ?? null,
        completed: false,
      }));

      const { error: insertError } = await context.supabase
        .from("revenue_opportunities")
        .insert(rows)
        .select("id");

      if (insertError) {
        throw insertError;
      }
    }
  }

  for (let index = 0; index < previousIds.length; index += DELETE_ID_CHUNK) {
    const chunk = previousIds.slice(index, index + DELETE_ID_CHUNK);
    const { error: deleteError } = await context.supabase
      .from("revenue_opportunities")
      .delete()
      .eq("practice_id", context.practiceId)
      .eq("opportunity_type", opportunityType)
      .eq("completed", false)
      .in("id", chunk);

    if (deleteError) {
      throw deleteError;
    }
  }

  return { created: opportunities.length };
}
