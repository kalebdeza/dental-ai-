import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dedupeMergeCandidates,
  mergeOpportunitiesByType,
  opportunityNaturalKey,
  planOpportunityMerge,
  type ExistingOpportunity,
  type MergeCandidate,
} from "./mergeOpportunitiesByType.ts";
import { createMemorySupabase } from "./mockSchedulerDb.ts";

const PRACTICE = "practice-a";

function existing(
  overrides: Partial<ExistingOpportunity> & Pick<ExistingOpportunity, "id">
): ExistingOpportunity {
  return {
    practice_id: PRACTICE,
    opportunity_type: "Recall",
    patient_id: "patient-1",
    claim_id: null,
    procedure_id: null,
    recall_id: null,
    completed: false,
    priority: "Low",
    estimated_value: 1,
    confidence_score: 90,
    reason: "old reason",
    recommended_action: "old action",
    ...overrides,
  };
}

function candidate(
  overrides: Partial<MergeCandidate> = {}
): MergeCandidate {
  return {
    patient_id: "patient-1",
    priority: "High",
    estimated_value: 200,
    confidence_score: 95,
    reason: "new reason",
    recommended_action: "new action",
    ...overrides,
  };
}

describe("opportunity natural keys", () => {
  it("keys Recall by recall_id and drops rows without one", () => {
    assert.equal(
      opportunityNaturalKey("Recall", { recall_id: "rec-1" }),
      "recall:rec-1"
    );
    assert.equal(opportunityNaturalKey("Recall", { recall_id: null }), null);
    assert.equal(
      opportunityNaturalKey("Recall", { patient_id: "pat-1" } as never),
      null
    );
  });

  it("keys Treatment by procedure_id and drops null procedure_id", () => {
    assert.equal(
      opportunityNaturalKey("Treatment", { procedure_id: "proc-1" }),
      "treatment:proc-1"
    );
    assert.equal(
      opportunityNaturalKey("Treatment", { procedure_id: null }),
      null
    );
  });

  it("keys Claim by claim_id, then procedure_id fallback", () => {
    assert.equal(
      opportunityNaturalKey("Claim", {
        claim_id: "claim-1",
        procedure_id: "proc-1",
      }),
      "claim:claim-1"
    );
    assert.equal(
      opportunityNaturalKey("Claim", {
        claim_id: null,
        procedure_id: "proc-1",
      }),
      "claim-proc:proc-1"
    );
    assert.equal(
      opportunityNaturalKey("Claim", { claim_id: null, procedure_id: null }),
      null
    );
  });
});

