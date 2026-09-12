import type { Json, Tables } from "../database.types.ts";

export const APPOINTMENT_SOURCES = ["demo", "opendental"] as const;
export type AppointmentSourceMode = (typeof APPOINTMENT_SOURCES)[number];

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const CONFIRMATION_STATUSES = [
  "unconfirmed",
  "pending",
  "confirmed",
  "reschedule_requested",
  "cancelled",
] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];

export const RESCHEDULE_STATUSES = [
  "none",
  "offered",
  "selected",
  "completed",
] as const;
export type RescheduleStatus = (typeof RESCHEDULE_STATUSES)[number];

export const APPOINTMENT_EVENT_TYPES = [
  "created",
  "confirmed",
  "reschedule_requested",
  "slots_offered",
  "rescheduled",
  "cancelled",
  "cancellation_recovery",
  "completed",
  "sms_sent",
  "sms_received",
  "opted_out",
] as const;
export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number];

export const SMS_DIRECTIONS = ["outbound", "inbound"] as const;
export type SmsDirection = (typeof SMS_DIRECTIONS)[number];

export const SMS_MESSAGE_TYPES = [
  "confirmation",
  "reminder",
  "reschedule_offer",
  "reschedule_confirmed",
  "cancellation",
  "cancellation_recovery",
  "recall_outreach",
  "treatment_outreach",
  "opt_out_ack",
  "unknown_reply",
] as const;
export type SmsMessageType = (typeof SMS_MESSAGE_TYPES)[number];

export const SMS_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "received",
] as const;
export type SmsStatus = (typeof SMS_STATUSES)[number];

export const CONVERSATION_STATES = [
  "idle",
  "awaiting_confirmation",
  "awaiting_slot_choice",
  "closed",
  "opted_out",
] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const SCHEDULING_JOB_TYPES = [
  "confirmation",
  "reminder",
  "reschedule_follow_up",
  "cancellation_recovery",
  "recall_outreach",
  "treatment_outreach",
] as const;
export type SchedulingJobType = (typeof SCHEDULING_JOB_TYPES)[number];

export const SCHEDULING_JOB_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "skipped",
] as const;
export type SchedulingJobStatus = (typeof SCHEDULING_JOB_STATUSES)[number];

export type AppointmentRow = Tables<"appointments">;
export type AppointmentEventRow = Tables<"appointment_events">;
export type SmsConversationRow = Tables<"sms_conversations">;
export type SmsMessageRow = Tables<"sms_messages">;
export type SchedulingJobRow = Tables<"scheduling_jobs">;
export type OpportunityRow = Tables<"revenue_opportunities">;

export type OfferedSlot = {
  index: number;
  start: string;
  end: string;
  label: string;
};

export type PatientContact = {
  id: string;
  practice_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

export type PracticeContact = {
  id: string;
  name: string;
  timezone: string;
};

export type LinkedOpportunity = Pick<
  OpportunityRow,
  | "id"
  | "practice_id"
  | "opportunity_type"
  | "reason"
  | "estimated_value"
  | "workflow_status"
  | "contact_outcome"
  | "completed"
  | "claim_id"
  | "patient_id"
>;

export type SchedulingLifecycleStage =
  | "opportunity"
  | "outreach"
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled";

export function isAppointmentSourceMode(
  value: unknown
): value is AppointmentSourceMode {
  return (
    typeof value === "string" &&
    (APPOINTMENT_SOURCES as readonly string[]).includes(value)
  );
}

export function parseOfferedSlots(value: Json | null | undefined): OfferedSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const index = Number(item.index);
    const start = item.start;
    const end = item.end;
    const label = item.label;

    if (
      !Number.isInteger(index) ||
      typeof start !== "string" ||
      typeof end !== "string" ||
      typeof label !== "string"
    ) {
      return [];
    }

    return [{ index, start, end, label }];
  });
}

export function offeredSlotsAsJson(slots: OfferedSlot[]): Json {
  return slots.map((slot) => ({
    index: slot.index,
    start: slot.start,
    end: slot.end,
    label: slot.label,
  }));
}

export function demoSmsAddress(patientId: string): string {
  return `demo:patient:${patientId}`;
}

export function isDemoSmsAddress(value: string): boolean {
  return value.startsWith("demo:");
}

export function jobDedupeKey(
  jobType: SchedulingJobType,
  subjectId: string
): string {
  return `${jobType}:${subjectId}`;
}

export function assertSamePractice(
  rowPracticeId: string,
  practiceId: string
): void {
  if (rowPracticeId !== practiceId) {
    throw new Error("Practice mismatch.");
  }
}
