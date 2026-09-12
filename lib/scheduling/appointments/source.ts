import type { AppointmentRow, AppointmentSourceMode, OfferedSlot } from "../types.ts";

export class OpenDentalWritesDisabledError extends Error {
  constructor(method: string) {
    super(
      `Open Dental appointment ${method} is disabled. Dental AI does not write appointments to a live office yet.`
    );
    this.name = "OpenDentalWritesDisabledError";
  }
}

export class OpenDentalSchedulingNotEnabledError extends Error {
  constructor(method: string) {
    super(
      `Open Dental appointment ${method} is not enabled. Local demo schedule is used until live office testing is turned on.`
    );
    this.name = "OpenDentalSchedulingNotEnabledError";
  }
}

export type AppointmentWriteInput = {
  practiceId: string;
  patientId: string;
  integrationId?: string | null;
  start: string;
  end: string;
  appointmentType?: string | null;
  providerName?: string | null;
  opportunityId?: string | null;
  notes?: string | null;
};

export type AppointmentSource = {
  readonly mode: AppointmentSourceMode;
  getAppointments(practiceId: string): Promise<AppointmentRow[]>;
  getAppointment(
    practiceId: string,
    appointmentId: string
  ): Promise<AppointmentRow | null>;
  getAvailableSlots(practiceId: string, count?: number): Promise<OfferedSlot[]>;
  createAppointment(input: AppointmentWriteInput): Promise<AppointmentRow>;
  updateAppointment(
    practiceId: string,
    appointmentId: string,
    patch: Partial<
      Pick<
        AppointmentRow,
        | "start_time"
        | "end_time"
        | "status"
        | "confirmation_status"
        | "reschedule_status"
        | "notes"
        | "offered_slots"
        | "cancelled_at"
        | "cancellation_reason"
        | "opportunity_id"
        | "provider_name"
        | "appointment_type"
      >
    >
  ): Promise<AppointmentRow>;
  cancelAppointment(
    practiceId: string,
    appointmentId: string,
    reason?: string | null
  ): Promise<AppointmentRow>;
};
