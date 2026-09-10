import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";
import { loadOpportunityFunnelMetrics } from "@/lib/data/opportunityFunnel";
import { loadPracticeRecoveredRevenue } from "@/lib/data/recoveredRevenue";
import {
  selectOpenRecallForPatient,
  type RecallRowSummary,
} from "@/lib/data/recallWorkflow";
import {
  buildTodayPriorityPatients,
  isRecoverableOpportunity,
  toWorkQueueItem,
} from "@/lib/data/workQueue";

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

    const recoverable = (opportunities ?? []).filter((item) =>
      isRecoverableOpportunity(item)
    );

    const claimOpportunities = recoverable.filter(
      (item) => item.opportunity_type === "Claim"
    );

    const recallOpportunities = recoverable.filter(
      (item) => item.opportunity_type === "Recall"
    );

    const treatmentOpportunities = recoverable.filter(
      (item) => item.opportunity_type === "Treatment"
    );

    const claimsRevenue = claimOpportunities.reduce(
      (sum, item) => sum + Number(item.estimated_value ?? 0),
      0
    );

    const recallRevenue = recallOpportunities.reduce(
      (sum, item) => sum + Number(item.estimated_value ?? 0),
      0
    );

    const treatmentRevenue = treatmentOpportunities.reduce(
      (sum, item) => sum + Number(item.estimated_value ?? 0),
      0
    );

    const totalRecoverableRevenue =
      claimsRevenue + recallRevenue + treatmentRevenue;

    const recallPatientIds = [
      ...new Set(
        (opportunities ?? [])
          .filter((item) => item.opportunity_type === "Recall")
          .map((item) => item.patient_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const claimIds = [
      ...new Set(
        (opportunities ?? [])
          .filter((item) => item.opportunity_type === "Claim")
          .map((item) => item.claim_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

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

    const queueItems = (opportunities ?? []).map((item) => {
      const patient = item.patient_id
        ? patientLookup.get(String(item.patient_id))
        : null;
      const claim = item.claim_id ? claimsById.get(item.claim_id) : null;
      const recallRow =
        item.opportunity_type === "Recall" && item.patient_id
          ? selectOpenRecallForPatient(recallRows, item.patient_id)
          : null;

      return toWorkQueueItem({
        id: item.id,
        patient: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown Patient",
        patientId: item.patient_id,
        opportunityType: item.opportunity_type,
        reason: item.reason,
        estimatedValue: Number(item.estimated_value ?? 0),
        priority: item.priority ?? "Medium",
        workflowStatus: item.workflow_status,
        contactOutcome: item.contact_outcome,
        snoozedUntil: item.snoozed_until,
        identifiedAt: item.identified_at,
        lastActedAt: item.last_acted_at,
        dueDate: recallRow?.due_date ?? null,
        claimSubmittedAt: claim?.submitted_at ?? null,
        claimRemainingBalance: claim ? Number(claim.remaining_balance) : null,
        completed: item.completed,
      });
    });

    const priorityPatients = buildTodayPriorityPatients(queueItems);

    const funnel = await loadOpportunityFunnelMetrics(
      supabase,
      practice.id
    );
    const recovered = await loadPracticeRecoveredRevenue(
      supabase,
      practice.id
    );

    return ApiResponse.ok({
      priorityPatients,
      totalRecoverableRevenue,

      claimsRevenue,
      recallRevenue,
      treatmentRevenue,

      claimOpportunities: claimOpportunities.length,

      recallPatients: recallOpportunities.length,

      treatmentPatients: treatmentOpportunities.length,

      totalPatients: patientCount ?? 0,
      funnel,
      recoveredRevenue: recovered.recoveredRevenue,
      recoveredPayments: recovered.details,
    });
  } catch (error) {
    logger.error(
      "Dashboard request failed",
      error
    );

    return ApiErrorHandler.handle(error);
  }
}
