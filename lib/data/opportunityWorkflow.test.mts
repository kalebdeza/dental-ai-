import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXISTING_OPPORTUNITY_COLUMNS,
  planOpportunityMerge,
  type ExistingOpportunity,
} from "../cron/mergeOpportunitiesByType.ts";
import {
  AUTHENTICATED_SCANNER_UPDATE_COLUMNS,
  AUTHENTICATED_WORKFLOW_UPDATE_COLUMNS,
  IDENTIFIED_SNAPSHOT_FIELDS,
  APPLY_OPPORTUNITY_WORKFLOW_RPC,
  CONTACT_OUTCOME_STATUS,
  IMMUTABLE_OPPORTUNITY_FIELDS,
  SCANNER_OWNED_FIELDS,
  WORKFLOW_OWNED_FIELDS,
  addOpportunityNote,
  applyCompletedWorkflowSync,
  backfillWorkflowStatus,
  buildApplyOpportunityWorkflowArgs,
  changeWorkflowStatus,
  completeOpportunity,
  dismissOpportunity,
  executeApplyOpportunityWorkflow,
  getOpportunity,
  getOpportunityActivities,
  isAuthenticatedDirectUpdateColumn,
  isAuthenticatedWorkflowUpdateColumn,
  isOpportunityDue,
  isWorkflowTransitionAllowed,
  newOpportunityWorkflowDefaults,
  planWorkflowMutation,
  recordContactOutcome,
  snoozeOpportunity,
  workflowActorFromAuth,
  type ApplyOpportunityWorkflowArgs,
  type OpportunityActivityRow,
  type OpportunityWorkflowClient,
  type OpportunityWorkflowRow,
  type WorkflowMutation,
} from "./opportunityWorkflow.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";
const USER_A = "user-a";
const USER_B = "user-b";
const MIGRATION_PATH = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260909010000_opportunity_workflow.sql",
    import.meta.url
  )
);

function opportunity(
  overrides: Partial<OpportunityWorkflowRow> = {}
): OpportunityWorkflowRow {
  return {
    id: "opp-1",
    practice_id: PRACTICE_A,
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

type MemoryTable = "revenue_opportunities" | "opportunity_activities";

function createWorkflowMemory(options: {
  authUid: string;
  practiceIds: string[];
  opportunities?: OpportunityWorkflowRow[];
  activities?: OpportunityActivityRow[];
}) {
  const opportunities = (options.opportunities ?? [opportunity()]).map(
    (row) => ({ ...row })
  );
  const activities = (options.activities ?? []).map((row) => ({ ...row }));
  let deleteCalls = 0;
  const rpcCalls: ApplyOpportunityWorkflowArgs[] = [];

  const tables: Record<MemoryTable, Record<string, unknown>[]> = {
    revenue_opportunities: opportunities,
    opportunity_activities: activities,
  };

  function from(table: string) {
    const filters: Array<[string, unknown]> = [];
    let action: "select" | "delete" | "update" = "select";
    let payload: Record<string, unknown> | null = null;

    const execute = async () => {
      if (action === "delete") {
        deleteCalls += 1;
        return { data: null, error: { message: "DELETE is not allowed" } };
      }

      const rows = (tables[table as MemoryTable] ?? []).filter((row) =>
        filters.every(([column, value]) => row[column] === value)
      );

      if (action === "update") {
        const patch = payload ?? {};
        const denied = Object.keys(patch).filter((column) =>
          isAuthenticatedWorkflowUpdateColumn(column)
        );

        if (denied.length > 0) {
          return {
            data: null,
            error: {
              message: `permission denied for column ${denied[0]}`,
            },
          };
        }

        for (const row of rows) {
          Object.assign(row, patch);
        }

        return { data: rows, error: null };
      }

      return { data: rows, error: null };
    };

    const chain = {
      select() {
        return chain;
      },
      eq(column: string, value: string) {
        filters.push([column, value]);
        return chain;
      },
      order() {
        return chain;
      },
      delete() {
        action = "delete";
        return chain;
      },
      update(patch: Record<string, unknown>) {
        action = "update";
        payload = patch;
        return chain;
      },
      maybeSingle: async () => {
        const result = await execute();
        const data = Array.isArray(result.data)
          ? (result.data[0] ?? null)
          : result.data;
        return { data, error: result.error };
      },
      then(
        resolve: (value: Awaited<ReturnType<typeof execute>>) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        return execute().then(resolve, reject);
      },
    };

    return chain;
  }

  const client: OpportunityWorkflowClient = {
    from,
    async rpc(fn, args) {
      rpcCalls.push({ ...args });

      if (fn !== APPLY_OPPORTUNITY_WORKFLOW_RPC) {
        return { data: null, error: { message: "Unknown function" } };
      }

      if ("p_actor_user_id" in args || "actor_user_id" in args) {
        return {
          data: null,
          error: { message: "Client-supplied actor is not allowed" },
        };
      }

      if (!options.practiceIds.includes(args.p_practice_id)) {
        return { data: null, error: { message: "Opportunity not found" } };
      }

      const row = opportunities.find(
        (item) =>
          item.id === args.p_opportunity_id &&
          item.practice_id === args.p_practice_id
      );

      if (!row) {
        return { data: null, error: { message: "Opportunity not found" } };
      }

      const mutation = mutationFromArgs(args);

      try {
        const result = executeApplyOpportunityWorkflow({
          row,
          practiceId: args.p_practice_id,
          actorUserId: options.authUid,
          mutation,
        });
        Object.assign(row, result.opportunity);
        activities.push(result.activity);
        return { data: result, error: null };
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error ? error.message : "Invalid workflow event",
          },
        };
      }
    },
  };

  return {
    client,
    opportunities,
    activities,
    rpcCalls,
    deleteCalls: () => deleteCalls,
  };
}

