import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";

export async function GET() {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase, practice } = auth;

    const {
      data: recalls,
      error,
    } = await supabase
      .from("revenue_opportunities")
      .select("*")
      .eq("practice_id", practice.id)
      .eq("opportunity_type", "Recall")
      .eq("completed", false)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const results = [];

    for (const recall of recalls ?? []) {
      let patientName = "Unknown Patient";

      if (recall.patient_id) {
        const { data: patient } =
          await supabase
            .from("patients")
            .select(
              "first_name,last_name"
            )
            .eq(
              "id",
              recall.patient_id
            )
            .eq("practice_id", practice.id)
            .maybeSingle();

        if (patient) {
          patientName =
            `${patient.first_name} ${patient.last_name}`;
        }
      }

      results.push({
        id: recall.id,

        patient: patientName,

        patientId:
          recall.patient_id,

        opportunity_type:
          recall.opportunity_type,

        estimated_value:
          Number(
            recall.estimated_value ?? 0
          ),

        priority:
          recall.priority,

        reason:
          recall.reason,

        recommendedAction:
          recall.recommended_action,

        completed:
          recall.completed,
      });
    }

    return ApiResponse.ok(results);
  } catch (error) {
    logger.error(
      "Recall request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}