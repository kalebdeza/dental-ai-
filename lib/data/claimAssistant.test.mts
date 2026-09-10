import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Tables } from "../database.types.ts";
import { CLAIM_STATUS } from "../opendental/status.ts";
import { NOT_AVAILABLE_IN_APP } from "./claimDisplay.ts";
import {
  CLAIM_AI_SYSTEM_PROMPT,
  CLAIM_READINESS_DISCLAIMER,
  PAYER_FOLLOW_UP_CHECKLIST,
  buildClaimAiFactsBlock,
  buildClaimAiUserPrompt,
  buildClaimAssistantView,
  getClaimSubmissionReadiness,
  getPmsGuidanceMessage,
  listClaimFieldChecks,
  looksLikeSyntheticTestData,
} from "./claimAssistant.ts";
import { getClaimWorkflowActions } from "./claimWorkflow.ts";

type Claim = Tables<"claims">;
type Patient = Tables<"patients">;

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-1",
    practice_id: "practice-1",
    integration_id: "integration-1",
    patient_id: "patient-1",
    provider_id: null,
    source_claim_id: "1",
    claim_number: "1001",
    insurance_company: "Delta",
    status: CLAIM_STATUS.Unsent,
    amount_billed: 400,
    amount_paid: 0,
    remaining_balance: 400,
    submitted_at: null,
    paid_at: null,
    last_action: null,
    denial_reason: null,
    last_synced_at: null,
    source_status: "U",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    practice_id: "practice-1",
    integration_id: "integration-1",
    source_patient_id: "1",
    first_name: "Ada",
    last_name: "Lovelace",
    middle_name: null,
    preferred_name: null,
    birth_date: null,
    gender: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    home_phone: null,
    mobile_phone: null,
    work_phone: null,
    email: null,
    chart_number: null,
    patient_status: null,
    balance: 0,
    insurance_estimate: 0,
    last_visit: null,
    next_visit: null,
    last_synced_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const linkedOpportunity = {
  id: "opp-1",
  reason: "Unsent claim",
  recommended_action: "Submit in PMS",
  completed: false,
  workflow_status: "open",
  snoozed_until: null,
};

