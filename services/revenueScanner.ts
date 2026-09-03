import { buildClaimOpportunities } from "@/lib/opendental/claimOpportunities";
import type { SupabaseServerClient } from "@/lib/auth/types";

import { PROCEDURE_STATUS } from "@/lib/opendental/status";

export class RevenueScannerService {
  /*
   * The client is supplied by the caller rather than imported, so this runs
   * with the identity of the request that triggered the scan. The practice_id
   * filters below stay as they are: once row level security is enabled they
   * become a redundant second check rather than the only one.
   */
  async scan(
    supabase: SupabaseServerClient,
    practiceId: string
  ) {
    const { data: procedures, error } = await supabase
      .from("procedures")
      .select("*")
      .eq("practice_id", practiceId)
      .eq("status", PROCEDURE_STATUS.Completed);

    if (error) {
      throw error;
    }

    const { data: claims, error: claimsError } = await supabase
      .from("claims")
      .select("*")
      .eq("practice_id", practiceId);

    if (claimsError) {
      throw claimsError;
    }

    return buildClaimOpportunities(procedures ?? [], claims ?? []).map(
      (opportunity) => ({
        practice_id: practiceId,
        patient_id: opportunity.patient_id,
        claim_id: opportunity.claim_id,
        procedure_id: opportunity.procedure_id,
        opportunity_type: "Claim" as const,
        priority: opportunity.priority,
        estimated_value: opportunity.estimated_value,
        confidence_score: opportunity.confidence_score,
        reason: opportunity.reason,
        recommended_action: opportunity.recommended_action,
        completed: false,
      })
    );
  }
}

export const revenueScanner = new RevenueScannerService();
