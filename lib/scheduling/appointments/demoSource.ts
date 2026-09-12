import type { SchedulingStore } from "../store.ts";
import { nextDemoSlots } from "../slots.ts";
import type { AppointmentRow } from "../types.ts";
import type {
  AppointmentSource,
  AppointmentWriteInput,
} from "./source.ts";

export function createDemoAppointmentSource(
  store: SchedulingStore,
  timeZone: string
): AppointmentSource {
  return {
    mode: "demo",

    getAppointments(practiceId) {
      return store.listAppointments(practiceId);
    },

    getAppointment(practiceId, appointmentId) {
      return store.getAppointment(practiceId, appointmentId);
    },

    async getAvailableSlots(practiceId, count = 2) {
      const appointments = await store.listAppointments(practiceId);
      const busy = appointments
        .filter((row) => row.status !== "cancelled")
        .map((row) => ({ start: row.start_time, end: row.end_time }));
      return nextDemoSlots(busy, count, new Date(), timeZone);
    },

    async createAppointment(input: AppointmentWriteInput) {
      return store.insertAppointment({
        practice_id: input.practiceId,
        integration_id: input.integrationId ?? null,
        patient_id: input.patientId,
        source_appointment_id: `demo-${crypto.randomUUID()}`,
        source: "demo",
        start_time: input.start,
        end_time: input.end,
        status: "scheduled",
        confirmation_status: "unconfirmed",
        reschedule_status: "none",
        appointment_type: input.appointmentType ?? "Demo visit",
        provider_name: input.providerName ?? "Demo Provider",
        opportunity_id: input.opportunityId ?? null,
        notes: input.notes ?? null,
      });
    },

    async updateAppointment(practiceId, appointmentId, patch) {
      const updated = await store.updateAppointment(practiceId, appointmentId, {
        ...patch,
        updated_at: new Date().toISOString(),
      });

      if (!updated) {
        throw new Error("Appointment not found.");
      }

      return updated;
    },

    async cancelAppointment(practiceId, appointmentId, reason) {
      const updated = await store.updateAppointment(practiceId, appointmentId, {
        status: "cancelled",
        confirmation_status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason ?? "patient_request",
        updated_at: new Date().toISOString(),
      });

      if (!updated) {
        throw new Error("Appointment not found.");
      }

      return updated;
    },
  };
}

export function isDemoAppointment(row: Pick<AppointmentRow, "source">): boolean {
  return row.source === "demo";
}
