import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMemorySupabase } from "./mockSchedulerDb.ts";
import { replaceOpenOpportunitiesByType } from "./replaceOpenOpportunitiesByType.ts";
import { stampPracticeJobTimestamp } from "./schedulerContext.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";

const PRACTICE_A = "practice-a";
const INTEGRATION_A = "integration-a";

function contextFrom(
  supabase: SchedulerPracticeContext["supabase"],
  practiceId = PRACTICE_A,
  integrationId = INTEGRATION_A
): SchedulerPracticeContext {
  return { supabase, practiceId, integrationId };
}

describe("timestamp stamps", () => {
  it("updates the matching integration and practice pair", async () => {
    const memory = createMemorySupabase({
      integrations: [
        {
          id: INTEGRATION_A,
          practice_id: PRACTICE_A,
          last_sync_at: null,
        },
        {
          id: "integration-b",
          practice_id: "practice-b",
          last_sync_at: null,
        },
      ],
    });

    await stampPracticeJobTimestamp(
      contextFrom(memory.supabase as never),
      "sync",
      new Date("2026-09-03T00:00:00.000Z")
    );

    assert.equal(
      memory.tables.integrations[0]?.last_sync_at,
      "2026-09-03T00:00:00.000Z"
    );
    assert.equal(memory.tables.integrations[1]?.last_sync_at, null);
  });

  it("fails when the integration/practice pair matches zero rows", async () => {
    const memory = createMemorySupabase({
      integrations: [
        {
          id: INTEGRATION_A,
          practice_id: "practice-b",
          last_sync_at: null,
        },
      ],
    });

    await assert.rejects(() =>
      stampPracticeJobTimestamp(
        contextFrom(memory.supabase as never),
        "sync",
        new Date("2026-09-03T00:00:00.000Z")
      )
    );
    assert.equal(memory.tables.integrations[0]?.last_sync_at, null);
  });
});

describe("per-type opportunity replacement", () => {
  it("inserts before deleting so a failed insert cannot empty the type", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "old-claim",
          practice_id: PRACTICE_A,
          opportunity_type: "Claim",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "done-claim",
          practice_id: PRACTICE_A,
          opportunity_type: "Claim",
          completed: true,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "recall",
          practice_id: PRACTICE_A,
          opportunity_type: "Recall",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
      ],
    });

    const originalFrom = memory.supabase.from.bind(memory.supabase);
    let inserts = 0;
    memory.supabase.from = ((table: string) => {
      const chain = originalFrom(table);
      const originalInsert = chain.insert.bind(chain);
      chain.insert = (rows: Record<string, unknown>[]) => {
        inserts += 1;
        if (inserts === 1) {
          throw new Error("insert failed");
        }
        return originalInsert(rows);
      };
      return chain;
    }) as typeof memory.supabase.from;

    await assert.rejects(() =>
      replaceOpenOpportunitiesByType(
        contextFrom(memory.supabase as never),
        "Claim",
        [
          {
            patient_id: "pat-a",
            priority: "High",
            estimated_value: 50,
          },
        ]
      )
    );

    assert.equal(
      memory.tables.revenue_opportunities.some((row) => row.id === "old-claim"),
      true
    );
    assert.equal(
      memory.tables.revenue_opportunities.some((row) => row.id === "done-claim"),
      true
    );
    assert.equal(
      memory.tables.revenue_opportunities.some((row) => row.id === "recall"),
      true
    );
  });

  it("pages past 1,000 incomplete opportunity ids and preserves other types and completed rows", async () => {
    const oldClaims = Array.from({ length: 1205 }, (_, index) => ({
      id: `old-claim-${index + 1}`,
      practice_id: PRACTICE_A,
      opportunity_type: "Claim",
      completed: false,
      priority: "Low",
      estimated_value: 1,
    }));

    const memory = createMemorySupabase({
      revenue_opportunities: [
        ...oldClaims,
        {
          id: "done-claim",
          practice_id: PRACTICE_A,
          opportunity_type: "Claim",
          completed: true,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "recall-keep",
          practice_id: PRACTICE_A,
          opportunity_type: "Recall",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "treatment-keep",
          practice_id: PRACTICE_A,
          opportunity_type: "Treatment",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "other-practice",
          practice_id: "practice-b",
          opportunity_type: "Claim",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
      ],
    });

    await replaceOpenOpportunitiesByType(
      contextFrom(memory.supabase as never),
      "Claim",
      [
        {
          patient_id: "pat-a",
          priority: "High",
          estimated_value: 50,
        },
      ]
    );

    const remaining = memory.tables.revenue_opportunities;
    assert.equal(
      remaining.filter(
        (row) =>
          row.opportunity_type === "Claim" &&
          row.completed === false &&
          row.practice_id === PRACTICE_A
      ).length,
      1
    );
    assert.equal(
      remaining.some((row) => row.id === "done-claim"),
      true
    );
    assert.equal(
      remaining.some((row) => row.id === "recall-keep"),
      true
    );
    assert.equal(
      remaining.some((row) => row.id === "treatment-keep"),
      true
    );
    assert.equal(
      remaining.some((row) => row.id === "other-practice"),
      true
    );
    assert.equal(
      remaining.some((row) => String(row.id).startsWith("old-claim-")),
      false
    );
  });

  it("preserves Claim rows when replacing Recall and Treatment", async () => {
    const memory = createMemorySupabase({
      revenue_opportunities: [
        {
          id: "claim-keep",
          practice_id: PRACTICE_A,
          opportunity_type: "Claim",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "recall-old",
          practice_id: PRACTICE_A,
          opportunity_type: "Recall",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "treatment-old",
          practice_id: PRACTICE_A,
          opportunity_type: "Treatment",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
      ],
    });

    await replaceOpenOpportunitiesByType(
      contextFrom(memory.supabase as never),
      "Recall",
      [{ patient_id: "pat-a", priority: "High", estimated_value: 2 }]
    );
    await replaceOpenOpportunitiesByType(
      contextFrom(memory.supabase as never),
      "Treatment",
      [{ patient_id: "pat-a", priority: "High", estimated_value: 3 }]
    );

    const remaining = memory.tables.revenue_opportunities;
    assert.equal(
      remaining.some((row) => row.id === "claim-keep"),
      true
    );
    assert.equal(
      remaining.some((row) => row.id === "recall-old"),
      false
    );
    assert.equal(
      remaining.some((row) => row.id === "treatment-old"),
      false
    );
  });
});