describe("planOpportunityMerge", () => {
  it("matches an existing opportunity on its natural key and keeps the same id", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [existing({ id: "opp-1", recall_id: "rec-1" })],
      [candidate({ recall_id: "rec-1" })]
    );

    assert.deepEqual(plan.inserts, []);
    assert.equal(plan.completions.length, 0);
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0]?.id, "opp-1");
  });

  it("refreshes scanner-owned fields and does not write office-owned fields", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [
        existing({
          id: "opp-1",
          recall_id: "rec-1",
          workflow_status: "contacted",
          contact_outcome: "will_call_back",
          snoozed_until: "2026-10-01",
          last_actor_user_id: "user-1",
          last_acted_at: "2026-09-01T00:00:00.000Z",
        }),
      ],
      [
        candidate({
          recall_id: "rec-1",
          reason: "refreshed",
          recommended_action: "call",
          estimated_value: 300,
          priority: "Medium",
          confidence_score: 80,
        }),
      ]
    );

    assert.deepEqual(plan.updates[0]?.fields, {
      reason: "refreshed",
      recommended_action: "call",
      estimated_value: 300,
      priority: "Medium",
      confidence_score: 80,
    });
    assert.equal(plan.completions.length, 0);
  });

  it("does not reopen a dismissed opportunity and does not insert a twin", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [
        existing({
          id: "opp-1",
          recall_id: "rec-1",
          workflow_status: "dismissed",
          completed: false,
        }),
      ],
      [candidate({ recall_id: "rec-1" })]
    );

    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.completions.length, 0);
    assert.equal(plan.updates[0]?.id, "opp-1");
  });

  it("does not reopen a completed opportunity", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [
        existing({
          id: "opp-1",
          recall_id: "rec-1",
          completed: true,
        }),
      ],
      [candidate({ recall_id: "rec-1" })]
    );

    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.completions.length, 0);
    assert.equal(plan.updates[0]?.id, "opp-1");
  });

  it("marks an unmatched open opportunity completed", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [existing({ id: "opp-1", recall_id: "rec-old" })],
      [candidate({ recall_id: "rec-new" })]
    );

    assert.equal(plan.completions[0]?.id, "opp-1");
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.inserts[0]?.recall_id, "rec-new");
  });

  it("marks unmatched contacted and scheduled opportunities completed while preserving office fields", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [
        existing({
          id: "contacted",
          recall_id: "rec-a",
          workflow_status: "contacted",
          contact_outcome: "no_answer",
          last_actor_user_id: "user-1",
        }),
        existing({
          id: "scheduled",
          recall_id: "rec-b",
          workflow_status: "scheduled",
          snoozed_until: "2026-10-01",
        }),
      ],
      []
    );

    assert.equal(plan.completions.length, 2);
    const contacted = plan.completions.find((item) => item.id === "contacted");
    const scheduled = plan.completions.find((item) => item.id === "scheduled");
    assert.equal(contacted?.preserve.contact_outcome, "no_answer");
    assert.equal(contacted?.preserve.last_actor_user_id, "user-1");
    assert.equal(scheduled?.preserve.snoozed_until, "2026-10-01");
  });

  it("leaves an unmatched dismissed opportunity untouched", () => {
    const plan = planOpportunityMerge(
      "Recall",
      [
        existing({
          id: "opp-1",
          recall_id: "rec-1",
          workflow_status: "dismissed",
        }),
      ],
      []
    );

    assert.deepEqual(plan.completions, []);
    assert.deepEqual(plan.inserts, []);
    assert.deepEqual(plan.updates, []);
  });

  it("drops unkeyed incoming candidates and does not insert them", () => {
    const recall = planOpportunityMerge(
      "Recall",
      [],
      [candidate({ recall_id: null }), candidate({ recall_id: "rec-1" })]
    );
    assert.equal(recall.droppedUnkeyed, 1);
    assert.equal(recall.inserts.length, 1);

    const treatment = planOpportunityMerge(
      "Treatment",
      [],
      [candidate({ procedure_id: null }), candidate({ procedure_id: "proc-1" })]
    );
    assert.equal(treatment.droppedUnkeyed, 1);
    assert.equal(treatment.inserts.length, 1);
  });

  it("does not automatically complete or delete existing Treatment rows with null procedure_id", () => {
    const plan = planOpportunityMerge(
      "Treatment",
      [
        existing({
          id: "saved-plan",
          opportunity_type: "Treatment",
          procedure_id: null,
          completed: false,
        }),
      ],
      [candidate({ procedure_id: "proc-1" })]
    );

    assert.equal(plan.completions.length, 0);
    assert.equal(
      plan.inserts.some((item) => item.procedure_id === "proc-1"),
      true
    );
  });

  it("deduplicates incoming claim_id candidates and prefers the outstanding-balance row", () => {
    const { keyed, droppedUnkeyed } = dedupeMergeCandidates("Claim", [
      candidate({
        claim_id: "claim-1",
        procedure_id: "proc-1",
        estimated_value: 400,
        claim_outstanding: false,
        reason: "unsent",
      }),
      candidate({
        claim_id: "claim-1",
        procedure_id: "proc-2",
        estimated_value: 40,
        claim_outstanding: true,
        reason: "outstanding",
      }),
    ]);

    assert.equal(droppedUnkeyed, 0);
    assert.equal(keyed.size, 1);
    assert.equal(keyed.get("claim:claim-1")?.reason, "outstanding");
    assert.equal(keyed.get("claim:claim-1")?.claim_outstanding, true);
  });

  it("completes an unclaimed procedure-keyed claim and inserts a new claim-keyed row", () => {
    const plan = planOpportunityMerge(
      "Claim",
      [
        existing({
          id: "unclaimed",
          opportunity_type: "Claim",
          claim_id: null,
          procedure_id: "proc-1",
          completed: false,
        }),
      ],
      [
        candidate({
          claim_id: "claim-1",
          procedure_id: "proc-1",
          claim_outstanding: true,
        }),
      ]
    );

    assert.equal(plan.completions[0]?.id, "unclaimed");
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.inserts[0]?.claim_id, "claim-1");
    assert.equal(plan.inserts[0]?.procedure_id, "proc-1");
  });

  it("is idempotent for a repeated candidate set", () => {
    const rows = [existing({ id: "opp-1", recall_id: "rec-1" })];
    const incoming = [candidate({ recall_id: "rec-1" })];
    const first = planOpportunityMerge("Recall", rows, incoming);
    const second = planOpportunityMerge("Recall", rows, incoming);

    assert.deepEqual(first, second);
    assert.equal(first.inserts.length, 0);
    assert.equal(first.updates[0]?.id, "opp-1");
  });
});

