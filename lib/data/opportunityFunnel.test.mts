import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createMemorySupabase } from "../cron/mockSchedulerDb.ts";
import { mergeOpportunitiesByType } from "../cron/mergeOpportunitiesByType.ts";
import {
  assertNoRecoveredRevenue,
  buildOpportunityFunnelMetrics,
  firstActivityAt,
  loadOpportunityFunnelMetrics,
  readOpportunityLifecycle,
  type OpportunityFunnelActivity,
  type OpportunityFunnelMetrics,
  type OpportunityFunnelRow,
} from "./opportunityFunnel.ts";
import { IDENTIFIED_SNAPSHOT_FIELDS } from "./opportunityWorkflow.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";
const MIGRATION_PATH = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260910010000_opportunity_funnel_snapshots.sql",
    import.meta.url
  )
);

function row(
  overrides: Partial<OpportunityFunnelRow> & Pick<OpportunityFunnelRow, "id">
): OpportunityFunnelRow {
  return {
    practice_id: PRACTICE_A,
    patient_id: "patient-1",
    identified_at: "2026-09-01T00:00:00.000Z",
    identified_estimated_value: 180,
    workflow_status: "open",
    close_reason: null,
    ...overrides,
  };
}

function activity(
  overrides: Partial<OpportunityFunnelActivity> &
    Pick<OpportunityFunnelActivity, "opportunity_id" | "to_status" | "created_at">
): OpportunityFunnelActivity {
  return {
    event_type: "status_change",
    ...overrides,
  };
}

describe("opportunity funnel snapshots", () => {
  it("keeps the original estimated value after a scanner refresh", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "opp-1",
          practice_id: PRACTICE_A,
          opportunity_type: "Recall",
          recall_id: "rec-1",
          patient_id: "patient-1",
          completed: false,
          workflow_status: "open",
          estimated_value: 180,
          identified_estimated_value: 180,
          identified_at: "2026-09-01T00:00:00.000Z",
          close_reason: null,
          priority: "Low",
        },
      ],
    });

    await mergeOpportunitiesByType(
      { supabase: memory.supabase as never, practiceId: PRACTICE_A },
      "Recall",
      [
        {
          patient_id: "patient-1",
          recall_id: "rec-1",
          priority: "High",
          estimated_value: 400,
          reason: "refreshed",
          recommended_action: "Call",
        },
      ]
    );

    const stored = memory.tables.revenue_opportunities[0];
    assert.equal(stored?.estimated_value, 400);
    assert.equal(stored?.identified_estimated_value, 180);
    assert.equal(stored?.identified_at, "2026-09-01T00:00:00.000Z");
  });

  it("snapshots identified value on insert and does not write it on later updates", async () => {
    const memory = createMemorySupabase();

    await mergeOpportunitiesByType(
      { supabase: memory.supabase as never, practiceId: PRACTICE_A },
      "Recall",
      [
        {
          patient_id: "patient-1",
          recall_id: "rec-1",
          priority: "High",
          estimated_value: 220,
        },
      ]
    );

    const created = memory.tables.revenue_opportunities[0];
    assert.equal(created?.estimated_value, 220);
    assert.equal(created?.identified_estimated_value, 220);
    assert.equal(typeof created?.identified_at, "string");

    await mergeOpportunitiesByType(
      { supabase: memory.supabase as never, practiceId: PRACTICE_A },
      "Recall",
      [
        {
          patient_id: "patient-1",
          recall_id: "rec-1",
          priority: "High",
          estimated_value: 500,
        },
      ]
    );

    assert.equal(memory.tables.revenue_opportunities[0]?.estimated_value, 500);
    assert.equal(
      memory.tables.revenue_opportunities[0]?.identified_estimated_value,
      220
    );
  });
});

