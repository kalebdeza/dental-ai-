import type { SchedulerSupabaseClient } from "../supabase/scheduler.ts";

export type SchedulerPracticeContext = {
  supabase: SchedulerSupabaseClient;
  practiceId: string;
  integrationId: string;
};

export function assertSchedulerPracticeContext(
  context: SchedulerPracticeContext
): void {
  if (!context.practiceId || !context.integrationId) {
    throw new Error("Scheduler practice context is incomplete.");
  }
}

export type SchedulableJob = "sync" | "claim" | "recall" | "treatment";

export class TimestampStampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimestampStampError";
  }
}

/**
 * Stamp a job timestamp only for the locked integration/practice pair.
 * Callers must pass IDs from the scheduler enumeration, never from the request.
 * Zero updated rows is a failure.
 */
export async function stampPracticeJobTimestamp(
  context: SchedulerPracticeContext,
  job: SchedulableJob,
  occurredAt: Date
): Promise<void> {
  assertSchedulerPracticeContext(context);

  const stampedAt = occurredAt.toISOString();
  const patch =
    job === "sync"
      ? { last_sync_at: stampedAt, updated_at: stampedAt }
      : job === "claim"
        ? { last_claim_scan_at: stampedAt, updated_at: stampedAt }
        : job === "recall"
          ? { last_recall_scan_at: stampedAt, updated_at: stampedAt }
          : { last_treatment_scan_at: stampedAt, updated_at: stampedAt };

  const { data, error } = await context.supabase
    .from("integrations")
    .update(patch)
    .eq("id", context.integrationId)
    .eq("practice_id", context.practiceId)
    .select("id");

  if (error) {
    throw error;
  }

  if (!data || data.length !== 1) {
    throw new TimestampStampError(
      "Practice job timestamp update affected no matching integration row."
    );
  }
}