function mutationFromArgs(args: ApplyOpportunityWorkflowArgs): WorkflowMutation {
  if (args.p_event_type === "note") {
    return { kind: "note", note: args.p_note ?? "" };
  }

  if (args.p_event_type === "snooze") {
    return {
      kind: "snooze",
      snoozedUntil: args.p_snoozed_until ?? "",
      note: args.p_note,
    };
  }

  if (args.p_event_type === "contact_outcome") {
    return {
      kind: "contact_outcome",
      contactOutcome: args.p_contact_outcome ?? "no_answer",
      note: args.p_note,
    };
  }

  if (args.p_event_type === "complete") {
    return { kind: "complete", note: args.p_note };
  }

  if (args.p_event_type === "dismiss") {
    return { kind: "dismiss", note: args.p_note };
  }

  return {
    kind: "status_change",
    toStatus: args.p_to_status ?? "open",
    note: args.p_note,
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

describe("opportunity workflow backfill", () => {
  it("maps completed true to completed and false to open", () => {
    assert.equal(backfillWorkflowStatus(true), "completed");
    assert.equal(backfillWorkflowStatus(false), "open");
  });

  it("does not invent contacted, scheduled, or dismissed during backfill", () => {
    assert.equal(backfillWorkflowStatus(true), "completed");
    assert.equal(backfillWorkflowStatus(false), "open");
    assert.equal(newOpportunityWorkflowDefaults().workflow_status, "open");
    assert.equal(newOpportunityWorkflowDefaults().completed, false);
    assert.equal(newOpportunityWorkflowDefaults().contact_outcome, null);
    assert.equal(newOpportunityWorkflowDefaults().snoozed_until, null);
    assert.equal(newOpportunityWorkflowDefaults().last_actor_user_id, null);
    assert.equal(newOpportunityWorkflowDefaults().last_acted_at, null);
    assert.equal(newOpportunityWorkflowDefaults().close_reason, null);
  });
});

describe("opportunity workflow transitions", () => {
  const validRecall = [
    ["open", "contacted"],
    ["open", "scheduled"],
    ["open", "completed"],
    ["open", "dismissed"],
    ["contacted", "contacted"],
    ["contacted", "scheduled"],
    ["contacted", "completed"],
    ["contacted", "dismissed"],
    ["scheduled", "contacted"],
    ["scheduled", "scheduled"],
    ["scheduled", "completed"],
    ["scheduled", "dismissed"],
  ] as const;

  for (const [from, to] of validRecall) {
    it(`allows Recall ${from} → ${to}`, () => {
      assert.equal(isWorkflowTransitionAllowed("Recall", from, to), true);
      assert.equal(isWorkflowTransitionAllowed("Treatment", from, to), true);
    });
  }

  it("rejects terminal and reopen transitions", () => {
    assert.equal(isWorkflowTransitionAllowed("Recall", "completed", "open"), false);
    assert.equal(
      isWorkflowTransitionAllowed("Recall", "completed", "contacted"),
      false
    );
    assert.equal(
      isWorkflowTransitionAllowed("Recall", "dismissed", "open"),
      false
    );
    assert.equal(
      isWorkflowTransitionAllowed("Recall", "dismissed", "completed"),
      false
    );
    assert.equal(isWorkflowTransitionAllowed("Recall", "open", "open"), false);
    assert.equal(
      isWorkflowTransitionAllowed("Recall", "completed", "completed"),
      false
    );
  });

  it("does not force Claims into the Recall/Treatment contact lifecycle", () => {
    assert.equal(isWorkflowTransitionAllowed("Claim", "open", "contacted"), false);
    assert.equal(isWorkflowTransitionAllowed("Claim", "open", "scheduled"), false);
    assert.equal(isWorkflowTransitionAllowed("Claim", "open", "completed"), true);
    assert.equal(isWorkflowTransitionAllowed("Claim", "open", "dismissed"), true);

    const claim = opportunity({ opportunity_type: "Claim", claim_id: "claim-1" });

    assert.throws(
      () =>
        planWorkflowMutation(claim, PRACTICE_A, {
          kind: "status_change",
          toStatus: "contacted",
        }),
      /Invalid workflow transition/
    );
    assert.throws(
      () =>
        planWorkflowMutation(claim, PRACTICE_A, {
          kind: "contact_outcome",
          contactOutcome: "no_answer",
        }),
      /Invalid workflow transition/
    );
  });
});

describe("opportunity workflow contact outcomes", () => {
  it("maps outcomes onto office workflow states, not Open Dental appointments", () => {
    assert.equal(CONTACT_OUTCOME_STATUS.scheduled, "scheduled");
    assert.equal(CONTACT_OUTCOME_STATUS.will_call_back, "contacted");
    assert.equal(CONTACT_OUTCOME_STATUS.no_answer, "contacted");
    assert.equal(CONTACT_OUTCOME_STATUS.left_voicemail, "contacted");
    assert.equal(CONTACT_OUTCOME_STATUS.wrong_number, "contacted");
    assert.equal(CONTACT_OUTCOME_STATUS.declined, "dismissed");
  });

  it("records a contact outcome, updates status, and writes an activity", () => {
    const result = executeApplyOpportunityWorkflow({
      row: opportunity(),
      practiceId: PRACTICE_A,
      actorUserId: USER_A,
      mutation: { kind: "contact_outcome", contactOutcome: "left_voicemail" },
    });

    assert.equal(result.opportunity.workflow_status, "contacted");
    assert.equal(result.opportunity.completed, false);
    assert.equal(result.opportunity.contact_outcome, "left_voicemail");
    assert.equal(result.activity.event_type, "contact_outcome");
    assert.equal(result.activity.contact_outcome, "left_voicemail");
    assert.equal(result.activity.from_status, "open");
    assert.equal(result.activity.to_status, "contacted");
  });

  it("dismisses on declined without deleting the opportunity", () => {
    const result = executeApplyOpportunityWorkflow({
      row: opportunity(),
      practiceId: PRACTICE_A,
      actorUserId: USER_A,
      mutation: { kind: "contact_outcome", contactOutcome: "declined" },
    });

    assert.equal(result.opportunity.workflow_status, "dismissed");
    assert.equal(result.opportunity.completed, false);
    assert.equal(result.opportunity.id, "opp-1");
  });
});

describe("opportunity workflow snooze", () => {
  it("keeps the current status and is not due until snoozed_until", () => {
    const result = executeApplyOpportunityWorkflow({
      row: opportunity({ workflow_status: "contacted" }),
      practiceId: PRACTICE_A,
      actorUserId: USER_A,
      mutation: {
        kind: "snooze",
        snoozedUntil: "2026-10-01T12:00:00.000Z",
      },
    });

    assert.equal(result.opportunity.workflow_status, "contacted");
    assert.equal(result.opportunity.snoozed_until, "2026-10-01T12:00:00.000Z");
    assert.equal(result.activity.event_type, "snooze");
    assert.equal(
      isOpportunityDue(result.opportunity, new Date("2026-09-15T00:00:00.000Z")),
      false
    );
    assert.equal(
      isOpportunityDue(result.opportunity, new Date("2026-10-02T00:00:00.000Z")),
      true
    );
  });

  it("rejects a snooze time that is not in the future", () => {
    assert.throws(
      () =>
        planWorkflowMutation(opportunity(), PRACTICE_A, {
          kind: "snooze",
          snoozedUntil: "2020-01-01T00:00:00.000Z",
        }),
      /future/
    );
  });

  it("rejects snooze on completed and dismissed opportunities", () => {
    assert.throws(
      () =>
        planWorkflowMutation(
          opportunity({ workflow_status: "completed", completed: true }),
          PRACTICE_A,
          { kind: "snooze", snoozedUntil: "2026-10-01T00:00:00.000Z" }
        ),
      /Invalid workflow transition/
    );
    assert.throws(
      () =>
        planWorkflowMutation(
          opportunity({ workflow_status: "dismissed" }),
          PRACTICE_A,
          { kind: "snooze", snoozedUntil: "2026-10-01T00:00:00.000Z" }
        ),
      /Invalid workflow transition/
    );
  });
});

describe("opportunity workflow completed/status synchronization", () => {
  it("keeps completed true only when workflow_status is completed", () => {
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "INSERT",
        next: { workflow_status: "open", completed: true },
      }),
      { workflow_status: "open", completed: false }
    );
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "open", completed: false },
        next: { workflow_status: "completed", completed: false },
      }),
      { workflow_status: "completed", completed: true }
    );
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "open", completed: false },
        next: { workflow_status: "dismissed", completed: true },
      }),
      { workflow_status: "dismissed", completed: false }
    );
  });

  it("lets a scanner completion flip open rows to completed", () => {
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "contacted", completed: false },
        next: { workflow_status: "contacted", completed: true },
      }),
      { workflow_status: "completed", completed: true }
    );
  });

  it("does not reopen completed or dismissed rows through the completed flag", () => {
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "completed", completed: true },
        next: { workflow_status: "completed", completed: false },
      }),
      { workflow_status: "completed", completed: true }
    );
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "dismissed", completed: false },
        next: { workflow_status: "dismissed", completed: true },
      }),
      { workflow_status: "dismissed", completed: false }
    );
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "completed", completed: true },
        next: { workflow_status: "open", completed: false },
      }),
      { workflow_status: "completed", completed: true }
    );
    assert.deepEqual(
      applyCompletedWorkflowSync({
        operation: "UPDATE",
        previous: { workflow_status: "dismissed", completed: false },
        next: { workflow_status: "open", completed: false },
      }),
      { workflow_status: "dismissed", completed: false }
    );
  });
});

