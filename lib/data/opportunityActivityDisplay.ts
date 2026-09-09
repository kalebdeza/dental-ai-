import {
  formatWorkflowStatusLabel,
  isContactOutcome,
  isWorkflowStatus,
  type OpportunityActivityRow,
} from "./opportunityWorkflow.ts";

export type OpportunityActivityView = {
  id: string;
  eventLabel: string;
  statusTransition: string | null;
  contactOutcome: string | null;
  note: string | null;
  snoozedUntil: string | null;
  timestamp: string;
};

const EVENT_LABELS: Record<string, string> = {
  status_change: "Status change",
  contact_outcome: "Contact outcome",
  note: "Note",
  snooze: "Snoozed",
  complete: "Completed",
  dismiss: "Dismissed",
};

const OUTCOME_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  will_call_back: "Will call back",
  no_answer: "No answer",
  left_voicemail: "Left voicemail",
  declined: "Declined",
  wrong_number: "Wrong number",
};

export function formatContactOutcomeLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return OUTCOME_LABELS[value] ?? null;
}

export function formatActivityTimestamp(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "Date not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleString();
}

export function mapOpportunityActivity(
  activity: OpportunityActivityRow
): OpportunityActivityView {
  const fromStatus = isWorkflowStatus(activity.from_status)
    ? formatWorkflowStatusLabel(activity.from_status)
    : null;
  const toStatus = isWorkflowStatus(activity.to_status)
    ? formatWorkflowStatusLabel(activity.to_status)
    : null;
  const statusTransition =
    fromStatus && toStatus && fromStatus !== toStatus
      ? `${fromStatus} → ${toStatus}`
      : fromStatus && toStatus
        ? fromStatus
        : null;

  return {
    id: activity.id,
    eventLabel: EVENT_LABELS[activity.event_type] ?? activity.event_type,
    statusTransition,
    contactOutcome: isContactOutcome(activity.contact_outcome)
      ? formatContactOutcomeLabel(activity.contact_outcome)
      : null,
    note: activity.note?.trim() || null,
    snoozedUntil: activity.snoozed_until,
    timestamp: activity.created_at,
  };
}

export function mapOpportunityActivities(
  activities: OpportunityActivityRow[]
): OpportunityActivityView[] {
  return activities.map(mapOpportunityActivity);
}
