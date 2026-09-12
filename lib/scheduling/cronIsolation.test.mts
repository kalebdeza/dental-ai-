import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("scheduling cron isolation", () => {
  it("does not contact Open Dental from the scheduling job route", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../../app/api/cron/scheduling-jobs/route.ts", import.meta.url)
      ),
      "utf8"
    );

    assert.match(source, /authorizeCronRequest/);
    assert.match(source, /createSchedulerClient/);
    assert.match(source, /processDueSchedulingJobs/);
    assert.doesNotMatch(source, /createSchedulerOpenDentalClient/);
    assert.doesNotMatch(source, /opendental/);
  });

  it("does not add scheduling Open Dental calls to practice-jobs", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../../app/api/cron/practice-jobs/route.ts", import.meta.url)
      ),
      "utf8"
    );

    assert.doesNotMatch(source, /scheduling-jobs/);
    assert.doesNotMatch(source, /processDueSchedulingJobs/);
  });
});