describe("opportunity workflow actor and tenant isolation", () => {
  it("takes actor identity from auth.uid() and never from a client field", () => {
    assert.equal(workflowActorFromAuth(USER_A), USER_A);
    assert.throws(() => workflowActorFromAuth(null), /Not authenticated/);

    const planned = planWorkflowMutation(opportunity(), PRACTICE_A, {
      kind: "note",
      note: "Called",
    });
    const args = buildApplyOpportunityWorkflowArgs(
      PRACTICE_A,
      "opp-1",
      planned
    );

    assert.deepEqual(Object.keys(args).sort(), [
      "p_clear_snooze",
      "p_contact_outcome",
      "p_event_type",
      "p_note",
      "p_opportunity_id",
      "p_practice_id",
      "p_snoozed_until",
      "p_to_status",
    ]);
    assert.equal("p_actor_user_id" in args, false);
    assert.equal("actor_user_id" in args, false);

    const result = executeApplyOpportunityWorkflow({
      row: opportunity(),
      practiceId: PRACTICE_A,
      actorUserId: USER_A,
      mutation: { kind: "note", note: "Called" },
    });
    assert.equal(result.activity.actor_user_id, USER_A);
    assert.equal(result.opportunity.last_actor_user_id, USER_A);
  });

  it("denies cross-practice mutations", () => {
    assert.throws(
      () =>
        planWorkflowMutation(opportunity(), PRACTICE_B, {
          kind: "dismiss",
        }),
      /Opportunity not found/
    );
  });

  it("does not change practice_id, source identifiers, or scanner-owned fields", () => {
    const row = opportunity({
      claim_id: null,
      procedure_id: "proc-1",
      recall_id: "recall-1",
      reason: "scanner reason",
      recommended_action: "scanner action",
      estimated_value: 180,
      priority: "High",
      confidence_score: 90,
    });
    const result = executeApplyOpportunityWorkflow({
      row,
      practiceId: PRACTICE_A,
      actorUserId: USER_A,
      mutation: { kind: "dismiss" },
    });

    for (const field of IMMUTABLE_OPPORTUNITY_FIELDS) {
      assert.equal(result.opportunity[field], row[field]);
    }

    for (const field of SCANNER_OWNED_FIELDS) {
      assert.equal(result.opportunity[field], row[field]);
    }

    assert.equal(result.opportunity.workflow_status, "dismissed");
    assert.ok(WORKFLOW_OWNED_FIELDS.includes("workflow_status"));
  });
});

