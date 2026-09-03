import { isOutstandingPlannedTreatment, TREAT_PLAN_STATUS } from "./status.ts";

type TreatPlan = {
  TreatPlanNum: number;
  PatNum: number;
  Heading?: string;
  TPStatus?: string;
};

type TreatPlanAttach = {
  TreatPlanNum: number;
  ProcNum?: number;
};

type ProcTP = {
  TreatPlanNum: number;
  ProcCode?: string;
  Descript?: string;
  FeeAmt?: number;
};

export type TreatmentOpportunityPatient = {
  id: string;
  source_patient_id: string;
};

export type TreatmentOpportunityProcedure = {
  id: string;
  source_procedure_id: string;
  patient_id: string;
  status: string | null;
  fee: number | null;
};

export type TreatmentOpportunity = {
  patient_id: string;
  procedure_id: string | null;
  priority: string;
  estimated_value: number;
  confidence_score: number;
  reason: string;
  recommended_action: string;
};

export function buildTreatmentOpportunities(input: {
  patients: TreatmentOpportunityPatient[];
  procedures: TreatmentOpportunityProcedure[];
  plans: TreatPlan[];
  attaches: TreatPlanAttach[];
  procTPs: ProcTP[];
}): TreatmentOpportunity[] {
  const patientBySource = new Map<string, string>();

  for (const patient of input.patients) {
    patientBySource.set(patient.source_patient_id, patient.id);
  }

  const procedureBySource = new Map<string, TreatmentOpportunityProcedure>();

  for (const procedure of input.procedures) {
    procedureBySource.set(procedure.source_procedure_id, procedure);
  }

  const attachesByPlan = new Map<number, TreatPlanAttach[]>();

  for (const attach of input.attaches) {
    const list = attachesByPlan.get(attach.TreatPlanNum) ?? [];
    list.push(attach);
    attachesByPlan.set(attach.TreatPlanNum, list);
  }

  const procTpsByPlan = new Map<number, ProcTP[]>();

  for (const procTP of input.procTPs) {
    const list = procTpsByPlan.get(procTP.TreatPlanNum) ?? [];
    list.push(procTP);
    procTpsByPlan.set(procTP.TreatPlanNum, list);
  }

  const opportunities: TreatmentOpportunity[] = [];
  const seen = new Set<string>();

  function push(opportunity: TreatmentOpportunity) {
    const key = `${opportunity.patient_id}:${opportunity.procedure_id ?? "saved"}:${opportunity.reason}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    opportunities.push(opportunity);
  }

  for (const plan of input.plans) {
    const patientId = patientBySource.get(String(plan.PatNum));

    if (!patientId) {
      continue;
    }

    if (
      plan.TPStatus === TREAT_PLAN_STATUS.Active ||
      plan.TPStatus === TREAT_PLAN_STATUS.Inactive
    ) {
      for (const attach of attachesByPlan.get(plan.TreatPlanNum) ?? []) {
        if (!attach.ProcNum) {
          continue;
        }

        const procedure = procedureBySource.get(String(attach.ProcNum));

        if (!procedure || procedure.patient_id !== patientId) {
          continue;
        }

        if (!isOutstandingPlannedTreatment(procedure.status)) {
          continue;
        }

        const fee = Number(procedure.fee ?? 0);

        if (fee <= 0) {
          continue;
        }

        push({
          patient_id: patientId,
          procedure_id: procedure.id,
          priority:
            plan.TPStatus === TREAT_PLAN_STATUS.Active ? "High" : "Medium",
          estimated_value: fee,
          confidence_score:
            plan.TPStatus === TREAT_PLAN_STATUS.Active ? 95 : 90,
          reason:
            plan.Heading ??
            "Treatment remains on the patient's treatment plan.",
          recommended_action:
            "Contact the patient and schedule the planned treatment.",
        });
      }
    }

    if (plan.TPStatus === TREAT_PLAN_STATUS.Saved) {
      for (const procTP of procTpsByPlan.get(plan.TreatPlanNum) ?? []) {
        const fee = Number(procTP.FeeAmt ?? 0);

        if (fee <= 0) {
          continue;
        }

        push({
          patient_id: patientId,
          procedure_id: null,
          priority: "Medium",
          estimated_value: fee,
          confidence_score: 90,
          reason:
            procTP.Descript ??
            procTP.ProcCode ??
            plan.Heading ??
            "Treatment remains on the patient's saved treatment plan.",
          recommended_action:
            "Contact the patient and schedule the planned treatment.",
        });
      }
    }
  }

  return opportunities;
}
