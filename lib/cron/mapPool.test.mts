import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapPool } from "./mapPool.ts";

describe("mapPool", () => {
  it("returns immediately for an empty list", async () => {
    const results = await mapPool([], 3, async () => 1);
    assert.deepEqual(results, []);
  });

  it("preserves order with bounded concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await mapPool(
      [1, 2, 3, 4, 5],
      2,
      async (value) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => {
          setTimeout(resolve, 15);
        });
        inFlight -= 1;
        return value * 10;
      }
    );

    assert.deepEqual(results, [10, 20, 30, 40, 50]);
    assert.ok(maxInFlight <= 2);
    assert.ok(maxInFlight >= 2);
  });
});