describe("opportunity workflow data-layer API", () => {
  it("loads an opportunity inside the authenticated practice", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });
    const row = await getOpportunity(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
    });
    assert.equal(row?.id, "opp-1");
    assert.equal(
      await getOpportunity(memory.client, {
        practiceId: PRACTICE_A,
        opportunityId: "missing",
      }),
      null
    );
  });

  it("changes status, records contact, notes, snoozes, dismisses, and completes", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });

    const contacted = await changeWorkflowStatus(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
      toStatus: "contacted",
    });
    assert.equal(contacted.opportunity.workflow_status, "contacted");
    assert.equal(contacted.opportunity.completed, false);

    const outcome = await recordContactOutcome(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
      contactOutcome: "will_call_back",
    });
    assert.equal(outcome.opportunity.contact_outcome, "will_call_back");
    assert.equal(outcome.opportunity.workflow_status, "contacted");

    await addOpportunityNote(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
      note: "Left a message with the front desk",
    });

    const snoozed = await snoozeOpportunity(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
      snoozedUntil: "2026-11-01T00:00:00.000Z",
    });
    assert.equal(snoozed.opportunity.workflow_status, "contacted");
    assert.equal(snoozed.opportunity.snoozed_until, "2026-11-01T00:00:00.000Z");

    const activities = await getOpportunityActivities(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
    });
    assert.equal(activities.length, 4);
    assert.deepEqual(
      activities.map((item) => item.event_type),
      ["status_change", "contact_outcome", "note", "snooze"]
    );
    assert.ok(activities.every((item) => item.actor_user_id === USER_A));
  });

  it("dismisses without DELETE and keeps the row dismissed for the scanner", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });
    const dismissed = await dismissOpportunity(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
    });

    assert.equal(dismissed.opportunity.workflow_status, "dismissed");
    assert.equal(dismissed.opportunity.completed, false);
    assert.equal(dismissed.opportunity.close_reason, "office_dismissed");
    assert.equal(dismissed.activity.event_type, "dismiss");
    assert.equal(memory.deleteCalls(), 0);
    assert.equal(memory.opportunities.length, 1);

    const plan = planOpportunityMerge(
      "Recall",
      [asExisting(memory.opportunities[0]!)],
      [
        {
          patient_id: "patient-1",
          recall_id: "recall-1",
          priority: "High",
          estimated_value: 200,
        },
      ]
    );
    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.completions.length, 0);
    assert.equal(plan.updates[0]?.id, "opp-1");
  });

  it("completes without DELETE and keeps the row completed for the scanner", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });
    const completed = await completeOpportunity(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
    });

    assert.equal(completed.opportunity.workflow_status, "completed");
    assert.equal(completed.opportunity.completed, true);
    assert.equal(completed.opportunity.close_reason, "office_completed");
    assert.equal(memory.deleteCalls(), 0);

    const plan = planOpportunityMerge(
      "Recall",
      [asExisting(memory.opportunities[0]!)],
      [
        {
          patient_id: "patient-1",
          recall_id: "recall-1",
          priority: "High",
          estimated_value: 200,
        },
      ]
    );
    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.completions.length, 0);
  });

  it("rejects invalid transitions through the data-layer API", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
      opportunities: [
        opportunity({ workflow_status: "completed", completed: true }),
      ],
    });

    await assert.rejects(
      () =>
        changeWorkflowStatus(memory.client, {
          practiceId: PRACTICE_A,
          opportunityId: "opp-1",
          toStatus: "open",
        }),
      /Invalid workflow transition/
    );
    assert.equal(memory.activities.length, 0);
  });

  it("denies cross-practice access through the data-layer API", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_B,
      practiceIds: [PRACTICE_B],
      opportunities: [opportunity()],
    });

    assert.equal(
      await getOpportunity(memory.client, {
        practiceId: PRACTICE_B,
        opportunityId: "opp-1",
      }),
      null
    );

    await assert.rejects(
      () =>
        dismissOpportunity(memory.client, {
          practiceId: PRACTICE_B,
          opportunityId: "opp-1",
        }),
      /Opportunity not found/
    );
    await assert.rejects(
      () =>
        dismissOpportunity(memory.client, {
          practiceId: PRACTICE_A,
          opportunityId: "opp-1",
        }),
      /Opportunity not found/
    );
    assert.equal(memory.activities.length, 0);
    assert.equal(memory.opportunities[0]?.workflow_status, "open");
  });

  it("uses the authenticated user for activity actor even if another user is in scope", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });
    const result = await addOpportunityNote(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
      note: "Follow up Thursday",
    });

    assert.equal(result.activity.actor_user_id, USER_A);
    assert.notEqual(result.activity.actor_user_id, USER_B);
    assert.equal(memory.rpcCalls[0] && "p_actor_user_id" in memory.rpcCalls[0], false);
  });
});

