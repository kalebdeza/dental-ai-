import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDueJobs,
  hasDueJob,
  isTimestampDue,
  resolveSyncFrequencyMinutes,
} from "./due.ts";

describe("practice job due calculation", () => {
  const now = new Date("2026-08-31T00:30:00.000Z");

  it("treats a null timestamp as due", () => {
    assert.equal(isTimestampDue(null, 15, now), true);
  });

  it("treats a timestamp older than the frequency as due", () => {
    assert.equal(
      isTimestampDue("2026-08-31T00:00:00.000Z", 15, now),
      true
    );
  });

  it("does not treat a future timestamp as due", () => {
    assert.equal(
      isTimestampDue("2026-08-31T01:00:00.000Z", 15, now),
      false
    );
  });

  it("treats a recent timestamp as not due", () => {
    assert.equal(
      isTimestampDue("2026-08-31T00:20:00.000Z", 15, now),
      false
    );
  });

  it("uses 15 minutes when frequency is missing or invalid", () => {
    assert.equal(resolveSyncFrequencyMinutes(0), 15);
    assert.equal(resolveSyncFrequencyMinutes(-5), 15);
    assert.equal(resolveSyncFrequencyMinutes(60), 60);
  });

  it("reports each job type independently", () => {
    const due = getDueJobs({
      syncFrequencyMinutes: 15,
      lastSyncAt: "2026-08-31T00:20:00.000Z",
      lastClaimScanAt: null,
      lastRecallScanAt: "2026-08-31T00:00:00.000Z",
      lastTreatmentScanAt: "2026-08-31T00:25:00.000Z",
      now,
    });

    assert.deepEqual(due, {
      sync: false,
      claim: true,
      recall: true,
      treatment: false,
    });
    assert.equal(hasDueJob(due), true);
  });
});
