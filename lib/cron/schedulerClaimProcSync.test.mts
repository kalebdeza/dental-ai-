import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSchedulerOpenDentalClientFromConfig } from "./opendental/clientFactory.ts";
import { createMemorySupabase } from "./mockSchedulerDb.ts";
import {
  canMarkStoredClaimProcAbsent,
  runSchedulerClaimProcSync,
} from "./schedulerClaimProcSync.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";
import {
  OFFICIAL_RECEIVED_CLAIMPROC,
  OFFICIAL_SUPPLEMENTAL_CLAIMPROC,
} from "../opendental/claimProc.fixtures.ts";
import { ATTRIBUTION_STATUS_ACTIVE } from "../data/paymentAttribution.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";
const INTEGRATION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

function contextFrom(
  supabase: SchedulerPracticeContext["supabase"]
): SchedulerPracticeContext {
  return {
    supabase,
    practiceId: PRACTICE_A,
    integrationId: INTEGRATION_A,
  };
}

function clientFromStatusPages(input: {
  received?: unknown[][];
  supplemental?: unknown[][];
  failStatus?: "Received" | "Supplemental";
  failAll?: boolean;
}): SchedulerOpenDentalClient {
  const fetchImpl: typeof fetch = async (inputUrl) => {
    const url = new URL(String(inputUrl));
    const offset = Number(url.searchParams.get("Offset") ?? "0");
    const path = url.pathname;
    const status = url.searchParams.get("Status");

    if (path !== "/claimprocs") {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (input.failAll || (input.failStatus && status === input.failStatus)) {
      return new Response("nope", { status: 503 });
    }

    const pages =
      status === "Supplemental"
        ? (input.supplemental ?? [[]])
        : status === "Received"
          ? (input.received ?? [[]])
          : [[]];
    const pageSize = 2;
    const page = pages[offset / pageSize] ?? [];

    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  return createSchedulerOpenDentalClientFromConfig({
    customerKey: "key",
    apiUrl: "https://od.example.test",
    developerKey: "dev",
    fetchImpl,
    pageSize: 2,
    sleep: async () => undefined,
  });
}

function storedReceivedClaimProc(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp-1",
    practice_id: PRACTICE_A,
    integration_id: INTEGRATION_A,
    source_claimproc_id: 1984257,
    source_claim_id: 98567,
    source_procedure_id: 1734730,
    source_patient_id: 1337,
    ins_pay_amt: 78,
    ins_pay_est: 88,
    status: "Received",
    write_off: 0,
    claim_payment_num: 6352,
    date_cp: "2021-02-16",
    absent_from_sync_at: null,
    ...overrides,
  };
}

function storedAttribution(overrides: Record<string, unknown> = {}) {
  return {
    id: "attr-1",
    practice_id: PRACTICE_A,
    opportunity_id: "opp-1",
    claimproc_id: "cp-1",
    source_claimproc_id: 1984257,
    credited_amount: 78,
    payment_dated_at: "2021-02-16",
    identified_at_snapshot: "2021-02-01T00:00:00.000Z",
    cap_snapshot: 100,
    status: ATTRIBUTION_STATUS_ACTIVE,
    ...overrides,
  };
}

describe("canMarkStoredClaimProcAbsent", () => {
  it("does not mark a row absent when its status stream mapped nothing", () => {
    assert.equal(
      canMarkStoredClaimProcAbsent({
        practiceId: PRACTICE_A,
        row: {
          practice_id: PRACTICE_A,
          source_claimproc_id: 1,
          status: "Received",
        },
        seen: new Set(),
        mappedByStatus: { Received: 0, Supplemental: 4 },
      }),
      false
    );
  });

  it("marks a missing Received row only when Received mapped other rows", () => {
    assert.equal(
      canMarkStoredClaimProcAbsent({
        practiceId: PRACTICE_A,
        row: {
          practice_id: PRACTICE_A,
          source_claimproc_id: 1,
          status: "Received",
        },
        seen: new Set([2]),
        mappedByStatus: { Received: 1, Supplemental: 0 },
      }),
      true
    );
  });
});

describe("scheduler ClaimProc sync", () => {
  it("upserts tenant-scoped ClaimProc rows from mocked /claimprocs and ignores payload tenant ids", async () => {
    const memory = createMemorySupabase();
    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({
        received: [
          [
            {
              ...OFFICIAL_RECEIVED_CLAIMPROC,
              practice_id: PRACTICE_B,
              integration_id: "other",
            },
          ],
        ],
      }),
      { runAttribution: false }
    );

    assert.equal(result.status, "succeeded");
    assert.equal(memory.tables.opendental_claimprocs.length, 1);
    const row = memory.tables.opendental_claimprocs[0];
    assert.equal(row?.practice_id, PRACTICE_A);
    assert.equal(row?.integration_id, INTEGRATION_A);
    assert.equal(row?.source_claimproc_id, 1984257);
    assert.equal(row?.date_cp, "2021-02-16");
    assert.equal(Object.hasOwn(row ?? {}, "paid_at"), false);
    assert.equal(row?.ins_pay_amt, 78);
  });

  it("does not create attribution without a matching Claim opportunity", async () => {
    const memory = createMemorySupabase();
    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({
        received: [[OFFICIAL_RECEIVED_CLAIMPROC]],
      })
    );

    assert.equal(result.status, "succeeded");
    assert.equal(memory.tables.opendental_claimprocs.length, 1);
    assert.equal(memory.tables.opportunity_payment_attributions.length, 0);
  });

  it("does not mark stored ClaimProcs absent or reverse revenue when both filtered streams are empty", async () => {
    const memory = createMemorySupabase({
      opendental_claimprocs: [storedReceivedClaimProc()],
      opportunity_payment_attributions: [storedAttribution()],
    });

    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({ received: [[]], supplemental: [[]] })
    );

    assert.equal(result.status, "succeeded");
    assert.equal(result.attributed, 0);
    assert.equal(
      memory.tables.opendental_claimprocs[0]?.absent_from_sync_at,
      null
    );
    assert.equal(
      memory.tables.opportunity_payment_attributions[0]?.status,
      ATTRIBUTION_STATUS_ACTIVE
    );
    assert.equal(
      memory.tables.opportunity_payment_attributions[0]?.credited_amount,
      78
    );
  });

  it("does not mark Supplemental rows absent when only the Received stream returned rows", async () => {
    const memory = createMemorySupabase({
      opendental_claimprocs: [
        storedReceivedClaimProc(),
        storedReceivedClaimProc({
          id: "cp-supp",
          source_claimproc_id: 214,
          status: "Supplemental",
        }),
      ],
    });

    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({
        received: [[OFFICIAL_RECEIVED_CLAIMPROC]],
        supplemental: [[]],
      }),
      { runAttribution: false }
    );

    assert.equal(result.status, "succeeded");
    const supplemental = memory.tables.opendental_claimprocs.find(
      (row) => row.id === "cp-supp"
    );
    assert.equal(supplemental?.absent_from_sync_at, null);
  });

  it("marks a previously Received ClaimProc absent when Received still returns other rows", async () => {
    const memory = createMemorySupabase({
      opendental_claimprocs: [
        storedReceivedClaimProc({
          id: "cp-old",
          source_claimproc_id: 111,
        }),
      ],
    });

    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({
        received: [[OFFICIAL_RECEIVED_CLAIMPROC]],
      }),
      { runAttribution: false }
    );

    assert.equal(result.status, "succeeded");
    const missing = memory.tables.opendental_claimprocs.find(
      (row) => row.id === "cp-old"
    );
    assert.equal(typeof missing?.absent_from_sync_at, "string");
  });

  it("does not mark absent, create revenue, or reverse revenue when Supplemental pagination fails", async () => {
    const memory = createMemorySupabase({
      opendental_claimprocs: [storedReceivedClaimProc()],
      opportunity_payment_attributions: [storedAttribution()],
    });

    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({
        received: [[OFFICIAL_RECEIVED_CLAIMPROC]],
        failStatus: "Supplemental",
      })
    );

    assert.equal(result.status, "failed");
    assert.equal(
      memory.tables.opendental_claimprocs.find((row) => row.id === "cp-1")
        ?.absent_from_sync_at,
      null
    );
    assert.equal(
      memory.tables.opportunity_payment_attributions[0]?.status,
      ATTRIBUTION_STATUS_ACTIVE
    );
    assert.equal(memory.tables.opportunity_payment_attribution_events.length, 0);
  });

  it("does not mark absent or reverse revenue when /claimprocs fails", async () => {
    const memory = createMemorySupabase({
      opendental_claimprocs: [storedReceivedClaimProc()],
      opportunity_payment_attributions: [storedAttribution()],
    });

    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({ failAll: true })
    );

    assert.equal(result.status, "failed");
    assert.equal(
      memory.tables.opendental_claimprocs[0]?.absent_from_sync_at,
      null
    );
    assert.equal(
      memory.tables.opportunity_payment_attributions[0]?.status,
      ATTRIBUTION_STATUS_ACTIVE
    );
  });

  it("clears absence when a ClaimProc reappears as Supplemental", async () => {
    const memory = createMemorySupabase({
      opendental_claimprocs: [
        storedReceivedClaimProc({
          source_claimproc_id: 214,
          absent_from_sync_at: "2026-09-01T00:00:00.000Z",
        }),
      ],
    });

    const result = await runSchedulerClaimProcSync(
      contextFrom(memory.supabase as never),
      clientFromStatusPages({
        supplemental: [[OFFICIAL_SUPPLEMENTAL_CLAIMPROC]],
      }),
      { runAttribution: false }
    );

    assert.equal(result.status, "succeeded");
    assert.equal(
      memory.tables.opendental_claimprocs[0]?.absent_from_sync_at,
      null
    );
    assert.equal(memory.tables.opendental_claimprocs[0]?.status, "Supplemental");
  });
});
