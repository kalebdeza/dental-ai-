import { createDemoAppointmentSource } from "./appointments/demoSource.ts";
import { OpenDentalWritesDisabledError } from "./appointments/source.ts";
import { parseInboundSms, type SmsIntent } from "./intents.ts";
import {
  cancelledAckMessage,
  confirmationMessage,
  confirmedAckMessage,
  optOutAckMessage,
  outreachOfferMessage,
  recoveryOfferMessage,
  reminderMessage,
  rescheduleOfferMessage,
  slotConfirmedMessage,
  unknownReplyMessage,
} from "./messages.ts";
import { slotByIndex } from "./slots.ts";
import type { SmsProvider } from "./sms/provider.ts";
import { demoDestinationForPatient } from "./sms/demoProvider.ts";
import { enqueueSchedulingJob, type SchedulingStore } from "./store.ts";
import {
  offeredSlotsAsJson,
  parseOfferedSlots,
  type AppointmentRow,
  type OfferedSlot,
  type SmsMessageType,
} from "./types.ts";

const DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000;

export type WorkflowActor = "office" | "patient" | "system" | "demo";

export type WorkflowContext = {
  store: SchedulingStore;
  sms: SmsProvider;
  now?: Date;
  actor?: WorkflowActor;
  onOpportunityScheduled?: (opportunityId: string) => Promise<void>;
};

export type InboundResult = {
  intent: SmsIntent;
  appointmentId: string | null;
  skipped?: string;
  reply?: string;
};

function nowOf(ctx: WorkflowContext): Date {
  return ctx.now ?? new Date();
}

function sourceOf(ctx: WorkflowContext): string {
  return ctx.actor ?? "system";
}

async function loadPracticeOrThrow(
  store: SchedulingStore,
  practiceId: string
) {
  const practice = await store.getPractice(practiceId);
  if (!practice) {
    throw new Error("Practice not found.");
  }
  return practice;
}

async function loadPatientOrThrow(
  store: SchedulingStore,
  practiceId: string,
  patientId: string
) {
  const patient = await store.getPatient(practiceId, patientId);
  if (!patient) {
    throw new Error("Patient not found.");
  }
  return patient;
}

export async function ensureConversation(
  store: SchedulingStore,
  input: {
    practiceId: string;
    patientId: string;
    appointmentId?: string | null;
  }
) {
  return store.upsertConversation({
    practice_id: input.practiceId,
    patient_id: input.patientId,
    appointment_id: input.appointmentId ?? null,
  });
}

export async function sendDemoSms(
  ctx: WorkflowContext,
  input: {
    practiceId: string;
    patientId: string;
    appointmentId?: string | null;
    messageType: SmsMessageType;
    body: string;
    conversationState?: string;
  }
): Promise<{ sent: boolean; skipped?: string }> {
  const conversation = await ensureConversation(ctx.store, input);

  if (conversation.opted_out || conversation.state === "opted_out") {
    return { sent: false, skipped: "opted_out" };
  }

  const since = new Date(
    nowOf(ctx).getTime() - DUPLICATE_WINDOW_MS
  ).toISOString();
  const duplicate = await ctx.store.recentOutbound({
    practiceId: input.practiceId,
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    messageType: input.messageType,
    sinceIso: since,
  });

  if (duplicate) {
    return { sent: false, skipped: "duplicate" };
  }

  const result = await ctx.sms.send({
    to: demoDestinationForPatient(input.patientId),
    body: input.body,
    practiceId: input.practiceId,
    patientId: input.patientId,
  });

  await ctx.store.insertMessage({
    practice_id: input.practiceId,
    patient_id: input.patientId,
    appointment_id: input.appointmentId ?? null,
    conversation_id: conversation.id,
    direction: "outbound",
    message_type: input.messageType,
    body: input.body,
    status: result.status,
    provider: result.provider,
    provider_message_id: result.providerMessageId,
    error: result.error ?? null,
    created_at: nowOf(ctx).toISOString(),
  });

  await ctx.store.updateConversation(input.practiceId, conversation.id, {
    last_outbound_at: nowOf(ctx).toISOString(),
    state: input.conversationState ?? conversation.state,
  });

  if (input.appointmentId) {
    await ctx.store.insertEvent({
      practiceId: input.practiceId,
      appointmentId: input.appointmentId,
      eventType: "sms_sent",
      source: sourceOf(ctx),
      newState: input.messageType,
      metadata: { providerMessageId: result.providerMessageId },
    });
  }

  return { sent: result.status === "sent" };
}

