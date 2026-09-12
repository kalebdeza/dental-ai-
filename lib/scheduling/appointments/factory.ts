import { createDemoAppointmentSource } from "./demoSource.ts";
import { createOpenDentalAppointmentSource } from "./openDentalSource.ts";
import type { AppointmentSourceMode } from "../types.ts";
import type { SchedulingStore } from "../store.ts";
import type { AppointmentSource as AppointmentSourceAdapter } from "./source.ts";

export function createAppointmentSource(options: {
  mode: AppointmentSourceMode;
  store: SchedulingStore;
  timeZone: string;
}): AppointmentSourceAdapter {
  if (options.mode === "opendental") {
    return createOpenDentalAppointmentSource(options.store);
  }

  return createDemoAppointmentSource(options.store, options.timeZone);
}

export function sourceModeForAppointment(
  source: string | null | undefined
): AppointmentSourceMode {
  return source === "opendental" ? "opendental" : "demo";
}