describe("opportunity funnel stages", () => {
  const activities: OpportunityFunnelActivity[] = [
    activity({
      opportunity_id: "opp-contacted-twice",
      to_status: "contacted",
      created_at: "2026-09-02T10:00:00.000Z",
    }),
    activity({
      opportunity_id: "opp-contacted-twice",
      event_type: "contact_outcome",
      to_status: "contacted",
      created_at: "2026-09-03T10:00:00.000Z",
    }),
    activity({
      opportunity_id: "opp-scheduled",
      to_status: "contacted",
      created_at: "2026-09-02T09:00:00.000Z",
    }),
    activity({
      opportunity_id: "opp-scheduled",
      event_type: "contact_outcome",
      to_status: "scheduled",
      created_at: "2026-09-04T09:00:00.000Z",
    }),
    activity({
      opportunity_id: "opp-scheduled",
      to_status: "scheduled",
      created_at: "2026-09-05T09:00:00.000Z",
    }),
    activity({
      opportunity_id: "opp-office-complete",
      event_type: "complete",
      to_status: "completed",
      created_at: "2026-09-06T09:00:00.000Z",
    }),
    activity({
      opportunity_id: "opp-dismissed",
      event_type: "dismiss",
      to_status: "dismissed",
      created_at: "2026-09-06T10:00:00.000Z",
    }),
  ];

  const opportunities: OpportunityFunnelRow[] = [
    row({
      id: "opp-open",
      identified_estimated_value: 100,
      workflow_status: "open",
    }),
    row({
      id: "opp-contacted-twice",
      identified_estimated_value: 200,
      workflow_status: "contacted",
    }),
    row({
      id: "opp-scheduled",
      patient_id: "patient-2",
      identified_estimated_value: 300,
      workflow_status: "scheduled",
    }),
    row({
      id: "opp-office-complete",
      identified_estimated_value: 400,
      workflow_status: "completed",
      close_reason: "office_completed",
    }),
    row({
      id: "opp-dismissed",
      identified_estimated_value: 50,
      workflow_status: "dismissed",
      close_reason: "office_dismissed",
    }),
    row({
      id: "opp-scanner-closed",
      identified_estimated_value: 75,
      workflow_status: "completed",
      close_reason: "scanner_closed",
    }),
    row({
      id: "opp-open",
      identified_estimated_value: 999,
    }),
  ];

  it("uses the first contacted and scheduled activities", () => {
    const contacted = readOpportunityLifecycle(
      row({ id: "opp-contacted-twice", workflow_status: "contacted" }),
      activities
    );
    const scheduled = readOpportunityLifecycle(
      row({
        id: "opp-scheduled",
        workflow_status: "scheduled",
      }),
      activities
    );

    assert.equal(contacted.contactedAt, "2026-09-02T10:00:00.000Z");
    assert.equal(scheduled.scheduledAt, "2026-09-04T09:00:00.000Z");
    assert.equal(
      firstActivityAt(
        activities,
        "opp-contacted-twice",
        (item) => item.to_status === "contacted"
      ),
      "2026-09-02T10:00:00.000Z"
    );
  });

  it("counts office completed separately from scanner closed and dismissed", () => {
    const metrics = buildOpportunityFunnelMetrics(opportunities, activities);

    assert.equal(metrics.officeCompleted.count, 1);
    assert.equal(metrics.officeCompleted.estimatedValue, 400);
    assert.equal(metrics.scannerClosedCount, 1);
    assert.equal(metrics.officeDismissedCount, 1);
    assert.notEqual(metrics.officeCompleted.estimatedValue, 75);
  });

  it("does not count dismissed opportunities as completed", () => {
    const metrics = buildOpportunityFunnelMetrics(opportunities, activities);
    assert.equal(metrics.officeCompleted.count, 1);
    assert.equal(metrics.officeCompleted.estimatedValue, 400);
    assert.equal(metrics.officeDismissedCount, 1);
  });

  it("counts each opportunity once and uses identified estimated value", () => {
    const metrics = buildOpportunityFunnelMetrics(opportunities, activities);

    assert.equal(metrics.identified.count, 6);
    assert.equal(metrics.identified.estimatedValue, 100 + 200 + 300 + 400 + 50 + 75);
    assert.equal(metrics.contacted.count, 2);
    assert.equal(metrics.contacted.estimatedValue, 500);
    assert.equal(metrics.scheduled.count, 1);
    assert.equal(metrics.scheduled.estimatedValue, 300);
    assert.equal(metrics.openPipeline.count, 3);
    assert.equal(metrics.openPipeline.estimatedValue, 600);
    assert.equal(metrics.identified.patientCount, 2);
  });

  it("does not infer completed from scanner disappearance and does not calculate recovered revenue", () => {
    const scannerOnly = buildOpportunityFunnelMetrics(
      [
        row({
          id: "opp-scanner-closed",
          workflow_status: "completed",
          close_reason: "scanner_closed",
          identified_estimated_value: 75,
        }),
      ],
      []
    );

    assert.equal(scannerOnly.officeCompleted.count, 0);
    assert.equal(scannerOnly.officeCompleted.estimatedValue, 0);
    assert.equal(scannerOnly.scannerClosedCount, 1);
    assert.equal(
      readOpportunityLifecycle(
        row({
          id: "opp-scanner-closed",
          close_reason: "scanner_closed",
        }),
        []
      ).completedAt,
      null
    );

    assertNoRecoveredRevenue(scannerOnly);
    assert.equal("recoveredRevenue" in scannerOnly, false);
    assert.equal("revenueRecovered" in scannerOnly, false);
    assert.doesNotMatch(JSON.stringify(scannerOnly), /recovered|roi/i);
  });
});

