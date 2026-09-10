import type { Tables } from "../database.types.ts";
import { isRecallComplete } from "../opendental/status.ts";
import {
  formatWorkflowStatusLabel,
  isOfficeWorkflowTerminal,
  readStoredWorkflowStatus,
} from "./opportunityWorkflow.ts";

export type RecallPatientContact = Pick<
  Tables<"patients">,
  | "id"
  | "first_name"
  | "last_name"
  | "mobile_phone"
  | "home_phone"
  | "work_phone"
>;

export type RecallRowSummary = Pick<
  Tables<"recalls">,
  | "patient_id"
  | "recall_type"
  | "due_date"
  | "completed_date"
  | "status"
  | "estimated_revenue"
>;

export type RecallOpportunityRow = Pick<
  Tables<"revenue_opportunities">,
  | "id"
  | "patient_id"
  | "opportunity_type"
  | "estimated_value"
  | "priority"
  | "reason"
  | "recommended_action"
  | "completed"
  | "workflow_status"
  | "contact_outcome"
  | "snoozed_until"
  | "identified_at"
  | "last_acted_at"
>;

export type RecallOpportunityApiItem = {
  id: string;
  patient: string;
  patientId: string | null;
  opportunity_type: string;
  estimated_value: number;
  priority: string;
  reason: string | null;
  recommendedAction: string | null;
  completed: boolean;
  workflowStatus: string;
  contactOutcome: string | null;
  snoozedUntil: string | null;
  identifiedAt: string | null;
  lastActedAt: string | null;
  phone: string | null;
  recallType: string | null;
  dueDate: string | null;
};

export type RecallActionId =
  | "call"
  | "schedule"
  | "mark_contacted"
  | "add_note"
  | "snooze"
  | "complete"
  | "dismiss";

export type RecallWorkflowAction = {
  id: RecallActionId;
  label: string;
  emphasis: "primary" | "secondary" | "destructive";
  available: boolean;
  unavailableReason?: string;
};

export type RecallContactOutcomeId =
  | "scheduled"
  | "will_call_back"
  | "no_answer"
  | "left_voicemail"
  | "declined"
  | "wrong_number";

