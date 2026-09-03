import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatClaimDate,
  formatPatientName,
  formatProcedureName,
} from "./claimDisplay.ts";

describe("claim display fields", () => {
  it("shows a procedure name when the related procedure exists", () => {
    assert.equal(
      formatProcedureName({ procedure_name: "Crown" }),
      "Crown"
    );
  });

  it("does not invent a procedure name when the relationship is missing", () => {
    assert.equal(formatProcedureName(null), "Not available");
    assert.equal(formatProcedureName(undefined), "Not available");
    assert.equal(formatProcedureName({ procedure_name: "  " }), "Not available");
  });

  it("does not crash when the patient relationship is missing", () => {
    assert.equal(formatPatientName(null), "Not available");
    assert.equal(
      formatPatientName({ first_name: "Ada", last_name: "Lovelace" }),
      "Ada Lovelace"
    );
  });

  it("formats claim dates and treats invalid values as unavailable", () => {
    assert.equal(formatClaimDate(null), "Not available");
    assert.equal(formatClaimDate("not-a-date"), "Not available");
    assert.equal(
      formatClaimDate("2026-09-03T00:00:00.000Z"),
      new Date("2026-09-03T00:00:00.000Z").toLocaleDateString()
    );
  });
});