describe("opportunity funnel tenant isolation", () => {
  it("loads only the requested practice", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "opp-a",
          practice_id: PRACTICE_A,
          patient_id: "patient-a",
          identified_at: "2026-09-01T00:00:00.000Z",
          identified_estimated_value: 180,
          workflow_status: "open",
          close_reason: null,
        },
        {
          id: "opp-b",
          practice_id: PRACTICE_B,
          patient_id: "patient-b",
          identified_at: "2026-09-01T00:00:00.000Z",
          identified_estimated_value: 900,
          workflow_status: "open",
          close_reason: null,
        },
      ],
      opportunity_activities: [
        {
          opportunity_id: "opp-b",
          practice_id: PRACTICE_B,
          event_type: "status_change",
          to_status: "contacted",
          created_at: "2026-09-02T00:00:00.000Z",
        },
      ],
    });

    const metrics = await loadOpportunityFunnelMetrics(
      memory.supabase as never,
      PRACTICE_A
    );

    assert.equal(metrics.identified.count, 1);
    assert.equal(metrics.identified.estimatedValue, 180);
    assert.equal(metrics.contacted.count, 0);
  });
});

describe("opportunity funnel migration contract", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("freezes identified snapshots and grants scanner close_reason only", () => {
    assert.match(sql, /add column if not exists identified_at/);
    assert.match(sql, /add column if not exists identified_estimated_value/);
    assert.match(sql, /add column if not exists close_reason/);
    assert.match(
      sql,
      /new\.identified_estimated_value := old\.identified_estimated_value/
    );
    assert.match(
      sql,
      /new\.identified_estimated_value := coalesce\(new\.estimated_value, 0\)/
    );
    assert.match(sql, /revoke update \(identified_at, identified_estimated_value\)/);
    assert.match(sql, /grant update \(close_reason\)/);
    assert.match(sql, /when v_next = 'completed' then 'office_completed'/);
    assert.match(sql, /when v_next = 'dismissed' then 'office_dismissed'/);
    assert.match(sql, /coalesce\(new\.close_reason, 'scanner_closed'\)/);
    assert.doesNotMatch(sql, /recovered_amount|revenue_recovered|roi/i);

    for (const field of IDENTIFIED_SNAPSHOT_FIELDS) {
      assert.match(sql, new RegExp(field));
    }
  });
});

describe("opportunity funnel metric shape", () => {
  it("exposes estimated funnel fields and no recovered revenue fields", () => {
    const metrics: OpportunityFunnelMetrics = buildOpportunityFunnelMetrics(
      [],
      []
    );

    assert.deepEqual(Object.keys(metrics).sort(), [
      "contacted",
      "identified",
      "officeCompleted",
      "officeDismissedCount",
      "openPipeline",
      "scannerClosedCount",
      "scheduled",
    ]);
    assertNoRecoveredRevenue(metrics);
  });
});
