import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import type { PracticeJobStepResult } from "./runPracticeJobSequence.ts";
import {
  assertSchedulerPracticeContext,
  type SchedulerPracticeContext,
} from "./schedulerContext.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";
import {
  isAttributableClaimProcStatus,
  mapOpenDentalClaimProc,
} from "../opendental/claimProc.ts";
import type { OpenDentalClaimProc } from "../opendental/claimProc.ts";
import { runPaymentAttribution } from "../data/recoveredRevenue.ts";

export const CLAIMPROC_SYNC_STATUSES = ["Received", "Supplemental"] as const;

const UPSERT_BATCH_SIZE = 100;

export function emptyClaimProcStatusCounts(): Record<
  (typeof CLAIMPROC_SYNC_STATUSES)[number],
  number
> {
  return {
    Received: 0,
    Supplemental: 0,
  };
}

/**
 * Filtered Received/Supplemental pages are not proof a ClaimProc was
 * deleted. Only mark a stored row absent when its own status stream
 * returned mapped rows and this id was not in either stream.
 */
export function canMarkStoredClaimProcAbsent(input: {
  practiceId: string;
  row: {
    practice_id: string;
    source_claimproc_id: number;
    status: string;
  };
  seen: ReadonlySet<number>;
  mappedByStatus: Readonly<Record<string, number>>;
}): boolean {
  if (input.row.practice_id !== input.practiceId) {
    return false;
  }

  if (input.seen.has(Number(input.row.source_claimproc_id))) {
    return false;
  }

  if (!isAttributableClaimProcStatus(input.row.status)) {
    return false;
  }

  return (input.mappedByStatus[input.row.status] ?? 0) > 0;
}

export type SchedulerClaimProcSyncResult = PracticeJobStepResult & {
  skipped?: number;
  upserted?: number;
  attributed?: number;
};

async function upsertClaimProcBatch(
  context: SchedulerPracticeContext,
  rows: Record<string, unknown>[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await context.supabase
      .from("opendental_claimprocs")
      .upsert(batch as never, {
        onConflict: "integration_id,source_claimproc_id",
      });

    if (error) {
      return { ok: false, error: "tenant_upsert_failed" };
    }
  }

  return { ok: true };
}

function mapSyncedRow(
  context: SchedulerPracticeContext,
  payload: OpenDentalClaimProc,
  syncedAt: string
): Record<string, unknown> | null {
  const mapped = mapOpenDentalClaimProc(payload);

  if (!mapped) {
    return null;
  }

  return {
    practice_id: context.practiceId,
    integration_id: context.integrationId,
    ...mapped,
    absent_from_sync_at: null,
    last_synced_at: syncedAt,
    updated_at: syncedAt,
  };
}

export async function runSchedulerClaimProcSync(
  context: SchedulerPracticeContext,
  client: SchedulerOpenDentalClient,
  options?: { runAttribution?: boolean }
): Promise<SchedulerClaimProcSyncResult> {
  assertSchedulerPracticeContext(context);

  const syncedAt = new Date().toISOString();
  const seen = new Set<number>();
  const mappedByStatus = emptyClaimProcStatusCounts();
  const completedStatuses = new Set<string>();
  let skipped = 0;
  let upserted = 0;

  try {
    for (const status of CLAIMPROC_SYNC_STATUSES) {
      await client.forEachClaimProcPage(async (page) => {
        const rows: Record<string, unknown>[] = [];

        for (const payload of page) {
          const row = mapSyncedRow(context, payload, syncedAt);

          if (!row) {
            skipped += 1;
            continue;
          }

          seen.add(row.source_claimproc_id as number);
          mappedByStatus[status] += 1;
          rows.push(row);
        }

        if (rows.length === 0) {
          return;
        }

        const result = await upsertClaimProcBatch(context, rows);

        if (!result.ok) {
          throw new Error(result.error);
        }

        upserted += rows.length;
      }, status);

      completedStatuses.add(status);
    }

    const bothStatusesCompleted = CLAIMPROC_SYNC_STATUSES.every((status) =>
      completedStatuses.has(status)
    );

    if (!bothStatusesCompleted) {
      return { status: "failed", skipped, upserted };
    }

    const existing = await paginateSupabaseQuery<{
      id: string;
      practice_id: string;
      source_claimproc_id: number;
      status: string;
    }>(() =>
      context.supabase
        .from("opendental_claimprocs")
        .select("id, practice_id, source_claimproc_id, status")
        .eq("practice_id", context.practiceId)
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const scopedExisting = existing.filter(
      (row) => row.practice_id === context.practiceId
    );
    const mappedTotal = CLAIMPROC_SYNC_STATUSES.reduce(
      (sum, status) => sum + mappedByStatus[status],
      0
    );

    // Empty filtered result sets are indistinguishable from a bad Status
    // filter or an incomplete API response. Do not mark absent or mutate
    // recovered revenue in that case.
    if (mappedTotal === 0 && scopedExisting.length > 0) {
      return { status: "succeeded", skipped, upserted, attributed: 0 };
    }

    const missingIds = scopedExisting
      .filter((row) =>
        canMarkStoredClaimProcAbsent({
          practiceId: context.practiceId,
          row,
          seen,
          mappedByStatus,
        })
      )
      .map((row) => row.id);

    for (const id of missingIds) {
      const { error } = await context.supabase
        .from("opendental_claimprocs")
        .update({
          absent_from_sync_at: syncedAt,
          updated_at: syncedAt,
        })
        .eq("id", id)
        .eq("practice_id", context.practiceId);

      if (error) {
        throw error;
      }
    }

    let attributed = 0;

    if (options?.runAttribution !== false) {
      const result = await runPaymentAttribution(context, syncedAt);
      attributed = result.mutations;
    }

    return {
      status: "succeeded",
      skipped,
      upserted,
      attributed,
    };
  } catch {
    return { status: "failed" };
  }
}