describe("mergeOpportunitiesByType writer", () => {
  it("preserves opportunity ids across a repeated scan and never deletes", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "opp-1",
          practice_id: PRACTICE,
          opportunity_type: "Recall",
          recall_id: "rec-1",
          patient_id: "patient-1",
          completed: false,
          priority: "Low",
          estimated_value: 1,
          identified_estimated_value: 1,
          identified_at: "2026-09-01T00:00:00.000Z",
          reason: "old",
          recommended_action: "old",
        },
      ],
    });

    const context = {
      supabase: memory.supabase as never,
      practiceId: PRACTICE,
    };

    const first = await mergeOpportunitiesByType(context, "Recall", [
      candidate({ recall_id: "rec-1", reason: "first" }),
    ]);
    const second = await mergeOpportunitiesByType(context, "Recall", [
      candidate({ recall_id: "rec-1", reason: "second" }),
    ]);

    const rows = memory.tables.revenue_opportunities;
    assert.equal(first.created, 0);
    assert.equal(second.created, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "opp-1");
    assert.equal(rows[0]?.reason, "second");
    assert.equal(rows[0]?.estimated_value, 200);
    assert.equal(rows[0]?.identified_estimated_value, 1);
    assert.equal(rows[0]?.completed, false);
  });

  it("completes unmatched open keyed rows and does not delete other types", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "old-recall",
          practice_id: PRACTICE,
          opportunity_type: "Recall",
          recall_id: "rec-old",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "claim-keep",
          practice_id: PRACTICE,
          opportunity_type: "Claim",
          claim_id: "claim-1",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
      ],
    });

    await mergeOpportunitiesByType(
      { supabase: memory.supabase as never, practiceId: PRACTICE },
      "Recall",
      [candidate({ recall_id: "rec-new" })]
    );

    const rows = memory.tables.revenue_opportunities;
    const old = rows.find((row) => row.id === "old-recall");
    const created = rows.find((row) => row.recall_id === "rec-new");
    assert.equal(old?.completed, true);
    assert.equal(old?.close_reason, "scanner_closed");
    assert.ok(old);
    assert.ok(created);
    assert.equal(
      rows.some((row) => row.id === "claim-keep" && row.completed === false),
      true
    );
  });

  it("leaves existing null-procedure Treatment rows in place", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "saved",
          practice_id: PRACTICE,
          opportunity_type: "Treatment",
          procedure_id: null,
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
      ],
    });

    await mergeOpportunitiesByType(
      { supabase: memory.supabase as never, practiceId: PRACTICE },
      "Treatment",
      [candidate({ procedure_id: null, reason: "saved plan" })]
    );

    const rows = memory.tables.revenue_opportunities;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "saved");
    assert.equal(rows[0]?.completed, false);
  });
});
