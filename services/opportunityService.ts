import type { SupabaseServerClient } from "@/lib/auth/types";
import {
  isSchedulerOpportunityType,
  mergeOpportunitiesByType,
  type MergeCandidate,
  type SchedulerOpportunityType,
} from "@/lib/cron/mergeOpportunitiesByType";

export type OpportunityCandidate = MergeCandidate & {
  opportunity_type: string;
};

export class OpportunityService {
  async replaceOpenOpportunities(
    supabase: SupabaseServerClient,
    practiceId: string,
    opportunities: OpportunityCandidate[]
  ) {
    const byType: Record<SchedulerOpportunityType, MergeCandidate[]> = {
      Claim: [],
      Recall: [],
      Treatment: [],
    };

    for (const opportunity of opportunities) {
      if (!isSchedulerOpportunityType(opportunity.opportunity_type)) {
        continue;
      }

      byType[opportunity.opportunity_type].push(opportunity);
    }

    let created = 0;
    let updated = 0;
    let completed = 0;
    let droppedUnkeyed = 0;

    for (const opportunityType of ["Claim", "Recall", "Treatment"] as const) {
      const result = await mergeOpportunitiesByType(
        { supabase, practiceId },
        opportunityType,
        byType[opportunityType]
      );
      created += result.created;
      updated += result.updated;
      completed += result.completed;
      droppedUnkeyed += result.droppedUnkeyed;
    }

    return {
      created,
      updated,
      completed,
      droppedUnkeyed,
    };
  }
}

export const opportunityService = new OpportunityService();
