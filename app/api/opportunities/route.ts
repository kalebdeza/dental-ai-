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
      data: opportunities,
      error,
    } = await supabase
      .from("revenue_opportunities")
      .select("*")
      .eq("practice_id", practice.id)
      .eq("completed", false)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const results = [];

    for (const opportunity of opportunities ?? []) {
      let patientName = "Unknown Patient";

      if (opportunity.patient_id) {
        const { data: patient } =
          await supabase
            .from("patients")
            .select(
              "first_name,last_name"
            )
            .eq(
              "id",
              opportunity.patient_id
            )
            .eq("practice_id", practice.id)
            .maybeSingle();

        if (patient) {
          patientName =
            `${patient.first_name} ${patient.last_name}`;
        }
      }

      results.push({
        id: opportunity.id,

        patient: patientName,

        opportunity_type:
          opportunity.opportunity_type,

        reason:
          opportunity.reason,

        estimated_value:
          Number(
            opportunity.estimated_value ?? 0
          ),

        priority:
          opportunity.priority,

        completed:
          opportunity.completed,
      });
    }

    return ApiResponse.ok(results);
  } catch (error) {
    logger.error(
      "Opportunities request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}