async function maybeScheduleOpportunity(
  ctx: WorkflowContext,
  practiceId: string,
  opportunityId: string | null | undefined
) {
  if (!opportunityId || !ctx.onOpportunityScheduled) {
    return;
  }

  const opportunity = await ctx.store.getOpportunity(practiceId, opportunityId);
  if (!opportunity) {
    return;
  }

  if (
    opportunity.opportunity_type !== "Recall" &&
    opportunity.opportunity_type !== "Treatment"
  ) {
    return;
  }

  await ctx.onOpportunityScheduled(opportunityId);
}

export async function confirmAppointment(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string
): Promise<AppointmentRow> {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const previous = appointment.confirmation_status;
  const updated = await ctx.store.updateAppointment(practiceId, appointmentId, {
    confirmation_status: "confirmed",
    status: appointment.status === "cancelled" ? appointment.status : "confirmed",
    updated_at: nowOf(ctx).toISOString(),
  });

  if (!updated) {
    throw new Error("Appointment not found.");
  }

  await ctx.store.insertEvent({
    practiceId,
    appointmentId,
    eventType: "confirmed",
    previousState: previous,
    newState: "confirmed",
    source: sourceOf(ctx),
  });

  const conversation = await ensureConversation(ctx.store, {
    practiceId,
    patientId: appointment.patient_id,
    appointmentId,
  });
  await ctx.store.updateConversation(practiceId, conversation.id, {
    state: "closed",
  });

  await maybeScheduleOpportunity(ctx, practiceId, appointment.opportunity_id);
  return updated;
}

export async function requestReschedule(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string
): Promise<{ appointment: AppointmentRow; slots: OfferedSlot[]; sent: boolean }> {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const demo = createDemoAppointmentSource(ctx.store, practice.timezone);
  const slots = await demo.getAvailableSlots(practiceId, 2);

  const updated = await ctx.store.updateAppointment(practiceId, appointmentId, {
    confirmation_status: "reschedule_requested",
    reschedule_status: "offered",
    offered_slots: offeredSlotsAsJson(slots),
    updated_at: nowOf(ctx).toISOString(),
  });

  if (!updated) {
    throw new Error("Appointment not found.");
  }

  await ctx.store.insertEvent({
    practiceId,
    appointmentId,
    eventType: "slots_offered",
    previousState: appointment.confirmation_status,
    newState: "reschedule_requested",
    source: sourceOf(ctx),
    metadata: { slots },
  });

  const outbound = await sendDemoSms(ctx, {
    practiceId,
    patientId: appointment.patient_id,
    appointmentId,
    messageType: "reschedule_offer",
    body: rescheduleOfferMessage(slots),
    conversationState: "awaiting_slot_choice",
  });

  return { appointment: updated, slots, sent: outbound.sent };
}