describe("claim submission assistant", () => {
  it("marks a complete unsent claim ready based only on stored fields", () => {
    const readiness = getClaimSubmissionReadiness({
      claim: claim(),
      patient: patient(),
    });
    assert.equal(readiness.state, "ready_based_on_available_data");
    assert.equal(readiness.label, "Ready based on available data");

    const view = buildClaimAssistantView({
      claim: claim(),
      patient: patient(),
    });
    assert.equal(view.title, "Claim submission assistant");
    assert.match(view.disclaimer ?? "", /Final claim validation/);
    assert.match(CLAIM_READINESS_DISCLAIMER, /Dental AI/);

    const labels = getClaimWorkflowActions(claim(), linkedOpportunity).map(
      (item) => item.label
    );
    assert.deepEqual(
      labels.slice(0, 3),
      ["Generate Narrative", "Submit in PMS", "Generate Supporting Notes"]
    );
    assert.equal(labels.includes("Open Claim"), false);
  });

  it("needs review when payer or billed amount is missing and does not call the claim ready", () => {
    const noPayer = getClaimSubmissionReadiness({
      claim: claim({ insurance_company: null }),
      patient: patient(),
    });
    assert.equal(noPayer.state, "needs_review");

    const zeroBilled = getClaimSubmissionReadiness({
      claim: claim({ amount_billed: 0 }),
      patient: patient(),
    });
    assert.equal(zeroBilled.state, "needs_review");

    const held = getClaimSubmissionReadiness({
      claim: claim({ status: CLAIM_STATUS.HoldUntilPrimaryReceived }),
      patient: patient(),
    });
    assert.equal(held.state, "needs_review");
  });

  it("is insufficient when patient and payer are both missing", () => {
    const readiness = getClaimSubmissionReadiness({
      claim: claim({ insurance_company: null }),
      patient: null,
    });
    assert.equal(readiness.state, "insufficient_data");
  });

  it("does not fabricate procedure, tooth, diagnosis, or attachment facts", () => {
    const fields = listClaimFieldChecks({
      claim: claim(),
      patient: patient(),
    });
    const notStored = fields.filter((field) => field.status === "not_stored");
    assert.ok(notStored.some((field) => field.key === "procedure"));
    assert.ok(notStored.some((field) => field.key === "tooth_number"));
    assert.ok(notStored.some((field) => field.key === "diagnosis"));
    assert.ok(notStored.some((field) => field.key === "attachments"));
    for (const field of notStored) {
      assert.equal(field.value, NOT_AVAILABLE_IN_APP);
    }

    const facts = buildClaimAiFactsBlock({
      claim: claim(),
      patient: patient(),
    });
    assert.match(facts, /Procedure: Not available in this app/);
    assert.doesNotMatch(facts, /D[0-9]{4}/);
    assert.doesNotMatch(facts, /tooth #/i);
  });
});

describe("outstanding and sent follow-up assistant", () => {
  it("recommends contacting the payer and shows a checklist, not an app action", () => {
    const now = new Date("2026-09-20T00:00:00.000Z");
    const view = buildClaimAssistantView({
      claim: claim({
        status: CLAIM_STATUS.Sent,
        remaining_balance: 250,
        submitted_at: "2026-08-01T00:00:00.000Z",
      }),
      patient: patient(),
      now,
    });
    assert.equal(view.title, "Payer follow-up assistant");
    assert.equal(
      view.recommendedNextStep,
      "Contact the payer to check claim status."
    );
    assert.deepEqual(view.followUpChecklist, [...PAYER_FOLLOW_UP_CHECKLIST]);
    assert.match(view.disclaimer ?? "", /does not contact the payer/);
    assert.ok(view.facts.some((fact) => fact.label === "Aging"));

    const actions = getClaimWorkflowActions(
      claim({
        status: CLAIM_STATUS.Sent,
        remaining_balance: 250,
        submitted_at: "2026-08-01T00:00:00.000Z",
      }),
      linkedOpportunity
    );
    const labels = actions.map((item) => item.label);
    assert.deepEqual(labels, ["Add Note", "Snooze", "Complete", "Dismiss"]);
    assert.equal(labels.includes("Submit in PMS"), false);
    assert.equal(labels.includes("Open Claim"), false);
    assert.equal(labels.includes("Follow Up"), false);
    assert.equal(actions.find((item) => item.id === "follow_up"), undefined);
  });
});

describe("denied claim assistant", () => {
  it("uses the stored denial reason and does not invent one", () => {
    const withReason = buildClaimAssistantView({
      claim: claim({
        status: CLAIM_STATUS.Sent,
        denial_reason: "Missing narrative",
      }),
      patient: patient(),
    });
    assert.equal(withReason.title, "Denial resolution");
    assert.equal(withReason.denialReason, "Missing narrative");
    assert.equal(withReason.denialUnavailable, false);
    assert.match(withReason.denialExplanation ?? "", /Missing narrative/);
    assert.doesNotMatch(withReason.denialExplanation ?? "", /x-ray|tooth|CDT/i);

    const noDenial = buildClaimAssistantView({
      claim: claim({
        status: CLAIM_STATUS.Sent,
        remaining_balance: 250,
        denial_reason: null,
      }),
      patient: patient(),
    });
    assert.equal(noDenial.bucket, "outstanding");
    assert.equal(noDenial.denialReason, null);
    assert.equal(noDenial.denialExplanation, null);
    assert.doesNotMatch(noDenial.recommendedNextStep, /denied because/i);

    const labels = getClaimWorkflowActions(
      claim({
        status: CLAIM_STATUS.Sent,
        denial_reason: "Missing narrative",
      }),
      linkedOpportunity
    ).map((item) => item.label);
    assert.ok(labels.includes("Generate Appeal"));
    assert.ok(labels.includes("Generate Narrative"));
    assert.ok(labels.includes("Fix in PMS"));
    assert.ok(labels.includes("Resubmit in PMS"));
    assert.equal(labels.includes("Open Claim"), false);
  });
});

describe("paid and resolved claims", () => {
  it("does not present submission or follow-up actions", () => {
    const paid = claim({
      status: CLAIM_STATUS.Received,
      amount_paid: 400,
      remaining_balance: 0,
      paid_at: "2026-09-01T00:00:00.000Z",
    });
    const view = buildClaimAssistantView({
      claim: paid,
      patient: patient(),
    });
    assert.equal(view.title, "Claim payment");
    assert.equal(view.followUpChecklist, null);
    assert.equal(view.readiness, null);
    assert.match(view.recommendedNextStep, /No submission or payer follow-up/);

    const labels = getClaimWorkflowActions(paid, linkedOpportunity).map(
      (item) => item.label
    );
    assert.ok(labels.includes("Mark Resolved"));
    assert.ok(labels.includes("Add Note"));
    assert.equal(labels.includes("Follow Up"), false);
    assert.equal(labels.includes("Submit in PMS"), false);
    assert.equal(labels.includes("Generate Narrative"), false);
    assert.equal(labels.includes("Open Claim"), false);
  });
});

describe("manual PMS and grounded AI prompts", () => {
  it("treats Submit/Fix/Resubmit as guidance that does not call an API", () => {
    const actions = getClaimWorkflowActions(claim(), linkedOpportunity);
    const submit = actions.find((item) => item.id === "submit");
    assert.equal(submit?.kind, "guidance");
    assert.equal(submit?.href, undefined);
    assert.match(getPmsGuidanceMessage("submit"), /does not submit claims/);
    assert.match(getPmsGuidanceMessage("fix"), /doesn't currently edit/);
    assert.match(getPmsGuidanceMessage("resubmit"), /doesn't currently resubmit/);
  });

  it("keeps Add Note, Snooze, Complete, and Dismiss as workflow actions", () => {
    const actions = getClaimWorkflowActions(claim(), linkedOpportunity);
    for (const id of ["add_note", "snooze", "complete", "dismiss"] as const) {
      const item = actions.find((action) => action.id === id);
      assert.equal(item?.kind, "workflow");
      assert.equal(item?.available, true);
    }
  });

  it("builds AI prompts that forbid fabricating missing claim facts", () => {
    const prompt = buildClaimAiUserPrompt({
      mode: "narrative",
      factsBlock: buildClaimAiFactsBlock({
        claim: claim(),
        patient: patient(),
      }),
    });
    assert.match(CLAIM_AI_SYSTEM_PROMPT, /Never invent/);
    assert.match(prompt, /Not available in this app/);
    assert.match(prompt, /Do not invent medical necessity|do not invent/i);
  });

  it("does not turn synthetic isolation-check text into a real-world recommendation", () => {
    assert.equal(
      looksLikeSyntheticTestData([
        "Do not contact a real patient. Isolation check only.",
      ]),
      true
    );
    const view = buildClaimAssistantView({
      claim: claim({
        last_action: "Do not contact a real patient. Isolation check only.",
      }),
      patient: patient(),
    });
    assert.equal(view.isSyntheticTestData, true);
    assert.match(view.syntheticNotice ?? "", /synthetic test data/i);
    assert.match(view.recommendedNextStep, /synthetic test data/i);
    assert.doesNotMatch(
      view.recommendedNextStep,
      /Contact the payer to check claim status/
    );
  });
});
