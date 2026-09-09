import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";
import {
  mapRecallOpportunity,
  selectOpenRecallForPatient,
  type RecallPatientContact,
  type RecallRowSummary,
} from "@/lib/data/recallWorkflow";
import {
  getOpportunityActivities,
  isActiveQueueOpportunity,
} from "@/lib/data/opportunityWorkflow";

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
      .eq("opportunity_type", "Recall")
      .order("created_at", { ascending: false });

    if (opportunityId) {
      query = query.eq("id", opportunityId);
    }

    const { data: recalls, error } = await query;

    if (error) {
      throw error;
    }

    const now = new Date();
    const rows = (recalls ?? []).filter((row) =>
      opportunityId ? true : isActiveQueueOpportunity(row, now)
    );
    const patientIds = [
      ...new Set(
        rows
          .map((row) => row.patient_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const patientsById = new Map<string, RecallPatientContact>();
    let recallRows: RecallRowSummary[] = [];

    if (patientIds.length > 0) {
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select(
          "id, first_name, last_name, mobile_phone, home_phone, work_phone"
        )
        .eq("practice_id", practice.id)
        .in("id", patientIds);

      if (patientsError) {
        throw patientsError;
      }

      for (const patient of patients ?? []) {
        patientsById.set(patient.id, patient);
      }

      const { data: recallRecords, error: recallError } = await supabase
        .from("recalls")
        .select(
          "patient_id, recall_type, due_date, completed_date, status, estimated_revenue"
        )
        .eq("practice_id", practice.id)
        .in("patient_id", patientIds);

      if (recallError) {
        throw recallError;
      }

      recallRows = recallRecords ?? [];
    }

    const results = rows.map((row) => {
      const patient = row.patient_id
        ? patientsById.get(row.patient_id) ?? null
        : null;
      const recallRow = row.patient_id
        ? selectOpenRecallForPatient(recallRows, row.patient_id)
        : null;

      return mapRecallOpportunity(row, patient, recallRow);
    });

    if (opportunityId) {
      const item = results[0];

      if (!item) {
        return ApiResponse.notFound("Recall opportunity not found.");
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
      "Recall request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}
