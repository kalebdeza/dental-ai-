import type { OfferedSlot } from "./types.ts";

export type ConfirmationMessageInput = {
  firstName: string;
  practiceName: string;
  start: Date;
  timeZone: string;
};

function weekdayDate(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(start);
}

function clockTime(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
}

export function formatAppointmentWhen(
  start: Date,
  timeZone: string
): { date: string; time: string } {
  return {
    date: weekdayDate(start, timeZone),
    time: clockTime(start, timeZone),
  };
}

export function firstNameForSms(firstName: string | null | undefined): string {
  const trimmed = firstName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "there";
}

export function confirmationMessage(input: ConfirmationMessageInput): string {
  const { date, time } = formatAppointmentWhen(input.start, input.timeZone);
  return `Hi ${firstNameForSms(input.firstName)}, this is ${input.practiceName}. You have an appointment on ${date} at ${time}. Reply CONFIRM to confirm or RESCHEDULE if you need another time.`;
}

export function reminderMessage(input: ConfirmationMessageInput): string {
  const { date, time } = formatAppointmentWhen(input.start, input.timeZone);
  return `Hi ${firstNameForSms(input.firstName)}, reminder from ${input.practiceName}: your appointment is ${date} at ${time}. Reply CONFIRM or RESCHEDULE.`;
}

export function rescheduleOfferMessage(slots: OfferedSlot[]): string {
  const options = slots
    .map((slot) => `Reply ${slot.index} for ${slot.label}`)
    .join(" or ");
  return `Sure. We have ${slots.map((slot) => slot.label).join(" or ")} available. ${options}.`;
}

export function slotConfirmedMessage(input: ConfirmationMessageInput): string {
  const { date, time } = formatAppointmentWhen(input.start, input.timeZone);
  return `You're all set. We reserved ${date} at ${time} with ${input.practiceName}. Reply STOP to opt out.`;
}

export function confirmedAckMessage(input: ConfirmationMessageInput): string {
  const { date, time } = formatAppointmentWhen(input.start, input.timeZone);
  return `Thanks, ${firstNameForSms(input.firstName)}. Your ${date} ${time} visit is confirmed.`;
}

export function cancelledAckMessage(firstName: string): string {
  return `We have noted the cancellation for ${firstNameForSms(firstName)}. The office will follow up if another visit is needed.`;
}

export function recoveryOfferMessage(
  firstName: string,
  practiceName: string,
  slots: OfferedSlot[]
): string {
  const options = slots
    .map((slot) => `Reply ${slot.index} for ${slot.label}`)
    .join(" or ");
  return `Hi ${firstNameForSms(firstName)}, this is ${practiceName}. We can get you back on the schedule: ${slots.map((slot) => slot.label).join(" or ")}. ${options}.`;
}

export function outreachOfferMessage(
  firstName: string,
  practiceName: string,
  kind: "recall" | "treatment",
  slots: OfferedSlot[]
): string {
  const reason =
    kind === "recall" ? "a recall visit" : "recommended treatment";
  const options = slots
    .map((slot) => `Reply ${slot.index} for ${slot.label}`)
    .join(" or ");
  return `Hi ${firstNameForSms(firstName)}, this is ${practiceName}. We have time for ${reason}: ${slots.map((slot) => slot.label).join(" or ")}. ${options}.`;
}

export function optOutAckMessage(): string {
  return "You are unsubscribed from appointment texts from this practice. No more messages will be sent.";
}

export function unknownReplyMessage(): string {
  return "Reply CONFIRM, RESCHEDULE, CANCEL, or STOP.";
}
