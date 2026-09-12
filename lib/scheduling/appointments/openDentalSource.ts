import type { SchedulingStore } from "../store.ts";
import type { AppointmentSource } from "./source.ts";
import {
  OpenDentalSchedulingNotEnabledError,
  OpenDentalWritesDisabledError,
} from "./source.ts";

/**
 * Read-only Open Dental appointment adapter.
 *
 * Reads local Dental AI rows that were previously synced. Does not call
 * the Open Dental API. Write methods throw so a live office cannot be
 * mutated from this MVP.
 */
export function createOpenDentalAppointmentSource(
  store: SchedulingStore
): AppointmentSource {
  return {
    mode: "opendental",

    async getAppointments(practiceId) {
      const rows = await store.listAppointments(practiceId);
      return rows.filter((row) => row.source === "opendental");
    },

    getAppointment(practiceId, appointmentId) {
      return store.getAppointment(practiceId, appointmentId);
    },

    async getAvailableSlots() {
      throw new OpenDentalSchedulingNotEnabledError("getAvailableSlots");
    },

    async createAppointment() {
      throw new OpenDentalWritesDisabledError("createAppointment");
    },

    async updateAppointment() {
      throw new OpenDentalWritesDisabledError("updateAppointment");
    },

    async cancelAppointment() {
      throw new OpenDentalWritesDisabledError("cancelAppointment");
    },
  };
}