describe("opportunity workflow privilege boundary", () => {
  it("does not allow authenticated users to UPDATE workflow columns directly", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });

    for (const column of AUTHENTICATED_WORKFLOW_UPDATE_COLUMNS) {
      assert.equal(isAuthenticatedDirectUpdateColumn(column), false);
      assert.equal(isAuthenticatedWorkflowUpdateColumn(column), true);
    }

    const { error } = await memory.client
      .from("revenue_opportunities")
      .update({ workflow_status: "contacted" })
      .eq("id", "opp-1")
      .eq("practice_id", PRACTICE_A);

    assert.match(error?.message ?? "", /permission denied for column workflow_status/);
    assert.equal(memory.opportunities[0]?.workflow_status, "open");
    assert.equal(memory.activities.length, 0);

    const { error: snoozeError } = await memory.client
      .from("revenue_opportunities")
      .update({ snoozed_until: "2026-11-01T00:00:00.000Z" })
      .eq("id", "opp-1")
      .eq("practice_id", PRACTICE_A);

    assert.match(
      snoozeError?.message ?? "",
      /permission denied for column snoozed_until/
    );
  });

  it("lets authenticated users execute the workflow RPC and writes an activity", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });

    const result = await changeWorkflowStatus(memory.client, {
      practiceId: PRACTICE_A,
      opportunityId: "opp-1",
      toStatus: "contacted",
    });

    assert.equal(result.opportunity.workflow_status, "contacted");
    assert.equal(result.activity.event_type, "status_change");
    assert.equal(result.activity.actor_user_id, USER_A);
    assert.equal(memory.rpcCalls.length, 1);
    assert.equal(memory.rpcCalls[0]?.p_event_type, "status_change");
    assert.equal(memory.activities.length, 1);
  });

  it("keeps scanner-owned UPDATE permissions intact", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_A,
      practiceIds: [PRACTICE_A],
    });

    for (const column of AUTHENTICATED_SCANNER_UPDATE_COLUMNS) {
      assert.equal(isAuthenticatedDirectUpdateColumn(column), true);
      assert.equal(isAuthenticatedWorkflowUpdateColumn(column), false);
    }

    for (const column of IDENTIFIED_SNAPSHOT_FIELDS) {
      assert.equal(isAuthenticatedDirectUpdateColumn(column), false);
      assert.equal(isAuthenticatedWorkflowUpdateColumn(column), false);
    }

    const { data, error } = await memory.client
      .from("revenue_opportunities")
      .update({
        reason: "scanner refresh",
        recommended_action: "Call",
        estimated_value: 220,
        priority: "Medium",
        confidence_score: 88,
        completed: false,
        updated_at: "2026-09-09T00:00:00.000Z",
      })
      .eq("id", "opp-1")
      .eq("practice_id", PRACTICE_A);

    assert.equal(error, null);
    assert.equal(data?.[0]?.reason, "scanner refresh");
    assert.equal(memory.opportunities[0]?.workflow_status, "open");
    assert.equal(memory.opportunities[0]?.contact_outcome, null);
    assert.equal(memory.activities.length, 0);
  });

  it("denies cross-practice workflow RPC mutations", async () => {
    const memory = createWorkflowMemory({
      authUid: USER_B,
      practiceIds: [PRACTICE_B],
      opportunities: [opportunity()],
    });

    await assert.rejects(
      () =>
        changeWorkflowStatus(memory.client, {
          practiceId: PRACTICE_A,
          opportunityId: "opp-1",
          toStatus: "contacted",
        }),
      /Opportunity not found/
    );
    assert.equal(memory.opportunities[0]?.workflow_status, "open");
    assert.equal(memory.activities.length, 0);
  });
});

