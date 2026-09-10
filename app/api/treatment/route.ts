import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";
import {
  mapTreatmentOpportunity,
  type TreatmentPatientContact,
  type TreatmentProcedureCodeRow,
  type TreatmentProcedureRow,
} from "@/lib/data/treatmentWorkflow";
import {
  getOpportunityActivities,
} from "@/lib/data/opportunityWorkflow";
import { isWorkQueueEligible } from "@/lib/data/workQueue";

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase, practice } = auth;
    const opportunityId = req.nextUrl.searchParams.get("id")?.trim();

    let query = supabase
      .from("revenue_opportunities")
      .select("*")
      .eq("practice_id", practice.id)
      .eq("opportunity_type", "Treatment")
      .order("estimated_value", {
        ascending: false,
      });

    if (opportunityId) {
      query = query.eq("id", opportunityId);
    }

    const { data: opportunities, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (opportunities ?? []).filter((row) =>
      opportunityId ? true : isWorkQueueEligible(row)
    );
    const patientIds = [
      ...new Set(
        rows
          .map((row) => row.patient_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const procedureIds = [
      ...new Set(
        rows
          .map((row) => row.procedure_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const patientsById = new Map<string, TreatmentPatientContact>();
    const proceduresById = new Map<string, TreatmentProcedureRow>();
    const codesById = new Map<string, TreatmentProcedureCodeRow>();

    if (patientIds.length > 0) {
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select(
          "id, first_name, last_name, mobile_phone, home_phone, work_phone, next_visit"
        )
        .eq("practice_id", practice.id)
        .in("id", patientIds);

      if (patientsError) {
        throw patientsError;
      }

      for (const patient of patients ?? []) {
        patientsById.set(patient.id, patient);
      }
    }

    if (procedureIds.length > 0) {
      const { data: procedures, error: proceduresError } = await supabase
        .from("procedures")
        .select(
          "id, fee, status, tooth, surface, procedure_code_id, completed_at"
        )
        .eq("practice_id", practice.id)
        .in("id", procedureIds);

      if (proceduresError) {
        throw proceduresError;
      }

      for (const procedure of procedures ?? []) {
        proceduresById.set(procedure.id, procedure);
      }

      const codeIds = [
        ...new Set(
          (procedures ?? []).map((procedure) => procedure.procedure_code_id)
        ),
      ];

      if (codeIds.length > 0) {
        const { data: codes, error: codesError } = await supabase
          .from("procedure_codes")
          .select("id, code, description")
          .in("id", codeIds);

        if (codesError) {
          throw codesError;
        }

        for (const code of codes ?? []) {
          codesById.set(code.id, code);
        }
      }
    }

    const results = rows.map((row) => {
      const patient = row.patient_id
        ? patientsById.get(row.patient_id) ?? null
        : null;
      const procedure = row.procedure_id
        ? proceduresById.get(row.procedure_id) ?? null
        : null;
      const procedureCode = procedure
        ? codesById.get(procedure.procedure_code_id) ?? null
        : null;

      return mapTreatmentOpportunity(row, patient, procedure, procedureCode);
    });

    if (opportunityId) {
      const item = results[0];

      if (!item) {
        return ApiResponse.notFound("Treatment opportunity not found.");
      }

      const activities = await getOpportunityActivities(supabase, {
        practiceId: practice.id,
        opportunityId: item.id,
      });

      return ApiResponse.ok({ item, activities });
    }

    return ApiResponse.ok(results);
  } catch (error) {
    logger.error(
      "Treatment opportunities request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}
