import { supabase } from "../supabase";
import type { Tables } from "../database.types";

export type Claim = Tables<"claims">;
export type Patient = Tables<"patients">;
export type Provider = Tables<"providers">;

export interface ClaimWithDetails extends Claim {
  patient: Patient | null;
  provider: Provider | null;
}

export async function getClaims(): Promise<Claim[]> {
  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getClaim(id: string): Promise<Claim> {
  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("id", id)
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
      .single(),

    claim.provider_id
      ? supabase
          .from("providers")
          .select("*")
          .eq("id", claim.provider_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...claim,
    patient,
    provider,
  };
}