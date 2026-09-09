import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { OpenDentalRequestError } from "./requestError.ts";

describe("Open Dental request errors", () => {
  it("does not include response bodies, URLs, or keys", () => {
    const error = new OpenDentalRequestError(500);
    assert.equal(error.message, "Open Dental request failed.");
    assert.equal(error.status, 500);
    assert.doesNotMatch(error.message, /secret|http|ODFHIR|Authorization/i);
  });
});

describe("interactive Open Dental client error handling", () => {
  it("does not attach Open Dental response text to thrown errors", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../services/opendental.ts", import.meta.url)),
      "utf8"
    );
    const testRoute = readFileSync(
      fileURLToPath(
        new URL("../../app/api/opendental/test/route.ts", import.meta.url)
      ),
      "utf8"
    );

    assert.match(source, /OpenDentalRequestError/);
    assert.doesNotMatch(source, /errorText/);
    assert.doesNotMatch(source, /response\.text\(\)/);
    assert.match(
      testRoute,
      /Open Dental connection test failed/
    );
    assert.doesNotMatch(testRoute, /result\.message/);
    assert.doesNotMatch(testRoute, /clinic: result\.clinic/);
  });
});
