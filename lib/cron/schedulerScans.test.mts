import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildClaimOpportunities } from "../opendental/claimOpportunities.ts";
import { buildRecallOpportunities } from "../opendental/recallOpportunities.ts";
import { buildTreatmentOpportunities } from "../opendental/treatmentOpportunities.ts";
import { PROCEDURE_STATUS, CLAIM_STATUS } from "../opendental/status.ts";
import { createMemorySupabase } from "./mockSchedulerDb.ts";
import { runSchedulerClaimScan } from "./schedulerClaimScan.ts";
import { runSchedulerRecallScan } from "./schedulerRecallScan.ts";
import { runSchedulerTreatmentScan } from "./schedulerTreatmentScan.ts";
import type { SchedulerPracticeContext } from "./schedulerContext.ts";
import type { SchedulerOpenDentalClient } from "./opendental/clientFactory.ts";

const PRACTICE_A = "practice-a";
const PRACTICE_B = "practice-b";
const INTEGRATION_A = "integration-a";
const INTEGRATION_B = "integration-b";

function contextFrom(
  supabase: SchedulerPracticeContext["supabase"]
): SchedulerPracticeContext {
  return {
    supabase,
    practiceId: PRACTICE_A,
    integrationId: INTEGRATION_A,
  };
}

describe("claim opportunities", () => {
  it("creates a claim opportunity for a completed procedure with no claim", () => {
    const opportunities = buildClaimOpportunities(
      [
        {
          id: "proc-1",
          patient_id: "pat-1",
          fee: 200,
          status: PROCEDURE_STATUS.Completed,
        },
      ],
      []
    );

    assert.equal(opportunities.length, 1);
    assert.equal(opportunities[0]?.procedure_id, "proc-1");
    assert.equal(opportunities[0]?.claim_id, null);
  });
});

describe("recall opportunities", () => {
  it("creates a recall opportunity for an overdue incomplete recall", () => {
    const opportunities = buildRecallOpportunities(
      [
        {
          patient_id: "pat-1",
          due_date: "2020-01-01",
          completed_date: null,
          recall_type: "Hygiene",
          estimated_revenue: 250,
        },
      ],
      new Date("2026-01-01")
    );

    assert.equal(opportunities.length, 1);
    assert.equal(opportunities[0]?.patient_id, "pat-1");
  });
});

describe("treatment opportunities", () => {
  it("creates a treatment opportunity from an active plan attach", () => {
    const opportunities = buildTreatmentOpportunities({
      patients: [{ id: "pat-1", source_patient_id: "11" }],
      procedures: [
        {
          id: "proc-1",
          source_procedure_id: "99",
          patient_id: "pat-1",
          status: PROCEDURE_STATUS.TreatmentPlanned,
          fee: 400,
        },
      ],
      plans: [
        {
          TreatPlanNum: 1,
          PatNum: 11,
          TPStatus: "Active",
          Heading: "Restorative",
        },
      ],
      attaches: [{ TreatPlanNum: 1, ProcNum: 99 }],
      procTPs: [],
    });

    assert.equal(opportunities.length, 1);
    assert.equal(opportunities[0]?.procedure_id, "proc-1");
  });
});

