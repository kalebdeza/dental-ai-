import type { Tables } from "../database.types.ts";

export const WORKFLOW_STATUSES = [
  "open",
  "contacted",
  "scheduled",
  "completed",
  "dismissed",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const CONTACT_OUTCOMES = [
  "scheduled",
  "will_call_back",
  "no_answer",
  "left_voicemail",
  "declined",
  "wrong_number",
] as const;

export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export const WORKFLOW_EVENT_TYPES = [
  "status_change",
  "contact_outcome",
  "note",
  "snooze",
  "complete",
  "dismiss",
] as const;

export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

export const OFFICE_CONTACT_OPPORTUNITY_TYPES = ["Recall", "Treatment"] as const;

export const APPLY_OPPORTUNITY_WORKFLOW_RPC = "apply_opportunity_workflow";

export const WORKFLOW_OWNED_FIELDS = [
  "workflow_status",
  "contact_outcome",
  "snoozed_until",
  "last_actor_user_id",
  "last_acted_at",
] as const;

export const SCANNER_OWNED_FIELDS = [
  "reason",
  "recommended_action",
  "estimated_value",
  "priority",
  "confidence_score",
] as const;

export const AUTHENTICATED_SCANNER_UPDATE_COLUMNS = [
  ...SCANNER_OWNED_FIELDS,
  "completed",
  "updated_at",
] as const;

export const AUTHENTICATED_WORKFLOW_UPDATE_COLUMNS = WORKFLOW_OWNED_FIELDS;

export const IMMUTABLE_OPPORTUNITY_FIELDS = [
  "practice_id",
  "opportunity_type",
  "patient_id",
  "claim_id",
  "procedure_id",
  "recall_id",
] as const;

export const CONTACT_OUTCOME_STATUS: Record<ContactOutcome, WorkflowStatus> = {
  scheduled: "scheduled",
  will_call_back: "contacted",
  no_answer: "contacted",
  left_voicemail: "contacted",
  declined: "dismissed",
  wrong_number: "contacted",
};

export type OpportunityWorkflowRow = Tables<"revenue_opportunities">;
export type OpportunityActivityRow = Tables<"opportunity_activities">;

export type WorkflowMutation =
  | {
      kind: "status_change";
      toStatus: WorkflowStatus;
      note?: string | null;
    }
  | {
      kind: "contact_outcome";
      contactOutcome: ContactOutcome;
      note?: string | null;
    }
  | {
      kind: "note";
      note: string;
    }
  | {
      kind: "snooze";
      snoozedUntil: string;
      note?: string | null;
    }
  | {
      kind: "complete";
      note?: string | null;
    }
  | {
      kind: "dismiss";
      note?: string | null;
    };

export type ApplyOpportunityWorkflowArgs = {
  p_opportunity_id: string;
  p_practice_id: string;
  p_event_type: WorkflowEventType;
  p_to_status: WorkflowStatus | null;
  p_contact_outcome: ContactOutcome | null;
  p_note: string | null;
  p_snoozed_until: string | null;
  p_clear_snooze: boolean;
};

export type PlannedWorkflowMutation = {
  eventType: WorkflowEventType;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  contactOutcome: ContactOutcome | null;
  note: string | null;
  snoozedUntil: string | null;
  clearSnooze: boolean;
};

export type ApplyOpportunityWorkflowResult = {
  opportunity: OpportunityWorkflowRow;
  activity: OpportunityActivityRow;
};

export type OpportunityWorkflowClient = {
  from: (table: string) => any;
  rpc: (
    fn: "apply_opportunity_workflow",
    args: ApplyOpportunityWorkflowArgs
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export class OpportunityWorkflowError extends Error {
  readonly code:
    | "not_found"
    | "forbidden"
    | "invalid_transition"
    | "unauthenticated"
    | "invalid_input";

  constructor(
    message: string,
    code:
      | "not_found"
      | "forbidden"
      | "invalid_transition"
      | "unauthenticated"
      | "invalid_input"
  ) {
    super(message);
    this.name = "OpportunityWorkflowError";
    this.code = code;
  }
}

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return (
    typeof value === "string" &&
    (WORKFLOW_STATUSES as readonly string[]).includes(value)
  );
}

export function isContactOutcome(value: unknown): value is ContactOutcome {
  return (
    typeof value === "string" &&
    (CONTACT_OUTCOMES as readonly string[]).includes(value)
  );
}

export function isAuthenticatedDirectUpdateColumn(column: string): boolean {
  return (AUTHENTICATED_SCANNER_UPDATE_COLUMNS as readonly string[]).includes(
    column
  );
}

export function isAuthenticatedWorkflowUpdateColumn(column: string): boolean {
  return (AUTHENTICATED_WORKFLOW_UPDATE_COLUMNS as readonly string[]).includes(
    column
  );
}

export function usesOfficeContactLifecycle(opportunityType: string): boolean {
  return (OFFICE_CONTACT_OPPORTUNITY_TYPES as readonly string[]).includes(
    opportunityType
  );
}

export function backfillWorkflowStatus(completed: boolean): WorkflowStatus {
  return completed ? "completed" : "open";
}

export function newOpportunityWorkflowDefaults(): {
  workflow_status: "open";
  completed: false;
  contact_outcome: null;
  snoozed_until: null;
  last_actor_user_id: null;
  last_acted_at: null;
} {
  return {
    workflow_status: "open",
    completed: false,
    contact_outcome: null,
    snoozed_until: null,
    last_actor_user_id: null,
    last_acted_at: null,
  };
}

export function workflowActorFromAuth(authUid: string | null | undefined): string {
  if (!authUid?.trim()) {
    throw new OpportunityWorkflowError("Not authenticated", "unauthenticated");
  }

  return authUid;
}

export function isOpportunitySnoozed(
  row: Pick<OpportunityWorkflowRow, "snoozed_until">,
  now: Date = new Date()
): boolean {
  if (!row.snoozed_until) {
    return false;
  }

  const until = Date.parse(row.snoozed_until);
  return Number.isFinite(until) && until > now.getTime();
}

export function isOpportunityDue(
  row: Pick<OpportunityWorkflowRow, "workflow_status" | "snoozed_until">,
  now: Date = new Date()
): boolean {
  if (
    row.workflow_status === "completed" ||
    row.workflow_status === "dismissed"
  ) {
    return false;
  }

  return !isOpportunitySnoozed(row, now);
}

export function readStoredWorkflowStatus(
  row: Pick<OpportunityWorkflowRow, "workflow_status" | "completed">
): WorkflowStatus {
  if (isWorkflowStatus(row.workflow_status)) {
    return row.workflow_status;
  }

  return backfillWorkflowStatus(row.completed);
}

export function formatWorkflowStatusLabel(status: WorkflowStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "contacted":
      return "Contacted";
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "dismissed":
      return "Dismissed";
  }
}

export function isActiveQueueOpportunity(
  row: Pick<
    OpportunityWorkflowRow,
    "workflow_status" | "completed" | "snoozed_until"
  >,
  now: Date = new Date()
): boolean {
  const status = readStoredWorkflowStatus(row);

  if (
    status !== "open" &&
    status !== "contacted" &&
    status !== "scheduled"
  ) {
    return false;
  }

  return isOpportunityDue({ ...row, workflow_status: status }, now);
}

export function isOfficeWorkflowTerminal(status: WorkflowStatus): boolean {
  return status === "completed" || status === "dismissed";
}

export function isWorkflowTransitionAllowed(
  opportunityType: string,
  from: WorkflowStatus,
  to: WorkflowStatus
): boolean {
  if (from === "completed" || from === "dismissed") {
    return false;
  }

  if (to === "open") {
    return false;
  }

  if (to === "contacted" || to === "scheduled") {
    return (
      usesOfficeContactLifecycle(opportunityType) &&
      (from === "open" || from === "contacted" || from === "scheduled")
    );
  }

  if (to === "completed" || to === "dismissed") {
    return from === "open" || from === "contacted" || from === "scheduled";
  }

  return false;
}

export function applyCompletedWorkflowSync(input: {
  operation: "INSERT" | "UPDATE";
  previous?: Pick<OpportunityWorkflowRow, "workflow_status" | "completed">;
  next: Pick<OpportunityWorkflowRow, "workflow_status" | "completed">;
}): { workflow_status: WorkflowStatus; completed: boolean } {
  const nextStatus = isWorkflowStatus(input.next.workflow_status)
    ? input.next.workflow_status
    : "open";

  if (input.operation === "INSERT") {
    return {
      workflow_status: nextStatus,
      completed: nextStatus === "completed",
    };
  }

  const previous = input.previous;

  if (!previous) {
    return {
      workflow_status: nextStatus,
      completed: nextStatus === "completed",
    };
  }

  const previousStatus = isWorkflowStatus(previous.workflow_status)
    ? previous.workflow_status
    : previous.completed
      ? "completed"
      : "open";

  if (nextStatus !== previousStatus) {
    if (previousStatus === "completed" || previousStatus === "dismissed") {
      return {
        workflow_status: previousStatus,
        completed: previousStatus === "completed",
      };
    }

    return {
      workflow_status: nextStatus,
      completed: nextStatus === "completed",
    };
  }

  if (input.next.completed !== previous.completed) {
    if (previousStatus === "dismissed") {
      return { workflow_status: "dismissed", completed: false };
    }

    if (input.next.completed) {
      return { workflow_status: "completed", completed: true };
    }

    if (previousStatus === "completed") {
      return { workflow_status: "completed", completed: true };
    }

    return {
      workflow_status: nextStatus,
      completed: nextStatus === "completed",
    };
  }

  return {
    workflow_status: nextStatus,
    completed: nextStatus === "completed",
  };
}

function requiredPracticeId(practiceId: string | null | undefined): string {
  if (!practiceId?.trim()) {
    throw new OpportunityWorkflowError("Practice is required", "invalid_input");
  }

  return practiceId;
}

function requiredOpportunityId(opportunityId: string | null | undefined): string {
  if (!opportunityId?.trim()) {
    throw new OpportunityWorkflowError(
      "Opportunity is required",
      "invalid_input"
    );
  }

  return opportunityId;
}

function readWorkflowStatus(row: OpportunityWorkflowRow): WorkflowStatus {
  return readStoredWorkflowStatus(row);
}

function optionalNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

function requiredNote(note: string | null | undefined): string {
  const trimmed = optionalNote(note);

  if (!trimmed) {
    throw new OpportunityWorkflowError("Note is required", "invalid_input");
  }

  return trimmed;
}

function requiredSnoozeUntil(value: string | null | undefined): string {
  if (!value?.trim()) {
    throw new OpportunityWorkflowError(
      "Snooze until is required",
      "invalid_input"
    );
  }

  const until = Date.parse(value);

  if (!Number.isFinite(until)) {
    throw new OpportunityWorkflowError(
      "Snooze until is required",
      "invalid_input"
    );
  }

  if (until <= Date.now()) {
    throw new OpportunityWorkflowError(
      "Snooze until must be in the future",
      "invalid_input"
    );
  }

  return new Date(until).toISOString();
}

export function planWorkflowMutation(
  row: OpportunityWorkflowRow,
  practiceId: string,
  mutation: WorkflowMutation
): PlannedWorkflowMutation {
  if (row.practice_id !== practiceId) {
    throw new OpportunityWorkflowError("Opportunity not found", "forbidden");
  }

  const fromStatus = readWorkflowStatus(row);

  if (mutation.kind === "note") {
    return {
      eventType: "note",
      fromStatus,
      toStatus: fromStatus,
      contactOutcome: null,
      note: requiredNote(mutation.note),
      snoozedUntil: null,
      clearSnooze: false,
    };
  }

  if (mutation.kind === "snooze") {
    if (fromStatus === "completed" || fromStatus === "dismissed") {
      throw new OpportunityWorkflowError(
        "Invalid workflow transition",
        "invalid_transition"
      );
    }

    return {
      eventType: "snooze",
      fromStatus,
      toStatus: fromStatus,
      contactOutcome: null,
      note: optionalNote(mutation.note),
      snoozedUntil: requiredSnoozeUntil(mutation.snoozedUntil),
      clearSnooze: false,
    };
  }

  const toStatus =
    mutation.kind === "contact_outcome"
      ? CONTACT_OUTCOME_STATUS[mutation.contactOutcome]
      : mutation.kind === "complete"
        ? "completed"
        : mutation.kind === "dismiss"
          ? "dismissed"
          : mutation.toStatus;

  if (
    (toStatus === "contacted" || toStatus === "scheduled") &&
    !usesOfficeContactLifecycle(row.opportunity_type)
  ) {
    throw new OpportunityWorkflowError(
      "Invalid workflow transition",
      "invalid_transition"
    );
  }

  if (mutation.kind === "contact_outcome") {
    if (!usesOfficeContactLifecycle(row.opportunity_type)) {
      throw new OpportunityWorkflowError(
        "Invalid workflow transition",
        "invalid_transition"
      );
    }

    if (!isContactOutcome(mutation.contactOutcome)) {
      throw new OpportunityWorkflowError(
        "Invalid workflow transition",
        "invalid_transition"
      );
    }
  }

  if (!isWorkflowTransitionAllowed(row.opportunity_type, fromStatus, toStatus)) {
    throw new OpportunityWorkflowError(
      "Invalid workflow transition",
      "invalid_transition"
    );
  }

  return {
    eventType:
      mutation.kind === "status_change" ? "status_change" : mutation.kind,
    fromStatus,
    toStatus,
    contactOutcome:
      mutation.kind === "contact_outcome" ? mutation.contactOutcome : null,
    note: optionalNote(mutation.note),
    snoozedUntil: null,
    clearSnooze: toStatus === "completed" || toStatus === "dismissed",
  };
}

export function buildApplyOpportunityWorkflowArgs(
  practiceId: string,
  opportunityId: string,
  planned: PlannedWorkflowMutation
): ApplyOpportunityWorkflowArgs {
  return {
    p_opportunity_id: opportunityId,
    p_practice_id: practiceId,
    p_event_type: planned.eventType,
    p_to_status: planned.toStatus,
    p_contact_outcome: planned.contactOutcome,
    p_note: planned.note,
    p_snoozed_until: planned.snoozedUntil,
    p_clear_snooze: planned.clearSnooze,
  };
}

export function workflowOwnedPatch(
  row: OpportunityWorkflowRow,
  planned: PlannedWorkflowMutation,
  actorUserId: string,
  actedAt: string
): Pick<
  OpportunityWorkflowRow,
  | "workflow_status"
  | "completed"
  | "contact_outcome"
  | "snoozed_until"
  | "last_actor_user_id"
  | "last_acted_at"
  | "updated_at"
> {
  const synced = applyCompletedWorkflowSync({
    operation: "UPDATE",
    previous: row,
    next: {
      workflow_status: planned.toStatus,
      completed: planned.toStatus === "completed",
    },
  });

  return {
    workflow_status: synced.workflow_status,
    completed: synced.completed,
    contact_outcome:
      planned.eventType === "contact_outcome"
        ? planned.contactOutcome
        : row.contact_outcome,
    snoozed_until: planned.eventType === "snooze"
      ? planned.snoozedUntil
      : planned.clearSnooze
        ? null
        : row.snoozed_until,
    last_actor_user_id: actorUserId,
    last_acted_at: actedAt,
    updated_at: actedAt,
  };
}

export function executeApplyOpportunityWorkflow(input: {
  row: OpportunityWorkflowRow;
  practiceId: string;
  actorUserId: string | null | undefined;
  mutation: WorkflowMutation;
  actedAt?: string;
  activityId?: string;
}): ApplyOpportunityWorkflowResult {
  const actorUserId = workflowActorFromAuth(input.actorUserId);
  const planned = planWorkflowMutation(
    input.row,
    input.practiceId,
    input.mutation
  );
  const actedAt = input.actedAt ?? new Date().toISOString();
  const patch = workflowOwnedPatch(input.row, planned, actorUserId, actedAt);

  const opportunity: OpportunityWorkflowRow = {
    ...input.row,
    ...patch,
    practice_id: input.row.practice_id,
    opportunity_type: input.row.opportunity_type,
    patient_id: input.row.patient_id,
    claim_id: input.row.claim_id,
    procedure_id: input.row.procedure_id,
    recall_id: input.row.recall_id,
    reason: input.row.reason,
    recommended_action: input.row.recommended_action,
    estimated_value: input.row.estimated_value,
    priority: input.row.priority,
    confidence_score: input.row.confidence_score,
  };

  const activity: OpportunityActivityRow = {
    id: input.activityId ?? crypto.randomUUID(),
    practice_id: input.row.practice_id,
    opportunity_id: input.row.id,
    actor_user_id: actorUserId,
    event_type: planned.eventType,
    from_status: planned.fromStatus,
    to_status: planned.toStatus,
    contact_outcome: planned.contactOutcome,
    note: planned.note,
    snoozed_until: planned.eventType === "snooze" ? planned.snoozedUntil : null,
    created_at: actedAt,
  };

  return { opportunity, activity };
}

function mapRpcError(message: string): OpportunityWorkflowError {
  if (/not authenticated/i.test(message)) {
    return new OpportunityWorkflowError(message, "unauthenticated");
  }

  if (/not found/i.test(message)) {
    return new OpportunityWorkflowError(message, "forbidden");
  }

  if (/invalid workflow/i.test(message) || /note is required/i.test(message)) {
    return new OpportunityWorkflowError(message, "invalid_transition");
  }

  return new OpportunityWorkflowError(message, "invalid_input");
}

async function loadOpportunity(
  client: OpportunityWorkflowClient,
  practiceId: string,
  opportunityId: string
): Promise<OpportunityWorkflowRow> {
  const { data, error } = await client
    .from("revenue_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("practice_id", practiceId)
    .maybeSingle();

  if (error) {
    throw new OpportunityWorkflowError(error.message, "invalid_input");
  }

  if (!data || data.practice_id !== practiceId) {
    throw new OpportunityWorkflowError("Opportunity not found", "forbidden");
  }

  return data;
}

async function mutateOpportunityWorkflow(
  client: OpportunityWorkflowClient,
  practiceId: string,
  opportunityId: string,
  mutation: WorkflowMutation
): Promise<ApplyOpportunityWorkflowResult> {
  const scopedPracticeId = requiredPracticeId(practiceId);
  const scopedOpportunityId = requiredOpportunityId(opportunityId);
  const row = await loadOpportunity(
    client,
    scopedPracticeId,
    scopedOpportunityId
  );
  const planned = planWorkflowMutation(row, scopedPracticeId, mutation);
  const args = buildApplyOpportunityWorkflowArgs(
    scopedPracticeId,
    scopedOpportunityId,
    planned
  );

  const { data, error } = await client.rpc(
    APPLY_OPPORTUNITY_WORKFLOW_RPC,
    args
  );

  if (error || !data || typeof data !== "object") {
    throw mapRpcError(error?.message ?? "Opportunity not found");
  }

  const payload = data as ApplyOpportunityWorkflowResult;

  if (!payload.opportunity || !payload.activity) {
    throw mapRpcError("Opportunity not found");
  }

  return payload;
}

export async function getOpportunity(
  client: OpportunityWorkflowClient,
  input: { practiceId: string; opportunityId: string }
): Promise<OpportunityWorkflowRow | null> {
  const practiceId = requiredPracticeId(input.practiceId);
  const opportunityId = requiredOpportunityId(input.opportunityId);

  const { data, error } = await client
    .from("revenue_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("practice_id", practiceId)
    .maybeSingle();

  if (error) {
    throw new OpportunityWorkflowError(error.message, "invalid_input");
  }

  if (!data || data.practice_id !== practiceId) {
    return null;
  }

  return data;
}

export async function getOpportunityActivities(
  client: OpportunityWorkflowClient,
  input: { practiceId: string; opportunityId: string }
): Promise<OpportunityActivityRow[]> {
  const practiceId = requiredPracticeId(input.practiceId);
  const opportunityId = requiredOpportunityId(input.opportunityId);

  const { data, error } = await client
    .from("opportunity_activities")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("practice_id", practiceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new OpportunityWorkflowError(error.message, "invalid_input");
  }

  return data ?? [];
}

export async function changeWorkflowStatus(
  client: OpportunityWorkflowClient,
  input: {
    practiceId: string;
    opportunityId: string;
    toStatus: WorkflowStatus;
    note?: string | null;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  return mutateOpportunityWorkflow(client, input.practiceId, input.opportunityId, {
    kind: "status_change",
    toStatus: input.toStatus,
    note: input.note,
  });
}

export async function recordContactOutcome(
  client: OpportunityWorkflowClient,
  input: {
    practiceId: string;
    opportunityId: string;
    contactOutcome: ContactOutcome;
    note?: string | null;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  return mutateOpportunityWorkflow(client, input.practiceId, input.opportunityId, {
    kind: "contact_outcome",
    contactOutcome: input.contactOutcome,
    note: input.note,
  });
}

export async function addOpportunityNote(
  client: OpportunityWorkflowClient,
  input: {
    practiceId: string;
    opportunityId: string;
    note: string;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  return mutateOpportunityWorkflow(client, input.practiceId, input.opportunityId, {
    kind: "note",
    note: input.note,
  });
}

export async function snoozeOpportunity(
  client: OpportunityWorkflowClient,
  input: {
    practiceId: string;
    opportunityId: string;
    snoozedUntil: string;
    note?: string | null;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  return mutateOpportunityWorkflow(client, input.practiceId, input.opportunityId, {
    kind: "snooze",
    snoozedUntil: input.snoozedUntil,
    note: input.note,
  });
}

export async function dismissOpportunity(
  client: OpportunityWorkflowClient,
  input: {
    practiceId: string;
    opportunityId: string;
    note?: string | null;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  return mutateOpportunityWorkflow(client, input.practiceId, input.opportunityId, {
    kind: "dismiss",
    note: input.note,
  });
}

export async function completeOpportunity(
  client: OpportunityWorkflowClient,
  input: {
    practiceId: string;
    opportunityId: string;
    note?: string | null;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  return mutateOpportunityWorkflow(client, input.practiceId, input.opportunityId, {
    kind: "complete",
    note: input.note,
  });
}

export async function applyOfficeWorkflowMutation(
  client: OpportunityWorkflowClient,
  practiceId: string,
  request: {
    opportunityId: string;
    action:
      | "mark_contacted"
      | "contact_outcome"
      | "add_note"
      | "snooze"
      | "dismiss"
      | "complete";
    contactOutcome?: ContactOutcome;
    note?: string | null;
    snoozedUntil?: string;
  }
): Promise<ApplyOpportunityWorkflowResult> {
  switch (request.action) {
    case "mark_contacted":
      return changeWorkflowStatus(client, {
        practiceId,
        opportunityId: request.opportunityId,
        toStatus: "contacted",
        note: request.note,
      });
    case "contact_outcome":
      if (!request.contactOutcome) {
        throw new OpportunityWorkflowError(
          "Invalid workflow transition",
          "invalid_transition"
        );
      }
      return recordContactOutcome(client, {
        practiceId,
        opportunityId: request.opportunityId,
        contactOutcome: request.contactOutcome,
        note: request.note,
      });
    case "add_note":
      return addOpportunityNote(client, {
        practiceId,
        opportunityId: request.opportunityId,
        note: request.note ?? "",
      });
    case "snooze":
      return snoozeOpportunity(client, {
        practiceId,
        opportunityId: request.opportunityId,
        snoozedUntil: request.snoozedUntil ?? "",
        note: request.note,
      });
    case "dismiss":
      return dismissOpportunity(client, {
        practiceId,
        opportunityId: request.opportunityId,
        note: request.note,
      });
    case "complete":
      return completeOpportunity(client, {
        practiceId,
        opportunityId: request.opportunityId,
        note: request.note,
      });
  }
}
