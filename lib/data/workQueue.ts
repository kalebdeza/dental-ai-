import { isClaimAging } from "./claimWorkflow.ts";
import {
  formatActivityTimestamp,
  formatContactOutcomeLabel,
} from "./opportunityActivityDisplay.ts";
import {
  formatWorkflowStatusLabel,
  isOpportunitySnoozed,
  readStoredWorkflowStatus,
  type OpportunityWorkflowRow,
} from "./opportunityWorkflow.ts";

export const WORK_QUEUE_TABS = ["today", "scheduled", "snoozed"] as const;
export type WorkQueueTab = (typeof WORK_QUEUE_TABS)[number];

export const WORK_QUEUE_TYPES = ["Recall", "Treatment", "Claim"] as const;
export type WorkQueueType = (typeof WORK_QUEUE_TYPES)[number];

export type WorkQueueItem = {
  id: string;
  patient: string;
  patientId: string | null;
  opportunityType: string;
  reason: string | null;
  estimatedValue: number;
  priority: string;
  workflowStatus: string;
  contactOutcome: string | null;
  snoozedUntil: string | null;
  identifiedAt: string | null;
  lastActedAt: string | null;
  dueDate: string | null;
  claimSubmittedAt: string | null;
  claimRemainingBalance: number | null;
  completed: boolean;
};

export type WorkQueueOpportunityRow = Pick<
  OpportunityWorkflowRow,
  | "id"
  | "opportunity_type"
  | "patient_id"
  | "claim_id"
  | "recall_id"
  | "priority"
  | "estimated_value"
  | "reason"
  | "completed"
  | "workflow_status"
  | "contact_outcome"
  | "snoozed_until"
  | "identified_at"
  | "last_acted_at"
>;

const PRIORITY_RANK: Record<string, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

type WorkQueueStatusInput = {
  workflow_status?: string;
  workflowStatus?: string;
  completed?: boolean;
  snoozed_until?: string | null;
  snoozedUntil?: string | null;
};

function statusRow(row: WorkQueueStatusInput): Pick<
  OpportunityWorkflowRow,
  "workflow_status" | "completed" | "snoozed_until"
> {
  return {
    workflow_status: row.workflow_status ?? row.workflowStatus ?? "open",
    completed: row.completed ?? false,
    snoozed_until: row.snoozed_until ?? row.snoozedUntil ?? null,
  };
}

export function isWorkQueueEligible(row: WorkQueueStatusInput): boolean {
  const status = readStoredWorkflowStatus(statusRow(row));
  return (
    status === "open" || status === "contacted" || status === "scheduled"
  );
}

export function isRecoverableOpportunity(row: WorkQueueStatusInput): boolean {
  const status = readStoredWorkflowStatus(statusRow(row));
  return status !== "completed" && status !== "dismissed";
}

export function workQueueTabFor(
  row: WorkQueueStatusInput,
  now: Date = new Date()
): WorkQueueTab | null {
  const normalized = statusRow(row);

  if (!isWorkQueueEligible(normalized)) {
    return null;
  }

  if (isOpportunitySnoozed(normalized, now)) {
    return "snoozed";
  }

  const status = readStoredWorkflowStatus(normalized);

  if (status === "scheduled") {
    return "scheduled";
  }

  if (status === "open" || status === "contacted") {
    return "today";
  }

  return null;
}

export function isTodayQueueItem(
  row: WorkQueueStatusInput,
  now: Date = new Date()
): boolean {
  return workQueueTabFor(row, now) === "today";
}

export function isClinicallyOverdue(
  item: Pick<
    WorkQueueItem,
    | "opportunityType"
    | "dueDate"
    | "claimSubmittedAt"
    | "claimRemainingBalance"
  >,
  now: Date = new Date()
): boolean {
  if (item.opportunityType === "Recall") {
    if (!item.dueDate) {
      return false;
    }

    const due = Date.parse(item.dueDate);
    return Number.isFinite(due) && due < now.getTime();
  }

  if (item.opportunityType === "Claim") {
    return isClaimAging(
      {
        submitted_at: item.claimSubmittedAt,
        remaining_balance: item.claimRemainingBalance ?? 0,
      },
      now
    );
  }

  return false;
}

export function formatQueueLastActivity(
  item: Pick<WorkQueueItem, "contactOutcome" | "lastActedAt">
): string | null {
  const outcome = formatContactOutcomeLabel(item.contactOutcome);
  const actedAt = item.lastActedAt?.trim()
    ? formatActivityTimestamp(item.lastActedAt)
    : null;
  const actedLabel =
    actedAt && actedAt !== "Date not recorded" ? actedAt : null;

  if (outcome && actedLabel) {
    return `${outcome} · ${actedLabel}`;
  }

  if (outcome) {
    return outcome;
  }

  if (actedLabel) {
    return `Last acted ${actedLabel}`;
  }

  return null;
}

export function formatEstimatedAmount(value: number): string {
  return `$${Number(value || 0).toLocaleString()}`;
}

