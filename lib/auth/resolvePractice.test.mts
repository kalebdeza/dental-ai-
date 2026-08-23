import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PRACTICE_ID_HEADER,
  resolveCurrentPractice,
} from "./resolvePractice.ts";

import { PRACTICE_ROLES, isPracticeRole } from "./roles.ts";

const alpha = { id: "11111111-1111-1111-1111-111111111111" };
const beta = { id: "22222222-2222-2222-2222-222222222222" };
const foreign = "33333333-3333-3333-3333-333333333333";

describe("resolveCurrentPractice", () => {
  it("reports no access when the user has no practices", () => {
    assert.deepEqual(resolveCurrentPractice([]), {
      kind: "noAccess",
    });
  });

  it("reports no access even when a practice is requested", () => {
    assert.deepEqual(resolveCurrentPractice([], foreign), {
      kind: "noAccess",
    });
  });

  it("resolves a single practice without a selection", () => {
    assert.deepEqual(resolveCurrentPractice([alpha]), {
      kind: "resolved",
      practice: alpha,
    });
  });

  it("resolves a single practice when it is selected explicitly", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha], alpha.id),
      { kind: "resolved", practice: alpha }
    );
  });

  it("requires a selection when several practices are accessible", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha, beta]),
      { kind: "ambiguous", practices: [alpha, beta] }
    );
  });

  it("resolves the selected practice out of several", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha, beta], beta.id),
      { kind: "resolved", practice: beta }
    );
  });

  it("reports not-found for a practice the user cannot reach", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha, beta], foreign),
      { kind: "notFound" }
    );
  });

  it("reports not-found rather than falling back to the only practice", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha], foreign),
      { kind: "notFound" }
    );
  });

  it("ignores a blank selection", () => {
    assert.deepEqual(resolveCurrentPractice([alpha], "   "), {
      kind: "resolved",
      practice: alpha,
    });
  });

  it("trims a padded selection", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha, beta], ` ${beta.id} `),
      { kind: "resolved", practice: beta }
    );
  });

  it("treats null and undefined selections as absent", () => {
    assert.deepEqual(resolveCurrentPractice([alpha], null), {
      kind: "resolved",
      practice: alpha,
    });

    assert.deepEqual(
      resolveCurrentPractice([alpha], undefined),
      { kind: "resolved", practice: alpha }
    );
  });

  it("never matches by position or prefix", () => {
    assert.deepEqual(
      resolveCurrentPractice([alpha, beta], "1111"),
      { kind: "notFound" }
    );
  });
});

describe("practice roles", () => {
  it("matches the practice_members_role_check constraint", () => {
    assert.deepEqual(
      [...PRACTICE_ROLES],
      ["owner", "admin", "clinician", "front_desk", "read_only"]
    );
  });

  it("accepts every valid role", () => {
    for (const role of PRACTICE_ROLES) {
      assert.equal(isPracticeRole(role), true);
    }
  });

  it("rejects invalid, absent, and near-miss roles", () => {
    for (const value of [
      "OWNER",
      "Owner",
      "dentist",
      "staff",
      "",
      null,
      undefined,
    ]) {
      assert.equal(isPracticeRole(value), false);
    }
  });
});

describe("practice header", () => {
  it("is the lowercase header name Headers.get expects", () => {
    assert.equal(PRACTICE_ID_HEADER, "x-practice-id");
    assert.equal(
      PRACTICE_ID_HEADER,
      PRACTICE_ID_HEADER.toLowerCase()
    );
  });
});
