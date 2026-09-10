import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { officeWorkflowSuccessMessage } from "../../app/components/postOfficeWorkflow.ts";
import { getClaimWorkflowActions } from "./claimWorkflow.ts";
import { CLAIM_STATUS } from "../opendental/status.ts";
import type { Tables } from "../database.types.ts";
import { SCHEDULE_IN_PMS_GUIDANCE } from "./recallWorkflow.ts";
import { getRecallWorkflowActions } from "./recallWorkflow.ts";
import { getTreatmentWorkflowActions } from "./treatmentWorkflow.ts";

function claim(overrides: Partial<Tables<"claims">> = {}): Tables<"claims"> {
  return {
    id: "claim-1",
    practice_id: "practice-1",
    integration_id: "integration-1",
    patient_id: "patient-1",
    provider_id: null,
    source_claim_id: "1",
    claim_number: "1001",
    insurance_company: "Delta",
    status: CLAIM_STATUS.Sent,
    amount_billed: 400,
    amount_paid: 0,
    remaining_balance: 250,
    submitted_at: "2026-08-15T00:00:00.000Z",
    paid_at: null,
    last_action: null,
    denial_reason: null,
    last_synced_at: null,
    source_status: "S",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Action Center UX", () => {
  it("does not show Open Claim on the claim workspace Action Center", () => {
    const actions = getClaimWorkflowActions(claim());
    assert.equal(
      actions.find((item) => item.id === "open_claim"),
      undefined
    );

    const source = readFileSync(
      fileURLToPath(
        new URL("../../app/claims/[id]/components/ClaimActions.tsx", import.meta.url)
      ),
      "utf8"
    );
    assert.doesNotMatch(source, /Open Claim/);
    assert.doesNotMatch(source, /View Claim Details/);
    assert.doesNotMatch(source, /<Link href=\{item\.href\}/);
  });

  it("every claim action has a real kind and none is a silent no-op", () => {
    for (const row of [
      claim({ status: CLAIM_STATUS.Unsent, remaining_balance: 400, submitted_at: null }),
      claim(),
      claim({ denial_reason: "Missing narrative" }),
      claim({
        status: CLAIM_STATUS.Received,
        amount_paid: 400,
        remaining_balance: 0,
        paid_at: "2026-09-01T00:00:00.000Z",
      }),
    ]) {
      for (const item of getClaimWorkflowActions(row, {
        id: "opp-1",
        reason: "Balance remains",
        recommended_action: "Follow up",
        completed: false,
        workflow_status: "open",
        snoozed_until: null,
      })) {
        assert.ok(
          item.kind === "workflow" ||
            item.kind === "navigate" ||
            item.kind === "guidance" ||
            item.kind === "in_page",
          `${item.id} missing kind`
        );
        if (item.kind === "navigate") {
          assert.ok(item.href);
        }
      }
    }
  });

  it("Schedule in PMS is clickable guidance and does not create appointments", () => {
    const recall = getRecallWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    }).find((item) => item.id === "schedule");
    const treatment = getTreatmentWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    }).find((item) => item.id === "schedule");
    assert.equal(recall?.available, true);
    assert.equal(treatment?.available, true);
    assert.match(SCHEDULE_IN_PMS_GUIDANCE, /doesn't currently create appointments/);

    const recallPage = readFileSync(
      fileURLToPath(new URL("../../app/recall/[id]/page.tsx", import.meta.url)),
      "utf8"
    );
    const treatmentPage = readFileSync(
      fileURLToPath(
        new URL("../../app/treatment/[id]/page.tsx", import.meta.url)
      ),
      "utf8"
    );
    assert.match(recallPage, /SCHEDULE_IN_PMS_GUIDANCE/);
    assert.match(treatmentPage, /SCHEDULE_IN_PMS_GUIDANCE/);
    assert.match(recallPage, /postOfficeWorkflow/);
    assert.match(treatmentPage, /postOfficeWorkflow/);
  });

  it("Call Patient uses tel: when a phone is stored and explains when it is not", () => {
    const withPhone = getRecallWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    }).find((item) => item.id === "call");
    const withoutPhone = getRecallWorkflowActions({
      phone: null,
      workflowStatus: "open",
      completed: false,
    }).find((item) => item.id === "call");
    assert.equal(withPhone?.available, true);
    assert.equal(withoutPhone?.available, false);
    assert.match(withoutPhone?.unavailableReason ?? "", /No patient phone/);

    const actionsUi = readFileSync(
      fileURLToPath(
        new URL("../../app/components/OfficeWorkflowActions.tsx", import.meta.url)
      ),
      "utf8"
    );
    assert.match(actionsUi, /item\.id === "call" && item\.available && telHref/);
    assert.match(actionsUi, /<a href=\{telHref\}/);
    assert.match(actionsUi, /item\.unavailableReason/);
  });

  it("persisted workflow actions report a visible success message", () => {
    assert.equal(
      officeWorkflowSuccessMessage("mark_contacted"),
      "Saved: marked contacted."
    );
    assert.equal(officeWorkflowSuccessMessage("add_note"), "Note saved.");
    assert.match(
      officeWorkflowSuccessMessage("contact_outcome", {
        contactOutcome: "scheduled",
      }),
      /did not create an appointment/
    );
    assert.match(
      officeWorkflowSuccessMessage("snooze", {
        snoozedUntil: "2026-10-01T12:00:00.000Z",
      }),
      /Snoozed until/
    );
  });

  it("claims page follows up with payer facts and keeps real workflow posts", () => {
    const page = readFileSync(
      fileURLToPath(new URL("../../app/claims/[id]/page.tsx", import.meta.url)),
      "utf8"
    );
    assert.match(page, /formatClaimFollowUpGuidance/);
    assert.match(page, /getPmsGuidanceMessage/);
    assert.match(page, /postOfficeWorkflow/);
    assert.match(page, /officeWorkflowSuccessMessage/);
    assert.match(page, /claimId: claim\.id/);
    assert.match(page, /claimId: current\.id/);
    assert.doesNotMatch(page, /app contacted/);
    assert.doesNotMatch(page, /router\.push\(`\/claims\/\$\{claim\.id\}`\)/);

    const submitCase = page.slice(
      page.indexOf('case "submit"'),
      page.indexOf('case "follow_up"')
    );
    assert.match(submitCase, /getPmsGuidanceMessage/);
    assert.doesNotMatch(submitCase, /fetch\(/);
    assert.doesNotMatch(submitCase, /opendental/i);

    const narrativeRoute = readFileSync(
      fileURLToPath(
        new URL("../../app/api/claims/narrative/route.ts", import.meta.url)
      ),
      "utf8"
    );
    assert.match(narrativeRoute, /requirePractice\(\)/);
    assert.match(narrativeRoute, /loadPracticeClaimWithDetails/);
    assert.match(narrativeRoute, /auth\.practice\.id/);
    assert.doesNotMatch(narrativeRoute, /opendental/i);
    assert.doesNotMatch(narrativeRoute, /body\.patientName/);

    const appealRoute = readFileSync(
      fileURLToPath(
        new URL("../../app/api/generate-appeal/route.ts", import.meta.url)
      ),
      "utf8"
    );
    assert.match(appealRoute, /claimId/);
    assert.match(appealRoute, /loadPracticeClaimWithDetails/);
    assert.match(appealRoute, /CLAIM_AI_SYSTEM_PROMPT/);
  });

  it("sent claims do not duplicate Follow Up and hide empty Copilot chrome", () => {
    const labels = getClaimWorkflowActions(claim(), {
      id: "opp-1",
      reason: "Balance remains",
      recommended_action: "Follow up",
      completed: false,
      workflow_status: "open",
      snoozed_until: null,
    }).map((item) => item.label);
    assert.deepEqual(labels, ["Add Note", "Snooze", "Complete", "Dismiss"]);

    const copilot = readFileSync(
      fileURLToPath(
        new URL("../../app/claims/[id]/components/AIClaimCopilot.tsx", import.meta.url)
      ),
      "utf8"
    );
    assert.match(copilot, /if \(!hasAiActions && !hasGeneratedOutput\)/);
    assert.match(copilot, /return null;/);
    assert.match(copilot, /bucket === "draft" \|\| bucket === "denied"/);
  });
});
