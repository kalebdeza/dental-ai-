import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Tables } from "../database.types.ts";
import { CLAIM_STATUS } from "../opendental/status.ts";
import {
  buildClaimTimeline,
  getClaimNextAction,
  getClaimWorkflowActions,
  getClaimWorkflowBucket,
} from "./claimWorkflow.ts";

type Claim = Tables<"claims">;

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

describe("claim workflow buckets", () => {
  it("treats unsent claims as draft and does not recommend follow-up", () => {
    const draft = claim();
    assert.equal(getClaimWorkflowBucket(draft), "draft");
    const labels = getClaimWorkflowActions(draft).map((item) => item.label);
    assert.ok(labels.includes("Review Claim"));
    assert.ok(labels.includes("Submit Claim"));
    assert.ok(labels.includes("Generate Narrative"));
    assert.ok(labels.includes("Add Note"));
    assert.ok(labels.includes("Snooze"));
    assert.ok(labels.includes("Complete"));
    assert.ok(labels.includes("Dismiss"));
    assert.equal(labels.includes("Follow Up"), false);
    assert.equal(labels.includes("Mark Contacted"), false);
    assert.equal(labels.includes("Scheduled"), false);
  });

  it("treats a sent claim with no remaining balance as sent, not draft", () => {
    const sent = claim({
      status: CLAIM_STATUS.Sent,
      remaining_balance: 0,
      amount_paid: 0,
      submitted_at: "2026-08-15T00:00:00.000Z",
    });
    assert.equal(getClaimWorkflowBucket(sent), "sent");
    const labels = getClaimWorkflowActions(sent).map((item) => item.label);
    assert.ok(labels.includes("Follow Up"));
    assert.ok(labels.includes("View Claim Details"));
    assert.ok(labels.includes("Add Note"));
    assert.ok(labels.includes("Snooze"));
    assert.equal(labels.includes("Submit Claim"), false);
    assert.equal(labels.includes("Set Follow-Up Date"), false);
  });

  it("uses denial_reason for denied actions including Generate Appeal", () => {
    const denied = claim({
      status: CLAIM_STATUS.Sent,
      denial_reason: "Missing narrative",
    });
    assert.equal(getClaimWorkflowBucket(denied), "denied");
    const labels = getClaimWorkflowActions(denied).map((item) => item.label);
    assert.ok(labels.includes("Generate Appeal"));
    assert.ok(labels.includes("Review Denial"));
    assert.equal(labels.includes("Submit Claim"), false);
  });

  it("treats a paid-down claim as paid", () => {
    const paid = claim({
      status: CLAIM_STATUS.Received,
      amount_paid: 400,
      remaining_balance: 0,
      paid_at: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(getClaimWorkflowBucket(paid), "paid");
    const labels = getClaimWorkflowActions(paid).map((item) => item.label);
    assert.ok(labels.includes("View Payment"));
    assert.ok(labels.includes("Mark Resolved"));
    assert.ok(labels.includes("Add Note"));
    assert.equal(labels.includes("Submit Claim"), false);
    assert.equal(labels.includes("Mark Contacted"), false);
  });

  it("uses outstanding follow-up actions when a sent claim still has a balance", () => {
    const outstanding = claim({
      status: CLAIM_STATUS.Sent,
      remaining_balance: 250,
      submitted_at: "2026-08-15T00:00:00.000Z",
    });
    assert.equal(getClaimWorkflowBucket(outstanding), "outstanding");
    const next = getClaimNextAction(outstanding, null);
    assert.equal(next.what.toLowerCase().includes("submit"), false);
    const labels = getClaimWorkflowActions(outstanding).map((item) => item.label);
    assert.ok(labels.includes("Follow Up"));
    assert.ok(labels.includes("Add Note"));
    assert.ok(labels.includes("Snooze"));
    assert.equal(labels.includes("Set Follow-Up Date"), false);
    assert.equal(labels.includes("Submit Claim"), false);
  });
});

describe("claim next action and timeline", () => {
  it("prefers stored opportunity reason and recommended action", () => {
    const next = getClaimNextAction(claim(), {
      reason: "Outstanding insurance balance remains.",
      recommended_action: "Call the payer about the remaining balance.",
    });
    assert.equal(next.source, "opportunity");
    assert.equal(next.why, "Outstanding insurance balance remains.");
    assert.equal(
      next.recommendedAction,
      "Call the payer about the remaining balance."
    );
  });

  it("only emits timeline events that have stored claim fields", () => {
    const events = buildClaimTimeline(
      claim({
        submitted_at: "2026-08-10T00:00:00.000Z",
        paid_at: null,
        denial_reason: null,
        last_action: null,
      })
    );
    assert.deepEqual(
      events.map((event) => event.label),
      ["Created", "Submitted"]
    );
  });

  it("includes denial text when stored, without inventing a denial timestamp", () => {
    const events = buildClaimTimeline(
      claim({ denial_reason: "CO-16" })
    );
    const denied = events.find((event) => event.label === "Denied");
    assert.equal(denied?.at, null);
    assert.equal(denied?.detail, "CO-16");
  });
});
