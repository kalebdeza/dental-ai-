import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PROCEDURE_STATUS } from "../opendental/status.ts";
import { createSchedulerOpenDentalClientFromConfig } from "./opendental/clientFactory.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";
import { createMemorySupabase } from "./mockSchedulerDb.ts";
import {
  loadTreatmentPlanDetails,
  runSchedulerTreatmentScan,
  TREATMENT_PLAN_FETCH_CONCURRENCY,
} from "./schedulerTreatmentScan.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";

const PRACTICE_A = "practice-a";
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("loadTreatmentPlanDetails", () => {
  it("fetches nothing when there are no treatment plans", async () => {
    let attachCalls = 0;
    let procCalls = 0;
    const client = {
      async listTreatPlanAttaches() {
        attachCalls += 1;
        return [];
      },
      async listProcTPs() {
        procCalls += 1;
        return [];
      },
    } as unknown as SchedulerOpenDentalClient;

    const result = await loadTreatmentPlanDetails(client, []);

    assert.deepEqual(result, { attaches: [], procTPs: [] });
    assert.equal(attachCalls, 0);
    assert.equal(procCalls, 0);
  });

  it("fetches attaches for one active treatment plan", async () => {
    const seen: number[] = [];
    const client = {
      async listTreatPlanAttaches(treatPlanNum: number) {
        seen.push(treatPlanNum);
        return [{ TreatPlanNum: treatPlanNum, ProcNum: 99 }];
      },
      async listProcTPs() {
        throw new Error("should not list procTPs for an active plan");
      },
    } as unknown as SchedulerOpenDentalClient;

    const result = await loadTreatmentPlanDetails(client, [
      { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A" },
    ]);

    assert.deepEqual(seen, [1]);
    assert.equal(result.attaches.length, 1);
    assert.equal(result.procTPs.length, 0);
  });

  it("fetches procTPs for a saved treatment plan", async () => {
    const seen: number[] = [];
    const client = {
      async listTreatPlanAttaches() {
        throw new Error("should not list attaches for a saved plan");
      },
      async listProcTPs(treatPlanNum: number) {
        seen.push(treatPlanNum);
        return [{ TreatPlanNum: treatPlanNum, FeeAmt: 200, Descript: "Crown" }];
      },
    } as unknown as SchedulerOpenDentalClient;

    const result = await loadTreatmentPlanDetails(client, [
      { TreatPlanNum: 9, PatNum: 11, TPStatus: "Saved", Heading: "Saved" },
    ]);

    assert.deepEqual(seen, [9]);
    assert.equal(result.procTPs.length, 1);
    assert.equal(result.attaches.length, 0);
  });

  it("deduplicates duplicate treatment-plan records", async () => {
    let attachCalls = 0;
    const client = {
      async listTreatPlanAttaches(treatPlanNum: number) {
        attachCalls += 1;
        return [{ TreatPlanNum: treatPlanNum, ProcNum: 99 }];
      },
      async listProcTPs() {
        return [];
      },
    } as unknown as SchedulerOpenDentalClient;

    await loadTreatmentPlanDetails(client, [
      { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A" },
      { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A copy" },
    ]);

    assert.equal(attachCalls, 1);
  });

  it("bounds concurrent Open Dental requests", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const client = {
      async listTreatPlanAttaches(treatPlanNum: number) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        inFlight -= 1;
        return [{ TreatPlanNum: treatPlanNum, ProcNum: treatPlanNum }];
      },
      async listProcTPs() {
        return [];
      },
    } as unknown as SchedulerOpenDentalClient;

    const plans = [1, 2, 3, 4, 5].map((TreatPlanNum) => ({
      TreatPlanNum,
      PatNum: TreatPlanNum,
      TPStatus: "Active",
      Heading: "A",
    }));

    await loadTreatmentPlanDetails(client, plans, 2);

    assert.ok(maxInFlight <= 2);
    assert.ok(maxInFlight >= 2);
    assert.equal(TREATMENT_PLAN_FETCH_CONCURRENCY, 3);
  });

  it("fails when an attach request fails", async () => {
    const client = {
      async listTreatPlanAttaches() {
        throw new Error("Open Dental request failed (400).");
      },
      async listProcTPs() {
        return [];
      },
    } as unknown as SchedulerOpenDentalClient;

    await assert.rejects(() =>
      loadTreatmentPlanDetails(client, [
        { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A" },
      ])
    );
  });
});

describe("runSchedulerTreatmentScan", () => {
  it("pages past 1,000 patients and procedures", async () => {
    const patients = Array.from({ length: 1205 }, (_, index) => ({
      id: `pat-${String(index + 1).padStart(4, "0")}`,
      practice_id: PRACTICE_A,
      integration_id: INTEGRATION_A,
      source_patient_id: String(index + 1),
    }));
    const procedures = Array.from({ length: 1205 }, (_, index) => ({
      id: `proc-${String(index + 1).padStart(4, "0")}`,
      practice_id: PRACTICE_A,
      integration_id: INTEGRATION_A,
      source_procedure_id: String(index + 1),
      patient_id: `pat-${String(index + 1).padStart(4, "0")}`,
      status: PROCEDURE_STATUS.TreatmentPlanned,
      fee: 400,
    }));
    const memory = createMemorySupabase({ patients, procedures });
    const client = {
      async listTreatPlans() {
        return [
          {
            TreatPlanNum: 1,
            PatNum: 1205,
            TPStatus: "Active",
            Heading: "Last",
          },
        ];
      },
      async listTreatPlanAttaches(treatPlanNum: number) {
        assert.equal(treatPlanNum, 1);
        return [{ TreatPlanNum: 1, ProcNum: 1205 }];
      },
      async listProcTPs() {
        throw new Error("should not list procTPs");
      },
    } as unknown as SchedulerOpenDentalClient;

    const result = await runSchedulerTreatmentScan(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "succeeded");
    assert.equal(
      memory.tables.revenue_opportunities.some(
        (row) =>
          row.opportunity_type === "Treatment" &&
          row.procedure_id === "proc-1205"
      ),
      true
    );
  });

  it("fails the treatment step when required plan data cannot be retrieved", async () => {
    const memory = createMemorySupabase({
      patients: [
        {
          id: "pat-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          source_patient_id: "11",
        },
      ],
      procedures: [],
      revenue_opportunities: [
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
    const client = {
      async listTreatPlans() {
        return [
          { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A" },
        ];
      },
      async listTreatPlanAttaches() {
        throw new Error("Open Dental request failed (400).");
      },
      async listProcTPs() {
        return [];
      },
    } as unknown as SchedulerOpenDentalClient;

    const result = await runSchedulerTreatmentScan(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "failed");
    assert.equal(
      memory.tables.revenue_opportunities.some(
        (row) => row.id === "treatment-old"
      ),
      true
    );
  });

  it("paginates treat plans and requires TreatPlanNum on child endpoints", async () => {
    const seenAttaches: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/treatplans") {
        const offset = Number(url.searchParams.get("Offset") ?? "0");
        const pages = [
          [
            { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A" },
            { TreatPlanNum: 2, PatNum: 11, TPStatus: "Saved", Heading: "B" },
          ],
          [{ TreatPlanNum: 3, PatNum: 11, TPStatus: "Inactive", Heading: "C" }],
        ];
        return jsonResponse(pages[offset / 2] ?? []);
      }

      if (url.pathname === "/treatplanattaches") {
        const treatPlanNum = url.searchParams.get("TreatPlanNum");
        seenAttaches.push(String(treatPlanNum));

        if (!treatPlanNum) {
          return jsonResponse("TreatPlanNum required", 400);
        }

        return jsonResponse([
          {
            TreatPlanAttachNum: Number(treatPlanNum),
            TreatPlanNum: Number(treatPlanNum),
            ProcNum: 99,
          },
        ]);
      }

      if (url.pathname === "/proctps") {
        const treatPlanNum = url.searchParams.get("TreatPlanNum");

        if (!treatPlanNum) {
          return jsonResponse("TreatPlanNum required", 400);
        }

        return jsonResponse([
          {
            ProcTPNum: 1,
            TreatPlanNum: Number(treatPlanNum),
            PatNum: 11,
            FeeAmt: 250,
            Descript: "Saved crown",
          },
        ]);
      }

      return jsonResponse([]);
    };

    const client = createSchedulerOpenDentalClientFromConfig({
      customerKey: "key",
      apiUrl: "https://od.example.test",
      developerKey: "dev",
      fetchImpl,
      pageSize: 2,
      sleep: async () => undefined,
    });

    const memory = createMemorySupabase({
      patients: [
        {
          id: "pat-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          source_patient_id: "11",
        },
      ],
      procedures: [
        {
          id: "proc-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          source_procedure_id: "99",
          patient_id: "pat-a",
          status: PROCEDURE_STATUS.TreatmentPlanned,
          fee: 400,
        },
      ],
    });

    const result = await runSchedulerTreatmentScan(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "succeeded");
    assert.deepEqual(seenAttaches.sort(), ["1", "3"]);
    assert.equal(
      memory.tables.revenue_opportunities.filter(
        (row) => row.opportunity_type === "Treatment"
      ).length,
      3
    );
  });

  it("fails on a malformed child-endpoint payload", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/treatplans") {
        return jsonResponse([
          { TreatPlanNum: 1, PatNum: 11, TPStatus: "Active", Heading: "A" },
        ]);
      }

      if (url.pathname === "/treatplanattaches") {
        return jsonResponse({ error: "nope" });
      }

      return jsonResponse([]);
    };

    const client = createSchedulerOpenDentalClientFromConfig({
      customerKey: "key",
      apiUrl: "https://od.example.test",
      developerKey: "dev",
      fetchImpl,
      pageSize: 100,
      sleep: async () => undefined,
    });

    const memory = createMemorySupabase({
      patients: [
        {
          id: "pat-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          source_patient_id: "11",
        },
      ],
    });

    const result = await runSchedulerTreatmentScan(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "failed");
  });
});