export async function applySlotSelection(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string,
  index: number
): Promise<{ appointment: AppointmentRow; reserved: boolean }> {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const slots = parseOfferedSlots(appointment.offered_slots);
  const selected = slotByIndex(slots, index);
  if (!selected) {
    throw new Error("That option is no longer available.");
  }

  if (appointment.source !== "demo") {
    await ctx.store.insertEvent({
      practiceId,
      appointmentId,
      eventType: "rescheduled",
      previousState: appointment.start_time,
      newState: selected.start,
      source: sourceOf(ctx),
      metadata: {
        selected,
        pmsWrite: "disabled",
      },
    });

    const updated = await ctx.store.updateAppointment(practiceId, appointmentId, {
      reschedule_status: "selected",
      confirmation_status: "reschedule_requested",
      updated_at: nowOf(ctx).toISOString(),
    });

    if (!updated) {
      throw new Error("Appointment not found.");
    }

    return { appointment: updated, reserved: false };
  }

  const updated = await ctx.store.updateAppointment(practiceId, appointmentId, {
    start_time: selected.start,
    end_time: selected.end,
    status: "scheduled",
    confirmation_status: "confirmed",
    reschedule_status: "completed",
    offered_slots: offeredSlotsAsJson(slots),
    updated_at: nowOf(ctx).toISOString(),
  });

  if (!updated) {
    throw new Error("Appointment not found.");
  }

  await ctx.store.insertEvent({
    practiceId,
    appointmentId,
    eventType: "rescheduled",
    previousState: appointment.start_time,
    newState: selected.start,
    source: sourceOf(ctx),
    metadata: { selected },
  });

  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const patient = await loadPatientOrThrow(
    ctx.store,
    practiceId,
    appointment.patient_id
  );

  await sendDemoSms(ctx, {
    practiceId,
    patientId: appointment.patient_id,
    appointmentId,
    messageType: "reschedule_confirmed",
    body: slotConfirmedMessage({
      firstName: patient.preferred_name || patient.first_name,
      practiceName: practice.name,
      start: new Date(selected.start),
      timeZone: practice.timezone,
    }),
    conversationState: "closed",
  });

  await maybeScheduleOpportunity(ctx, practiceId, appointment.opportunity_id);
  return { appointment: updated, reserved: true };
}

export async function cancelAppointmentWorkflow(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string,
  reason = "patient_request"
): Promise<AppointmentRow> {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  if (appointment.source !== "demo") {
    const updated = await ctx.store.updateAppointment(practiceId, appointmentId, {
      confirmation_status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: nowOf(ctx).toISOString(),
      updated_at: nowOf(ctx).toISOString(),
    });

    if (!updated) {
      throw new Error("Appointment not found.");
    }

    await ctx.store.insertEvent({
      practiceId,
      appointmentId,
      eventType: "cancelled",
      previousState: appointment.status,
      newState: "cancelled_local",
      source: sourceOf(ctx),
      metadata: { pmsWrite: "disabled", reason },
    });

    await enqueueSchedulingJob(ctx.store, {
      practiceId,
      jobType: "cancellation_recovery",
      subjectId: appointmentId,
      appointmentId,
      opportunityId: appointment.opportunity_id,
      patientId: appointment.patient_id,
    });

    return updated;
  }

  const demo = createDemoAppointmentSource(
    ctx.store,
    (await loadPracticeOrThrow(ctx.store, practiceId)).timezone
  );
  const updated = await demo.cancelAppointment(practiceId, appointmentId, reason);

  await ctx.store.insertEvent({
    practiceId,
    appointmentId,
    eventType: "cancelled",
    previousState: appointment.status,
    newState: "cancelled",
    source: sourceOf(ctx),
    metadata: { reason },
  });

  await enqueueSchedulingJob(ctx.store, {
    practiceId,
    jobType: "cancellation_recovery",
    subjectId: appointmentId,
    appointmentId,
    opportunityId: appointment.opportunity_id,
    patientId: appointment.patient_id,
  });

  return updated;
}

export async function sendConfirmationForAppointment(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string
): Promise<{ sent: boolean; skipped?: string }> {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const patient = await loadPatientOrThrow(
    ctx.store,
    practiceId,
    appointment.patient_id
  );

  const outbound = await sendDemoSms(ctx, {
    practiceId,
    patientId: appointment.patient_id,
    appointmentId,
    messageType: "confirmation",
    body: confirmationMessage({
      firstName: patient.preferred_name || patient.first_name,
      practiceName: practice.name,
      start: new Date(appointment.start_time),
      timeZone: practice.timezone,
    }),
    conversationState: "awaiting_confirmation",
  });

  if (outbound.sent) {
    await ctx.store.updateAppointment(practiceId, appointmentId, {
      confirmation_status: "pending",
      updated_at: nowOf(ctx).toISOString(),
    });
  }

  return outbound;
}

