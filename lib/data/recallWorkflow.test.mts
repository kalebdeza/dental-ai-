import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DESIRED_RECALL_STEPS,
  DESIRED_RECALL_TERMINAL,
  RECALL_CONTACT_OUTCOMES,
  RECALL_OPPORTUNITY_TYPE,
  formatRecallDueDate,
  formatRecallPatientName,
  getPersistedRecallStatus,
  getRecallContactOutcomes,
  getRecallWorkflowActions,
  mapRecallOpportunity,
  parseRecallDismissId,
  pickPatientPhone,
  recallDismissEquality,
  selectOpenRecallForPatient,
  storedRecallRecommendation,
  toTelHref,
  type RecallPatientContact,
  type RecallRowSummary,
} from "./recallWorkflow.ts";

function patient(
  overrides: Partial<RecallPatientContact> = {}
): RecallPatientContact {
  return {
    id: "patient-1",
    first_name: "Ada",
    last_name: "Lovelace",
    mobile_phone: null,
    home_phone: null,
    work_phone: null,
    ...overrides,
  };
}

function recallRow(
  overrides: Partial<RecallRowSummary> = {}
): RecallRowSummary {
  return {
    patient_id: "patient-1",
    recall_type: "Prophy",
    due_date: "2026-01-01",
    completed_date: null,
    status: "Due",
    estimated_revenue: 180,
    ...overrides,
  };
}

describe("recall phone selection", () => {
  it("prefers mobile, then home, then work, and does not invent a number", () => {
    assert.equal(pickPatientPhone(null), null);
    assert.equal(pickPatientPhone(patient()), null);
    assert.equal(pickPatientPhone(patient({ mobile_phone: "   " })), null);
    assert.equal(
      pickPatientPhone(patient({ mobile_phone: "555-0100" })),
      "555-0100"
    );
    assert.equal(
      pickPatientPhone(
        patient({ mobile_phone: "  ", home_phone: "555-0200" })
      ),
      "555-0200"
    );
    assert.equal(
      pickPatientPhone(
        patient({
          mobile_phone: null,
          home_phone: "  ",
          work_phone: "555-0300",
        })
      ),
      "555-0300"
    );
  });

  it("only builds a tel href from a usable stored phone", () => {
    assert.equal(toTelHref(null), null);
    assert.equal(toTelHref("abc"), null);
    assert.equal(toTelHref("555-0100"), "tel:5550100");
    assert.equal(toTelHref("+1 (555) 010-0199"), "tel:+15550100199");
  });
});

describe("recall record selection", () => {
  it("picks the most overdue open recall for the patient and skips completed ones", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    const selected = selectOpenRecallForPatient(
      [
        recallRow({
          recall_type: "Other patient",
          patient_id: "patient-2",
          due_date: "2025-01-01",
        }),
        recallRow({
          recall_type: "Completed",
          due_date: "2025-01-01",
          completed_date: "2026-02-01",
        }),
        recallRow({
          recall_type: "Newer overdue",
          due_date: "2026-06-01",
        }),
        recallRow({
          recall_type: "Oldest overdue",
          due_date: "2025-12-01",
        }),
      ],
      "patient-1",
      now
    );

    assert.equal(selected?.recall_type, "Oldest overdue");
  });

  it("returns null when the patient has no open recall rows", () => {
    assert.equal(
      selectOpenRecallForPatient(
        [
          recallRow({
            completed_date: "2026-01-15",
          }),
        ],
        "patient-1"
      ),
      null
    );
  });
});

