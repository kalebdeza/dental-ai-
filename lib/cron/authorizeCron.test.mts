import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

import { authorizeCronRequest } from "./authorizeCron.ts";

describe("cron authorization", () => {
  it("fails closed when CRON_SECRET is missing", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    try {
      const allowed = authorizeCronRequest({
        headers: new Headers({ authorization: "Bearer secret" }),
      } as never);
      assert.equal(allowed, false);
    } finally {
      if (previous === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previous;
      }
    }
  });

  it("accepts only an Authorization Bearer secret", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "super-secret";

    try {
      assert.equal(
        authorizeCronRequest({
          headers: new Headers({ authorization: "Bearer super-secret" }),
        } as never),
        true
      );
      assert.equal(
        authorizeCronRequest({
          headers: new Headers({ authorization: "Bearer other" }),
        } as never),
        false
      );
      assert.equal(
        authorizeCronRequest({
          headers: new Headers({}),
        } as never),
        false
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previous;
      }
    }
  });
});

describe("cron route tenant isolation", () => {
  it("does not read practice or integration ids from the request", async () => {
    const route = await readFile(
      new URL("../../app/api/cron/practice-jobs/route.ts", import.meta.url),
      "utf8"
    );

    assert.equal(route.includes("searchParams"), false);
    assert.equal(route.includes("cookies("), false);
    assert.equal(route.includes("X-Practice-Id"), false);
    assert.equal(route.includes("request.json"), false);
    assert.match(route, /listConnectedOpenDentalIntegrations/);
    assert.match(route, /planPracticeJobTick/);
    assert.match(route, /loadPracticeJobCursor/);
    assert.match(route, /acquirePracticeJobLock/);
    assert.match(route, /integration\.practice_id/);
    assert.match(route, /integration\.id/);
  });
});

describe("connected integration listing", () => {
  it("paginates connected Open Dental integrations with an explicit order", async () => {
    const listing = await readFile(
      new URL("./listConnectedIntegrations.ts", import.meta.url),
      "utf8"
    );

    assert.match(
      listing,
      /select\(\s*"id, practice_id, sync_frequency_minutes/
    );
    assert.match(listing, /\.not\("customer_key", "is", null\)/);
    assert.match(listing, /paginateSupabaseQuery/);
    assert.match(listing, /\.order\("id"\)/);
  });
});