export async function sendReminderForAppointment(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string
) {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const patient = await loadPatientOrThrow(
    ctx.store,
    practiceId,
    appointment.patient_id
  );

  return sendDemoSms(ctx, {
    practiceId,
    patientId: appointment.patient_id,
    appointmentId,
    messageType: "reminder",
    body: reminderMessage({
      firstName: patient.preferred_name || patient.first_name,
      practiceName: practice.name,
      start: new Date(appointment.start_time),
      timeZone: practice.timezone,
    }),
    conversationState: "awaiting_confirmation",
  });
}

export async function sendRecoveryOffer(
  ctx: WorkflowContext,
  practiceId: string,
  appointmentId: string
) {
  const appointment = await ctx.store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const patient = await loadPatientOrThrow(
    ctx.store,
    practiceId,
    appointment.patient_id
  );
  const demo = createDemoAppointmentSource(ctx.store, practice.timezone);
  const slots = await demo.getAvailableSlots(practiceId, 2);

  await ctx.store.updateAppointment(practiceId, appointmentId, {
    offered_slots: offeredSlotsAsJson(slots),
    reschedule_status: "offered",
    updated_at: nowOf(ctx).toISOString(),
  });

  await ctx.store.insertEvent({
    practiceId,
    appointmentId,
    eventType: "cancellation_recovery",
    source: sourceOf(ctx),
    metadata: { slots },
  });

  return sendDemoSms(ctx, {
    practiceId,
    patientId: appointment.patient_id,
    appointmentId,
    messageType: "cancellation_recovery",
    body: recoveryOfferMessage(
      patient.preferred_name || patient.first_name,
      practice.name,
      slots
    ),
    conversationState: "awaiting_slot_choice",
  });
}

export async function sendOpportunityOutreach(
  ctx: WorkflowContext,
  practiceId: string,
  opportunityId: string,
  kind: "recall" | "treatment"
) {
  const opportunity = await ctx.store.getOpportunity(practiceId, opportunityId);
  if (!opportunity?.patient_id) {
    throw new Error("Opportunity is missing a patient.");
  }

  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const patient = await loadPatientOrThrow(
    ctx.store,
    practiceId,
    opportunity.patient_id
  );
  const demo = createDemoAppointmentSource(ctx.store, practice.timezone);
  const slots = await demo.getAvailableSlots(practiceId, 2);

  const conversation = await ensureConversation(ctx.store, {
    practiceId,
    patientId: opportunity.patient_id,
  });

  await ctx.store.updateConversation(practiceId, conversation.id, {
    state: "awaiting_slot_choice",
  });

  return sendDemoSms(ctx, {
    practiceId,
    patientId: opportunity.patient_id,
    messageType:
      kind === "recall" ? "recall_outreach" : "treatment_outreach",
    body: outreachOfferMessage(
      patient.preferred_name || patient.first_name,
      practice.name,
      kind,
      slots
    ),
    conversationState: "awaiting_slot_choice",
  });
}

async function createDemoAppointmentFromSlot(
  ctx: WorkflowContext,
  practiceId: string,
  patientId: string,
  opportunityId: string | null,
  appointmentType: string,
  index: number
): Promise<AppointmentRow> {
  const practice = await loadPracticeOrThrow(ctx.store, practiceId);
  const demo = createDemoAppointmentSource(ctx.store, practice.timezone);
  const slots = await demo.getAvailableSlots(practiceId, 2);
  const selected = slotByIndex(slots, index);
  if (!selected) {
    throw new Error("That option is no longer available.");
  }

  const created = await demo.createAppointment({
    practiceId,
    patientId,
    start: selected.start,
    end: selected.end,
    appointmentType,
    opportunityId,
    providerName: "Demo Provider",
  });

  await ctx.store.insertEvent({
    practiceId,
    appointmentId: created.id,
    eventType: "created",
    newState: "scheduled",
    source: sourceOf(ctx),
    metadata: { selected, opportunityId },
  });

  const patient = await loadPatientOrThrow(ctx.store, practiceId, patientId);
  await sendDemoSms(ctx, {
    practiceId,
    patientId,
    appointmentId: created.id,
    messageType: "reschedule_confirmed",
    body: slotConfirmedMessage({
      firstName: patient.preferred_name || patient.first_name,
      practiceName: practice.name,
      start: new Date(selected.start),
      timeZone: practice.timezone,
    }),
    conversationState: "closed",
  });

  await maybeScheduleOpportunity(ctx, practiceId, opportunityId);
  return created;
}

