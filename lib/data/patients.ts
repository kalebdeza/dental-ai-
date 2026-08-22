import { supabase } from "@/lib/supabase";

export async function getPatients() {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("last_name");

  if (error) throw error;

  return data ?? [];
}

export async function getPatient(id: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
}