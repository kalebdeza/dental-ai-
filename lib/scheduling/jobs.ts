import {
  sendConfirmationForAppointment,
  sendOpportunityOutreach,
  sendRecoveryOffer,
  sendReminderForAppointment,
  type WorkflowContext,
} from "./workflow.ts";
import type { SchedulingJobRow } from "./types.ts";

export type ProcessJobsResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

async function runJob(
  ctx: WorkflowContext,
  job: SchedulingJobRow
): Promise<"succeeded" | "skipped"> {
  switch (job.job_type) {
    case "confirmation":
      if (!job.appointment_id) {
        return "skipped";
      }
      {
        const result = await sendConfirmationForAppointment(
          ctx,
          job.practice_id,
          job.appointment_id
        );
        return result.skipped ? "skipped" : "succeeded";
      }
    case "reminder":
      if (!job.appointment_id) {
        return "skipped";
      }
      {
        const result = await sendReminderForAppointment(
          ctx,
          job.practice_id,
          job.appointment_id
        );
        return result.skipped ? "skipped" : "succeeded";
      }
    case "reschedule_follow_up":
    case "cancellation_recovery":
      if (!job.appointment_id) {
        return "skipped";
      }
      {
        const result = await sendRecoveryOffer(
          ctx,
          job.practice_id,
          job.appointment_id
        );
        return result.skipped ? "skipped" : "succeeded";
      }
    case "recall_outreach":
      if (!job.opportunity_id) {
        return "skipped";
      }
      {
        const result = await sendOpportunityOutreach(
          ctx,
          job.practice_id,
          job.opportunity_id,
          "recall"
        );
        return result.skipped ? "skipped" : "succeeded";
      }
    case "treatment_outreach":
      if (!job.opportunity_id) {
        return "skipped";
      }
      {
        const result = await sendOpportunityOutreach(
          ctx,
          job.practice_id,
          job.opportunity_id,
          "treatment"
        );
        return result.skipped ? "skipped" : "succeeded";
      }
    default:
      return "skipped";
  }
}

export async function processDueSchedulingJobs(
  ctx: WorkflowContext,
  options?: { practiceId?: string | null; limit?: number }
): Promise<ProcessJobsResult> {
  const claimed = await ctx.store.claimDueJobs({
    practiceId: options?.practiceId ?? null,
    now: ctx.now ?? new Date(),
    limit: options?.limit ?? 25,
  });

  const summary: ProcessJobsResult = {
    claimed: claimed.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of claimed) {
    try {
      const status = await runJob(ctx, job);
      await ctx.store.updateJob(job.practice_id, job.id, {
        status,
        last_error: null,
      });
      if (status === "skipped") {
        summary.skipped += 1;
      } else {
        summary.succeeded += 1;
      }
    } catch (error) {
      await ctx.store.updateJob(job.practice_id, job.id, {
        status: "failed",
        last_error: error instanceof Error ? error.message : "Job failed.",
      });
      summary.failed += 1;
    }
  }

  return summary;
}
