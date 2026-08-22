import { env } from "@/lib/api/env";
import { ApiResponse } from "@/lib/api/response";

/**
 * Blocks routes that disclose patient data to an external AI provider.
 *
 * Returns null when the route may proceed, otherwise a 503 to return
 * immediately. Call this before reading the request body so that patient
 * data is never parsed, logged, or placed in a prompt while disabled.
 */
export function aiGuard() {
  if (env.AI_PHI_ENABLED === "true") {
    return null;
  }

  return ApiResponse.serviceUnavailable(
    "AI features are temporarily disabled pending a signed data protection agreement with the AI provider."
  );
}
