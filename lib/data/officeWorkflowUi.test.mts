import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  planOpportunityMerge,
  type ExistingOpportunity,
  type MergeCandidate,
} from "../cron/mergeOpportunitiesByType.ts";
import {
  executeApplyOpportunityWorkflow,
  isActiveQueueOpportunity,
  planWorkflowMutation,
  type OpportunityWorkflowRow,
} from "./opportunityWorkflow.ts";
import { parseOfficeWorkflowRequest } from "./opportunityWorkflowRequest.ts";
import { mapOpportunityActivity } from "./opportunityActivityDisplay.ts";
import {
  getTreatmentContactOutcomes,
  getTreatmentWorkflowActions,
} from "./treatmentWorkflow.ts";
import { getClaimWorkflowActions } from "./claimWorkflow.ts";
import type { Tables } from "../database.types.ts";
import { CLAIM_STATUS } from "../opendental/status.ts";

const PRACTICE = "practice-a";
const USER = "user-a";

function opportunity(
  overrides: Partial<OpportunityWorkflowRow> = {}
): OpportunityWorkflowRow {
  return {
    id: "opp-1",
    practice_id: PRACTICE,
    opportunity_type: "Recall",
    patient_id: "patient-1",
    claim_id: null,
    procedure_id: null,
    recall_id: "recall-1",
    priority: "High",
    estimated_value: 180,
    confidence_score: 90,
    reason: "Overdue recall",
    recommended_action: "Call the patient",
    completed: false,
    workflow_status: "open",
    contact_outcome: null,
    snoozed_until: null,
    last_actor_user_id: null,
    last_acted_at: null,
    close_reason: null,
    identified_at: "2026-09-01T00:00:00.000Z",
    identified_estimated_value: 180,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function asExisting(row: OpportunityWorkflowRow): ExistingOpportunity {
  return {
    id: row.id,
    practice_id: row.practice_id,
    opportunity_type: row.opportunity_type,
    patient_id: row.patient_id,
    claim_id: row.claim_id,
    procedure_id: row.procedure_id,
    recall_id: row.recall_id,
    completed: row.completed,
    priority: row.priority,
    estimated_value: row.estimated_value,
    confidence_score: row.confidence_score,
    reason: row.reason,
    recommended_action: row.recommended_action,
    workflow_status: row.workflow_status,
    contact_outcome: row.contact_outcome,
    snoozed_until: row.snoozed_until,
    last_actor_user_id: row.last_actor_user_id,
    last_acted_at: row.last_acted_at,
  };
}

function candidate(
  overrides: Partial<MergeCandidate> = {}
): MergeCandidate {
  return {
    patient_id: "patient-1",
    recall_id: "recall-1",
    priority: "High",
    estimated_value: 200,
    ...overrides,
  };
}

function mutate(
  row: OpportunityWorkflowRow,
  mutation: Parameters<typeof executeApplyOpportunityWorkflow>[0]["mutation"]
) {
  return executeApplyOpportunityWorkflow({
    row,
    practiceId: PRACTICE,
    actorUserId: USER,
    mutation,
  });
}

function claim(overrides: Partial<Tables<"claims">> = {}): Tables<"claims"> {
  return {
    id: "claim-1",
    practice_id: PRACTICE,
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

describe("recall office workflow", () => {
  it("walks open → contacted → scheduled → completed and records activities", () => {
    const contacted = mutate(opportunity(), {
      kind: "status_change",
      toStatus: "contacted",
    });
    assert.equal(contacted.opportunity.workflow_status, "contacted");
    assert.equal(contacted.activity.event_type, "status_change");

    const scheduled = mutate(contacted.opportunity, {
      kind: "contact_outcome",
      contactOutcome: "scheduled",
    });
    assert.equal(scheduled.opportunity.workflow_status, "scheduled");
    assert.equal(scheduled.opportunity.contact_outcome, "scheduled");

    const completed = mutate(scheduled.opportunity, { kind: "complete" });
    assert.equal(completed.opportunity.workflow_status, "completed");
    assert.equal(completed.opportunity.completed, true);
  });

  it("records every contact outcome", () => {
    const outcomes = [
      "scheduled",
      "will_call_back",
      "no_answer",
      "left_voicemail",
      "declined",
      "wrong_number",
    ] as const;

    for (const contactOutcome of outcomes) {
      const result = mutate(opportunity(), {
        kind: "contact_outcome",
        contactOutcome,
      });
      assert.equal(result.activity.contact_outcome, contactOutcome);
      assert.equal(result.activity.event_type, "contact_outcome");
    }
  });

  it("dismisses from open, contacted, and scheduled without DELETE", () => {
    for (const status of ["open", "contacted", "scheduled"] as const) {
      const result = mutate(opportunity({ workflow_status: status }), {
        kind: "dismiss",
      });
      assert.equal(result.opportunity.workflow_status, "dismissed");
      assert.equal(result.opportunity.completed, false);
      assert.equal(result.opportunity.id, "opp-1");
      assert.equal(result.activity.event_type, "dismiss");
    }
  });

  it("saves notes and future snoozes, and hides snoozed rows from the queue", () => {
    const noted = mutate(opportunity(), { kind: "note", note: "Left a message" });
    assert.equal(noted.activity.note, "Left a message");

    const until = new Date(Date.now() + 86400000).toISOString();
    const snoozed = mutate(noted.opportunity, {
      kind: "snooze",
      snoozedUntil: until,
    });
    assert.equal(snoozed.opportunity.workflow_status, "open");
    assert.equal(
      isActiveQueueOpportunity(snoozed.opportunity, new Date()),
      false
    );
    assert.equal(
      isActiveQueueOpportunity(
        snoozed.opportunity,
        new Date(Date.now() + 2 * 86400000)
      ),
      true
    );
  });

  it("keeps dismissed, completed, and snoozed rows through scanner merge", () => {
    const dismissed = mutate(opportunity(), { kind: "dismiss" }).opportunity;
    const completed = mutate(opportunity({ id: "opp-2", recall_id: "recall-2" }), {
      kind: "complete",
    }).opportunity;
    const snoozed = mutate(
      opportunity({ id: "opp-3", recall_id: "recall-3" }),
      {
        kind: "snooze",
        snoozedUntil: new Date(Date.now() + 86400000).toISOString(),
      }
    ).opportunity;

    const dismissedPlan = planOpportunityMerge(
      "Recall",
      [asExisting(dismissed)],
      [candidate()]
    );
    assert.equal(dismissedPlan.inserts.length, 0);
    assert.equal(dismissedPlan.completions.length, 0);

    const completedPlan = planOpportunityMerge(
      "Recall",
      [asExisting(completed)],
      [candidate({ recall_id: "recall-2" })]
    );
    assert.equal(completedPlan.inserts.length, 0);
    assert.equal(completedPlan.completions.length, 0);

    const snoozedPlan = planOpportunityMerge(
      "Recall",
      [asExisting(snoozed)],
      [candidate({ recall_id: "recall-3" })]
    );
    assert.equal(snoozedPlan.updates[0]?.id, "opp-3");
    assert.equal(snoozedPlan.inserts.length, 0);
    assert.equal(
      snoozedPlan.updates[0]?.fields.reason != null ||
        snoozedPlan.updates.length === 1,
      true
    );
  });

  it("denies cross-practice recall mutations and keeps actor from auth", () => {
    assert.throws(
      () =>
        planWorkflowMutation(opportunity(), "practice-b", { kind: "dismiss" }),
      /Opportunity not found/
    );
    const result = mutate(opportunity(), { kind: "note", note: "Called" });
    assert.equal(result.activity.actor_user_id, USER);
  });
});

describe("treatment office workflow", () => {
  it("uses the same persisted Recall/Treatment lifecycle", () => {
    const row = opportunity({
      opportunity_type: "Treatment",
      procedure_id: "proc-1",
      recall_id: null,
    });
    const contacted = mutate(row, {
      kind: "status_change",
      toStatus: "contacted",
    });
    const scheduled = mutate(contacted.opportunity, {
      kind: "status_change",
      toStatus: "scheduled",
    });
    const completed = mutate(scheduled.opportunity, { kind: "complete" });
    assert.equal(completed.opportunity.workflow_status, "completed");
    assert.equal(completed.opportunity.completed, true);

    const dismissed = mutate(row, { kind: "dismiss" });
    assert.equal(dismissed.opportunity.workflow_status, "dismissed");

    const actions = getTreatmentWorkflowActions({
      phone: "555-0100",
      workflowStatus: "open",
      completed: false,
    });
    assert.equal(actions.find((item) => item.id === "schedule")?.available, false);
    assert.equal(
      getTreatmentContactOutcomes({
        workflowStatus: "open",
        completed: false,
      }).every((item) => item.available),
      true
    );
  });

  it("records every treatment contact outcome", () => {
    const row = opportunity({
      opportunity_type: "Treatment",
      procedure_id: "proc-1",
      recall_id: null,
    });
    const outcomes = [
      "scheduled",
      "will_call_back",
      "no_answer",
      "left_voicemail",
      "declined",
      "wrong_number",
    ] as const;

    for (const contactOutcome of outcomes) {
      const result = mutate(row, {
        kind: "contact_outcome",
        contactOutcome,
      });
      assert.equal(result.activity.contact_outcome, contactOutcome);
      assert.equal(result.opportunity.contact_outcome, contactOutcome);
    }
  });

  it("dismisses treatment from open, contacted, and scheduled without DELETE", () => {
    for (const status of ["open", "contacted", "scheduled"] as const) {
      const result = mutate(
        opportunity({
          opportunity_type: "Treatment",
          procedure_id: "proc-1",
          recall_id: null,
          workflow_status: status,
        }),
        { kind: "dismiss" }
      );
      assert.equal(result.opportunity.workflow_status, "dismissed");
      assert.equal(result.opportunity.id, "opp-1");
    }
  });

  it("saves treatment notes and snoozes, and keeps dismissed/completed/snoozed through merge", () => {
    const row = opportunity({
      opportunity_type: "Treatment",
      procedure_id: "proc-1",
      recall_id: null,
    });
    const noted = mutate(row, { kind: "note", note: "Discussed crown" });
    assert.equal(noted.activity.event_type, "note");

    const until = new Date(Date.now() + 86400000).toISOString();
    const snoozed = mutate(noted.opportunity, {
      kind: "snooze",
      snoozedUntil: until,
    });
    assert.equal(isActiveQueueOpportunity(snoozed.opportunity), false);
    const snoozedPlan = planOpportunityMerge(
      "Treatment",
      [asExisting(snoozed.opportunity)],
      [candidate({ recall_id: null, procedure_id: "proc-1" })]
    );
    assert.equal(snoozedPlan.inserts.length, 0);
    assert.equal(snoozedPlan.updates[0]?.id, "opp-1");

    const dismissed = mutate(row, { kind: "dismiss" }).opportunity;
    const completed = mutate(
      opportunity({
        id: "opp-2",
        opportunity_type: "Treatment",
        procedure_id: "proc-2",
        recall_id: null,
      }),
      { kind: "complete" }
    ).opportunity;

    const dismissedPlan = planOpportunityMerge(
      "Treatment",
      [asExisting(dismissed)],
      [candidate({ recall_id: null, procedure_id: "proc-1" })]
    );
    assert.equal(dismissedPlan.inserts.length, 0);

    const completedPlan = planOpportunityMerge(
      "Treatment",
      [asExisting(completed)],
      [candidate({ recall_id: null, procedure_id: "proc-2" })]
    );
    assert.equal(completedPlan.inserts.length, 0);
    assert.equal(completedPlan.completions.length, 0);
  });

  it("denies cross-practice treatment mutations and keeps actor from auth", () => {
    const row = opportunity({
      opportunity_type: "Treatment",
      procedure_id: "proc-1",
      recall_id: null,
    });
    assert.throws(
      () => planWorkflowMutation(row, "practice-b", { kind: "dismiss" }),
      /Opportunity not found/
    );
    const result = mutate(row, { kind: "note", note: "Called" });
    assert.equal(result.activity.actor_user_id, USER);
  });
});

describe("claims office workflow stays claim-centric", () => {
  it("allows notes, snooze, complete, and dismiss, and rejects contacted/scheduled", () => {
    const labels = getClaimWorkflowActions(claim(), {
      id: "opp-claim",
      reason: "Balance remains",
      recommended_action: "Follow up",
      completed: false,
      workflow_status: "open",
      snoozed_until: null,
    }).map((item) => item.label);

    assert.ok(labels.includes("Add Note"));
    assert.ok(labels.includes("Snooze"));
    assert.ok(labels.includes("Complete"));
    assert.ok(labels.includes("Dismiss"));
    assert.ok(labels.includes("Follow Up"));
    assert.equal(labels.includes("Mark Contacted"), false);
    assert.equal(labels.includes("Call Patient"), false);

    const row = opportunity({
      opportunity_type: "Claim",
      claim_id: "claim-1",
      recall_id: null,
    });
    assert.throws(
      () =>
        planWorkflowMutation(row, PRACTICE, {
          kind: "status_change",
          toStatus: "contacted",
        }),
      /Invalid workflow transition/
    );
    assert.throws(
      () =>
        planWorkflowMutation(row, PRACTICE, {
          kind: "contact_outcome",
          contactOutcome: "no_answer",
        }),
      /Invalid workflow transition/
    );

    const noted = mutate(row, { kind: "note", note: "Called payer" });
    assert.equal(noted.activity.event_type, "note");
    const snoozed = mutate(row, {
      kind: "snooze",
      snoozedUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(snoozed.activity.event_type, "snooze");
    assert.equal(isActiveQueueOpportunity(snoozed.opportunity), false);
    const dismissed = mutate(row, { kind: "dismiss" });
    assert.equal(dismissed.opportunity.workflow_status, "dismissed");
    const completed = mutate(row, { kind: "complete" });
    assert.equal(completed.opportunity.workflow_status, "completed");
    assert.equal(completed.activity.actor_user_id, USER);
    assert.throws(
      () => planWorkflowMutation(row, "practice-b", { kind: "note", note: "x" }),
      /Opportunity not found/
    );
  });
});

describe("queue filtering", () => {
  it("hides completed, dismissed, and snoozed rows until they are due", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    assert.equal(
      isActiveQueueOpportunity(opportunity({ workflow_status: "open" }), now),
      true
    );
    assert.equal(
      isActiveQueueOpportunity(
        opportunity({ workflow_status: "contacted" }),
        now
      ),
      true
    );
    assert.equal(
      isActiveQueueOpportunity(
        opportunity({ workflow_status: "scheduled" }),
        now
      ),
      true
    );
    assert.equal(
      isActiveQueueOpportunity(
        opportunity({ workflow_status: "completed", completed: true }),
        now
      ),
      false
    );
    assert.equal(
      isActiveQueueOpportunity(
        opportunity({ workflow_status: "dismissed" }),
        now
      ),
      false
    );
    assert.equal(
      isActiveQueueOpportunity(
        opportunity({
          workflow_status: "open",
          snoozed_until: "2026-09-10T00:00:00.000Z",
        }),
        now
      ),
      false
    );
    assert.equal(
      isActiveQueueOpportunity(
        opportunity({
          workflow_status: "open",
          snoozed_until: "2026-09-08T00:00:00.000Z",
        }),
        now
      ),
      true
    );
  });

  it("does not trigger a revenue scan from queue pages", () => {
    for (const relative of [
      "../../app/recall/page.tsx",
      "../../app/treatment/page.tsx",
      "../../app/opportunities/page.tsx",
    ]) {
      const source = readFileSync(
        fileURLToPath(new URL(relative, import.meta.url)),
        "utf8"
      );
      assert.doesNotMatch(source, /fetch\("\/api\/revenue-scan"\)/);
    }
  });
});

describe("workflow request parsing and activity display", () => {
  it("ignores client actor and practice fields", () => {
    const parsed = parseOfficeWorkflowRequest({
      opportunityId: "opp-1",
      action: "dismiss",
      actor_user_id: "attacker",
      practice_id: "other-practice",
    });
    assert.deepEqual(parsed, { opportunityId: "opp-1", action: "dismiss" });
  });

  it("maps stored activities without inventing history", () => {
    const view = mapOpportunityActivity({
      id: "act-1",
      practice_id: PRACTICE,
      opportunity_id: "opp-1",
      actor_user_id: USER,
      event_type: "contact_outcome",
      from_status: "open",
      to_status: "contacted",
      contact_outcome: "no_answer",
      note: "Rang twice",
      snoozed_until: null,
      created_at: "2026-09-09T12:00:00.000Z",
    });
    assert.equal(view.eventLabel, "Contact outcome");
    assert.equal(view.statusTransition, "Open → Contacted");
    assert.equal(view.contactOutcome, "No answer");
    assert.equal(view.note, "Rang twice");
  });
});

describe("no DELETE dismissal in Action Center APIs", () => {
  it("removes DELETE handlers from recall and treatment routes", () => {
    const recall = readFileSync(
      fileURLToPath(new URL("../../app/api/recall/route.ts", import.meta.url)),
      "utf8"
    );
    const treatment = readFileSync(
      fileURLToPath(
        new URL("../../app/api/treatment/route.ts", import.meta.url)
      ),
      "utf8"
    );
    assert.doesNotMatch(recall, /export async function DELETE/);
    assert.doesNotMatch(treatment, /export async function DELETE/);
    assert.doesNotMatch(recall, /\.delete\(/);
    assert.doesNotMatch(treatment, /\.delete\(/);
  });

  it("revokes authenticated DELETE on revenue_opportunities and drops the DELETE policy", () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/20260909020000_revoke_authenticated_opportunity_delete.sql",
          import.meta.url
        )
      ),
      "utf8"
    );

    assert.match(
      sql,
      /revoke delete\s+on table public\.revenue_opportunities\s+from authenticated/i
    );
    assert.match(
      sql,
      /drop policy if exists revenue_opportunities_delete\s+on public\.revenue_opportunities/i
    );
    assert.doesNotMatch(
      sql,
      /revoke delete[\s\S]*from service_role/i
    );
  });
});
