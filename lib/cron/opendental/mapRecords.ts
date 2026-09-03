import {
  mapClaimStatus,
  mapProcedureStatus,
  normalizeOpenDentalDate,
  normalizeSourceStatus,
} from "../../opendental/status.ts";
import { estimateRecallRevenue } from "../../opendental/recallRevenue.ts";
import type { SchedulerPracticeContext } from "../schedulerContext.ts";
import type {
  OpenDentalClaim,
  OpenDentalPatient,
  OpenDentalProcedure,
  OpenDentalProcedureCode,
  OpenDentalRecall,
} from "./types.ts";

function tenantIds(context: SchedulerPracticeContext) {
  return {
    practice_id: context.practiceId,
    integration_id: context.integrationId,
  };
}

export function mapPatientRow(
  context: SchedulerPracticeContext,
  patient: OpenDentalPatient,
  syncedAt: string
) {
  const tenant = tenantIds(context);

  return {
    practice_id: tenant.practice_id,
    integration_id: tenant.integration_id,
    source_patient_id: String(patient.PatNum),
    chart_number: patient.PatNum ? String(patient.PatNum) : null,
    first_name: patient.FName ?? "",
    last_name: patient.LName ?? "",
    preferred_name: patient.PreferredName ?? null,
    middle_name: patient.MiddleI ?? null,
    birth_date: normalizeOpenDentalDate(patient.Birthdate),
    gender: patient.Gender ?? null,
    email: patient.Email ?? null,
    mobile_phone: patient.WirelessPhone ?? null,
    home_phone: patient.HmPhone ?? null,
    work_phone: patient.WkPhone ?? null,
    address: patient.Address ?? null,
    city: patient.City ?? null,
    state: patient.State ?? null,
    zip_code: patient.Zip ?? null,
    balance: Number(patient.BalTotal ?? 0),
    insurance_estimate: Number(patient.InsEst ?? 0),
    last_visit: normalizeOpenDentalDate(patient.DateLastVisit),
    patient_status: patient.PatStatus ?? null,
    last_synced_at: syncedAt,
  };
}

export function mapProcedureCodeRow(
  context: SchedulerPracticeContext,
  procedureCode: OpenDentalProcedureCode,
  syncedAt: string
) {
  return {
    integration_id: context.integrationId,
    source_code_id: String(procedureCode.CodeNum),
    code: procedureCode.ProcCode ?? "",
    description: procedureCode.Descript ?? "",
    category: procedureCode.Category ?? null,
    fee:
      procedureCode.ProcFee !== undefined
        ? Number(procedureCode.ProcFee)
        : null,
    active: procedureCode.IsHidden !== true,
    updated_at: syncedAt,
  };
}

export function mapProcedureRow(
  context: SchedulerPracticeContext,
  procedure: OpenDentalProcedure,
  patientId: string,
  procedureCodeId: string,
  syncedAt: string
) {
  const tenant = tenantIds(context);
  const procedureDate = normalizeOpenDentalDate(procedure.ProcDate);

  return {
    practice_id: tenant.practice_id,
    integration_id: tenant.integration_id,
    patient_id: patientId,
    procedure_code_id: procedureCodeId,
    source_procedure_id: String(procedure.ProcNum),
    provider_id: null,
    appointment_id: null,
    tooth: procedure.ToothNum ?? null,
    surface: procedure.Surf ?? null,
    status: mapProcedureStatus(procedure.ProcStatus),
    source_status: normalizeSourceStatus(procedure.ProcStatus),
    fee: Number(procedure.ProcFee ?? 0),
    insurance_estimate: 0,
    insurance_paid: 0,
    patient_portion: Number(procedure.ProcFee ?? 0),
    completed_at: procedureDate
      ? new Date(procedureDate).toISOString()
      : null,
    last_synced_at: syncedAt,
    updated_at: syncedAt,
  };
}

export function mapClaimRow(
  context: SchedulerPracticeContext,
  claim: OpenDentalClaim,
  patientId: string,
  syncedAt: string
) {
  const tenant = tenantIds(context);
  const amountBilled = Number(claim.ClaimFee ?? 0);
  const amountPaid = Number(claim.InsPayAmt ?? 0);
  const dateSent = normalizeOpenDentalDate(claim.DateSent);
  const submittedAt = dateSent ? new Date(dateSent).toISOString() : null;

  return {
    practice_id: tenant.practice_id,
    integration_id: tenant.integration_id,
    patient_id: patientId,
    provider_id: null,
    source_claim_id: String(claim.ClaimNum),
    claim_number: String(claim.ClaimNum),
    insurance_company: null,
    status: mapClaimStatus(claim.ClaimStatus),
    source_status: normalizeSourceStatus(claim.ClaimStatus),
    amount_billed: amountBilled,
    amount_paid: amountPaid,
    remaining_balance: Math.max(amountBilled - amountPaid, 0),
    submitted_at: submittedAt,
    paid_at: amountPaid > 0 ? submittedAt : null,
    last_action: null,
    denial_reason: null,
    last_synced_at: syncedAt,
    updated_at: syncedAt,
  };
}

export function mapRecallRow(
  context: SchedulerPracticeContext,
  recall: OpenDentalRecall,
  patientId: string,
  syncedAt: string
) {
  const tenant = tenantIds(context);
  const recallType = recall.RecallTypeNum
    ? `Recall ${recall.RecallTypeNum}`
    : "Dental Recall";

  return {
    practice_id: tenant.practice_id,
    integration_id: tenant.integration_id,
    patient_id: patientId,
    source_recall_id: String(recall.RecallNum),
    recall_type: recallType,
    due_date: normalizeOpenDentalDate(recall.DateDue),
    completed_date: normalizeOpenDentalDate(recall.DatePrevious),
    status: normalizeSourceStatus(recall.recallStatus) ?? "Unknown",
    source_status: normalizeSourceStatus(recall.RecallStatus),
    estimated_revenue: estimateRecallRevenue(recallType),
    last_synced_at: syncedAt,
    updated_at: syncedAt,
  };
}
