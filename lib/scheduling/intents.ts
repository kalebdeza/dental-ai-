export type SmsIntent =
  | { kind: "confirm" }
  | { kind: "reschedule" }
  | { kind: "cancel" }
  | { kind: "stop" }
  | { kind: "slot"; index: number }
  | { kind: "unknown" };

const STOP_TOKENS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel subscription",
  "optout",
  "opt out",
]);

const CONFIRM_TOKENS = new Set(["confirm", "confirmed", "yes", "c"]);
const RESCHEDULE_TOKENS = new Set([
  "reschedule",
  "resched",
  "another time",
  "new time",
]);
const CANCEL_TOKENS = new Set(["cancel", "cancelled", "canceled"]);

function normalize(body: string): string {
  return body.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseInboundSms(body: string): SmsIntent {
  const text = normalize(body);

  if (!text) {
    return { kind: "unknown" };
  }

  if (STOP_TOKENS.has(text) || text === "stop all") {
    return { kind: "stop" };
  }

  const slotMatch = text.match(/^([1-9])$/);
  if (slotMatch) {
    return { kind: "slot", index: Number(slotMatch[1]) };
  }

  if (CONFIRM_TOKENS.has(text)) {
    return { kind: "confirm" };
  }

  if (CANCEL_TOKENS.has(text)) {
    return { kind: "cancel" };
  }

  if (RESCHEDULE_TOKENS.has(text)) {
    return { kind: "reschedule" };
  }

  if (/\bstop\b/.test(text) && text.length <= 24) {
    return { kind: "stop" };
  }

  if (/\bconfirm\b/.test(text)) {
    return { kind: "confirm" };
  }

  if (/\bresched(ule)?\b/.test(text)) {
    return { kind: "reschedule" };
  }

  if (/\bcancel(led|ed)?\b/.test(text)) {
    return { kind: "cancel" };
  }

  return { kind: "unknown" };
}

export function isOptOutIntent(intent: SmsIntent): boolean {
  return intent.kind === "stop";
}
