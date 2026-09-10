import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";
import {
  selectOpenRecallForPatient,
  type RecallRowSummary,
} from "@/lib/data/recallWorkflow";
import { isWorkQueueEligible, toWorkQueueItem } from "@/lib/data/workQueue";

export async function GET() {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase, practice } = auth;

    const { data: opportunities, error } = await supabase
      .from("revenue_opportunities")
      .select("*")
      .eq("practice_id", practice.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const rows = (opportunities ?? []).filter((opportunity) =>
      isWorkQueueEligible(opportunity)
    );

    const patientIds = [
      ...new Set(
        rows
          .map((opportunity) => opportunity.patient_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const claimIds = [
      ...new Set(
        rows
          .filter((opportunity) => opportunity.opportunity_type === "Claim")
          .map((opportunity) => opportunity.claim_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const recallPatientIds = [
      ...new Set(
        rows
          .filter((opportunity) => opportunity.opportunity_type === "Recall")
          .map((opportunity) => opportunity.patient_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const patientsById = new Map<
      string,
      { first_name: string; last_name: string }
    >();

    if (patientIds.length > 0) {
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("practice_id", practice.id)
        .in("id", patientIds);

      if (patientsError) {
        throw patientsError;
      }

      for (const patient of patients ?? []) {
        patientsById.set(patient.id, patient);
      }
    }

    const claimsById = new Map<
      string,
      { submitted_at: string | null; remaining_balance: number }
    >();

    if (claimIds.length > 0) {
      const { data: claims, error: claimsError } = await supabase
        .from("claims")
        .select("id, submitted_at, remaining_balance")
        .eq("practice_id", practice.id)
        .in("id", claimIds);

      if (claimsError) {
        throw claimsError;
      }

      for (const claim of claims ?? []) {
        claimsById.set(claim.id, claim);
      }
    }

    let recallRows: RecallRowSummary[] = [];

    if (recallPatientIds.length > 0) {
      const { data: recallRecords, error: recallError } = await supabase
        .from("recalls")
        .select(
          "patient_id, recall_type, due_date, completed_date, status, estimated_revenue"
        )
        .eq("practice_id", practice.id)
        .in("patient_id", recallPatientIds);

      if (recallError) {
        throw recallError;
      }

      recallRows = recallRecords ?? [];
    }

    const results = rows.map((opportunity) => {
      const patient = opportunity.patient_id
        ? patientsById.get(opportunity.patient_id)
        : null;
      const claim = opportunity.claim_id
        ? claimsById.get(opportunity.claim_id)
        : null;

      const recallRow =
        opportunity.opportunity_type === "Recall" && opportunity.patient_id
          ? selectOpenRecallForPatient(recallRows, opportunity.patient_id)
          : null;

      return toWorkQueueItem({
        id: opportunity.id,
        patient: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown Patient",
        patientId: opportunity.patient_id,
        opportunityType: opportunity.opportunity_type,
        reason: opportunity.reason,
        estimatedValue: Number(opportunity.estimated_value ?? 0),
        priority: opportunity.priority,
        workflowStatus: opportunity.workflow_status,
        contactOutcome: opportunity.contact_outcome,
        snoozedUntil: opportunity.snoozed_until,
        identifiedAt: opportunity.identified_at,
        lastActedAt: opportunity.last_acted_at,
        dueDate: recallRow?.due_date ?? null,
        claimSubmittedAt: claim?.submitted_at ?? null,
        claimRemainingBalance: claim ? Number(claim.remaining_balance) : null,
        completed: opportunity.completed,
      });
    });

    return ApiResponse.ok(results);
  } catch (error) {
    logger.error("Opportunities request failed", error);

    return ApiErrorHandler.handle(error);
  }
}
