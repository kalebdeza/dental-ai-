import type { TablesInsert, TablesUpdate } from "../database.types.ts";
import type {
  AppointmentEventRow,
  AppointmentEventType,
  AppointmentRow,
  LinkedOpportunity,
  PatientContact,
  PracticeContact,
  SchedulingJobRow,
  SchedulingJobStatus,
  SchedulingJobType,
  SmsConversationRow,
  SmsMessageRow,
} from "./types.ts";

export type SchedulingClient = {
  // Matches OpportunityWorkflowClient: PostgREST builders are not worth
  // duplicating for every table used by scheduling automation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type SchedulingStore = {
  getPractice(practiceId: string): Promise<PracticeContact | null>;
  getPatient(
    practiceId: string,
    patientId: string
  ): Promise<PatientContact | null>;
  listPatients(practiceId: string): Promise<PatientContact[]>;
  getIntegration(practiceId: string): Promise<{ id: string } | null>;
  listAppointments(practiceId: string): Promise<AppointmentRow[]>;
  getAppointment(
    practiceId: string,
    appointmentId: string
  ): Promise<AppointmentRow | null>;
  insertAppointment(
    row: TablesInsert<"appointments">
  ): Promise<AppointmentRow>;
  updateAppointment(
    practiceId: string,
    appointmentId: string,
    patch: TablesUpdate<"appointments">
  ): Promise<AppointmentRow | null>;
  insertEvent(row: {
    practiceId: string;
    appointmentId: string;
    eventType: AppointmentEventType;
    previousState?: string | null;
    newState?: string | null;
    source?: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<AppointmentEventRow>;
  listEvents(
    practiceId: string,
    appointmentId: string
  ): Promise<AppointmentEventRow[]>;
  getConversation(options: {
    practiceId: string;
    patientId: string;
    appointmentId?: string | null;
  }): Promise<SmsConversationRow | null>;
  upsertConversation(
    row: TablesInsert<"sms_conversations">
  ): Promise<SmsConversationRow>;
  updateConversation(
    practiceId: string,
    conversationId: string,
    patch: TablesUpdate<"sms_conversations">
  ): Promise<SmsConversationRow | null>;
  insertMessage(row: TablesInsert<"sms_messages">): Promise<SmsMessageRow>;
  listMessages(
    practiceId: string,
    appointmentId: string
  ): Promise<SmsMessageRow[]>;
  recentOutbound(options: {
    practiceId: string;
    appointmentId?: string | null;
    patientId?: string | null;
    messageType: string;
    sinceIso: string;
  }): Promise<SmsMessageRow | null>;
  insertJob(row: TablesInsert<"scheduling_jobs">): Promise<SchedulingJobRow | null>;
  getPendingJob(
    practiceId: string,
    dedupeKey: string
  ): Promise<SchedulingJobRow | null>;
  claimDueJobs(options: {
    practiceId?: string | null;
    now: Date;
    limit: number;
  }): Promise<SchedulingJobRow[]>;
  updateJob(
    practiceId: string,
    jobId: string,
    patch: TablesUpdate<"scheduling_jobs">
  ): Promise<SchedulingJobRow | null>;
  getOpportunity(
    practiceId: string,
    opportunityId: string
  ): Promise<LinkedOpportunity | null>;
  listOpenOpportunities(
    practiceId: string,
    opportunityType?: string
  ): Promise<LinkedOpportunity[]>;
};

function asError(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Scheduling store error.");
}

export function createSupabaseSchedulingStore(
  client: SchedulingClient
): SchedulingStore {
  return {
    async getPractice(practiceId) {
      const { data, error } = await client
        .from("practices")
        .select("id, name, timezone")
        .eq("id", practiceId)
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async getPatient(practiceId, patientId) {
      const { data, error } = await client
        .from("patients")
        .select("id, practice_id, first_name, last_name, preferred_name")
        .eq("practice_id", practiceId)
        .eq("id", patientId)
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async listPatients(practiceId) {
      const { data, error } = await client
        .from("patients")
        .select("id, practice_id, first_name, last_name, preferred_name")
        .eq("practice_id", practiceId)
        .order("last_name");
      if (error) asError(error);
      return data ?? [];
    },

    async getIntegration(practiceId) {
      const { data, error } = await client
        .from("integrations")
        .select("id")
        .eq("practice_id", practiceId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async listAppointments(practiceId) {
      const { data, error } = await client
        .from("appointments")
        .select("*")
        .eq("practice_id", practiceId)
        .order("start_time");
      if (error) asError(error);
      return data ?? [];
    },

    async getAppointment(practiceId, appointmentId) {
      const { data, error } = await client
        .from("appointments")
        .select("*")
        .eq("practice_id", practiceId)
        .eq("id", appointmentId)
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async insertAppointment(row) {
      const { data, error } = await client
        .from("appointments")
        .insert(row)
        .select("*")
        .maybeSingle();
      if (error || !data) asError(error);
      return data;
    },

    async updateAppointment(practiceId, appointmentId, patch) {
      const { data, error } = await client
        .from("appointments")
        .update(patch)
        .eq("practice_id", practiceId)
        .eq("id", appointmentId)
        .select("*")
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async insertEvent(row) {
      const { data, error } = await client
        .from("appointment_events")
        .insert({
          practice_id: row.practiceId,
          appointment_id: row.appointmentId,
          event_type: row.eventType,
          previous_state: row.previousState ?? null,
          new_state: row.newState ?? null,
          source: row.source ?? "system",
          metadata: row.metadata ?? null,
        })
        .select("*")
        .maybeSingle();
      if (error || !data) asError(error);
      return data;
    },

    async listEvents(practiceId, appointmentId) {
      const { data, error } = await client
        .from("appointment_events")
        .select("*")
        .eq("practice_id", practiceId)
        .eq("appointment_id", appointmentId)
        .order("created_at");
      if (error) asError(error);
      return data ?? [];
    },

    async getConversation({ practiceId, patientId, appointmentId }) {
      let query = client
        .from("sms_conversations")
        .select("*")
        .eq("practice_id", practiceId)
        .eq("patient_id", patientId)
        .order("updated_at");

      if (appointmentId) {
        query = query.eq("appointment_id", appointmentId);
      } else {
        query = query.is("appointment_id", null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) asError(error);
      return data;
    },

    async upsertConversation(row) {
      const existing = await this.getConversation({
        practiceId: row.practice_id,
        patientId: row.patient_id,
        appointmentId: row.appointment_id ?? null,
      });

      if (existing) {
        const updated = await this.updateConversation(
          row.practice_id,
          existing.id,
          {
            state: row.state ?? existing.state,
            opted_out: row.opted_out ?? existing.opted_out,
            appointment_id: row.appointment_id ?? existing.appointment_id,
            last_outbound_at:
              row.last_outbound_at ?? existing.last_outbound_at,
            last_inbound_at: row.last_inbound_at ?? existing.last_inbound_at,
            updated_at: new Date().toISOString(),
          }
        );
        if (!updated) {
          throw new Error("Conversation update failed.");
        }
        return updated;
      }

      const { data, error } = await client
        .from("sms_conversations")
        .insert(row)
        .select("*")
        .maybeSingle();
      if (error || !data) asError(error);
      return data;
    },

    async updateConversation(practiceId, conversationId, patch) {
      const { data, error } = await client
        .from("sms_conversations")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("practice_id", practiceId)
        .eq("id", conversationId)
        .select("*")
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async insertMessage(row) {
      const { data, error } = await client
        .from("sms_messages")
        .insert(row)
        .select("*")
        .maybeSingle();
      if (error || !data) asError(error);
      return data;
    },

    async listMessages(practiceId, appointmentId) {
      const { data, error } = await client
        .from("sms_messages")
        .select("*")
        .eq("practice_id", practiceId)
        .eq("appointment_id", appointmentId)
        .order("created_at");
      if (error) asError(error);
      return data ?? [];
    },

    async recentOutbound({
      practiceId,
      appointmentId,
      patientId,
      messageType,
      sinceIso,
    }) {
      let query = client
        .from("sms_messages")
        .select("*")
        .eq("practice_id", practiceId)
        .eq("direction", "outbound")
        .eq("message_type", messageType)
        .gte("created_at", sinceIso)
        .order("created_at")
        .limit(1);

      if (appointmentId) {
        query = query.eq("appointment_id", appointmentId);
      }

      if (patientId) {
        query = query.eq("patient_id", patientId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) asError(error);
      return data;
    },

    async insertJob(row) {
      const { data: existing, error: existingError } = await client
        .from("scheduling_jobs")
        .select("*")
        .eq("practice_id", row.practice_id)
        .eq("dedupe_key", row.dedupe_key)
        .maybeSingle();
      if (existingError) asError(existingError);
      if (existing) {
        return existing;
      }

      const { data, error } = await client
        .from("scheduling_jobs")
        .insert(row)
        .select("*")
        .maybeSingle();

      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          return this.getPendingJob(row.practice_id, row.dedupe_key);
        }
        asError(error);
      }

      return data;
    },

    async getPendingJob(practiceId, dedupeKey) {
      const { data, error } = await client
        .from("scheduling_jobs")
        .select("*")
        .eq("practice_id", practiceId)
        .eq("dedupe_key", dedupeKey)
        .in("status", ["pending", "processing"])
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async claimDueJobs({ practiceId, now, limit }) {
      let query = client
        .from("scheduling_jobs")
        .select("*")
        .eq("status", "pending")
        .lte("run_after", now.toISOString())
        .order("run_after")
        .limit(limit);

      if (practiceId) {
        query = query.eq("practice_id", practiceId);
      }

      const { data, error } = await query;
      if (error) asError(error);

      const claimed: SchedulingJobRow[] = [];

      for (const row of data ?? []) {
        const { data: locked, error: lockError } = await client
          .from("scheduling_jobs")
          .update({
            status: "processing",
            attempts: (row.attempts ?? 0) + 1,
            updated_at: now.toISOString(),
          })
          .eq("id", row.id)
          .eq("practice_id", row.practice_id)
          .eq("status", "pending")
          .select("*")
          .maybeSingle();

        if (lockError) asError(lockError);
        if (locked) {
          claimed.push(locked);
        }
      }

      return claimed;
    },

    async updateJob(practiceId, jobId, patch) {
      const { data, error } = await client
        .from("scheduling_jobs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("practice_id", practiceId)
        .eq("id", jobId)
        .select("*")
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async getOpportunity(practiceId, opportunityId) {
      const { data, error } = await client
        .from("revenue_opportunities")
        .select(
          "id, practice_id, opportunity_type, reason, estimated_value, workflow_status, contact_outcome, completed, claim_id, patient_id"
        )
        .eq("practice_id", practiceId)
        .eq("id", opportunityId)
        .maybeSingle();
      if (error) asError(error);
      return data;
    },

    async listOpenOpportunities(practiceId, opportunityType) {
      let query = client
        .from("revenue_opportunities")
        .select(
          "id, practice_id, opportunity_type, reason, estimated_value, workflow_status, contact_outcome, completed, claim_id, patient_id"
        )
        .eq("practice_id", practiceId)
        .eq("completed", false)
        .in("workflow_status", ["open", "contacted"]);

      if (opportunityType) {
        query = query.eq("opportunity_type", opportunityType);
      }

      const { data, error } = await query;
      if (error) asError(error);
      return data ?? [];
    },
  };
}

type MemoryTables = {
  practices: PracticeContact[];
  patients: PatientContact[];
  integrations: { id: string; practice_id: string }[];
  appointments: AppointmentRow[];
  events: AppointmentEventRow[];
  conversations: SmsConversationRow[];
  messages: SmsMessageRow[];
  jobs: SchedulingJobRow[];
  opportunities: LinkedOpportunity[];
};

export function createMemorySchedulingStore(
  seed: Partial<MemoryTables> = {}
): SchedulingStore & { tables: MemoryTables } {
  const tables: MemoryTables = {
    practices: seed.practices ?? [],
    patients: seed.patients ?? [],
    integrations: seed.integrations ?? [],
    appointments: seed.appointments ?? [],
    events: seed.events ?? [],
    conversations: seed.conversations ?? [],
    messages: seed.messages ?? [],
    jobs: seed.jobs ?? [],
    opportunities: seed.opportunities ?? [],
  };

  const store: SchedulingStore & { tables: MemoryTables } = {
    tables,

    async getPractice(practiceId) {
      return tables.practices.find((row) => row.id === practiceId) ?? null;
    },

    async getPatient(practiceId, patientId) {
      return (
        tables.patients.find(
          (row) => row.practice_id === practiceId && row.id === patientId
        ) ?? null
      );
    },

    async listPatients(practiceId) {
      return tables.patients.filter((row) => row.practice_id === practiceId);
    },

    async getIntegration(practiceId) {
      return (
        tables.integrations.find((row) => row.practice_id === practiceId) ??
        null
      );
    },

    async listAppointments(practiceId) {
      return tables.appointments
        .filter((row) => row.practice_id === practiceId)
        .sort((left, right) => left.start_time.localeCompare(right.start_time));
    },

    async getAppointment(practiceId, appointmentId) {
      return (
        tables.appointments.find(
          (row) => row.practice_id === practiceId && row.id === appointmentId
        ) ?? null
      );
    },

    async insertAppointment(row) {
      const created: AppointmentRow = {
        appointment_type: row.appointment_type ?? null,
        cancellation_reason: row.cancellation_reason ?? null,
        cancelled_at: row.cancelled_at ?? null,
        confirmation_status: row.confirmation_status ?? "unconfirmed",
        created_at: row.created_at ?? new Date().toISOString(),
        end_time: row.end_time,
        id: row.id ?? crypto.randomUUID(),
        integration_id: row.integration_id ?? null,
        last_synced_at: row.last_synced_at ?? null,
        notes: row.notes ?? null,
        offered_slots: row.offered_slots ?? null,
        operatory: row.operatory ?? null,
        opportunity_id: row.opportunity_id ?? null,
        patient_id: row.patient_id,
        practice_id: row.practice_id,
        provider_id: row.provider_id ?? null,
        provider_name: row.provider_name ?? null,
        reschedule_status: row.reschedule_status ?? "none",
        source: row.source ?? "demo",
        source_appointment_id: row.source_appointment_id,
        start_time: row.start_time,
        status: row.status,
        updated_at: row.updated_at ?? new Date().toISOString(),
      };
      tables.appointments.push(created);
      return created;
    },

    async updateAppointment(practiceId, appointmentId, patch) {
      const index = tables.appointments.findIndex(
        (row) => row.practice_id === practiceId && row.id === appointmentId
      );
      if (index < 0) {
        return null;
      }
      tables.appointments[index] = {
        ...tables.appointments[index],
        ...patch,
        practice_id: practiceId,
        id: appointmentId,
      };
      return tables.appointments[index];
    },

    async insertEvent(row) {
      const created: AppointmentEventRow = {
        id: crypto.randomUUID(),
        practice_id: row.practiceId,
        appointment_id: row.appointmentId,
        event_type: row.eventType,
        previous_state: row.previousState ?? null,
        new_state: row.newState ?? null,
        source: row.source ?? "system",
        metadata: (row.metadata ?? null) as AppointmentEventRow["metadata"],
        created_at: new Date().toISOString(),
      };
      tables.events.push(created);
      return created;
    },

    async listEvents(practiceId, appointmentId) {
      return tables.events.filter(
        (row) =>
          row.practice_id === practiceId && row.appointment_id === appointmentId
      );
    },

    async getConversation({ practiceId, patientId, appointmentId }) {
      return (
        tables.conversations.find(
          (row) =>
            row.practice_id === practiceId &&
            row.patient_id === patientId &&
            (appointmentId
              ? row.appointment_id === appointmentId
              : row.appointment_id == null)
        ) ?? null
      );
    },

    async upsertConversation(row) {
      const existing = await this.getConversation({
        practiceId: row.practice_id,
        patientId: row.patient_id,
        appointmentId: row.appointment_id ?? null,
      });
      if (existing) {
        const updated = await this.updateConversation(
          row.practice_id,
          existing.id,
          row
        );
        if (!updated) {
          throw new Error("Conversation update failed.");
        }
        return updated;
      }
      const created: SmsConversationRow = {
        id: row.id ?? crypto.randomUUID(),
        practice_id: row.practice_id,
        patient_id: row.patient_id,
        appointment_id: row.appointment_id ?? null,
        state: row.state ?? "idle",
        opted_out: row.opted_out ?? false,
        last_outbound_at: row.last_outbound_at ?? null,
        last_inbound_at: row.last_inbound_at ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
      };
      tables.conversations.push(created);
      return created;
    },

    async updateConversation(practiceId, conversationId, patch) {
      const index = tables.conversations.findIndex(
        (row) => row.practice_id === practiceId && row.id === conversationId
      );
      if (index < 0) {
        return null;
      }
      tables.conversations[index] = {
        ...tables.conversations[index],
        ...patch,
        practice_id: practiceId,
        id: conversationId,
        updated_at: new Date().toISOString(),
      };
      return tables.conversations[index];
    },

    async insertMessage(row) {
      const created: SmsMessageRow = {
        id: row.id ?? crypto.randomUUID(),
        practice_id: row.practice_id,
        patient_id: row.patient_id,
        appointment_id: row.appointment_id ?? null,
        conversation_id: row.conversation_id ?? null,
        direction: row.direction,
        message_type: row.message_type,
        body: row.body,
        status: row.status ?? "queued",
        provider: row.provider ?? "demo",
        provider_message_id: row.provider_message_id ?? null,
        error: row.error ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
      };
      tables.messages.push(created);
      return created;
    },

    async listMessages(practiceId, appointmentId) {
      return tables.messages.filter(
        (row) =>
          row.practice_id === practiceId && row.appointment_id === appointmentId
      );
    },

    async recentOutbound({
      practiceId,
      appointmentId,
      patientId,
      messageType,
      sinceIso,
    }) {
      return (
        tables.messages.find(
          (row) =>
            row.practice_id === practiceId &&
            row.direction === "outbound" &&
            row.message_type === messageType &&
            row.created_at >= sinceIso &&
            (appointmentId ? row.appointment_id === appointmentId : true) &&
            (patientId ? row.patient_id === patientId : true)
        ) ?? null
      );
    },

    async insertJob(row) {
      const existing = tables.jobs.find(
        (job) =>
          job.practice_id === row.practice_id &&
          job.dedupe_key === row.dedupe_key
      );
      if (existing) {
        return existing;
      }
      const created: SchedulingJobRow = {
        id: row.id ?? crypto.randomUUID(),
        practice_id: row.practice_id,
        appointment_id: row.appointment_id ?? null,
        opportunity_id: row.opportunity_id ?? null,
        patient_id: row.patient_id ?? null,
        job_type: row.job_type,
        status: row.status ?? "pending",
        run_after: row.run_after ?? new Date().toISOString(),
        attempts: row.attempts ?? 0,
        last_error: row.last_error ?? null,
        dedupe_key: row.dedupe_key,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
      };
      tables.jobs.push(created);
      return created;
    },

    async getPendingJob(practiceId, dedupeKey) {
      return (
        tables.jobs.find(
          (row) =>
            row.practice_id === practiceId &&
            row.dedupe_key === dedupeKey &&
            (row.status === "pending" || row.status === "processing")
        ) ?? null
      );
    },

    async claimDueJobs({ practiceId, now, limit }) {
      const due = tables.jobs
        .filter(
          (row) =>
            row.status === "pending" &&
            row.run_after <= now.toISOString() &&
            (!practiceId || row.practice_id === practiceId)
        )
        .slice(0, limit);

      const claimed: SchedulingJobRow[] = [];
      for (const row of due) {
        row.status = "processing";
        row.attempts += 1;
        row.updated_at = now.toISOString();
        claimed.push(row);
      }
      return claimed;
    },

    async updateJob(practiceId, jobId, patch) {
      const index = tables.jobs.findIndex(
        (row) => row.practice_id === practiceId && row.id === jobId
      );
      if (index < 0) {
        return null;
      }
      tables.jobs[index] = {
        ...tables.jobs[index],
        ...patch,
        practice_id: practiceId,
        id: jobId,
        updated_at: new Date().toISOString(),
      };
      return tables.jobs[index];
    },

    async getOpportunity(practiceId, opportunityId) {
      return (
        tables.opportunities.find(
          (row) => row.id === opportunityId && row.practice_id === practiceId
        ) ?? null
      );
    },

    async listOpenOpportunities(practiceId, opportunityType) {
      return tables.opportunities.filter(
        (row) =>
          row.practice_id === practiceId &&
          !row.completed &&
          (row.workflow_status === "open" ||
            row.workflow_status === "contacted") &&
          (!opportunityType || row.opportunity_type === opportunityType)
      );
    },
  };

  return store;
}

export function enqueueSchedulingJob(
  store: SchedulingStore,
  input: {
    practiceId: string;
    jobType: SchedulingJobType;
    subjectId: string;
    appointmentId?: string | null;
    opportunityId?: string | null;
    patientId?: string | null;
    runAfter?: Date;
  }
): Promise<SchedulingJobRow | null> {
  return store.insertJob({
    practice_id: input.practiceId,
    job_type: input.jobType,
    appointment_id: input.appointmentId ?? null,
    opportunity_id: input.opportunityId ?? null,
    patient_id: input.patientId ?? null,
    status: "pending",
    run_after: (input.runAfter ?? new Date()).toISOString(),
    dedupe_key: `${input.jobType}:${input.subjectId}`,
  });
}

export type { SchedulingJobType, SchedulingJobStatus };
