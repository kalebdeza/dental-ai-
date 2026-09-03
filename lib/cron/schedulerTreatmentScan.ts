import { TREAT_PLAN_STATUS } from "../opendental/status.ts";
import { buildTreatmentOpportunities } from "../opendental/treatmentOpportunities.ts";
import { mapPool } from "./mapPool.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";
import type {
  OpenDentalProcTP,
  OpenDentalTreatPlan,
  OpenDentalTreatPlanAttach,
} from "./opendental/types.ts";
import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import { replaceOpenOpportunitiesByType } from "./replaceOpenOpportunitiesByType.ts";
import type { PracticeJobStepResult } from "./runPracticeJobSequence.ts";
import {
  assertSchedulerPracticeContext,
  type SchedulerPracticeContext,
} from "./schedulerContext.ts";

export const TREATMENT_PLAN_FETCH_CONCURRENCY = 3;

function uniqueTreatPlans(
  plans: OpenDentalTreatPlan[]
): OpenDentalTreatPlan[] {
  const seen = new Set<number>();
  const unique: OpenDentalTreatPlan[] = [];

  for (const plan of plans) {
    if (seen.has(plan.TreatPlanNum)) {
      continue;
    }

    seen.add(plan.TreatPlanNum);
    unique.push(plan);
  }

  return unique;
}

export async function loadTreatmentPlanDetails(
  client: SchedulerOpenDentalClient,
  plans: OpenDentalTreatPlan[],
  concurrency = TREATMENT_PLAN_FETCH_CONCURRENCY
): Promise<{
  attaches: OpenDentalTreatPlanAttach[];
  procTPs: OpenDentalProcTP[];
}> {
  const unique = uniqueTreatPlans(plans);
  const attaches: OpenDentalTreatPlanAttach[] = [];
  const procTPs: OpenDentalProcTP[] = [];

  await mapPool(unique, concurrency, async (plan) => {
    if (
      plan.TPStatus === TREAT_PLAN_STATUS.Active ||
      plan.TPStatus === TREAT_PLAN_STATUS.Inactive
    ) {
      const page = await client.listTreatPlanAttaches(plan.TreatPlanNum);
      attaches.push(...page);
      return;
    }

    if (plan.TPStatus === TREAT_PLAN_STATUS.Saved) {
      const page = await client.listProcTPs(plan.TreatPlanNum);
      procTPs.push(...page);
    }
  });

  return { attaches, procTPs };
}

export async function runSchedulerTreatmentScan(
  context: SchedulerPracticeContext,
  client: SchedulerOpenDentalClient
): Promise<PracticeJobStepResult> {
  assertSchedulerPracticeContext(context);

  try {
    const patients = await paginateSupabaseQuery<{
      id: string;
      source_patient_id: string;
    }>(() =>
      context.supabase
        .from("patients")
        .select("id, source_patient_id")
        .eq("practice_id", context.practiceId)
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const procedures = await paginateSupabaseQuery<{
      id: string;
      source_procedure_id: string;
      patient_id: string;
      status: string | null;
      fee: number | null;
    }>(() =>
      context.supabase
        .from("procedures")
        .select("id, source_procedure_id, patient_id, status, fee")
        .eq("practice_id", context.practiceId)
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const plans = await client.listTreatPlans();
    const { attaches, procTPs } = await loadTreatmentPlanDetails(
      client,
      plans
    );

    const opportunities = buildTreatmentOpportunities({
      patients,
      procedures,
      plans: uniqueTreatPlans(plans),
      attaches,
      procTPs,
    });

    await replaceOpenOpportunitiesByType(context, "Treatment", opportunities);

    return { status: "succeeded" };
  } catch {
    return { status: "failed" };
  }
}