describe("opportunity workflow migration contract", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("backfills completed/open and does not create historical activities", () => {
    assert.match(
      sql,
      /set workflow_status = 'completed'\s+where completed = true/i
    );
    assert.match(sql, /default 'open'/i);
    assert.doesNotMatch(
      sql,
      /insert into public\.opportunity_activities[\s\S]*select /i
    );
    assert.doesNotMatch(
      sql,
      /set workflow_status = 'contacted'/i
    );
    assert.doesNotMatch(
      sql,
      /set workflow_status = 'scheduled'/i
    );
    assert.doesNotMatch(
      sql,
      /set workflow_status = 'dismissed'/i
    );
  });

  it("creates append-only activity policies and RPC-only workflow mutation grants", () => {
    const mergeSql = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/20260909000000_opportunity_merge_natural_keys.sql",
          import.meta.url
        )
      ),
      "utf8"
    );

    assert.match(sql, /create table if not exists public\.opportunity_activities/);
    assert.match(sql, /create policy opportunity_activities_select/);
    assert.match(sql, /create policy opportunity_activities_insert/);
    assert.match(sql, /actor_user_id = auth\.uid\(\)/);
    assert.match(sql, /last_actor_user_id must equal auth\.uid\(\)/);
    assert.match(sql, /grant select, insert on table public\.opportunity_activities to authenticated/);
    assert.doesNotMatch(
      sql,
      /grant update[^\n]*on table public\.opportunity_activities/i
    );
    assert.doesNotMatch(
      sql,
      /grant delete[^\n]*on table public\.opportunity_activities/i
    );
    assert.match(
      sql,
      /revoke update \(\s*workflow_status,\s*contact_outcome,\s*snoozed_until,\s*last_actor_user_id,\s*last_acted_at\s*\)/i
    );
    assert.doesNotMatch(
      sql,
      /grant update \(\s*workflow_status/i
    );
    assert.match(
      sql,
      /create or replace function public\.apply_opportunity_workflow[\s\S]*security definer/i
    );
    assert.doesNotMatch(
      sql,
      /create or replace function public\.apply_opportunity_workflow[\s\S]*security invoker/i
    );
    assert.match(
      sql,
      /grant execute on function public\.apply_opportunity_workflow/
    );
    assert.match(
      mergeSql,
      /grant update \(\s*reason,\s*recommended_action,\s*estimated_value,\s*priority,\s*confidence_score,\s*completed,\s*updated_at\s*\)\s*on table revenue_opportunities\s*to authenticated/i
    );
  });

  it("synchronizes completed with workflow_status in a trigger", () => {
    assert.match(sql, /create trigger enforce_revenue_opportunity_workflow/);
    assert.match(
      sql,
      /new\.completed := \(new\.workflow_status = 'completed'\)/
    );
    assert.match(sql, /Opportunity identity and source keys are immutable/);
  });

  it("loads workflow_status in the scanner merge so dismissed rows stay dismissed", () => {
    assert.match(EXISTING_OPPORTUNITY_COLUMNS, /workflow_status/);
    assert.match(EXISTING_OPPORTUNITY_COLUMNS, /completed/);
  });
});
