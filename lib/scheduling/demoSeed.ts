import { createDemoAppointmentSource } from "./appointments/demoSource.ts";
import { enqueueSchedulingJob, type SchedulingStore } from "./store.ts";
import type { AppointmentRow, LinkedOpportunity } from "./types.ts";

const DEMO_TYPES = [
  "Hygiene recall",
  "Treatment consult",
  "Crown seat",
  "New patient exam",
] as const;

export type DemoSeedResult = {
  created: AppointmentRow[];
  reused: AppointmentRow[];
  message: string;
};

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function nextWeekday(from: Date, daysAhead: number): Date {
  const date = new Date(from.getTime());
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(17, 0, 0, 0);
  const day = date.getUTCDay();
  if (day === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  if (day === 6) {
    date.setUTCDate(date.getUTCDate() + 2);
  }
  return date;
}

export async function seedDemoSchedule(
  store: SchedulingStore,
  practiceId: string
): Promise<DemoSeedResult> {
  const practice = await store.getPractice(practiceId);
  if (!practice) {
    throw new Error("Practice not found.");
  }

  const patients = await store.listPatients(practiceId);
  if (patients.length === 0) {
    throw new Error(
      "Demo schedule needs at least one existing patient. No patients were created."
    );
  }

  const existing = (await store.listAppointments(practiceId)).filter(
    (row) => row.source === "demo"
  );

  if (existing.length >= 4) {
    return {
      created: [],
      reused: existing,
      message: "Demo appointments already exist for this practice.",
    };
  }

  const recalls = await store.listOpenOpportunities(practiceId, "Recall");
  const treatments = await store.listOpenOpportunities(practiceId, "Treatment");
  const demo = createDemoAppointmentSource(store, practice.timezone);
  const created: AppointmentRow[] = [];
  const now = new Date();

  for (let index = existing.length; index < 4; index += 1) {
    const patient = patients[index % patients.length];
    const start = nextWeekday(now, index + 1);
    const opportunity =
      index === 0
        ? recalls.find((row) => row.patient_id === patient.id) ?? recalls[0]
        : index === 1
          ? treatments.find((row) => row.patient_id === patient.id) ??
            treatments[0]
          : undefined;

    const appointment = await demo.createAppointment({
      practiceId,
      patientId: patient.id,
      start: start.toISOString(),
      end: addHours(start, 1).toISOString(),
      appointmentType: DEMO_TYPES[index] ?? "Demo visit",
      providerName: "Demo Provider",
      opportunityId: opportunity?.id ?? null,
      notes: "Demo appointment. Not written to Open Dental.",
    });

    await store.insertEvent({
      practiceId,
      appointmentId: appointment.id,
      eventType: "created",
      newState: "scheduled",
      source: "demo",
      metadata: {
        opportunityId: opportunity?.id ?? null,
        opportunityType: opportunity?.opportunity_type ?? null,
      },
    });

    await enqueueSchedulingJob(store, {
      practiceId,
      jobType: "confirmation",
      subjectId: appointment.id,
      appointmentId: appointment.id,
      opportunityId: appointment.opportunity_id,
      patientId: appointment.patient_id,
    });

    created.push(appointment);
  }

  return {
    created,
    reused: existing,
    message: `Created ${created.length} demo appointment${created.length === 1 ? "" : "s"}. No Open Dental writes and no real SMS were sent.`,
  };
}

export function opportunityForSeedLink(
  opportunities: LinkedOpportunity[],
  patientId: string
): LinkedOpportunity | undefined {
  return (
    opportunities.find((row) => row.patient_id === patientId) ?? opportunities[0]
  );
}