export async function applyOptOut(
  ctx: WorkflowContext,
  practiceId: string,
  patientId: string,
  appointmentId?: string | null
) {
  const conversation = await ensureConversation(ctx.store, {
    practiceId,
    patientId,
    appointmentId,
  });

  await ctx.store.updateConversation(practiceId, conversation.id, {
    opted_out: true,
    state: "opted_out",
    last_inbound_at: nowOf(ctx).toISOString(),
  });

  if (appointmentId) {
    await ctx.store.insertEvent({
      practiceId,
      appointmentId,
      eventType: "opted_out",
      source: sourceOf(ctx),
    });
  }

  await ctx.store.insertMessage({
    practice_id: practiceId,
    patient_id: patientId,
    appointment_id: appointmentId ?? null,
    conversation_id: conversation.id,
    direction: "outbound",
    message_type: "opt_out_ack",
    body: optOutAckMessage(),
    status: "sent",
    provider: "demo",
    provider_message_id: `demo-optout-${crypto.randomUUID()}`,
    created_at: nowOf(ctx).toISOString(),
  });
}

async function resolveInboundAppointment(
  store: SchedulingStore,
  practiceId: string,
  patientId: string,
  appointmentId?: string | null
): Promise<AppointmentRow | null> {
  if (appointmentId) {
    return store.getAppointment(practiceId, appointmentId);
  }

  const appointments = await store.listAppointments(practiceId);
  const matching = appointments
    .filter((row) => row.patient_id === patientId && row.status !== "completed")
    .sort((left, right) => left.start_time.localeCompare(right.start_time));

  return (
    matching.find((row) => row.confirmation_status !== "cancelled") ??
    matching[0] ??
    null
  );
}

