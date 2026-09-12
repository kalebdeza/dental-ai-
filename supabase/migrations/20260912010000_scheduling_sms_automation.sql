-- =========================================
-- Scheduling + SMS automation MVP.
--
-- Additive only. Does not drop or rewrite
-- existing appointments rows. Open Dental
-- remains the source of truth for real
-- appointments; Dental AI stores
-- intelligence, SMS, and demo schedule
-- state.
--
-- Authenticated users may SELECT tenant
-- rows and perform office actions.
-- Scheduler uses service_role.
-- =========================================

-- -----------------------------------------
-- 1. Extend existing appointments
-- -----------------------------------------

alter table public.appointments
    add column if not exists source text not null default 'opendental';

alter table public.appointments
    add column if not exists confirmation_status text not null default 'unconfirmed';

alter table public.appointments
    add column if not exists reschedule_status text not null default 'none';

alter table public.appointments
    add column if not exists cancelled_at timestamptz;

alter table public.appointments
    add column if not exists cancellation_reason text;

alter table public.appointments
    add column if not exists provider_name text;

alter table public.appointments
    add column if not exists opportunity_id uuid
        references public.revenue_opportunities(id)
        on delete set null;

alter table public.appointments
    add column if not exists offered_slots jsonb;

-- Demo appointments are local Dental AI rows. They must not require
-- an Open Dental integrations row.
alter table public.appointments
    alter column integration_id drop not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'appointments_source_check'
    ) then
        alter table public.appointments
            add constraint appointments_source_check
            check (source in ('opendental', 'demo'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'appointments_confirmation_status_check'
    ) then
        alter table public.appointments
            add constraint appointments_confirmation_status_check
            check (
                confirmation_status in (
                    'unconfirmed',
                    'pending',
                    'confirmed',
                    'reschedule_requested',
                    'cancelled'
                )
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'appointments_reschedule_status_check'
    ) then
        alter table public.appointments
            add constraint appointments_reschedule_status_check
            check (
                reschedule_status in (
                    'none',
                    'offered',
                    'selected',
                    'completed'
                )
            );
    end if;
end
$$;

create index if not exists appointments_opportunity
on public.appointments (practice_id, opportunity_id);

create index if not exists appointments_confirmation
on public.appointments (practice_id, confirmation_status);

-- -----------------------------------------
-- 2. appointment_events
-- -----------------------------------------

create table if not exists public.appointment_events (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    appointment_id uuid not null
        references public.appointments(id)
        on delete cascade,

    event_type text not null,
    previous_state text,
    new_state text,
    source text not null default 'system',
    metadata jsonb,
    created_at timestamptz not null default now(),

    constraint appointment_events_type_check
        check (
            event_type in (
                'created',
                'confirmed',
                'reschedule_requested',
                'slots_offered',
                'rescheduled',
                'cancelled',
                'cancellation_recovery',
                'completed',
                'sms_sent',
                'sms_received',
                'opted_out'
            )
        )
);

create index if not exists appointment_events_appointment
on public.appointment_events (appointment_id, created_at);

create index if not exists appointment_events_practice
on public.appointment_events (practice_id, created_at);

-- -----------------------------------------
-- 3. sms_conversations
-- -----------------------------------------

create table if not exists public.sms_conversations (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    patient_id uuid not null
        references public.patients(id)
        on delete cascade,

    appointment_id uuid
        references public.appointments(id)
        on delete set null,

    state text not null default 'idle',
    opted_out boolean not null default false,
    last_outbound_at timestamptz,
    last_inbound_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint sms_conversations_state_check
        check (
            state in (
                'idle',
                'awaiting_confirmation',
                'awaiting_slot_choice',
                'closed',
                'opted_out'
            )
        ),

    unique (practice_id, patient_id, appointment_id)
);

create index if not exists sms_conversations_practice
on public.sms_conversations (practice_id, patient_id);

create unique index if not exists sms_conversations_patient_open
on public.sms_conversations (practice_id, patient_id)
where appointment_id is null;

-- -----------------------------------------
-- 4. sms_messages
-- -----------------------------------------

create table if not exists public.sms_messages (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    patient_id uuid not null
        references public.patients(id)
        on delete cascade,

    appointment_id uuid
        references public.appointments(id)
        on delete set null,

    conversation_id uuid
        references public.sms_conversations(id)
        on delete set null,

    direction text not null,
    message_type text not null,
    body text not null,
    status text not null default 'queued',
    provider text not null default 'demo',
    provider_message_id text,
    error text,
    created_at timestamptz not null default now(),

    constraint sms_messages_direction_check
        check (direction in ('outbound', 'inbound')),

    constraint sms_messages_status_check
        check (
            status in (
                'queued',
                'sent',
                'delivered',
                'failed',
                'received'
            )
        )
);

create index if not exists sms_messages_practice
on public.sms_messages (practice_id, created_at);

create index if not exists sms_messages_appointment
on public.sms_messages (appointment_id, created_at);

create unique index if not exists sms_messages_provider_id
on public.sms_messages (provider, provider_message_id)
where provider_message_id is not null;

-- -----------------------------------------
-- 5. scheduling_jobs
-- -----------------------------------------

create table if not exists public.scheduling_jobs (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    appointment_id uuid
        references public.appointments(id)
        on delete set null,

    opportunity_id uuid
        references public.revenue_opportunities(id)
        on delete set null,

    patient_id uuid
        references public.patients(id)
        on delete set null,

    job_type text not null,
    status text not null default 'pending',
    run_after timestamptz not null default now(),
    attempts integer not null default 0,
    last_error text,
    dedupe_key text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint scheduling_jobs_type_check
        check (
            job_type in (
                'confirmation',
                'reminder',
                'reschedule_follow_up',
                'cancellation_recovery',
                'recall_outreach',
                'treatment_outreach'
            )
        ),

    constraint scheduling_jobs_status_check
        check (
            status in (
                'pending',
                'processing',
                'succeeded',
                'failed',
                'skipped'
            )
        ),

    unique (practice_id, dedupe_key)
);

create index if not exists scheduling_jobs_due
on public.scheduling_jobs (practice_id, status, run_after);

-- -----------------------------------------
-- 6. Grants
-- -----------------------------------------

revoke all on table public.appointment_events from public, anon, authenticated, service_role;
revoke all on table public.sms_conversations from public, anon, authenticated, service_role;
revoke all on table public.sms_messages from public, anon, authenticated, service_role;
revoke all on table public.scheduling_jobs from public, anon, authenticated, service_role;

grant select, insert, update on table public.appointments to authenticated;
grant select, insert, update on table public.appointments to service_role;

grant select on table public.appointment_events to authenticated;
grant select, insert on table public.appointment_events to service_role;

grant select on table public.sms_conversations to authenticated;
grant select, insert, update on table public.sms_conversations to service_role;

grant select on table public.sms_messages to authenticated;
grant select, insert, update on table public.sms_messages to service_role;

grant select on table public.scheduling_jobs to authenticated;
grant select, insert, update on table public.scheduling_jobs to service_role;

-- Office demo seed and inbound simulation write through the
-- authenticated session for the current practice.
grant insert on table public.appointment_events to authenticated;
grant insert, update on table public.sms_conversations to authenticated;
grant insert on table public.sms_messages to authenticated;
grant insert, update on table public.scheduling_jobs to authenticated;

-- -----------------------------------------
-- 7. RLS
-- -----------------------------------------

alter table public.appointment_events enable row level security;
alter table public.appointment_events force row level security;

drop policy if exists appointment_events_select on public.appointment_events;
create policy appointment_events_select
on public.appointment_events
for select
to authenticated
using (practice_id in (select public.user_practice_ids()));

drop policy if exists appointment_events_insert on public.appointment_events;
create policy appointment_events_insert
on public.appointment_events
for insert
to authenticated
with check (practice_id in (select public.user_practice_ids()));

alter table public.sms_conversations enable row level security;
alter table public.sms_conversations force row level security;

drop policy if exists sms_conversations_select on public.sms_conversations;
create policy sms_conversations_select
on public.sms_conversations
for select
to authenticated
using (practice_id in (select public.user_practice_ids()));

drop policy if exists sms_conversations_insert on public.sms_conversations;
create policy sms_conversations_insert
on public.sms_conversations
for insert
to authenticated
with check (practice_id in (select public.user_practice_ids()));

drop policy if exists sms_conversations_update on public.sms_conversations;
create policy sms_conversations_update
on public.sms_conversations
for update
to authenticated
using (practice_id in (select public.user_practice_ids()))
with check (practice_id in (select public.user_practice_ids()));

alter table public.sms_messages enable row level security;
alter table public.sms_messages force row level security;

drop policy if exists sms_messages_select on public.sms_messages;
create policy sms_messages_select
on public.sms_messages
for select
to authenticated
using (practice_id in (select public.user_practice_ids()));

drop policy if exists sms_messages_insert on public.sms_messages;
create policy sms_messages_insert
on public.sms_messages
for insert
to authenticated
with check (practice_id in (select public.user_practice_ids()));

alter table public.scheduling_jobs enable row level security;
alter table public.scheduling_jobs force row level security;

drop policy if exists scheduling_jobs_select on public.scheduling_jobs;
create policy scheduling_jobs_select
on public.scheduling_jobs
for select
to authenticated
using (practice_id in (select public.user_practice_ids()));

drop policy if exists scheduling_jobs_insert on public.scheduling_jobs;
create policy scheduling_jobs_insert
on public.scheduling_jobs
for insert
to authenticated
with check (practice_id in (select public.user_practice_ids()));

drop policy if exists scheduling_jobs_update on public.scheduling_jobs;
create policy scheduling_jobs_update
on public.scheduling_jobs
for update
to authenticated
using (practice_id in (select public.user_practice_ids()))
with check (practice_id in (select public.user_practice_ids()));

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert
on public.appointments
for insert
to authenticated
with check (practice_id in (select public.user_practice_ids()));

drop policy if exists appointments_update on public.appointments;
create policy appointments_update
on public.appointments
for update
to authenticated
using (practice_id in (select public.user_practice_ids()))
with check (practice_id in (select public.user_practice_ids()));
