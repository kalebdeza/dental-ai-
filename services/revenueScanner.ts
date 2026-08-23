import type { SupabaseServerClient } from "@/lib/auth/types";

import {
  isClaimAwaitingSubmission,
  PROCEDURE_STATUS,
} from "@/lib/opendental/status";

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
    const { data: procedures, error } =
      await supabase
        .from("procedures")
        .select("*")
        .eq("practice_id", practiceId)
        .eq(
          "status",
          PROCEDURE_STATUS.Completed
        );

    if (error) {
      throw error;
    }

    const { data: claims, error: claimsError } =
      await supabase
        .from("claims")
        .select("*")
        .eq("practice_id", practiceId);

    if (claimsError) {
      throw claimsError;
    }

    const opportunities = [];

    for (const procedure of procedures ?? []) {
      const procedureFee = Number(
        procedure.fee ?? 0
      );

      if (procedureFee <= 0) {
        continue;
      }

      /*
       * Claims currently relate to patients rather
       * than procedures in our database.
       *
       * Match by patient and billed amount.
       * Prefer an outstanding claim when multiple
       * claims match.
       */
      const matchingClaims = (
        claims ?? []
      ).filter(
        (claim) =>
          claim.patient_id ===
            procedure.patient_id &&
          Number(
            claim.amount_billed ?? 0
          ) === procedureFee
      );

      const matchingClaim =
        matchingClaims.find(
          (claim) =>
            Number(
              claim.remaining_balance ?? 0
            ) > 0
        ) ??
        matchingClaims[0];

      /*
       * No claim means the completed procedure
       * may still need to be submitted.
       */
      if (!matchingClaim) {
        opportunities.push({
          practice_id: practiceId,
          patient_id: procedure.patient_id,
          claim_id: null,
          procedure_id: procedure.id,

          opportunity_type: "Claim",

          priority: "High",

          /*
           * This is the actual Open Dental
           * procedure fee.
           */
          estimated_value: procedureFee,

          confidence_score: 70,

          reason:
            "Completed procedure with no matching insurance claim.",

          recommended_action:
            "Review and submit the insurance claim.",

          completed: false,
        });

        continue;
      }

      /*
       * If a claim exists but has not been
       * submitted, use the actual billed amount.
       */
      if (
        isClaimAwaitingSubmission(
          matchingClaim.status
        )
      ) {
        opportunities.push({
          practice_id: practiceId,
          patient_id: procedure.patient_id,
          claim_id: matchingClaim.id,
          procedure_id: procedure.id,

          opportunity_type: "Claim",

          priority: "High",

          estimated_value: procedureFee,

          confidence_score: 90,

          reason:
            "Completed procedure with an insurance claim that has not been submitted.",

          recommended_action:
            "Review and submit the insurance claim.",

          completed: false,
        });

        continue;
      }

      /*
       * If the claim was submitted but still has
       * an outstanding balance, use the actual
       * remaining balance rather than the full fee.
       */
      const remainingBalance = Number(
        matchingClaim.remaining_balance ??
          0
      );

      if (remainingBalance > 0) {
        opportunities.push({
          practice_id: practiceId,
          patient_id: procedure.patient_id,
          claim_id: matchingClaim.id,
          procedure_id: procedure.id,

          opportunity_type: "Claim",

          priority:
            remainingBalance >=
            procedureFee * 0.5
              ? "High"
              : "Medium",

          /*
           * Actual amount still outstanding.
           */
          estimated_value:
            remainingBalance,

          confidence_score: 95,

          reason:
            "Insurance claim has an outstanding balance that may still be recoverable.",

          recommended_action:
            "Review the claim status and follow up on the outstanding insurance balance.",

          completed: false,
        });
      }
    }

    return opportunities;
  }
}

export const revenueScanner =
  new RevenueScannerService();