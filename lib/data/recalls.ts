import { supabase } from "@/lib/supabase";

import { resolveSolePracticeId } from "./resolvePracticeId";

export async function getRecalls() {
  const practiceId = await resolveSolePracticeId();

  if (!practiceId) {
    return [];
  }

  const { data, error } = await supabase
    .from("recalls")
    .select("*")
    .eq("practice_id", practiceId);

  if (error) throw error;

  return data ?? [];
}