describe("scheduler scanners", () => {
  it("claim scan only reads the locked practice/integration and only replaces Claim rows", async () => {
    const memory = createMemorySupabase({
      procedures: [
        {
          id: "proc-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          patient_id: "pat-a",
          fee: 150,
          status: PROCEDURE_STATUS.Completed,
        },
        {
          id: "proc-b",
          practice_id: PRACTICE_B,
          integration_id: INTEGRATION_B,
          patient_id: "pat-b",
          fee: 999,
          status: PROCEDURE_STATUS.Completed,
        },
      ],
      claims: [],
      revenue_opportunities: [
        {
          id: "claim-old",
          practice_id: PRACTICE_A,
          opportunity_type: "Claim",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
        {
          id: "claim-done",
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
      ],
    });

    const result = await runSchedulerClaimScan(
      contextFrom(memory.supabase as never)
    );

    assert.equal(result.status, "succeeded");
    const remaining = memory.tables.revenue_opportunities;
    assert.equal(
      remaining.some((row) => row.id === "claim-old"),
      false
    );
    assert.equal(
      remaining.some((row) => row.id === "claim-done"),
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
      remaining.some(
        (row) =>
          row.opportunity_type === "Claim" &&
          row.completed === false &&
          row.procedure_id === "proc-a"
      ),
      true
    );
    assert.equal(
      remaining.some((row) => row.procedure_id === "proc-b"),
      false
    );
  });

  it("recall scan only reads the locked practice/integration and preserves other types", async () => {
    const memory = createMemorySupabase({
      recalls: [
        {
          id: "rec-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          patient_id: "pat-a",
          due_date: "2020-01-01",
          completed_date: null,
          recall_type: "Hygiene",
          estimated_revenue: 250,
        },
        {
          id: "rec-b",
          practice_id: PRACTICE_B,
          integration_id: INTEGRATION_B,
          patient_id: "pat-b",
          due_date: "2020-01-01",
          completed_date: null,
          recall_type: "Hygiene",
          estimated_revenue: 250,
        },
      ],
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
          id: "treatment-keep",
          practice_id: PRACTICE_A,
          opportunity_type: "Treatment",
          completed: false,
          priority: "Low",
          estimated_value: 1,
        },
      ],
    });

    const result = await runSchedulerRecallScan(
      contextFrom(memory.supabase as never)
    );
    assert.equal(result.status, "succeeded");
    const remaining = memory.tables.revenue_opportunities;
    assert.equal(
      remaining.some((row) => row.id === "claim-keep"),
      true
    );
    assert.equal(
      remaining.some((row) => row.id === "treatment-keep"),
      true
    );
    assert.equal(
      remaining.some(
        (row) =>
          row.opportunity_type === "Recall" && row.patient_id === "pat-a"
      ),
      true
    );
    assert.equal(
      remaining.some((row) => row.patient_id === "pat-b"),
      false
    );
  });

  it("treatment scan only uses locked-practice procedures and only replaces Treatment rows", async () => {
    const memory = createMemorySupabase({
      patients: [
        {
          id: "pat-a",
          practice_id: PRACTICE_A,
          integration_id: INTEGRATION_A,
          source_patient_id: "11",
        },
        {
          id: "pat-b",
          practice_id: PRACTICE_B,
          integration_id: INTEGRATION_B,
          source_patient_id: "22",
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
        {
          id: "proc-b",
          practice_id: PRACTICE_B,
          integration_id: INTEGRATION_B,
          source_procedure_id: "88",
          patient_id: "pat-b",
          status: PROCEDURE_STATUS.TreatmentPlanned,
          fee: 900,
        },
      ],
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
          id: "recall-keep",
          practice_id: PRACTICE_A,
          opportunity_type: "Recall",
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
          { TreatPlanNum: 2, PatNum: 22, TPStatus: "Active", Heading: "B" },
        ];
      },
      async listTreatPlanAttaches(treatPlanNum: number) {
        if (treatPlanNum === 1) {
          return [{ TreatPlanNum: 1, ProcNum: 99 }];
        }

        if (treatPlanNum === 2) {
          return [{ TreatPlanNum: 2, ProcNum: 88 }];
        }

        return [];
      },
      async listProcTPs() {
        return [];
      },
    } as unknown as SchedulerOpenDentalClient;

    const result = await runSchedulerTreatmentScan(
      contextFrom(memory.supabase as never),
      client
    );

    assert.equal(result.status, "succeeded");
    const remaining = memory.tables.revenue_opportunities;
    assert.equal(
      remaining.some((row) => row.id === "claim-keep"),
      true
    );
    assert.equal(
      remaining.some((row) => row.id === "recall-keep"),
      true
    );
    assert.equal(
      remaining.some(
        (row) =>
          row.opportunity_type === "Treatment" &&
          row.procedure_id === "proc-a"
      ),
      true
    );
    assert.equal(
      remaining.some((row) => row.procedure_id === "proc-b"),
      false
    );
  });

  it("pages past 1,000 procedures and claims without truncating opportunities", async () => {
    const procedures = Array.from({ length: 1205 }, (_, index) => ({
      id: `proc-${String(index + 1).padStart(4, "0")}`,
      practice_id: PRACTICE_A,
      integration_id: INTEGRATION_A,
      patient_id: `pat-${String(index + 1).padStart(4, "0")}`,
      fee: 150,
      status: PROCEDURE_STATUS.Completed,
    }));
    const claims = Array.from({ length: 1205 }, (_, index) => ({
      id: `claim-${String(index + 1).padStart(4, "0")}`,
      practice_id: PRACTICE_A,
      integration_id: INTEGRATION_A,
      patient_id: `pat-${String(index + 1).padStart(4, "0")}`,
      status: CLAIM_STATUS.Unsent,
      amount_billed: 150,
      remaining_balance: 10,
    }));
    const memory = createMemorySupabase({ procedures, claims });
    const result = await runSchedulerClaimScan(
      contextFrom(memory.supabase as never)
    );

    assert.equal(result.status, "succeeded");
    const created = memory.tables.revenue_opportunities.filter(
      (row) => row.opportunity_type === "Claim"
    );
    assert.equal(created.length, 1205);
    assert.equal(
      created.some(
        (row) =>
          row.procedure_id === "proc-1205" && row.claim_id === "claim-1205"
      ),
      true
    );
  });

  it("pages past 1,000 recalls without truncating opportunities", async () => {
    const recalls = Array.from({ length: 1205 }, (_, index) => ({
      id: `rec-${index + 1}`,
      practice_id: PRACTICE_A,
      integration_id: INTEGRATION_A,
      patient_id: `pat-${index + 1}`,
      due_date: "2020-01-01",
      completed_date: null,
      recall_type: "Hygiene",
      estimated_revenue: 250,
    }));
    const memory = createMemorySupabase({ recalls });
    const result = await runSchedulerRecallScan(
      contextFrom(memory.supabase as never)
    );

    assert.equal(result.status, "succeeded");
    assert.equal(
      memory.tables.revenue_opportunities.filter(
        (row) => row.opportunity_type === "Recall"
      ).length,
      1205
    );
  });
});
