import { paginateSupabaseQuery } from "./paginateSupabase.ts";
import type { ConnectedIntegrationRow } from "./selectDueBatch.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";

/**
 * Loads every connected Open Dental integration.
 * Paginated: a clinic group with more than ~1000 practices must not be truncated.
 */
export async function listConnectedOpenDentalIntegrations(
  supabase: SchedulerPracticeContext["supabase"]
): Promise<ConnectedIntegrationRow[]> {
  const rows = await paginateSupabaseQuery<ConnectedIntegrationRow>(() =>
    supabase
      .from("integrations")
      .select(
        "id, practice_id, sync_frequency_minutes, last_sync_at, last_claim_scan_at, last_recall_scan_at, last_treatment_scan_at"
      )
      .eq("provider", "opendental")
      .eq("status", "connected")
      .not("customer_key", "is", null)
      .order("id")
  );

  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
}
