import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOpenDentalAppointmentSource } from "./appointments/openDentalSource.ts";
import { OpenDentalWritesDisabledError } from "./appointments/source.ts";
import { seedDemoSchedule } from "./demoSeed.ts";
import { processDueSchedulingJobs } from "./jobs.ts";
import { createDemoSmsProvider } from "./sms/demoProvider.ts";
import { createMemorySchedulingStore } from "./store.ts";
import type { AppointmentRow, LinkedOpportunity } from "./types.ts";
import {
  handleInboundSms,
  queueConfirmationJob,
  sendConfirmationForAppointment,
  sendDemoSms,
  type WorkflowContext,
} from "./workflow.ts";

const PRACTICE = "practice-1";
const OTHER = "practice-2";
const PATIENT = "patient-1";
const INTEGRATION = "integration-1";
const OPPORTUNITY = "opportunity-1";

function appointment(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: "appt-1",
    practice_id: PRACTICE,
    integration_id: INTEGRATION,
    patient_id: PATIENT,
    provider_id: null,
    provider_name: "Demo Provider",
    source_appointment_id: "demo-1",
    source: "demo",
    appointment_type: "Hygiene recall",
    operatory: null,
    start_time: "2026-09-15T17:00:00.000Z",
    end_time: "2026-09-15T18:00:00.000Z",
    status: "scheduled",
    confirmation_status: "unconfirmed",
    reschedule_status: "none",
    cancelled_at: null,
    cancellation_reason: null,
    opportunity_id: OPPORTUNITY,
    offered_slots: null,
    notes: null,
    last_synced_at: null,
    created_at: "2026-09-11T00:00:00.000Z",
    updated_at: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

function opportunity(
  overrides: Partial<LinkedOpportunity> = {}
): LinkedOpportunity {
  return {
    id: OPPORTUNITY,
    practice_id: PRACTICE,
    opportunity_type: "Recall",
    reason: "Due for hygiene",
    estimated_value: 180,
    workflow_status: "open",
    contact_outcome: null,
    completed: false,
    claim_id: null,
    patient_id: PATIENT,
    ...overrides,
  };
}

function context(store: ReturnType<typeof createMemorySchedulingStore>): {
  ctx: WorkflowContext;
  sms: ReturnType<typeof createDemoSmsProvider>;
  scheduled: string[];
} {
  const sms = createDemoSmsProvider();
  const scheduled: string[] = [];
  return {
    sms,
    scheduled,
    ctx: {
      store,
      sms,
      actor: "patient",
      now: new Date("2026-09-12T12:00:00.000Z"),
      onOpportunityScheduled: async (id) => {
        scheduled.push(id);
      },
    },
  };
}

function seededStore(row: AppointmentRow = appointment()) {
  return createMemorySchedulingStore({
    practices: [{ id: PRACTICE, name: "Riverside Dental", timezone: "UTC" }],
    patients: [
      {
        id: PATIENT,
        practice_id: PRACTICE,
        first_name: "Ada",
        last_name: "Lovelace",
        preferred_name: null,
      },
    ],
    integrations: [{ id: INTEGRATION, practice_id: PRACTICE }],
    appointments: [row],
    opportunities: [opportunity()],
  });
}

describe("scheduling workflow", () => {
  it("confirms an appointment from CONFIRM and links the opportunity", async () => {
    const store = seededStore();
    const { ctx, scheduled } = context(store);

    const result = await handleInboundSms(ctx, {
      practiceId: PRACTICE,
      appointmentId: "appt-1",
      body: "CONFIRM",
    });

    assert.equal(result.intent.kind, "confirm");
    const updated = await store.getAppointment(PRACTICE, "appt-1");
    assert.equal(updated?.confirmation_status, "confirmed");
    assert.equal(scheduled[0], OPPORTUNITY);
    assert.equal(
      store.tables.events.some((event) => event.event_type === "confirmed"),
      true
    );
    assert.equal(
      store.tables.messages.some((message) => message.direction === "inbound"),
      true
    );
  });

  it("offers slots for RESCHEDULE and reserves a selected demo slot", async () => {
    const store = seededStore();
    const { ctx } = context(store);

    const offered = await handleInboundSms(ctx, {
      practiceId: PRACTICE,
      appointmentId: "appt-1",
      body: "RESCHEDULE",
    });
    assert.equal(offered.intent.kind, "reschedule");
    const pending = await store.getAppointment(PRACTICE, "appt-1");
    assert.equal(pending?.reschedule_status, "offered");
    assert.ok(pending?.offered_slots);

    const selected = await handleInboundSms(ctx, {
      practiceId: PRACTICE,
      appointmentId: "appt-1",
      body: "1",
    });
    assert.equal(selected.intent.kind, "slot");
    const updated = await store.getAppointment(PRACTICE, "appt-1");
    assert.equal(updated?.reschedule_status, "completed");
    assert.equal(updated?.confirmation_status, "confirmed");
    assert.notEqual(updated?.start_time, appointment().start_time);
  });

  it("records cancellation without deleting the appointment", async () => {
    const store = seededStore();
    const { ctx } = context(store);

    await handleInboundSms(ctx, {
      practiceId: PRACTICE,
      appointmentId: "appt-1",
      body: "CANCEL",
    });

    const updated = await store.getAppointment(PRACTICE, "appt-1");
    assert.ok(updated);
    assert.equal(updated.status, "cancelled");
    assert.equal(updated.confirmation_status, "cancelled");
    assert.ok(updated.cancelled_at);
    assert.equal(
      store.tables.jobs.some((job) => job.job_type === "cancellation_recovery"),
      true
    );
  });

  it("opts the conversation out on STOP and blocks later demo SMS", async () => {
    const store = seededStore();
    const { ctx, sms } = context(store);

    await handleInboundSms(ctx, {
      practiceId: PRACTICE,
      appointmentId: "appt-1",
      body: "STOP",
    });

    const outboundBefore = sms.logs.length;
    const result = await sendConfirmationForAppointment(ctx, PRACTICE, "appt-1");
    assert.equal(result.skipped, "opted_out");
    assert.equal(sms.logs.length, outboundBefore);
  });

  it("does not send a duplicate confirmation message", async () => {
    const store = seededStore();
    const { ctx, sms } = context(store);

    const first = await sendDemoSms(ctx, {
      practiceId: PRACTICE,
      patientId: PATIENT,
      appointmentId: "appt-1",
      messageType: "confirmation",
      body: "first",
    });
    const second = await sendDemoSms(ctx, {
      practiceId: PRACTICE,
      patientId: PATIENT,
      appointmentId: "appt-1",
      messageType: "confirmation",
      body: "second",
    });

    assert.equal(first.sent, true);
    assert.equal(second.skipped, "duplicate");
    assert.equal(sms.logs.length, 1);
  });

  it("does not enqueue a second pending confirmation job", async () => {
    const store = seededStore();
    const first = await queueConfirmationJob(store, appointment());
    const second = await queueConfirmationJob(store, appointment());
    assert.equal(first?.id, second?.id);
    assert.equal(store.tables.jobs.length, 1);
  });

  it("seeds demo appointments without an Open Dental integration", async () => {
    const store = createMemorySchedulingStore({
      practices: [{ id: PRACTICE, name: "Riverside Dental", timezone: "UTC" }],
      patients: [
        {
          id: PATIENT,
          practice_id: PRACTICE,
          first_name: "Ada",
          last_name: "Lovelace",
          preferred_name: null,
        },
      ],
      integrations: [],
      appointments: [],
      opportunities: [opportunity()],
    });

    const result = await seedDemoSchedule(store, PRACTICE);
    assert.equal(result.created.length, 4);
    assert.equal(
      result.created.every((row) => row.source === "demo"),
      true
    );
    assert.equal(
      result.created.every((row) => row.integration_id == null),
      true
    );
  });

  it("isolates appointments by practice", async () => {
    const store = seededStore();
    assert.equal(await store.getAppointment(OTHER, "appt-1"), null);
    assert.deepEqual(await store.listAppointments(OTHER), []);
    assert.equal(await store.getOpportunity(OTHER, OPPORTUNITY), null);
  });

  it("skips a claimed confirmation job when a duplicate SMS already exists", async () => {
    const store = seededStore();
    const { ctx } = context(store);
    await sendConfirmationForAppointment(ctx, PRACTICE, "appt-1");
    await queueConfirmationJob(store, appointment());

    const summary = await processDueSchedulingJobs(ctx, { practiceId: PRACTICE });
    assert.equal(summary.claimed, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(
      store.tables.jobs.filter((job) => job.status === "skipped").length,
      1
    );
  });
});

describe("Open Dental appointment adapter", () => {
  it("refuses write methods", async () => {
    const store = seededStore(
      appointment({ source: "opendental", source_appointment_id: "od-1" })
    );
    const source = createOpenDentalAppointmentSource(store);

    await assert.rejects(
      () =>
        source.createAppointment({
          practiceId: PRACTICE,
          patientId: PATIENT,
          integrationId: INTEGRATION,
          start: "2026-09-16T17:00:00.000Z",
          end: "2026-09-16T18:00:00.000Z",
        }),
      OpenDentalWritesDisabledError
    );
    await assert.rejects(
      () => source.updateAppointment(PRACTICE, "appt-1", { notes: "nope" }),
      OpenDentalWritesDisabledError
    );
    await assert.rejects(
      () => source.cancelAppointment(PRACTICE, "appt-1"),
      OpenDentalWritesDisabledError
    );
  });
});
