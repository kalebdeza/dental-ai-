import { NextRequest } from "next/server";

import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { ApiResponse } from "@/lib/api/response";
import { authorizeCronRequest } from "@/lib/cron/authorizeCron";
import { getDueJobs, hasDueJob } from "@/lib/cron/due";
import { listConnectedOpenDentalIntegrations } from "@/lib/cron/listConnectedIntegrations";
import {
  acquirePracticeJobLock,
  loadPracticeJobCursor,
  releasePracticeJobLock,
  savePracticeJobCursor,
} from "@/lib/cron/practiceJobLock";
import { processPracticeJobs } from "@/lib/cron/processPracticeJobs";
import { planPracticeJobTick } from "@/lib/cron/selectDueBatch";
import { createSchedulerClient } from "@/lib/supabase/scheduler";

export const dynamic = "force-dynamic";

// Next.js requires a numeric literal here. Keep in sync with
// PRACTICE_JOB_MAX_DURATION_SECONDS in lib/cron/timeout.ts (lock TTL is derived from that).
export const maxDuration = 300;

/**
 * Lightweight scheduler tick.
 *
 * Each invocation processes a bounded number of due practices (see
 * PRACTICE_JOBS_PER_INVOCATION). Remaining due practices are selected on
 * later ticks by rotating from a Redis cursor of the last inspected
 * integration id. The HTTP request cannot choose practice IDs or the cursor.
 * Per-practice Redis locks still serialize overlapping ticks.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCronRequest(request)) {
    return ApiResponse.unauthorized();
  }

  let supabase: ReturnType<typeof createSchedulerClient>;
  let cursor: string | null;

  try {
    supabase = createSchedulerClient();
    cursor = await loadPracticeJobCursor();
  } catch (error) {
    logger.error("Practice job scheduler setup failed");
    return ApiErrorHandler.handle(error);
  }

  let integrations;

  try {
    integrations = await listConnectedOpenDentalIntegrations(supabase);
  } catch (error) {
    logger.error("Practice job enumeration failed");
    return ApiErrorHandler.handle(error);
  }

  const now = new Date();
  const { batch, nextCursor } = planPracticeJobTick(integrations, cursor, now);
  const dueCount = integrations.filter((integration) =>
    hasDueJob(
      getDueJobs({
        syncFrequencyMinutes: integration.sync_frequency_minutes,
        lastSyncAt: integration.last_sync_at,
        lastClaimScanAt: integration.last_claim_scan_at,
        lastRecallScanAt: integration.last_recall_scan_at,
        lastTreatmentScanAt: integration.last_treatment_scan_at,
        now,
      })
    )
  ).length;

  const summary = {
    due: dueCount,
    scheduled: batch.length,
    deferred: Math.max(0, dueCount - batch.length),
    locked: 0,
    processed: 0,
    skipped: integrations.length - dueCount,
    failed: 0,
  };

  for (const integration of batch) {
    try {
      let lockToken: string | null;

      try {
        lockToken = await acquirePracticeJobLock(integration.practice_id);
      } catch {
        logger.error("Practice job lock failed", {
          practiceId: integration.practice_id,
          integrationId: integration.id,
        });
        summary.failed += 1;
        continue;
      }

      if (!lockToken) {
        logger.info("Practice job already locked", {
          practiceId: integration.practice_id,
          integrationId: integration.id,
        });
        summary.locked += 1;
        continue;
      }

      try {
        const due = getDueJobs({
          syncFrequencyMinutes: integration.sync_frequency_minutes,
          lastSyncAt: integration.last_sync_at,
          lastClaimScanAt: integration.last_claim_scan_at,
          lastRecallScanAt: integration.last_recall_scan_at,
          lastTreatmentScanAt: integration.last_treatment_scan_at,
          now,
        });

        const outcome = await processPracticeJobs({
          supabase,
          practiceId: integration.practice_id,
          integrationId: integration.id,
          due,
        });

        const jobFailed =
          outcome.sync === "failed" ||
          outcome.claim === "failed" ||
          outcome.recall === "failed" ||
          outcome.treatment === "failed";

        if (jobFailed) {
          summary.failed += 1;
        } else {
          summary.processed += 1;
        }

        logger.info("Practice jobs processed", {
          practiceId: integration.practice_id,
          integrationId: integration.id,
          sync: outcome.sync,
          claim: outcome.claim,
          recall: outcome.recall,
          treatment: outcome.treatment,
        });
      } finally {
        await releasePracticeJobLock(integration.practice_id, lockToken);
      }
    } catch {
      summary.failed += 1;
      logger.error("Practice job failed", {
        practiceId: integration.practice_id,
        integrationId: integration.id,
      });
    }
  }

  if (nextCursor) {
    try {
      await savePracticeJobCursor(nextCursor);
    } catch {
      logger.error("Practice job cursor save failed");
    }
  }

  return ApiResponse.ok({
    success: true,
    ...summary,
  });
}
