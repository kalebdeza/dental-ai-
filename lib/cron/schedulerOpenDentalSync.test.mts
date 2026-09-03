import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSchedulerOpenDentalClientFromConfig } from "./opendental/clientFactory.ts";
import { createMemorySupabase } from "./mockSchedulerDb.ts";
import { runSchedulerOpenDentalSync } from "./schedulerOpenDentalSync.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";
const INTEGRATION_A = "integration-a";

function contextFrom(
  supabase: SchedulerPracticeContext["supabase"]
): SchedulerPracticeContext {
  return {
    supabase,
    practiceId: PRACTICE_A,
    integrationId: INTEGRATION_A,
  };
}

function clientFromPages(pages: {
  clinics?: unknown[][];
  patients?: unknown[][];
  codes?: unknown[][];
  procedures?: unknown[][];
  claims?: unknown[][];
  recalls?: unknown[][];
}): SchedulerOpenDentalClient {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("Offset") ?? "0");
    const path = url.pathname;
    const byPath: Record<string, unknown[][] | undefined> = {
      "/clinics": pages.clinics ?? [[]],
      "/patients/Simple": pages.patients ?? [[]],
      "/procedurecodes": pages.codes ?? [[]],
      "/procedurelogs": pages.procedures ?? [[]],
      "/claims": pages.claims ?? [[]],
      "/recalls": pages.recalls ?? [[]],
    };
    const series = byPath[path] ?? [[]];
    const page = series[offset / 2] ?? [];
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

describe("scheduler Open Dental sync", () => {
  it("upserts tenant-scoped rows and ignores payload tenant ids", async () => {
    const memory = createMemorySupabase();
    const result = await runSchedulerOpenDentalSync(
      contextFrom(memory.supabase as never),
      clientFromPages({
        patients: [
          [
            {
              PatNum: 1,
              FName: "Ada",
              LName: "Lovelace",
              practice_id: PRACTICE_B,
              integration_id: "other",
            },
          ],
        ],
        codes: [[{ CodeNum: 10, ProcCode: "D0120", Descript: "Exam" }]],
        procedures: [
          [{ ProcNum: 5, PatNum: 1, CodeNum: 10, ProcFee: 100, ProcStatus: "C" }],
        ],
        claims: [[{ ClaimNum: 7, PatNum: 1, ClaimFee: 100, ClaimStatus: "U" }]],
        recalls: [[{ RecallNum: 3, PatNum: 1, DateDue: "2020-01-01" }]],
      })
    );

    assert.equal(result.status, "succeeded");
    assert.equal(memory.tables.patients[0]?.practice_id, PRACTICE_A);
    assert.equal(memory.tables.patients[0]?.integration_id, INTEGRATION_A);
    assert.equal(memory.tables.procedures[0]?.practice_id, PRACTICE_A);
    assert.equal(memory.tables.claims[0]?.practice_id, PRACTICE_A);
    assert.equal(memory.tables.recalls[0]?.practice_id, PRACTICE_A);
    assert.equal(memory.tables.procedure_codes[0]?.integration_id, INTEGRATION_A);
  });

  it("fails when Open Dental returns a non-2xx status", async () => {
    const memory = createMemorySupabase();
    const fetchImpl: typeof fetch = async () =>
      new Response("nope", { status: 503 });
    const client = createSchedulerOpenDentalClientFromConfig({
      customerKey: "key",
      apiUrl: "https://od.example.test",
      developerKey: "dev",
      fetchImpl,
      sleep: async () => undefined,
    });

    const result = await runSchedulerOpenDentalSync(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "failed");
    assert.equal(memory.tables.patients.length, 0);
  });

  it("does not stamp last_sync_at", async () => {
    const memory = createMemorySupabase({
      integrations: [
        {
          id: INTEGRATION_A,
          practice_id: PRACTICE_A,
          last_sync_at: null,
        },
      ],
    });

    const result = await runSchedulerOpenDentalSync(
      contextFrom(memory.supabase as never),
      clientFromPages({
        patients: [[{ PatNum: 1, FName: "Ada", LName: "Lovelace" }]],
      })
    );

    assert.equal(result.status, "succeeded");
    assert.equal(memory.tables.integrations[0]?.last_sync_at, null);
  });

  it("keeps existing tenant rows when an Open Dental page is empty", async () => {
    const memory = createMemorySupabase({
      patients: [
        {
          id: "p1",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          source_patient_id: "1",
        },
      ],
    });

    const result = await runSchedulerOpenDentalSync(
      contextFrom(memory.supabase as never),
      clientFromPages({ patients: [[]] })
    );

    assert.equal(result.status, "succeeded");
    assert.equal(memory.tables.patients.length, 1);
  });

  it("loads more than 1,000 patients and procedure codes before linking procedures", async () => {
    const patients = Array.from({ length: 1205 }, (_, index) => ({
      id: `p-${String(index + 1).padStart(4, "0")}`,
      practice_id: PRACTICE_A,
      integration_id: INTEGRATION_A,
      source_patient_id: String(index + 1),
    }));
    const codes = Array.from({ length: 1205 }, (_, index) => ({
      id: `c-${String(index + 1).padStart(4, "0")}`,
      integration_id: INTEGRATION_A,
      source_code_id: String(index + 1),
    }));
    const memory = createMemorySupabase({
      patients,
      procedure_codes: codes,
    });

    const result = await runSchedulerOpenDentalSync(
      contextFrom(memory.supabase as never),
      clientFromPages({
        procedures: [
          [
            {
              ProcNum: 50,
              PatNum: 1205,
              CodeNum: 1205,
              ProcFee: 100,
              ProcStatus: "C",
            },
          ],
        ],
      })
    );

    assert.equal(result.status, "succeeded");
    assert.equal(result.skipped?.procedures, 0);
    assert.equal(memory.tables.procedures.length, 1);
    assert.equal(memory.tables.procedures[0]?.patient_id, "p-1205");
    assert.equal(memory.tables.procedures[0]?.procedure_code_id, "c-1205");
    assert.equal(memory.tables.procedures[0]?.practice_id, PRACTICE_A);
  });

  it("fails the sync when Open Dental hits the safety page limit and does not stamp last_sync_at", async () => {
    const memory = createMemorySupabase({
      integrations: [
        {
          id: INTEGRATION_A,
          practice_id: PRACTICE_A,
          last_sync_at: null,
        },
      ],
    });
    const fetchImpl: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;

      if (path === "/clinics" || path === "/procedurecodes") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (path === "/patients/Simple") {
        return new Response(
          JSON.stringify([
            { PatNum: 1, FName: "Ada", LName: "Lovelace" },
            { PatNum: 2, FName: "Grace", LName: "Hopper" },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createSchedulerOpenDentalClientFromConfig({
      customerKey: "key",
      apiUrl: "https://od.example.test",
      developerKey: "dev",
      fetchImpl,
      pageSize: 2,
      maxPages: 3,
      sleep: async () => undefined,
    });

    const result = await runSchedulerOpenDentalSync(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "failed");
    assert.equal(memory.tables.integrations[0]?.last_sync_at, null);
  });
});
