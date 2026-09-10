import type { Tables } from "../database.types.ts";
import {
  formatWorkflowStatusLabel,
  isOfficeWorkflowTerminal,
  readStoredWorkflowStatus,
} from "./opportunityWorkflow.ts";

export type TreatmentPatientContact = Pick<
  Tables<"patients">,
  | "id"
  | "first_name"
  | "last_name"
  | "mobile_phone"
  | "home_phone"
  | "work_phone"
  | "next_visit"
>;

export type TreatmentProcedureRow = Pick<
  Tables<"procedures">,
  | "id"
  | "fee"
  | "status"
  | "tooth"
  | "surface"
  | "procedure_code_id"
  | "completed_at"
>;

export type TreatmentProcedureCodeRow = Pick<
  Tables<"procedure_codes">,
  "id" | "code" | "description"
>;

export type TreatmentOpportunityRow = Pick<
  Tables<"revenue_opportunities">,
  | "id"
  | "patient_id"
  | "procedure_id"
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

export type TreatmentOpportunityApiItem = {
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
  nextVisit: string | null;
  procedureId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  procedureFee: number | null;
  procedureStatus: string | null;
  tooth: string | null;
  surface: string | null;
};

export type TreatmentActionId =
  | "call"
  | "schedule"
  | "mark_contacted"
  | "add_note"
  | "snooze"
  | "complete"
  | "dismiss";

export type TreatmentWorkflowAction = {
  id: TreatmentActionId;
  label: string;
  emphasis: "primary" | "secondary" | "destructive";
  available: boolean;
  unavailableReason?: string;
};

export type TreatmentContactOutcomeId =
  | "scheduled"
  | "will_call_back"
  | "no_answer"
  | "left_voicemail"
  | "declined"
  | "wrong_number";

export type TreatmentContactOutcome = {
  id: TreatmentContactOutcomeId;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

export const TREATMENT_OPPORTUNITY_TYPE = "Treatment" as const;

export const DESIRED_TREATMENT_STEPS = [
  "Open",
  "Contacted",
  "Scheduled",
  "Completed",
] as const;

export const DESIRED_TREATMENT_TERMINAL = "Dismissed";

export const SCHEDULE_IN_PMS_GUIDANCE =
  "The app doesn't currently create appointments. Schedule this treatment in your PMS, then record the Scheduled contact outcome here.";

const CALL_NO_PHONE =
  "No patient phone is stored (mobile, home, or work).";

const TERMINAL_UNAVAILABLE =
  "This treatment opportunity is already completed or dismissed.";

export const TREATMENT_CONTACT_OUTCOMES: Array<
  Omit<TreatmentContactOutcome, "available" | "unavailableReason">
> = [
  { id: "scheduled", label: "Scheduled" },
  { id: "will_call_back", label: "Will call back" },
  { id: "no_answer", label: "No answer" },
  { id: "left_voicemail", label: "Left voicemail" },
  { id: "declined", label: "Declined" },
  { id: "wrong_number", label: "Wrong number" },
];

function action(
  id: TreatmentActionId,
  label: string,
  emphasis: TreatmentWorkflowAction["emphasis"],
  available = true,
  unavailableReason?: string
): TreatmentWorkflowAction {
  return { id, label, emphasis, available, unavailableReason };
}

export function formatTreatmentPatientName(
  patient: Pick<TreatmentPatientContact, "first_name" | "last_name"> | null
): string {
  if (!patient) {
    return "Unknown Patient";
  }

  const name = `${patient.first_name} ${patient.last_name}`.trim();
  return name.length > 0 ? name : "Unknown Patient";
}

export function pickPatientPhone(
  patient: Pick<
    TreatmentPatientContact,
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

export function formatTreatmentDate(
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

export function formatProcedureLabel(
  code: string | null | undefined,
  description: string | null | undefined
): string {
  const storedCode = code?.trim() || null;
  const storedDescription = description?.trim() || null;

  if (storedCode && storedDescription) {
    return `${storedCode} — ${storedDescription}`;
  }

  return storedCode ?? storedDescription ?? "Not available";
}

export function getPersistedTreatmentStatus(
  opportunity: Pick<TreatmentOpportunityRow, "workflow_status" | "completed">
): ReturnType<typeof formatWorkflowStatusLabel> {
  return formatWorkflowStatusLabel(readStoredWorkflowStatus(opportunity));
}

export function getTreatmentContactOutcomes(input: {
  workflowStatus: string;
  completed: boolean;
}): TreatmentContactOutcome[] {
  const status = readStoredWorkflowStatus({
    workflow_status: input.workflowStatus,
    completed: input.completed,
  });
  const available = !isOfficeWorkflowTerminal(status);

  return TREATMENT_CONTACT_OUTCOMES.map((outcome) => ({
    ...outcome,
    available,
    unavailableReason: available ? undefined : TERMINAL_UNAVAILABLE,
  }));
}

export function mapTreatmentOpportunity(
  opportunity: TreatmentOpportunityRow,
  patient: TreatmentPatientContact | null,
  procedure: TreatmentProcedureRow | null,
  procedureCode: TreatmentProcedureCodeRow | null
): TreatmentOpportunityApiItem {
  return {
    id: opportunity.id,
    patient: formatTreatmentPatientName(patient),
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
    phone: pickPatientPhone(patient),
    nextVisit: patient?.next_visit ?? null,
    procedureId: opportunity.procedure_id,
    procedureCode: procedureCode?.code?.trim() || null,
    procedureDescription: procedureCode?.description?.trim() || null,
    procedureFee: procedure ? Number(procedure.fee) : null,
    procedureStatus: procedure?.status?.trim() || null,
    tooth: procedure?.tooth?.trim() || null,
    surface: procedure?.surface?.trim() || null,
  };
}

export function getTreatmentWorkflowActions(input: {
  phone: string | null;
  workflowStatus: string;
  completed: boolean;
}): TreatmentWorkflowAction[] {
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
    action("add_note", "Add Note", "secondary", true),
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

export function parseTreatmentDismissId(body: unknown): string | null {
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

export function treatmentDismissEquality(
  opportunityId: string,
  practiceId: string
): {
  id: string;
  practice_id: string;
  opportunity_type: typeof TREATMENT_OPPORTUNITY_TYPE;
  completed: false;
} {
  return {
    id: opportunityId,
    practice_id: practiceId,
    opportunity_type: TREATMENT_OPPORTUNITY_TYPE,
    completed: false,
  };
}

export function storedTreatmentRecommendation(
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
