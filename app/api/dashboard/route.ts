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

    const { data: opportunities, error: opportunitiesError } =
      await supabase
        .from("revenue_opportunities")
        .select("*")
        .eq("practice_id", practice.id)
        .eq("completed", false);

    if (opportunitiesError) {
      throw opportunitiesError;
    }

    const { data: patients, count: patientCount, error: patientsError } =
      await supabase
        .from("patients")
        .select("*", { count: "exact" })
        .eq("practice_id", practice.id);

    if (patientsError) {
      throw patientsError;
    }

    const patientLookup = new Map(
      (patients ?? []).map((patient) => [
        String(patient.id),
        patient,
      ])
    );

    const claimOpportunities = (
      opportunities ?? []
    ).filter(
      (item) => item.opportunity_type === "Claim"
    );

    const recallOpportunities = (
      opportunities ?? []
    ).filter(
      (item) => item.opportunity_type === "Recall"
    );

    const treatmentOpportunities = (
      opportunities ?? []
    ).filter(
      (item) => item.opportunity_type === "Treatment"
    );

    const claimsRevenue =
      claimOpportunities.reduce(
        (sum, item) =>
          sum + Number(item.estimated_value ?? 0),
        0
      );

    const recallRevenue =
      recallOpportunities.reduce(
        (sum, item) =>
          sum + Number(item.estimated_value ?? 0),
        0
      );

    const treatmentRevenue =
      treatmentOpportunities.reduce(
        (sum, item) =>
          sum + Number(item.estimated_value ?? 0),
        0
      );

    const totalRecoverableRevenue =
      claimsRevenue +
      recallRevenue +
      treatmentRevenue;

    const priorityPatients = [
      ...treatmentOpportunities.map((item) => {
        const patient = patientLookup.get(
          String(item.patient_id)
        );

        return {
          name: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",
          patientId: item.patient_id,
          type: "Treatment",
          revenue: Number(
            item.estimated_value ?? 0
          ),
          priority: item.priority ?? "Medium",
        };
      }),

      ...recallOpportunities.map((item) => {
        const patient = patientLookup.get(
          String(item.patient_id)
        );

        return {
          name: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",
          patientId: item.patient_id,
          type: "Recall",
          revenue: Number(
            item.estimated_value ?? 0
          ),
          priority: item.priority ?? "Medium",
        };
      }),

      ...claimOpportunities.map((item) => {
        const patient = patientLookup.get(
          String(item.patient_id)
        );

        return {
          name: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",
          patientId: item.patient_id,
          type: "Claim",
          revenue: Number(
            item.estimated_value ?? 0
          ),
          priority: item.priority ?? "High",
        };
      }),
    ]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return ApiResponse.ok({
      priorityPatients,
      totalRecoverableRevenue,

      claimsRevenue,
      recallRevenue,
      treatmentRevenue,

      claimOpportunities:
        claimOpportunities.length,

      recallPatients:
        recallOpportunities.length,

      treatmentPatients:
        treatmentOpportunities.length,

      totalPatients: patientCount ?? 0,
    });
  } catch (error) {
    logger.error(
      "Dashboard request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}