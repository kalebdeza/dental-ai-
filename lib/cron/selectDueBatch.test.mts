import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMemorySupabase } from "./mockSchedulerDb.ts";
import { listConnectedOpenDentalIntegrations } from "./listConnectedIntegrations.ts";
import {
  PRACTICE_JOBS_PER_INVOCATION,
  planPracticeJobTick,
  selectDueBatch,
} from "./selectDueBatch.ts";

function integration(
  id: string,
  overrides?: {
    last_sync_at?: string | null;
    practice_id?: string;
  }
) {
  return {
    id,
    practice_id: overrides?.practice_id ?? `practice-${id}`,
    sync_frequency_minutes: 15,
    last_sync_at: overrides?.last_sync_at ?? null,
    last_claim_scan_at: overrides?.last_sync_at ?? null,
    last_recall_scan_at: overrides?.last_sync_at ?? null,
    last_treatment_scan_at: overrides?.last_sync_at ?? null,
  };
}

describe("selectDueBatch", () => {
  it("returns an empty batch when nothing is due", () => {
    const { batch, nextCursor } = selectDueBatch(
      [integration("a"), integration("b")],
      () => false,
      null,
      1
    );

    assert.deepEqual(batch, []);
    assert.equal(nextCursor, "b");
  });

  it("bounds work per invocation and rotates so later practices are not starved", () => {
    const ordered = [
      integration("a"),
      integration("b"),
      integration("c"),
    ];
    const isDue = () => true;

    const first = selectDueBatch(ordered, isDue, null, 1);
    assert.deepEqual(
      first.batch.map((item) => item.id),
      ["a"]
    );

    const second = selectDueBatch(ordered, isDue, first.nextCursor, 1);
    assert.deepEqual(
      second.batch.map((item) => item.id),
      ["b"]
    );

    const third = selectDueBatch(ordered, isDue, second.nextCursor, 1);
    assert.deepEqual(
      third.batch.map((item) => item.id),
      ["c"]
    );

    const wrap = selectDueBatch(ordered, isDue, third.nextCursor, 1);
    assert.deepEqual(
      wrap.batch.map((item) => item.id),
      ["a"]
    );
  });

  it("skips not-due practices and still reaches later due practices", () => {
    const ordered = [
      integration("a"),
      integration("b"),
      integration("c"),
    ];
    const { batch, nextCursor } = selectDueBatch(
      ordered,
      (item) => item.id === "c",
      "a",
      1
    );

    assert.equal(batch[0]?.id, "c");
    assert.equal(nextCursor, "c");
  });
});

describe("planPracticeJobTick", () => {
  const now = new Date("2026-09-03T00:30:00.000Z");
  const recent = "2026-09-03T00:20:00.000Z";

  it("schedules one due practice per tick by default", () => {
    assert.equal(PRACTICE_JOBS_PER_INVOCATION, 1);

    const first = planPracticeJobTick(
      [
        integration("int-b"),
        integration("int-a"),
        integration("int-c"),
      ],
      null,
      now
    );

    assert.equal(first.batch.length, 1);
    assert.equal(first.batch[0]?.id, "int-a");
    assert.equal(first.batch[0]?.practice_id, "practice-int-a");

    const second = planPracticeJobTick(
      [
        integration("int-b"),
        integration("int-a"),
        integration("int-c"),
      ],
      first.nextCursor,
      now
    );

    assert.equal(second.batch[0]?.id, "int-b");
  });

  it("does not treat recently stamped practices as due", () => {
    const { batch } = planPracticeJobTick(
      [
        integration("int-a", { last_sync_at: recent }),
        integration("int-b"),
      ],
      null,
      now
    );

    assert.equal(batch[0]?.id, "int-b");
  });
});

describe("listConnectedOpenDentalIntegrations", () => {
  it("pages past 1,000 integrations and ignores disconnected rows", async () => {
    const connected = Array.from({ length: 1205 }, (_, index) => ({
      id: `int-${String(index + 1).padStart(4, "0")}`,
      practice_id: `practice-${index + 1}`,
      provider: "opendental",
      status: "connected",
      customer_key: "encrypted-key",
      sync_frequency_minutes: 15,
      last_sync_at: null,
      last_claim_scan_at: null,
      last_recall_scan_at: null,
      last_treatment_scan_at: null,
    }));

    const memory = createMemorySupabase({
      integrations: [
        ...connected,
        {
          id: "disconnected",
          practice_id: "practice-x",
          provider: "opendental",
          status: "disconnected",
          customer_key: "encrypted-key",
          sync_frequency_minutes: 15,
          last_sync_at: null,
          last_claim_scan_at: null,
          last_recall_scan_at: null,
          last_treatment_scan_at: null,
        },
        {
          id: "no-key",
          practice_id: "practice-y",
          provider: "opendental",
          status: "connected",
          customer_key: null,
          sync_frequency_minutes: 15,
          last_sync_at: null,
          last_claim_scan_at: null,
          last_recall_scan_at: null,
          last_treatment_scan_at: null,
        },
      ],
    });

    const rows = await listConnectedOpenDentalIntegrations(
      memory.supabase as never
    );

    assert.equal(rows.length, 1205);
    assert.equal(rows[0]?.id, "int-0001");
    assert.equal(rows[1204]?.id, "int-1205");
  });
});
