import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeErrorMeta, sanitizeLogMeta } from "./safeLog.ts";

describe("safe error logging", () => {
  it("keeps error name and code and drops messages and payloads", () => {
    const error = Object.assign(new Error("Ada Lovelace DOB 1970-01-01"), {
      code: "42501",
      details: { claim: { amount: 400 } },
    });

    assert.deepEqual(safeErrorMeta(error), {
      name: "Error",
      code: "42501",
    });
    assert.equal("message" in safeErrorMeta(error), false);
  });

  it("does not log nested objects, arrays, or vendor response bodies", () => {
    const sanitized = sanitizeLogMeta({
      practiceId: "practice-a",
      count: 3,
      error: new Error("Open Dental API 500: secret-patient-name"),
      patients: [{ first_name: "Ada" }],
      payload: { insurance_company: "Delta" },
    });

    assert.deepEqual(sanitized, {
      practiceId: "practice-a",
      count: 3,
      error: { name: "Error" },
    });
    assert.deepEqual(
      sanitizeLogMeta({
        practiceId: "practice-a",
        jobs: ["sync", "recall"],
      }),
      {
        practiceId: "practice-a",
        jobs: ["sync", "recall"],
      }
    );
    assert.deepEqual(
      sanitizeLogMeta({
        message: "Ada Lovelace claim $400",
        customer_key: "secret",
      }),
      { name: "Error" }
    );
    assert.deepEqual(
      sanitizeLogMeta({
        practiceId: "practice-a",
        customer_key: "secret",
      }),
      { practiceId: "practice-a" }
    );
  });
});
