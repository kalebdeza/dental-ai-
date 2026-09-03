import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import type { PracticeJobStepResult } from "./runPracticeJobSequence.ts";
import {
  assertSchedulerPracticeContext,
  type SchedulerPracticeContext,
} from "./schedulerContext.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";
import {
  mapClaimRow,
  mapPatientRow,
  mapProcedureCodeRow,
  mapProcedureRow,
  mapRecallRow,
} from "./opendental/mapRecords.ts";
import type {
  OpenDentalClaim,
  OpenDentalPatient,
  OpenDentalProcedure,
  OpenDentalProcedureCode,
  OpenDentalRecall,
} from "./opendental/types.ts";

const UPSERT_BATCH_SIZE = 100;

export type SchedulerSyncResult = PracticeJobStepResult & {
  error?: string;
  skipped?: {
    procedures: number;
    claims: number;
    recalls: number;
  };
};

async function upsertBatch(
  context: SchedulerPracticeContext,
  table:
    | "patients"
    | "procedure_codes"
    | "procedures"
    | "claims"
    | "recalls",
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await context.supabase
      .from(table)
      .upsert(batch as never, { onConflict });

    if (error) {
      return { ok: false, error: "tenant_upsert_failed" };
    }
  }

  return { ok: true };
}

async function loadPatientMap(
  context: SchedulerPracticeContext
): Promise<Map<string, string> | null> {
  try {
    const data = await paginateSupabaseQuery<{
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

    const map = new Map<string, string>();

    for (const row of data) {
      map.set(row.source_patient_id, row.id);
    }

    return map;
  } catch {
    return null;
  }
}

async function loadProcedureCodeMap(
  context: SchedulerPracticeContext
): Promise<Map<string, string> | null> {
  try {
    const data = await paginateSupabaseQuery<{
      id: string;
      source_code_id: string;
    }>(() =>
      context.supabase
        .from("procedure_codes")
        .select("id, source_code_id")
        .eq("integration_id", context.integrationId)
        .order("id")
    );

    const map = new Map<string, string>();

    for (const row of data) {
      map.set(row.source_code_id, row.id);
    }

    return map;
  } catch {
    return null;
  }
}

/**
 * Upserts Open Dental records for one locked practice.
 * Does not stamp last_sync_at. Does not log credentials or clinical fields.
 */
export async function runSchedulerOpenDentalSync(
  context: SchedulerPracticeContext,
  client: SchedulerOpenDentalClient
): Promise<SchedulerSyncResult> {
  assertSchedulerPracticeContext(context);

  const syncedAt = new Date().toISOString();
  const skipped = {
    procedures: 0,
    claims: 0,
    recalls: 0,
  };

  try {
    await client.assertReachable();

    await client.forEachProcedureCodePage(async (page: OpenDentalProcedureCode[]) => {
      const rows = page.map((row) =>
        mapProcedureCodeRow(context, row, syncedAt)
      );
      const result = await upsertBatch(
        context,
        "procedure_codes",
        rows,
        "integration_id,source_code_id"
      );

      if (!result.ok) {
        throw new Error(result.error);
      }
    });

    await client.forEachPatientPage(async (page: OpenDentalPatient[]) => {
      const rows = page.map((row) => mapPatientRow(context, row, syncedAt));
      const result = await upsertBatch(
        context,
        "patients",
        rows,
        "integration_id,source_patient_id"
      );

      if (!result.ok) {
        throw new Error(result.error);
      }
    });

    const patientMap = await loadPatientMap(context);
    const procedureCodeMap = await loadProcedureCodeMap(context);

    if (!patientMap || !procedureCodeMap) {
      return { status: "failed", error: "tenant_read_failed" };
    }

    await client.forEachProcedurePage(async (page: OpenDentalProcedure[]) => {
      const rows = [];

      for (const procedure of page) {
        const patientId = patientMap.get(String(procedure.PatNum));
        const procedureCodeId =
          procedure.CodeNum !== undefined
            ? procedureCodeMap.get(String(procedure.CodeNum))
            : undefined;

        if (!patientId || !procedureCodeId) {
          skipped.procedures += 1;
          continue;
        }

        rows.push(
          mapProcedureRow(
            context,
            procedure,
            patientId,
            procedureCodeId,
            syncedAt
          )
        );
      }

      if (rows.length === 0) {
        return;
      }

      const result = await upsertBatch(
        context,
        "procedures",
        rows,
        "integration_id,source_procedure_id"
      );

      if (!result.ok) {
        throw new Error(result.error);
      }
    });

    await client.forEachClaimPage(async (page: OpenDentalClaim[]) => {
      const rows = [];

      for (const claim of page) {
        const patientId = patientMap.get(String(claim.PatNum));

        if (!patientId) {
          skipped.claims += 1;
          continue;
        }

        rows.push(mapClaimRow(context, claim, patientId, syncedAt));
      }

      if (rows.length === 0) {
        return;
      }

      const result = await upsertBatch(
        context,
        "claims",
        rows,
        "integration_id,source_claim_id"
      );

      if (!result.ok) {
        throw new Error(result.error);
      }
    });

    await client.forEachRecallPage(async (page: OpenDentalRecall[]) => {
      const rows = [];

      for (const recall of page) {
        const patientId = patientMap.get(String(recall.PatNum));

        if (!patientId) {
          skipped.recalls += 1;
          continue;
        }

        rows.push(mapRecallRow(context, recall, patientId, syncedAt));
      }

      if (rows.length === 0) {
        return;
      }

      const result = await upsertBatch(
        context,
        "recalls",
        rows,
        "integration_id,source_recall_id"
      );

      if (!result.ok) {
        throw new Error(result.error);
      }
    });

    return { status: "succeeded", skipped };
  } catch {
    return { status: "failed", error: "open_dental_sync_failed" };
  }
}
