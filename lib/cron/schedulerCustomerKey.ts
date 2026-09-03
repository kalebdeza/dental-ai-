import "server-only";

import { decrypt } from "@/lib/security/encryption";

import {
  assertSchedulerPracticeContext,
  type SchedulerPracticeContext,
} from "./schedulerContext";

export async function loadSchedulerCustomerKey(
  context: SchedulerPracticeContext
): Promise<string> {
  assertSchedulerPracticeContext(context);

  const { data, error } = await context.supabase
    .from("integrations")
    .select("customer_key, status, provider")
    .eq("id", context.integrationId)
    .eq("practice_id", context.practiceId)
    .eq("provider", "opendental")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load the Open Dental integration.");
  }

  if (!data || data.status !== "connected" || !data.customer_key) {
    throw new Error("Open Dental integration is not connected.");
  }

  return decrypt(data.customer_key);
}
