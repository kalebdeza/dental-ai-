import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapPatientRow, mapProcedureCodeRow } from "./mapRecords.ts";
import type { SchedulerPracticeContext } from "../schedulerContext.ts";

const context = {
  practiceId: "practice-a",
  integrationId: "integration-a",
  supabase: {} as SchedulerPracticeContext["supabase"],
};

describe("Open Dental record mapping", () => {
  it("always takes practice_id and integration_id from context", () => {
    const row = mapPatientRow(
      context,
      {
        PatNum: 9,
        FName: "Ada",
        LName: "Lovelace",
        practice_id: "attacker-practice",
        integration_id: "attacker-integration",
      } as never,
      "2026-09-03T00:00:00.000Z"
    );

    assert.equal(row.practice_id, "practice-a");
    assert.equal(row.integration_id, "integration-a");
    assert.equal(row.source_patient_id, "9");
  });

  it("does not copy tenant ids onto procedure codes from the payload", () => {
    const row = mapProcedureCodeRow(
      context,
      {
        CodeNum: 4,
        ProcCode: "D0120",
        integration_id: "attacker-integration",
      } as never,
      "2026-09-03T00:00:00.000Z"
    );

    assert.equal(row.integration_id, "integration-a");
    assert.equal(
      Object.prototype.hasOwnProperty.call(row, "practice_id"),
      false
    );
  });
});
