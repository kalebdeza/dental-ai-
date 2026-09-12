import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextDemoSlots, slotByIndex } from "./slots.ts";

describe("demo slots", () => {
  it("returns the next weekday openings and skips busy times", () => {
    const now = new Date("2026-09-11T16:00:00.000Z");
    const first = nextDemoSlots([], 2, now, "UTC");
    assert.equal(first.length, 2);
    assert.equal(first[0]?.index, 1);
    assert.equal(first[1]?.index, 2);
    assert.ok(slotByIndex(first, 1));

    const busy = [{ start: first[0]!.start, end: first[0]!.end }];
    const second = nextDemoSlots(busy, 2, now, "UTC");
    assert.notEqual(second[0]?.start, first[0]?.start);
  });
});
