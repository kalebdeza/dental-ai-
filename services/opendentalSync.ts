import { createClient } from "@/lib/supabase/server";

import { integrationService } from "@/services/integrationService";
import { estimateRecallRevenue } from "@/lib/opendental/recallRevenue";
import { openDental } from "@/services/opendental";

import {
  mapClaimStatus,
  mapProcedureStatus,
  normalizeOpenDentalDate,
  normalizeSourceStatus,
} from "@/lib/opendental/status";

export class OpenDentalSyncService {
  async sync(
  practiceId: string
) {
    const supabase = await createClient();

    const integration =
      await integrationService.getOpenDentalIntegration(
        practiceId
      );

    const syncedAt =
      new Date().toISOString();

    // =========================================
    // Patients
    // =========================================

    const patients =
      await openDental.getPatients(
        integration.customerKey
      );

    for (const patient of patients) {
      const sourcePatientId =
        String(patient.PatNum);

      const { error } = await supabase
        .from("patients")
        .upsert(
          {
            practice_id: practiceId,
            integration_id: integration.id,
            source_patient_id:
              sourcePatientId,

            chart_number:
              patient.PatNum
                ? String(patient.PatNum)
                : null,

            first_name:
              patient.FName ?? "",

            last_name:
              patient.LName ?? "",

            preferred_name:
              patient.PreferredName ?? null,

            middle_name:
              patient.MiddleI ?? null,

            birth_date:
              normalizeOpenDentalDate(
                patient.Birthdate
              ),

            gender:
              patient.Gender ?? null,

            email:
              patient.Email ?? null,

            mobile_phone:
              patient.WirelessPhone ?? null,

            home_phone:
              patient.HmPhone ?? null,

            work_phone:
              patient.WkPhone ?? null,

            address:
              patient.Address ?? null,

            city:
              patient.City ?? null,

            state:
              patient.State ?? null,

            zip_code:
              patient.Zip ?? null,

            balance:
              Number(
                patient.BalTotal ?? 0
              ),

            insurance_estimate:
              Number(
                patient.InsEst ?? 0
              ),

            last_visit:
              normalizeOpenDentalDate(
                patient.DateLastVisit
              ),

            patient_status:
              patient.PatStatus ?? null,

            last_synced_at:
              syncedAt,
          },
          {
            onConflict:
              "integration_id,source_patient_id",
          }
        );

      if (error) {
        throw new Error(
          `Failed to sync patient ${sourcePatientId}: ${error.message}`
        );
      }
    }

    // =========================================
    // Build Patient Map
    // =========================================

    const patientMap =
      new Map<string, string>();

    const {
      data: storedPatients,
      error: patientError,
    } = await supabase
      .from("patients")
      .select(
        "id,source_patient_id"
      )
      .eq(
        "integration_id",
        integration.id
      );

    if (patientError) {
      throw patientError;
    }

    for (
      const patient of
        storedPatients ?? []
    ) {
      patientMap.set(
        patient.source_patient_id,
        patient.id
      );
    }

    // =========================================
    // Procedure Codes
    // =========================================

    const procedureCodes =
      await openDental.getProcedureCodes(
        integration.customerKey
      );

    for (const procedureCode of
      procedureCodes) {
      const sourceCodeId =
        String(procedureCode.CodeNum);

      const { error } = await supabase
        .from("procedure_codes")
        .upsert(
          {
            integration_id:
              integration.id,

            source_code_id:
              sourceCodeId,

            code:
              procedureCode.ProcCode ?? "",

            description:
              procedureCode.Descript ?? "",

            category:
              procedureCode.Category ?? null,

            fee:
              procedureCode.ProcFee !==
              undefined
                ? Number(
                    procedureCode.ProcFee
                  )
                : null,

            active:
              procedureCode.IsHidden !== true,

            updated_at:
              syncedAt,
          },
          {
            onConflict:
              "integration_id,source_code_id",
          }
        );

      if (error) {
        throw new Error(
          `Failed to sync procedure code ${sourceCodeId}: ${error.message}`
        );
      }
    }

    // =========================================
    // Build Procedure Code Map
    // =========================================

    const procedureCodeMap =
      new Map<string, string>();

    const {
      data: storedProcedureCodes,
      error: procedureCodeError,
    } = await supabase
      .from("procedure_codes")
      .select(
        "id,source_code_id"
      )
      .eq(
        "integration_id",
        integration.id
      );

    if (procedureCodeError) {
      throw procedureCodeError;
    }

    for (
      const procedureCode of
        storedProcedureCodes ?? []
    ) {
      procedureCodeMap.set(
        procedureCode.source_code_id,
        procedureCode.id
      );
    }

    // =========================================
    // Procedures
    // =========================================

    const procedures =
      await openDental.getProcedures(
        integration.customerKey
      );

    for (const procedure of
      procedures) {
      const sourceProcedureId =
        String(procedure.ProcNum);

      const patientId =
        patientMap.get(
          String(procedure.PatNum)
        );

      if (!patientId) {
        throw new Error(
          `Patient ${procedure.PatNum} was not found for procedure ${sourceProcedureId}.`
        );
      }

      const procedureCodeId =
        procedure.CodeNum !== undefined
          ? procedureCodeMap.get(
              String(procedure.CodeNum)
            )
          : undefined;

      if (!procedureCodeId) {
        throw new Error(
          `Procedure code ${
            procedure.CodeNum ?? "unknown"
          } was not found for procedure ${sourceProcedureId}.`
        );
      }

      const procedureDate =
        normalizeOpenDentalDate(
          procedure.ProcDate
        );

      const completedAt =
        procedureDate
          ? new Date(
              procedureDate
            ).toISOString()
          : null;

      const { error } = await supabase
        .from("procedures")
        .upsert(
          {
            practice_id: practiceId,
            integration_id:
              integration.id,

            patient_id: patientId,
            procedure_code_id:
              procedureCodeId,

            source_procedure_id:
              sourceProcedureId,

            provider_id: null,
            appointment_id: null,

            tooth:
              procedure.ToothNum ?? null,

            surface:
              procedure.Surf ?? null,

            status:
              mapProcedureStatus(
                procedure.ProcStatus
              ),

            source_status:
              normalizeSourceStatus(
                procedure.ProcStatus
              ),

            fee:
              Number(
                procedure.ProcFee ?? 0
              ),

            insurance_estimate: 0,
            insurance_paid: 0,

            patient_portion:
              Number(
                procedure.ProcFee ?? 0
              ),

            completed_at:
              completedAt,

            last_synced_at:
              syncedAt,

            updated_at:
              syncedAt,
          },
          {
            onConflict:
              "integration_id,source_procedure_id",
          }
        );

      if (error) {
        throw new Error(
          `Failed to sync procedure ${sourceProcedureId}: ${error.message}`
        );
      }
    }

    // =========================================
    // Claims
    // =========================================

    const claims =
      await openDental.getClaims(
        integration.customerKey
      );

    for (const claim of claims) {
      const sourceClaimId =
        String(claim.ClaimNum);

      const patientId =
        patientMap.get(
          String(claim.PatNum)
        );

      if (!patientId) {
        throw new Error(
          `Patient ${claim.PatNum} was not found for claim ${sourceClaimId}.`
        );
      }

      const amountBilled =
        Number(
          claim.ClaimFee ?? 0
        );

      const amountPaid =
        Number(
          claim.InsPayAmt ?? 0
        );

      const remainingBalance =
        Math.max(
          amountBilled - amountPaid,
          0
        );

      const dateSent =
        normalizeOpenDentalDate(
          claim.DateSent
        );

      const submittedAt =
        dateSent
          ? new Date(
              dateSent
            ).toISOString()
          : null;

      const paidAt =
        amountPaid > 0
          ? submittedAt
          : null;

      const { error } = await supabase
        .from("claims")
        .upsert(
          {
            practice_id: practiceId,
            integration_id:
              integration.id,

            patient_id: patientId,
            provider_id: null,

            source_claim_id:
              sourceClaimId,

            claim_number:
              sourceClaimId,

            insurance_company: null,

            status:
              mapClaimStatus(
                claim.ClaimStatus
              ),

            source_status:
              normalizeSourceStatus(
                claim.ClaimStatus
              ),

            amount_billed:
              amountBilled,

            amount_paid:
              amountPaid,

            remaining_balance:
              remainingBalance,

            submitted_at:
              submittedAt,

            paid_at:
              paidAt,

            last_action: null,
            denial_reason: null,

            last_synced_at:
              syncedAt,

            updated_at:
              syncedAt,
          },
          {
            onConflict:
              "integration_id,source_claim_id",
          }
        );

      if (error) {
        throw new Error(
          `Failed to sync claim ${sourceClaimId}: ${error.message}`
        );
      }
    }

    // =========================================
    // Recalls
    // =========================================

    const recalls =
      await openDental.getRecalls(
        integration.customerKey
      );

    for (const recall of recalls) {
      const sourceRecallId =
        String(recall.RecallNum);

      const patientId =
        patientMap.get(
          String(recall.PatNum)
        );

      if (!patientId) {
        throw new Error(
          `Patient ${recall.PatNum} was not found for recall ${sourceRecallId}.`
        );
      }

      const dueDate =
        normalizeOpenDentalDate(
          recall.DateDue
        );

      const completedDate =
        normalizeOpenDentalDate(
          recall.DatePrevious
        );

      /*
       * RecallStatus describes the reminder that was sent, not whether the
       * recall was fulfilled, so it is stored for reference only. Nothing
       * derives completion from it. The raw integer goes to source_status
       * and the API's display name is kept for humans.
       */
      const status =
        normalizeSourceStatus(
          recall.recallStatus
        ) ?? "Unknown";

      const sourceStatus =
        normalizeSourceStatus(
          recall.RecallStatus
        );

      const recallType =
        recall.RecallTypeNum
          ? `Recall ${recall.RecallTypeNum}`
          : "Dental Recall";

      const estimatedRevenue =
        estimateRecallRevenue(
          recallType
        );

      const { error } = await supabase
        .from("recalls")
        .upsert(
          {
            practice_id: practiceId,
            integration_id:
              integration.id,

            patient_id: patientId,

            source_recall_id:
              sourceRecallId,

            recall_type:
              recallType,

            due_date:
              dueDate,

            completed_date:
              completedDate,

            status,

            source_status:
              sourceStatus,

            estimated_revenue:
              estimatedRevenue,

            last_synced_at:
              syncedAt,

            updated_at:
              syncedAt,
          },
          {
            onConflict:
              "integration_id,source_recall_id",
          }
        );

      if (error) {
        throw new Error(
          `Failed to sync recall ${sourceRecallId}: ${error.message}`
        );
      }
    }

    // =========================================
    // Mark Integration Synced
    // =========================================

    const { error: syncError } =
      await supabase
        .from("integrations")
        .update({
          last_sync_at:
            syncedAt,
        })
        .eq(
          "id",
          integration.id
        );

    if (syncError) {
      throw syncError;
    }

    return {
      patients:
        patients.length,

      procedureCodes:
        procedureCodes.length,

      procedures:
        procedures.length,

      claims:
        claims.length,

      recalls:
        recalls.length,

      syncedAt,
    };
  }
}

export const openDentalSync =
  new OpenDentalSyncService();