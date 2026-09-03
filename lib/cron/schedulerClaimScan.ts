import { buildClaimOpportunities } from "../opendental/claimOpportunities.ts";
import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import { replaceOpenOpportunitiesByType } from "./replaceOpenOpportunitiesByType.ts";
import type { PracticeJobStepResult } from "./runPracticeJobSequence.ts";
import {
  assertSchedulerPracticeContext,
  type SchedulerPracticeContext,
} from "./schedulerContext.ts";

export async function runSchedulerClaimScan(
  context: SchedulerPracticeContext
): Promise<PracticeJobStepResult> {
  assertSchedulerPracticeContext(context);

  try {
    const procedures = await paginateSupabaseQuery<{
      id: string;
      patient_id: string;
      fee: number | null;
      status: string | null;
    }>(() =>
      context.supabase
        .from("procedures")
        .select("id, patient_id, fee, status")
        .eq("practice_id", context.practiceId)
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const claims = await paginateSupabaseQuery<{
      id: string;
      patient_id: string;
      status: string | null;
      amount_billed: number | null;
      remaining_balance: number | null;
    }>(() =>
      context.supabase
        .from("claims")
        .select("id, patient_id, status, amount_billed, remaining_balance")
        .eq("practice_id", context.practiceId)
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const opportunities = buildClaimOpportunities(procedures, claims);

    await replaceOpenOpportunitiesByType(context, "Claim", opportunities);

    return { status: "succeeded" };
  } catch {
    return { status: "failed" };
  }
}
