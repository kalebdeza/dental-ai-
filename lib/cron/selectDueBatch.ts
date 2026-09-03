import { getDueJobs, hasDueJob } from "./due.ts";

/**
 * One due practice per cron tick. A single 300s sync can consume the
 * whole function, so later due practices are picked on following ticks
 * via Redis cursor rotation — not skipped permanently.
 */
export const PRACTICE_JOBS_PER_INVOCATION = 1;

export type ConnectedIntegrationRow = {
  id: string;
  practice_id: string;
  sync_frequency_minutes: number;
  last_sync_at: string | null;
  last_claim_scan_at: string | null;
  last_recall_scan_at: string | null;
  last_treatment_scan_at: string | null;
};

/**
 * Stable rotation over connected integrations so each cron tick does a
 * bounded amount of work without starving later practices.
 *
 * Caller must pass integrations sorted by id. cursorId is the last
 * integration inspected on a previous tick (not a request parameter).
 */
export function selectDueBatch<T extends { id: string }>(
  ordered: T[],
  isDue: (item: T) => boolean,
  cursorId: string | null,
  limit: number = PRACTICE_JOBS_PER_INVOCATION
): { batch: T[]; nextCursor: string | null } {
  if (ordered.length === 0 || limit <= 0) {
    return { batch: [], nextCursor: cursorId };
  }

  let start = 0;

  if (cursorId) {
    const cursorIndex = ordered.findIndex((item) => item.id === cursorId);
    start = cursorIndex === -1 ? 0 : (cursorIndex + 1) % ordered.length;
  }

  const batch: T[] = [];
  let nextCursor = cursorId;
  let index = start;

  for (let visited = 0; visited < ordered.length; visited += 1) {
    const item = ordered[index];
    nextCursor = item.id;

    if (isDue(item)) {
      batch.push(item);

      if (batch.length >= limit) {
        break;
      }
    }

    index = (index + 1) % ordered.length;
  }

  return { batch, nextCursor };
}

export function planPracticeJobTick(
  integrations: ConnectedIntegrationRow[],
  cursorId: string | null,
  now: Date,
  limit: number = PRACTICE_JOBS_PER_INVOCATION
): { batch: ConnectedIntegrationRow[]; nextCursor: string | null } {
  const ordered = [...integrations].sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  return selectDueBatch(
    ordered,
    (item) =>
      hasDueJob(
        getDueJobs({
          syncFrequencyMinutes: item.sync_frequency_minutes,
          lastSyncAt: item.last_sync_at,
          lastClaimScanAt: item.last_claim_scan_at,
          lastRecallScanAt: item.last_recall_scan_at,
          lastTreatmentScanAt: item.last_treatment_scan_at,
          now,
        })
      ),
    cursorId,
    limit
  );
}
