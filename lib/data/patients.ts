import { supabase } from "@/lib/supabase";

import { resolveSolePracticeId } from "./resolvePracticeId";

export async function getPatients() {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    return [];
  }

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("practice_id", practiceId)
    .order("last_name");

  if (error) throw error;

  return data ?? [];
}

export async function getPatient(id: string) {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    throw new Error("Practice not resolved.");
  }

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practiceId)
    .single();

  if (error) throw error;

  return data;
}
