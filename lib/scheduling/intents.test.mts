import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseInboundSms } from "./intents.ts";

describe("inbound SMS intents", () => {
  it("parses CONFIRM", () => {
    assert.deepEqual(parseInboundSms("CONFIRM"), { kind: "confirm" });
    assert.deepEqual(parseInboundSms("yes"), { kind: "confirm" });
  });

  it("parses RESCHEDULE", () => {
    assert.deepEqual(parseInboundSms("RESCHEDULE"), { kind: "reschedule" });
    assert.deepEqual(parseInboundSms("resched"), { kind: "reschedule" });
  });

  it("parses slot selection", () => {
    assert.deepEqual(parseInboundSms("1"), { kind: "slot", index: 1 });
    assert.deepEqual(parseInboundSms("2"), { kind: "slot", index: 2 });
  });

  it("parses cancellation and STOP", () => {
    assert.deepEqual(parseInboundSms("cancel"), { kind: "cancel" });
    assert.deepEqual(parseInboundSms("STOP"), { kind: "stop" });
    assert.deepEqual(parseInboundSms("unsubscribe"), { kind: "stop" });
  });

  it("returns unknown for unrelated text", () => {
    assert.deepEqual(parseInboundSms("running late"), { kind: "unknown" });
  });
});