export type RecallContactOutcome = {
  id: RecallContactOutcomeId;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

export const RECALL_OPPORTUNITY_TYPE = "Recall" as const;

export const DESIRED_RECALL_STEPS = [
  "Open",
  "Contacted",
  "Scheduled",
  "Completed",
] as const;

export const DESIRED_RECALL_TERMINAL = "Dismissed";

export const SCHEDULE_IN_PMS_GUIDANCE =
  "The app doesn't currently create appointments. Schedule this visit in your PMS, then record the Scheduled contact outcome here.";

const CALL_NO_PHONE =
  "No patient phone is stored (mobile, home, or work).";

const TERMINAL_UNAVAILABLE =
  "This recall opportunity is already completed or dismissed.";

export const RECALL_CONTACT_OUTCOMES: Array<
  Omit<RecallContactOutcome, "available" | "unavailableReason">
> = [
  { id: "scheduled", label: "Scheduled" },
  { id: "will_call_back", label: "Will call back" },
  { id: "no_answer", label: "No answer" },
  { id: "left_voicemail", label: "Left voicemail" },
  { id: "declined", label: "Declined" },
  { id: "wrong_number", label: "Wrong number" },
];

function action(
  id: RecallActionId,
  label: string,
  emphasis: RecallWorkflowAction["emphasis"],
  available = true,
  unavailableReason?: string
): RecallWorkflowAction {
  return { id, label, emphasis, available, unavailableReason };
}

export function formatRecallPatientName(
  patient: Pick<RecallPatientContact, "first_name" | "last_name"> | null
): string {
  if (!patient) {
    return "Unknown Patient";
  }

  const name = `${patient.first_name} ${patient.last_name}`.trim();
  return name.length > 0 ? name : "Unknown Patient";
}

export function pickPatientPhone(
  patient: Pick<
    RecallPatientContact,
    "mobile_phone" | "home_phone" | "work_phone"
  > | null
): string | null {
  if (!patient) {
    return null;
  }

  for (const value of [
    patient.mobile_phone,
    patient.home_phone,
    patient.work_phone,
  ]) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

export function toTelHref(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  const trimmed = phone.trim();
  const normalized = trimmed.replace(/[^\d+]/g, "");
  const digits = normalized.replace(/\+/g, "");

  if (digits.length < 7) {
    return null;
  }

  if (normalized.includes("++") || normalized.slice(1).includes("+")) {
    return null;
  }

  return `tel:${normalized}`;
}

export function formatRecallDueDate(
  value: string | null | undefined
): string {
  if (!value?.trim()) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString();
}

export function formatStoredText(
  value: string | null | undefined,
  fallback = "Not available"
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function getPersistedRecallStatus(
  opportunity: Pick<RecallOpportunityRow, "workflow_status" | "completed">
): ReturnType<typeof formatWorkflowStatusLabel> {
  return formatWorkflowStatusLabel(readStoredWorkflowStatus(opportunity));
}

export function getRecallContactOutcomes(input: {
  workflowStatus: string;
  completed: boolean;
}): RecallContactOutcome[] {
  const status = readStoredWorkflowStatus({
    workflow_status: input.workflowStatus,
    completed: input.completed,
  });
  const available = !isOfficeWorkflowTerminal(status);

  return RECALL_CONTACT_OUTCOMES.map((outcome) => ({
    ...outcome,
    available,
    unavailableReason: available ? undefined : TERMINAL_UNAVAILABLE,
  }));
}

export function selectOpenRecallForPatient(
  rows: RecallRowSummary[],
  patientId: string,
  now = new Date()
): RecallRowSummary | null {
  const open = rows.filter(
    (row) =>
      row.patient_id === patientId && !isRecallComplete(row.completed_date)
  );

  if (open.length === 0) {
    return null;
  }

  const dated = open
    .filter((row) => row.due_date)
    .sort((a, b) => {
      const aTime = Date.parse(a.due_date as string);
      const bTime = Date.parse(b.due_date as string);
      const aValid = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
      const bValid = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
      return aValid - bValid;
    });

  const overdue = dated.find((row) => {
    const due = Date.parse(row.due_date as string);
    return !Number.isNaN(due) && due < now.getTime();
  });

  return overdue ?? dated[0] ?? open[0];
}

export function mapRecallOpportunity(
  opportunity: RecallOpportunityRow,
  patient: RecallPatientContact | null,
  recallRow: RecallRowSummary | null
): RecallOpportunityApiItem {
  const phone = pickPatientPhone(patient);
  const recallType = recallRow?.recall_type?.trim() || null;

  return {
    id: opportunity.id,
    patient: formatRecallPatientName(patient),
    patientId: opportunity.patient_id,
    opportunity_type: opportunity.opportunity_type,
    estimated_value: Number(opportunity.estimated_value ?? 0),
    priority: opportunity.priority,
    reason: opportunity.reason,
    recommendedAction: opportunity.recommended_action,
    completed: opportunity.completed,
    workflowStatus: readStoredWorkflowStatus(opportunity),
    contactOutcome: opportunity.contact_outcome,
    snoozedUntil: opportunity.snoozed_until,
    identifiedAt: opportunity.identified_at ?? null,
    lastActedAt: opportunity.last_acted_at ?? null,
    phone,
    recallType,
    dueDate: recallRow?.due_date ?? null,
  };
}

export function getRecallWorkflowActions(input: {
  phone: string | null;
  workflowStatus: string;
  completed: boolean;
}): RecallWorkflowAction[] {
  const tel = toTelHref(input.phone);
  const canCall = Boolean(tel);
  const status = readStoredWorkflowStatus({
    workflow_status: input.workflowStatus,
    completed: input.completed,
  });
  const terminal = isOfficeWorkflowTerminal(status);
  const canAdvance = !terminal;

  return [
    action(
      "call",
      "Call Patient",
      "primary",
      canCall && canAdvance,
      canCall
        ? terminal
          ? TERMINAL_UNAVAILABLE
          : undefined
        : CALL_NO_PHONE
    ),
    action(
      "schedule",
      "Schedule in PMS",
      "secondary",
      canAdvance,
      terminal ? TERMINAL_UNAVAILABLE : undefined
    ),
    action(
      "mark_contacted",
      "Mark Contacted",
      "secondary",
      canAdvance && status !== "contacted",
      terminal
        ? TERMINAL_UNAVAILABLE
        : status === "contacted"
          ? "Already marked contacted."
          : undefined
    ),
    action(
      "add_note",
      "Add Note",
      "secondary",
      true
    ),
    action(
      "snooze",
      "Snooze",
      "secondary",
      canAdvance,
      terminal ? TERMINAL_UNAVAILABLE : undefined
    ),
    action(
      "complete",
      "Mark Complete",
      "secondary",
      canAdvance,
      terminal ? TERMINAL_UNAVAILABLE : undefined
    ),
    action(
      "dismiss",
      "Dismiss",
      "destructive",
      canAdvance,
      terminal ? TERMINAL_UNAVAILABLE : undefined
    ),
  ];
}

export function parseRecallDismissId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("id" in body)) {
    return null;
  }

  const id = (body as { id: unknown }).id;

  if (typeof id !== "string") {
    return null;
  }

  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function recallDismissEquality(
  opportunityId: string,
  practiceId: string
): {
  id: string;
  practice_id: string;
  opportunity_type: typeof RECALL_OPPORTUNITY_TYPE;
  completed: false;
} {
  return {
    id: opportunityId,
    practice_id: practiceId,
    opportunity_type: RECALL_OPPORTUNITY_TYPE,
    completed: false,
  };
}

export function storedRecallRecommendation(
  recommendedAction: string | null | undefined,
  reason: string | null | undefined
): { text: string; source: "recommended_action" | "reason" | "none" } {
  const recommended = recommendedAction?.trim();
  if (recommended) {
    return { text: recommended, source: "recommended_action" };
  }

  const storedReason = reason?.trim();
  if (storedReason) {
    return { text: storedReason, source: "reason" };
  }

  return { text: "No stored recommendation.", source: "none" };
}
