import { buildRecallOpportunities } from "../opendental/recallOpportunities.ts";
import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import { replaceOpenOpportunitiesByType } from "./replaceOpenOpportunitiesByType.ts";
import type { PracticeJobStepResult } from "./runPracticeJobSequence.ts";
import {
  assertSchedulerPracticeContext,
  type SchedulerPracticeContext,
} from "./schedulerContext.ts";

export async function runSchedulerRecallScan(
  context: SchedulerPracticeContext
): Promise<PracticeJobStepResult> {
  assertSchedulerPracticeContext(context);

  try {
    const recalls = await paginateSupabaseQuery<{
      patient_id: string;
      due_date: string | null;
      completed_date: string | null;
      recall_type: string | null;
      estimated_revenue: number | null;
    }>(() =>
      context.supabase
        .from("recalls")
        .select(
          "patient_id, due_date, completed_date, recall_type, estimated_revenue"
        )
        .eq("practice_id", context.practiceId)
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const opportunities = buildRecallOpportunities(recalls);

    await replaceOpenOpportunitiesByType(context, "Recall", opportunities);

    return { status: "succeeded" };
  } catch {
    return { status: "failed" };
  }
}