export function workQueueTypeHref(
  opportunityType: string,
  opportunityId: string,
  claimId?: string | null
): string {
  if (opportunityType === "Recall") {
    return `/recall/${opportunityId}`;
  }

  if (opportunityType === "Treatment") {
    return `/treatment/${opportunityId}`;
  }

  if (opportunityType === "Claim" && claimId) {
    return `/claims/${claimId}`;
  }

  return `/opportunities/${opportunityId}`;
}

function estimatedValueOf(item: Pick<WorkQueueItem, "estimatedValue">): number {
  const value = Number(item.estimatedValue ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function identifiedAtMillis(value: string | null): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function compareWorkQueueItems(
  left: WorkQueueItem,
  right: WorkQueueItem,
  now: Date = new Date()
): number {
  const overdueDelta =
    Number(isClinicallyOverdue(left, now)) ===
    Number(isClinicallyOverdue(right, now))
      ? 0
      : isClinicallyOverdue(left, now)
        ? -1
        : 1;

  if (overdueDelta !== 0) {
    return overdueDelta;
  }

  const leftPriority = PRIORITY_RANK[left.priority] ?? 99;
  const rightPriority = PRIORITY_RANK[right.priority] ?? 99;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const valueDelta = estimatedValueOf(right) - estimatedValueOf(left);
  if (valueDelta !== 0) {
    return valueDelta;
  }

  const identifiedDelta =
    identifiedAtMillis(left.identifiedAt) -
    identifiedAtMillis(right.identifiedAt);
  if (identifiedDelta !== 0) {
    return identifiedDelta;
  }

  return left.id.localeCompare(right.id);
}

export function filterWorkQueueItems(
  items: WorkQueueItem[],
  tab: WorkQueueTab,
  now: Date = new Date(),
  typeFilter: WorkQueueType | "all" = "all"
): WorkQueueItem[] {
  return items.filter((item) => {
    if (typeFilter !== "all" && item.opportunityType !== typeFilter) {
      return false;
    }

    return workQueueTabFor(item, now) === tab;
  });
}

export function sortWorkQueueItems(
  items: WorkQueueItem[],
  now: Date = new Date()
): WorkQueueItem[] {
  return [...items].sort((left, right) =>
    compareWorkQueueItems(left, right, now)
  );
}

export function selectWorkQueueItems(
  items: WorkQueueItem[],
  tab: WorkQueueTab,
  now: Date = new Date(),
  typeFilter: WorkQueueType | "all" = "all"
): WorkQueueItem[] {
  return sortWorkQueueItems(
    filterWorkQueueItems(items, tab, now, typeFilter),
    now
  );
}

export function recoverableEstimatedTotal(
  items: Array<
    Pick<
      WorkQueueItem,
      "estimatedValue" | "workflowStatus" | "completed" | "opportunityType"
    >
  >,
  opportunityType?: string
): number {
  return items.reduce((sum, item) => {
    if (opportunityType && item.opportunityType !== opportunityType) {
      return sum;
    }

    if (!isRecoverableOpportunity(item)) {
      return sum;
    }

    return sum + estimatedValueOf(item);
  }, 0);
}

export function toWorkQueueItem(input: {
  id: string;
  patient: string;
  patientId?: string | null;
  opportunityType: string;
  reason: string | null;
  estimatedValue: number;
  priority: string;
  workflowStatus: string;
  contactOutcome?: string | null;
  snoozedUntil?: string | null;
  identifiedAt?: string | null;
  lastActedAt?: string | null;
  dueDate?: string | null;
  claimSubmittedAt?: string | null;
  claimRemainingBalance?: number | null;
  completed?: boolean;
}): WorkQueueItem {
  return {
    id: input.id,
    patient: input.patient,
    patientId: input.patientId ?? null,
    opportunityType: input.opportunityType,
    reason: input.reason,
    estimatedValue: Number(input.estimatedValue ?? 0),
    priority: input.priority,
    workflowStatus: readStoredWorkflowStatus({
      workflow_status: input.workflowStatus,
      completed: input.completed ?? false,
    }),
    contactOutcome: input.contactOutcome ?? null,
    snoozedUntil: input.snoozedUntil ?? null,
    identifiedAt: input.identifiedAt ?? null,
    lastActedAt: input.lastActedAt ?? null,
    dueDate: input.dueDate ?? null,
    claimSubmittedAt: input.claimSubmittedAt ?? null,
    claimRemainingBalance: input.claimRemainingBalance ?? null,
    completed: input.completed ?? false,
  };
}

export type TodayPriorityPatient = {
  opportunityId: string;
  patientId: string | null;
  name: string;
  type: string;
  revenue: number;
  priority: string;
};

export function buildTodayPriorityPatients(
  items: WorkQueueItem[],
  now: Date = new Date(),
  limit = 5
): TodayPriorityPatient[] {
  return selectWorkQueueItems(items, "today", now)
    .slice(0, limit)
    .map((item) => ({
      opportunityId: item.id,
      patientId: item.patientId,
      name: item.patient,
      type: item.opportunityType,
      revenue: estimatedValueOf(item),
      priority: item.priority,
    }));
}

export function queueStatusLabel(status: string): string {
  return formatWorkflowStatusLabel(
    readStoredWorkflowStatus({
      workflow_status: status,
      completed: false,
    })
  );
}
