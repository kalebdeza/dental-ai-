import { supabase } from "@/lib/supabase";

export async function getRecalls() {
  const { data, error } = await supabase
    .from("recalls")
    .select("*");

  if (error) throw error;

  return data ?? [];
}