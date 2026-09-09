import {
  mergeOpportunitiesByType,
  type MergeCandidate,
  type SchedulerOpportunityType,
} from "./mergeOpportunitiesByType.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";

export {
  SCHEDULER_OPPORTUNITY_TYPES,
  type SchedulerOpportunityType,
} from "./mergeOpportunitiesByType.ts";

export type SchedulerOpportunityInsert = MergeCandidate;

/**
 * Persist one opportunity type for one practice using natural-key merge.
 * practice_id and opportunity_type come from the scheduler context / typed
 * argument, never from caller-supplied row fields.
 */
export async function replaceOpenOpportunitiesByType(
  context: SchedulerPracticeContext,
  opportunityType: SchedulerOpportunityType,
  opportunities: SchedulerOpportunityInsert[]
): Promise<{ created: number }> {
  const result = await mergeOpportunitiesByType(
    context,
    opportunityType,
    opportunities
  );

  return { created: result.created };
}