export async function handleInboundSms(
  ctx: WorkflowContext,
  input: {
    practiceId: string;
    patientId?: string | null;
    appointmentId?: string | null;
    body: string;
  }
): Promise<InboundResult> {
  const intent = parseInboundSms(input.body);
  const appointment = input.appointmentId
    ? await ctx.store.getAppointment(input.practiceId, input.appointmentId)
    : input.patientId
      ? await resolveInboundAppointment(
          ctx.store,
          input.practiceId,
          input.patientId
        )
      : null;

  const patientId = appointment?.patient_id ?? input.patientId;
  if (!patientId) {
    throw new Error("Patient not found for inbound message.");
  }

  await loadPatientOrThrow(ctx.store, input.practiceId, patientId);

  const conversation = await ensureConversation(ctx.store, {
    practiceId: input.practiceId,
    patientId,
    appointmentId: appointment?.id ?? null,
  });

  await ctx.store.insertMessage({
    practice_id: input.practiceId,
    patient_id: patientId,
    appointment_id: appointment?.id ?? null,
    conversation_id: conversation.id,
    direction: "inbound",
    message_type:
      intent.kind === "confirm"
        ? "confirmation"
        : intent.kind === "reschedule"
          ? "reschedule_offer"
          : intent.kind === "cancel"
            ? "cancellation"
            : intent.kind === "stop"
              ? "opt_out_ack"
              : intent.kind === "slot"
                ? "reschedule_offer"
                : "unknown_reply",
    body: input.body,
    status: "received",
    provider: "demo",
    provider_message_id: `demo-in-${crypto.randomUUID()}`,
    created_at: nowOf(ctx).toISOString(),
  });

  await ctx.store.updateConversation(input.practiceId, conversation.id, {
    last_inbound_at: nowOf(ctx).toISOString(),
  });

  if (appointment) {
    await ctx.store.insertEvent({
      practiceId: input.practiceId,
      appointmentId: appointment.id,
      eventType: "sms_received",
      source: "patient",
      metadata: { intent: intent.kind },
    });
  }

  if (conversation.opted_out && intent.kind !== "stop") {
    return {
      intent,
      appointmentId: appointment?.id ?? null,
      skipped: "opted_out",
    };
  }

  if (intent.kind === "stop") {
    await applyOptOut(ctx, input.practiceId, patientId, appointment?.id);
    return {
      intent,
      appointmentId: appointment?.id ?? null,
      reply: optOutAckMessage(),
    };
  }

  if (intent.kind === "confirm") {
    if (!appointment) {
      return { intent, appointmentId: null, skipped: "no_appointment" };
    }
    await confirmAppointment(ctx, input.practiceId, appointment.id);
    const practice = await loadPracticeOrThrow(ctx.store, input.practiceId);
    const patient = await loadPatientOrThrow(
      ctx.store,
      input.practiceId,
      patientId
    );
    return {
      intent,
      appointmentId: appointment.id,
      reply: confirmedAckMessage({
        firstName: patient.preferred_name || patient.first_name,
        practiceName: practice.name,
        start: new Date(appointment.start_time),
        timeZone: practice.timezone,
      }),
    };
  }

  if (intent.kind === "reschedule") {
    if (!appointment) {
      return { intent, appointmentId: null, skipped: "no_appointment" };
    }
    const result = await requestReschedule(
      ctx,
      input.practiceId,
      appointment.id
    );
    return {
      intent,
      appointmentId: appointment.id,
      reply: rescheduleOfferMessage(result.slots),
    };
  }

  if (intent.kind === "cancel") {
    if (!appointment) {
      return { intent, appointmentId: null, skipped: "no_appointment" };
    }
    await cancelAppointmentWorkflow(ctx, input.practiceId, appointment.id);
    const patient = await loadPatientOrThrow(
      ctx.store,
      input.practiceId,
      patientId
    );
    const reply = cancelledAckMessage(
      patient.preferred_name || patient.first_name
    );
    await sendDemoSms(ctx, {
      practiceId: input.practiceId,
      patientId,
      appointmentId: appointment.id,
      messageType: "cancellation",
      body: reply,
      conversationState: "idle",
    });
    return { intent, appointmentId: appointment.id, reply };
  }

  if (intent.kind === "slot") {
    if (appointment) {
      const result = await applySlotSelection(
        ctx,
        input.practiceId,
        appointment.id,
        intent.index
      );
      return {
        intent,
        appointmentId: result.appointment.id,
        reply: result.reserved
          ? "reserved"
          : new OpenDentalWritesDisabledError("updateAppointment").message,
      };
    }

    const openRecall = (
      await ctx.store.listOpenOpportunities(input.practiceId, "Recall")
    ).find((row) => row.patient_id === patientId);
    const openTreatment = (
      await ctx.store.listOpenOpportunities(input.practiceId, "Treatment")
    ).find((row) => row.patient_id === patientId);
    const opportunity = openRecall ?? openTreatment;
    const created = await createDemoAppointmentFromSlot(
      ctx,
      input.practiceId,
      patientId,
      opportunity?.id ?? null,
      opportunity?.opportunity_type === "Treatment"
        ? "Treatment"
        : "Recall",
      intent.index
    );
    return { intent, appointmentId: created.id, reply: "reserved" };
  }

  return {
    intent,
    appointmentId: appointment?.id ?? null,
    reply: unknownReplyMessage(),
  };
}

export async function queueConfirmationJob(
  store: SchedulingStore,
  appointment: Pick<
    AppointmentRow,
    "id" | "practice_id" | "patient_id" | "opportunity_id"
  >
) {
  return enqueueSchedulingJob(store, {
    practiceId: appointment.practice_id,
    jobType: "confirmation",
    subjectId: appointment.id,
    appointmentId: appointment.id,
    opportunityId: appointment.opportunity_id,
    patientId: appointment.patient_id,
  });
}
