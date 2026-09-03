import { supabase } from "../supabase";
import type { Tables } from "../database.types";

import { resolveSolePracticeId } from "./resolvePracticeId";

export type Claim = Tables<"claims">;
export type Patient = Tables<"patients">;
export type Provider = Tables<"providers">;

/**
 * Claims have no procedure_id in the schema, so procedure cannot be loaded
 * as a related row. patient_id is required, but the patient row can still
 * be missing. provider_id is nullable.
 */
export interface ClaimWithDetails extends Claim {
  patient: Patient | null;
  provider: Provider | null;
}

export async function getClaims(): Promise<Claim[]> {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    return [];
  }

  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("practice_id", practiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getClaim(id: string): Promise<Claim> {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    throw new Error("Practice not resolved.");
  }

  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practiceId)
    .single();

  if (error) throw error;

  return data;
}

export async function getClaimWithDetails(
  id: string
): Promise<ClaimWithDetails> {
  const claim = await getClaim(id);

  const [{ data: patient }, { data: provider }] = await Promise.all([
    supabase
      .from("patients")
      .select("*")
      .eq("id", claim.patient_id)
      .eq("practice_id", claim.practice_id)
      .maybeSingle(),

    claim.provider_id
      ? supabase
          .from("providers")
          .select("*")
          .eq("id", claim.provider_id)
          .eq("practice_id", claim.practice_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...claim,
    patient: patient ?? null,
    provider: provider ?? null,
  };
}
