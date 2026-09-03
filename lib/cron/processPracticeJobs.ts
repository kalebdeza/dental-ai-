import { logger } from "@/lib/api/logger";

import type { PracticeJobDue, PracticeJobType } from "./due";
import { createSchedulerOpenDentalClient } from "./opendental/schedulerOpenDentalClient";
import { runPracticeJobSequence } from "./runPracticeJobSequence";
import type { PracticeJobStepResult } from "./runPracticeJobSequence";
import { runSchedulerClaimScan } from "./schedulerClaimScan";
import { loadSchedulerCustomerKey } from "./schedulerCustomerKey";
import type { SchedulableJob, SchedulerPracticeContext } from "./schedulerContext";
import { stampPracticeJobTimestamp } from "./schedulerContext";
import { runSchedulerOpenDentalSync } from "./schedulerOpenDentalSync";
import { runSchedulerRecallScan } from "./schedulerRecallScan";
import { runSchedulerTreatmentScan } from "./schedulerTreatmentScan";

export type ProcessPracticeJobsInput = SchedulerPracticeContext & {
  due: PracticeJobDue;
};

export type PracticeJobOutcome = {
  sync: "succeeded" | "failed" | "skipped";
  claim: "succeeded" | "failed" | "skipped";
  recall: "succeeded" | "failed" | "skipped";
  treatment: "succeeded" | "failed" | "skipped";
};

async function stampSucceeded(
  context: SchedulerPracticeContext,
  job: SchedulableJob,
  result: PracticeJobStepResult
): Promise<PracticeJobStepResult> {
  if (result.status !== "succeeded") {
    return result;
  }

  try {
    await stampPracticeJobTimestamp(context, job, new Date());
    return result;
  } catch {
    logger.error("Practice job timestamp stamp failed", {
      practiceId: context.practiceId,
      integrationId: context.integrationId,
      job,
    });
    return { status: "failed" };
  }
}

function logStep(
  context: SchedulerPracticeContext,
  job: PracticeJobType,
  result: PracticeJobStepResult,
  durationMs: number
): void {
  logger.info("Practice job step finished", {
    practiceId: context.practiceId,
    integrationId: context.integrationId,
    job,
    status: result.status,
    durationMs,
  });
}

/**
 * Scheduler entry for one locked practice.
 * Tenant IDs come from enumeration. Does not use cookies or request input.
 */
export async function processPracticeJobs(
  input: ProcessPracticeJobsInput
): Promise<PracticeJobOutcome> {
  const dueTypes = (
    Object.entries(input.due) as [PracticeJobType, boolean][]
  )
    .filter(([, isDue]) => isDue)
    .map(([job]) => job);

  logger.info("Practice jobs due", {
    practiceId: input.practiceId,
    integrationId: input.integrationId,
    jobs: dueTypes,
  });

  const context: SchedulerPracticeContext = {
    supabase: input.supabase,
    practiceId: input.practiceId,
    integrationId: input.integrationId,
  };

  const outcome: PracticeJobOutcome = {
    sync: "skipped",
    claim: "skipped",
    recall: "skipped",
    treatment: "skipped",
  };

  const needsOpenDental = input.due.sync || input.due.treatment;
  let openDentalClient: ReturnType<
    typeof createSchedulerOpenDentalClient
  > | null = null;

  if (needsOpenDental) {
    try {
      const customerKey = await loadSchedulerCustomerKey(context);
      openDentalClient = createSchedulerOpenDentalClient(customerKey);
    } catch {
      logger.error("Practice job Open Dental client setup failed", {
        practiceId: context.practiceId,
        integrationId: context.integrationId,
      });

      if (input.due.sync) {
        outcome.sync = "failed";
        return outcome;
      }
    }
  }

  await runPracticeJobSequence(input.due, {
    sync: async () => {
      const started = Date.now();

      if (!openDentalClient) {
        const result = { status: "failed" as const };
        logStep(context, "sync", result, Date.now() - started);
        return result;
      }

      const result = await stampSucceeded(
        context,
        "sync",
        await runSchedulerOpenDentalSync(context, openDentalClient)
      );
      outcome.sync = result.status === "succeeded" ? "succeeded" : "failed";
      logStep(context, "sync", result, Date.now() - started);
      return result;
    },
    claim: async () => {
      const started = Date.now();
      const result = await stampSucceeded(
        context,
        "claim",
        await runSchedulerClaimScan(context)
      );
      outcome.claim = result.status === "succeeded" ? "succeeded" : "failed";
      logStep(context, "claim", result, Date.now() - started);
      return result;
    },
    recall: async () => {
      const started = Date.now();
      const result = await stampSucceeded(
        context,
        "recall",
        await runSchedulerRecallScan(context)
      );
      outcome.recall = result.status === "succeeded" ? "succeeded" : "failed";
      logStep(context, "recall", result, Date.now() - started);
      return result;
    },
    treatment: async () => {
      const started = Date.now();

      if (!openDentalClient) {
        const result = { status: "failed" as const };
        outcome.treatment = "failed";
        logStep(context, "treatment", result, Date.now() - started);
        return result;
      }

      const result = await stampSucceeded(
        context,
        "treatment",
        await runSchedulerTreatmentScan(context, openDentalClient)
      );
      outcome.treatment =
        result.status === "succeeded" ? "succeeded" : "failed";
      logStep(context, "treatment", result, Date.now() - started);
      return result;
    },
  });

  if (!input.due.sync) {
    outcome.sync = "skipped";
  }

  if (!input.due.claim) {
    outcome.claim = "skipped";
  }

  if (!input.due.recall) {
    outcome.recall = "skipped";
  }

  if (!input.due.treatment) {
    outcome.treatment = "skipped";
  }

  return outcome;
}
