import { workQueueTypeHref } from "./workQueue.ts";
import type { SchedulingClient } from "../scheduling/store.ts";
import { createSupabaseSchedulingStore } from "../scheduling/store.ts";
import { schedulingLifecycle } from "../scheduling/lifecycle.ts";
import {
  parseOfferedSlots,
  type AppointmentEventRow,
  type AppointmentRow,
  type LinkedOpportunity,
  type SmsMessageRow,
} from "../scheduling/types.ts";

export type SchedulingAppointmentItem = {
  id: string;
  patientId: string;
  patientName: string;
  appointmentType: string;
  providerName: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  confirmationStatus: string;
  rescheduleStatus: string;
  cancelledAt: string | null;
  opportunityId: string | null;
  opportunity: {
    id: string;
    type: string;
    reason: string | null;
    workflowStatus: string;
    href: string;
    estimatedValue: number;
  } | null;
  lifecycle: ReturnType<typeof schedulingLifecycle>;
  offeredSlots: ReturnType<typeof parseOfferedSlots>;
};

export type SchedulingAppointmentDetail = SchedulingAppointmentItem & {
  events: AppointmentEventRow[];
  messages: SmsMessageRow[];
};

function patientName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name || "Unknown patient";
}

function toItem(
  appointment: AppointmentRow,
  patient: { first_name: string; last_name: string } | null,
  opportunity: LinkedOpportunity | null
): SchedulingAppointmentItem {
  return {
    id: appointment.id,
    patientId: appointment.patient_id,
    patientName: patient
      ? patientName(patient.first_name, patient.last_name)
      : "Unknown patient",
    appointmentType: appointment.appointment_type || "Visit",
    providerName: appointment.provider_name || "Unassigned",
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    status: appointment.status,
    source: appointment.source,
    confirmationStatus: appointment.confirmation_status,
    rescheduleStatus: appointment.reschedule_status,
    cancelledAt: appointment.cancelled_at,
    opportunityId: appointment.opportunity_id,
    opportunity: opportunity
      ? {
          id: opportunity.id,
          type: opportunity.opportunity_type,
          reason: opportunity.reason,
          workflowStatus: opportunity.workflow_status,
          href: workQueueTypeHref(
            opportunity.opportunity_type,
            opportunity.id,
            opportunity.claim_id
          ),
          estimatedValue: Number(opportunity.estimated_value ?? 0),
        }
      : null,
    lifecycle: schedulingLifecycle({
      appointment,
      opportunity,
    }),
    offeredSlots: parseOfferedSlots(appointment.offered_slots),
  };
}

export async function loadSchedulingBoard(
  client: SchedulingClient,
  practiceId: string
): Promise<SchedulingAppointmentItem[]> {
  const store = createSupabaseSchedulingStore(client);
  const appointments = await store.listAppointments(practiceId);
  const patients = await store.listPatients(practiceId);
  const patientsById = new Map(patients.map((row) => [row.id, row]));
  const opportunities = new Map<string, LinkedOpportunity>();

  for (const appointment of appointments) {
    if (!appointment.opportunity_id || opportunities.has(appointment.opportunity_id)) {
      continue;
    }
    const opportunity = await store.getOpportunity(
      practiceId,
      appointment.opportunity_id
    );
    if (opportunity) {
      opportunities.set(opportunity.id, opportunity);
    }
  }

  return appointments.map((appointment) =>
    toItem(
      appointment,
      patientsById.get(appointment.patient_id) ?? null,
      appointment.opportunity_id
        ? opportunities.get(appointment.opportunity_id) ?? null
        : null
    )
  );
}

export async function loadSchedulingDetail(
  client: SchedulingClient,
  practiceId: string,
  appointmentId: string
): Promise<SchedulingAppointmentDetail | null> {
  const store = createSupabaseSchedulingStore(client);
  const appointment = await store.getAppointment(practiceId, appointmentId);
  if (!appointment) {
    return null;
  }

  const [patient, opportunity, events, messages] = await Promise.all([
    store.getPatient(practiceId, appointment.patient_id),
    appointment.opportunity_id
      ? store.getOpportunity(practiceId, appointment.opportunity_id)
      : Promise.resolve(null),
    store.listEvents(practiceId, appointmentId),
    store.listMessages(practiceId, appointmentId),
  ]);

  return {
    ...toItem(appointment, patient, opportunity),
    events,
    messages,
  };
}
