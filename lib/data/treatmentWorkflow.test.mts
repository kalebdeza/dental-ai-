import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DESIRED_TREATMENT_STEPS,
  DESIRED_TREATMENT_TERMINAL,
  TREATMENT_OPPORTUNITY_TYPE,
  formatProcedureLabel,
  formatTreatmentDate,
  formatTreatmentPatientName,
  getPersistedTreatmentStatus,
  getTreatmentWorkflowActions,
  mapTreatmentOpportunity,
  parseTreatmentDismissId,
  pickPatientPhone,
  storedTreatmentRecommendation,
  toTelHref,
  treatmentDismissEquality,
  type TreatmentPatientContact,
  type TreatmentProcedureCodeRow,
  type TreatmentProcedureRow,
} from "./treatmentWorkflow.ts";

function patient(
  overrides: Partial<TreatmentPatientContact> = {}
): TreatmentPatientContact {
  return {
    id: "patient-1",
    first_name: "Ada",
    last_name: "Lovelace",
    mobile_phone: null,
    home_phone: null,
    work_phone: null,
    next_visit: null,
    ...overrides,
  };
}

function procedure(
  overrides: Partial<TreatmentProcedureRow> = {}
): TreatmentProcedureRow {
  return {
    id: "proc-1",
    fee: 1200,
    status: "Treatment Planned",
    tooth: "14",
    surface: "MOD",
    procedure_code_id: "code-1",
    completed_at: null,
    ...overrides,
  };
}

function procedureCode(
  overrides: Partial<TreatmentProcedureCodeRow> = {}
): TreatmentProcedureCodeRow {
  return {
    id: "code-1",
    code: "D2740",
    description: "Crown - porcelain/ceramic",
    ...overrides,
  };
}

describe("treatment phone selection", () => {
  it("prefers mobile, then home, then work, and does not invent a number", () => {
    assert.equal(pickPatientPhone(null), null);
    assert.equal(pickPatientPhone(patient()), null);
    assert.equal(
      pickPatientPhone(patient({ mobile_phone: "555-0100" })),
      "555-0100"
    );
    assert.equal(
      pickPatientPhone(patient({ home_phone: "555-0200" })),
      "555-0200"
    );
    assert.equal(toTelHref(null), null);
    assert.equal(toTelHref("555-0100"), "tel:5550100");
  });
});

describe("treatment opportunity mapping", () => {
  it("maps stored patient, phone, and procedure fields without fabricating values", () => {
    const mapped = mapTreatmentOpportunity(
      {
        id: "opp-1",
        patient_id: "patient-1",
        procedure_id: "proc-1",
        opportunity_type: "Treatment",
        estimated_value: 1200,
        priority: "High",
        reason: "Crown remains on the treatment plan.",
        recommended_action:
          "Contact the patient and schedule the planned treatment.",
        completed: false,
        workflow_status: "open",
        contact_outcome: null,
        snoozed_until: null,
        identified_at: "2026-09-01T00:00:00.000Z",
        last_acted_at: null,
      },
      patient({
        mobile_phone: "555-0100",
        next_visit: "2026-10-01",
      }),
      procedure(),
      procedureCode()
    );

    assert.equal(mapped.patient, "Ada Lovelace");
    assert.equal(mapped.phone, "555-0100");
    assert.equal(mapped.nextVisit, "2026-10-01");
    assert.equal(mapped.procedureCode, "D2740");
    assert.equal(mapped.procedureDescription, "Crown - porcelain/ceramic");
    assert.equal(mapped.procedureFee, 1200);
    assert.equal(mapped.procedureStatus, "Treatment Planned");
    assert.equal(mapped.tooth, "14");
    assert.equal(mapped.surface, "MOD");
  });

  it("leaves procedure details empty when no procedure row is linked", () => {
    const mapped = mapTreatmentOpportunity(
      {
        id: "opp-2",
        patient_id: null,
        procedure_id: null,
        opportunity_type: "Treatment",
        estimated_value: 400,
        priority: "Medium",
        reason: "Saved treatment plan item.",
        recommended_action: null,
        completed: false,
        workflow_status: "open",
        contact_outcome: null,
        snoozed_until: null,
        identified_at: "2026-09-01T00:00:00.000Z",
        last_acted_at: null,
      },
      null,
      null,
      null
    );

    assert.equal(mapped.patient, "Unknown Patient");
    assert.equal(mapped.phone, null);
    assert.equal(mapped.procedureCode, null);
    assert.equal(mapped.procedureDescription, null);
    assert.equal(mapped.procedureFee, null);
    assert.equal(mapped.tooth, null);
    assert.equal(formatProcedureLabel(null, null), "Not available");
    assert.equal(
      formatProcedureLabel("D2740", "Crown - porcelain/ceramic"),
      "D2740 — Crown - porcelain/ceramic"
    );
  });

  it("formats names and dates from stored values only", () => {
    assert.equal(formatTreatmentPatientName(null), "Unknown Patient");
    assert.equal(formatTreatmentDate(null), "Not available");
    assert.equal(formatTreatmentDate("not-a-date"), "Not available");
  });
});

describe("treatment workflow persistence", () => {
  it("enables Call Patient only when a usable phone is stored", () => {
    const withPhone = getTreatmentWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    });
    const withoutPhone = getTreatmentWorkflowActions({
      phone: null,
      workflowStatus: "open",
      completed: false,
    });

    assert.equal(withPhone.find((item) => item.id === "call")?.available, true);
    assert.equal(
      withoutPhone.find((item) => item.id === "call")?.available,
      false
    );
    assert.equal(
      withPhone.find((item) => item.id === "schedule")?.label,
      "Schedule in PMS"
    );
    assert.equal(
      withoutPhone.find((item) => item.id === "call")?.unavailableReason,
      "No patient phone is stored (mobile, home, or work)."
    );
  });

  it("enables persisted office actions and Schedule in PMS guidance", () => {
    const actions = getTreatmentWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    });
    const byId = Object.fromEntries(actions.map((item) => [item.id, item]));

    assert.equal(byId.dismiss.available, true);
    assert.equal(byId.schedule.available, true);
    assert.equal(byId.schedule.label, "Schedule in PMS");
    assert.equal(byId.mark_contacted.available, true);
    assert.equal(byId.add_note.available, true);
    assert.equal(byId.snooze.available, true);
    assert.equal(byId.complete.available, true);
    assert.deepEqual(DESIRED_TREATMENT_STEPS, [
      "Open",
      "Contacted",
      "Scheduled",
      "Completed",
    ]);
    assert.equal(DESIRED_TREATMENT_TERMINAL, "Dismissed");
    assert.equal(
      getPersistedTreatmentStatus({
        workflow_status: "open",
        completed: false,
      }),
      "Open"
    );
  });

  it("parses an opportunity id without using DELETE as dismissal", () => {
    assert.equal(treatmentDismissEquality("opp-1", "practice-1").opportunity_type, TREATMENT_OPPORTUNITY_TYPE);
    assert.equal(parseTreatmentDismissId({ id: " opp-1 " }), "opp-1");
    assert.equal(parseTreatmentDismissId({ id: 1 }), null);
  });

  it("uses the stored recommendation and does not invent AI copy", () => {
    assert.deepEqual(
      storedTreatmentRecommendation(
        "Contact the patient and schedule the planned treatment.",
        "Crown remains on the treatment plan."
      ),
      {
        text: "Contact the patient and schedule the planned treatment.",
        source: "recommended_action",
      }
    );
    assert.deepEqual(storedTreatmentRecommendation(null, "  "), {
      text: "No stored recommendation.",
      source: "none",
    });
  });
});
