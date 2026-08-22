import { supabase } from "@/lib/supabase";

export async function getRevenueOpportunities() {
  const { data, error } = await supabase
    .from("revenue_opportunities")
    .select("*");

  if (error) throw error;

  return data ?? [];
}