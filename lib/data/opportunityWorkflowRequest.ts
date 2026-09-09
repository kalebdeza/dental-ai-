import {
  CONTACT_OUTCOMES,
  type ContactOutcome,
} from "./opportunityWorkflow.ts";

export const OFFICE_WORKFLOW_ACTIONS = [
  "mark_contacted",
  "contact_outcome",
  "add_note",
  "snooze",
  "dismiss",
  "complete",
] as const;

export type OfficeWorkflowAction = (typeof OFFICE_WORKFLOW_ACTIONS)[number];

export type ParsedOfficeWorkflowRequest = {
  opportunityId: string;
  action: OfficeWorkflowAction;
  contactOutcome?: ContactOutcome;
  note?: string;
  snoozedUntil?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isOfficeWorkflowAction(value: unknown): value is OfficeWorkflowAction {
  return (
    typeof value === "string" &&
    (OFFICE_WORKFLOW_ACTIONS as readonly string[]).includes(value)
  );
}

function isContactOutcome(value: unknown): value is ContactOutcome {
  return (
    typeof value === "string" &&
    (CONTACT_OUTCOMES as readonly string[]).includes(value)
  );
}

export function parseOfficeWorkflowRequest(
  body: unknown
): ParsedOfficeWorkflowRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const opportunityId = readTrimmedString(body.opportunityId);
  const action = body.action;

  if (!opportunityId || !isOfficeWorkflowAction(action)) {
    return null;
  }

  const parsed: ParsedOfficeWorkflowRequest = {
    opportunityId,
    action,
  };

  const note = readTrimmedString(body.note);
  if (note) {
    parsed.note = note;
  }

  if (action === "contact_outcome") {
    if (!isContactOutcome(body.contactOutcome)) {
      return null;
    }
    parsed.contactOutcome = body.contactOutcome;
  }

  if (action === "snooze") {
    const snoozedUntil = readTrimmedString(body.snoozedUntil);
    if (!snoozedUntil) {
      return null;
    }
    parsed.snoozedUntil = snoozedUntil;
  }

  if (action === "add_note" && !parsed.note) {
    return null;
  }

  return parsed;
}

export function workflowRequestIgnoresClientActor(
  body: unknown
): boolean {
  const parsed = parseOfficeWorkflowRequest(body);
  if (!parsed) {
    return false;
  }

  return !("actorUserId" in parsed) && !("actor_user_id" in parsed);
}
