import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoSmsAddress } from "../types.ts";
import { createDemoSmsProvider } from "./demoProvider.ts";
import { SmsDestinationError } from "./provider.ts";

describe("demo SMS provider", () => {
  it("records outbound messages without using a carrier", async () => {
    const provider = createDemoSmsProvider();
    const result = await provider.send({
      to: demoSmsAddress("patient-1"),
      body: "Hello",
      practiceId: "practice-1",
      patientId: "patient-1",
    });

    assert.equal(result.status, "sent");
    assert.equal(result.provider, "demo");
    assert.match(result.providerMessageId, /^demo-/);
    assert.equal(provider.logs.length, 1);
    assert.equal(provider.logs[0]?.to, "demo:patient:patient-1");
  });

  it("refuses real phone numbers", async () => {
    const provider = createDemoSmsProvider();
    await assert.rejects(
      () =>
        provider.send({
          to: "+15555550100",
          body: "Hello",
          practiceId: "practice-1",
          patientId: "patient-1",
        }),
      SmsDestinationError
    );
    assert.equal(provider.logs.length, 0);
  });
});
