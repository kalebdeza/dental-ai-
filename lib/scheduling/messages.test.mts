import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  confirmationMessage,
  firstNameForSms,
  rescheduleOfferMessage,
} from "./messages.ts";
import type { OfferedSlot } from "./types.ts";

describe("scheduling messages", () => {
  it("generates a confirmation message without clinical details", () => {
    const body = confirmationMessage({
      firstName: "Ada",
      practiceName: "Riverside Dental",
      start: new Date("2026-09-15T17:00:00.000Z"),
      timeZone: "UTC",
    });

    assert.match(body, /Hi Ada/);
    assert.match(body, /Riverside Dental/);
    assert.match(body, /CONFIRM/);
    assert.match(body, /RESCHEDULE/);
    assert.doesNotMatch(body, /phone|ssn|chart|address|dob/i);
  });

  it("falls back when a first name is missing", () => {
    assert.equal(firstNameForSms("  "), "there");
    const body = confirmationMessage({
      firstName: "",
      practiceName: "Riverside Dental",
      start: new Date("2026-09-15T17:00:00.000Z"),
      timeZone: "UTC",
    });
    assert.match(body, /Hi there/);
  });

  it("lists numbered reschedule options", () => {
    const slots: OfferedSlot[] = [
      {
        index: 1,
        start: "2026-09-16T14:00:00.000Z",
        end: "2026-09-16T15:00:00.000Z",
        label: "Tuesday at 10:00 AM",
      },
      {
        index: 2,
        start: "2026-09-17T19:00:00.000Z",
        end: "2026-09-17T20:00:00.000Z",
        label: "Wednesday at 3:00 PM",
      },
    ];

    const body = rescheduleOfferMessage(slots);
    assert.match(body, /Tuesday at 10:00 AM/);
    assert.match(body, /Wednesday at 3:00 PM/);
    assert.match(body, /Reply 1/);
    assert.match(body, /Reply 2/);
  });
});
