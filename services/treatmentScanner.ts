import { supabase } from "@/lib/supabase";

import {
  openDental,
} from "@/services/opendental";

import { integrationService } from "@/services/integrationService";

export class TreatmentScannerService {
  async scan(practiceId: string) {
    const integration =
      await integrationService.getOpenDentalIntegration(
        practiceId
      );

    const opportunities = [];

    // --------------------------------------------------
    // Load locally synced patients
    // --------------------------------------------------

    const {
      data: patients,
      error: patientError,
    } = await supabase
      .from("patients")
      .select(
        "id,source_patient_id,first_name,last_name"
      )
      .eq("practice_id", practiceId)
      .eq(
        "integration_id",
        integration.id
      );

    if (patientError) {
      throw patientError;
    }

    const patientMap = new Map<
      string,
      {
        id: string;
        first_name: string;
        last_name: string;
      }
    >();

    for (const patient of patients ?? []) {
      patientMap.set(
        patient.source_patient_id,
        patient
      );
    }

    // --------------------------------------------------
    // Load treatment plans
    // --------------------------------------------------

    const treatmentPlans =
      await openDental.getTreatPlans(
        integration.customerKey
      );

    // --------------------------------------------------
    // Active / Inactive treatment plans
    // --------------------------------------------------

    for (const plan of treatmentPlans) {
      if (
        plan.TPStatus !== "Active" &&
        plan.TPStatus !== "Inactive"
      ) {
        continue;
      }

      const patient =
        patientMap.get(
          String(plan.PatNum)
        );

      if (!patient) {
        continue;
      }

      const attaches =
        await openDental.getTreatPlanAttaches(
          integration.customerKey,
          plan.TreatPlanNum
        );

      for (const attach of attaches) {
        if (!attach.ProcNum) {
          continue;
        }

        const {
          data: procedure,
          error: procedureError,
        } = await supabase
          .from("procedures")
          .select(
            "id,source_procedure_id,status,fee"
          )
          .eq(
            "practice_id",
            practiceId
          )
          .eq(
            "integration_id",
            integration.id
          )
          .eq(
            "source_procedure_id",
            String(attach.ProcNum)
          )
          .maybeSingle();

        if (procedureError) {
          throw procedureError;
        }

        // A completed procedure is not
        // an unscheduled treatment opportunity.
        if (
          procedure?.status ===
          "Completed"
        ) {
          continue;
        }

        const fee = Number(
          procedure?.fee ?? 0
        );

        if (
          !procedure ||
          fee <= 0
        ) {
          continue;
        }

        opportunities.push({
          practice_id: practiceId,

          patient_id:
            patient.id,

          procedure_id:
            procedure.id,

          claim_id: null,

          opportunity_type:
            "Treatment",

          priority:
            plan.TPStatus === "Active"
              ? "High"
              : "Medium",

          estimated_value:
            fee,

          confidence_score:
            plan.TPStatus === "Active"
              ? 95
              : 90,

          reason:
            plan.Heading ??
            "Treatment remains on the patient's treatment plan.",

          recommended_action:
            "Contact the patient and schedule the planned treatment.",

          completed: false,
        });
      }
    }

    // --------------------------------------------------
    // Saved treatment plans
    // --------------------------------------------------

    for (const plan of treatmentPlans) {
      if (plan.TPStatus !== "Saved") {
        continue;
      }

      const patient =
        patientMap.get(
          String(plan.PatNum)
        );

      if (!patient) {
        continue;
      }

      const procTPs =
        await openDental.getProcTPs(
          integration.customerKey,
          plan.TreatPlanNum
        );

      for (const procTP of procTPs) {
        const fee = Number(
          procTP.FeeAmt ?? 0
        );

        if (fee <= 0) {
          continue;
        }

        opportunities.push({
          practice_id: practiceId,

          patient_id:
            patient.id,

          procedure_id: null,

          claim_id: null,

          opportunity_type:
            "Treatment",

          priority: "Medium",

          // Actual Open Dental treatment-plan fee.
          estimated_value:
            fee,

          confidence_score: 90,

          reason:
            procTP.Descript ??
            procTP.ProcCode ??
            plan.Heading ??
            "Treatment remains on the patient's saved treatment plan.",

          recommended_action:
            "Contact the patient and schedule the planned treatment.",

          completed: false,
        });
      }
    }

    return opportunities;
  }
}

export const treatmentScanner =
  new TreatmentScannerService();