describe("recall opportunity mapping", () => {
  it("maps stored patient, phone, and recall fields without fabricating values", () => {
    const mapped = mapRecallOpportunity(
      {
        id: "opp-1",
        patient_id: "patient-1",
        opportunity_type: "Recall",
        estimated_value: 250,
        priority: "High",
        reason: "Patient is 90 days overdue for Prophy.",
        recommended_action:
          "Contact the patient and schedule the overdue recall appointment.",
        completed: false,
        workflow_status: "open",
        contact_outcome: null,
        snoozed_until: null,
      },
      patient({ mobile_phone: "555-0100" }),
      recallRow({ due_date: "2026-01-15", recall_type: "Prophy" })
    );

    assert.equal(mapped.patient, "Ada Lovelace");
    assert.equal(mapped.phone, "555-0100");
    assert.equal(mapped.recallType, "Prophy");
    assert.equal(mapped.dueDate, "2026-01-15");
    assert.equal(mapped.patientId, "patient-1");
  });

  it("leaves phone and recall details empty when they are not stored", () => {
    const mapped = mapRecallOpportunity(
      {
        id: "opp-2",
        patient_id: null,
        opportunity_type: "Recall",
        estimated_value: 0,
        priority: "Low",
        reason: null,
        recommended_action: null,
        completed: false,
        workflow_status: "open",
        contact_outcome: null,
        snoozed_until: null,
      },
      null,
      null
    );

    assert.equal(mapped.patient, "Unknown Patient");
    assert.equal(mapped.phone, null);
    assert.equal(mapped.recallType, null);
    assert.equal(mapped.dueDate, null);
  });

  it("formats names and due dates from stored values only", () => {
    assert.equal(formatRecallPatientName(null), "Unknown Patient");
    assert.equal(formatRecallDueDate(null), "Not available");
    assert.equal(formatRecallDueDate("not-a-date"), "Not available");
    assert.equal(
      formatRecallDueDate("2026-01-15T00:00:00.000Z"),
      new Date("2026-01-15T00:00:00.000Z").toLocaleDateString()
    );
  });
});

describe("recall workflow persistence", () => {
  it("enables Call Patient only when a usable phone is stored", () => {
    const withPhone = getRecallWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    });
    const withoutPhone = getRecallWorkflowActions({
      phone: null,
      workflowStatus: "open",
      completed: false,
    });

    assert.equal(withPhone.find((item) => item.id === "call")?.available, true);
    assert.equal(
      withoutPhone.find((item) => item.id === "call")?.available,
      false
    );
  });

  it("enables persisted office actions and keeps scheduling disabled", () => {
    const actions = getRecallWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    });
    const byId = Object.fromEntries(actions.map((item) => [item.id, item]));

    assert.equal(byId.dismiss.available, true);
    assert.equal(byId.mark_contacted.available, true);
    assert.equal(byId.add_note.available, true);
    assert.equal(byId.snooze.available, true);
    assert.equal(byId.complete.available, true);
    assert.equal(byId.schedule.available, false);

    const completed = getRecallWorkflowActions({
      phone: "555-0100",
      workflowStatus: "completed",
      completed: true,
    });
    assert.equal(completed.find((item) => item.id === "dismiss")?.available, false);
    assert.equal(completed.find((item) => item.id === "complete")?.available, false);
  });

  it("uses persisted workflow_status labels and persistable contact outcomes", () => {
    assert.equal(RECALL_CONTACT_OUTCOMES.length, 6);
    assert.deepEqual(DESIRED_RECALL_STEPS, [
      "Open",
      "Contacted",
      "Scheduled",
      "Completed",
    ]);
    assert.equal(DESIRED_RECALL_TERMINAL, "Dismissed");
    assert.equal(
      getPersistedRecallStatus({ workflow_status: "open", completed: false }),
      "Open"
    );
    assert.equal(
      getPersistedRecallStatus({
        workflow_status: "completed",
        completed: true,
      }),
      "Completed"
    );
    assert.equal(
      getPersistedRecallStatus({
        workflow_status: "contacted",
        completed: false,
      }),
      "Contacted"
    );
    assert.equal(
      getRecallContactOutcomes({
        workflowStatus: "open",
        completed: false,
      }).every((item) => item.available),
      true
    );
    assert.equal(
      getRecallContactOutcomes({
        workflowStatus: "dismissed",
        completed: false,
      }).every((item) => !item.available),
      true
    );
  });

  it("parses an opportunity id without using DELETE equality as dismissal", () => {
    assert.equal(parseRecallDismissId({ id: " opp-1 " }), "opp-1");
    assert.equal(parseRecallDismissId({ id: "" }), null);
    assert.equal(parseRecallDismissId({ id: 1 }), null);
    assert.equal(parseRecallDismissId({}), null);
    assert.equal(recallDismissEquality("opp-1", "practice-1").opportunity_type, RECALL_OPPORTUNITY_TYPE);
  });

  it("uses the stored recommendation and does not invent AI copy", () => {
    assert.deepEqual(
      storedRecallRecommendation(
        "Contact the patient and schedule the overdue recall appointment.",
        "Patient is 90 days overdue."
      ),
      {
        text: "Contact the patient and schedule the overdue recall appointment.",
        source: "recommended_action",
      }
    );
    assert.deepEqual(storedRecallRecommendation(null, "Overdue recall"), {
      text: "Overdue recall",
      source: "reason",
    });
    assert.deepEqual(storedRecallRecommendation("  ", "  "), {
      text: "No stored recommendation.",
      source: "none",
    });
  });
});
