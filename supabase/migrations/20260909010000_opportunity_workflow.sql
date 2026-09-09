-- =========================================
-- Persistent opportunity workflow foundation.
--
-- Adds office-owned status on revenue_opportunities,
-- an append-only activity log, a trigger that keeps
-- completed synchronized with workflow_status, and a
-- single RPC that applies a mutation and writes the
-- activity in one transaction.
--
-- contacted and scheduled are office workflow states.
-- They are not Open Dental appointment states.
--
-- Dismiss sets workflow_status = dismissed.
-- Opportunities are never deleted to dismiss them.
--
-- Existing rows are backfilled from completed only:
--   true  → completed
--   false → open
-- No historical activity rows are created.
-- =========================================

-- -----------------------------------------
-- 1. Columns
-- -----------------------------------------

alter table public.revenue_opportunities
    add column if not exists workflow_status text not null default 'open',
    add column if not exists contact_outcome text,
    add column if not exists snoozed_until timestamptz,
    add column if not exists last_actor_user_id uuid
        references auth.users(id)
        on delete set null,
    add column if not exists last_acted_at timestamptz;

-- Backfill from the existing completed flag only.
-- Do not invent contacted, scheduled, or dismissed.
-- Do not insert into opportunity_activities.
update public.revenue_opportunities
set workflow_status = 'completed'
where completed = true
  and workflow_status is distinct from 'completed';

alter table public.revenue_opportunities
    drop constraint if exists revenue_opportunities_workflow_status_check;

alter table public.revenue_opportunities
    add constraint revenue_opportunities_workflow_status_check
    check (
        workflow_status in (
            'open',
            'contacted',
            'scheduled',
            'completed',
            'dismissed'
        )
    );

alter table public.revenue_opportunities
    drop constraint if exists revenue_opportunities_contact_outcome_check;

alter table public.revenue_opportunities
    add constraint revenue_opportunities_contact_outcome_check
    check (
        contact_outcome is null
        or contact_outcome in (
            'scheduled',
            'will_call_back',
            'no_answer',
            'left_voicemail',
            'declined',
            'wrong_number'
        )
    );

create index if not exists revenue_opportunities_practice_workflow
on public.revenue_opportunities (practice_id, opportunity_type, workflow_status);

-- -----------------------------------------
-- 2. Identity + completed/status sync
--
-- workflow_status wins when it changes.
-- Scanner completions that only flip completed
-- also set workflow_status = completed.
-- Dismissed rows stay dismissed (completed = false)
-- even if a writer tries to set completed = true.
-- Completed rows cannot be reopened via completed.
-- practice_id, opportunity_type, and source FKs
-- cannot be changed after insert.
-- -----------------------------------------

create or replace function public.enforce_revenue_opportunity_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if TG_OP = 'UPDATE' then
        if new.practice_id is distinct from old.practice_id
            or new.opportunity_type is distinct from old.opportunity_type
            or new.patient_id is distinct from old.patient_id
            or new.claim_id is distinct from old.claim_id
            or new.procedure_id is distinct from old.procedure_id
            or new.recall_id is distinct from old.recall_id
        then
            raise exception
                'Opportunity identity and source keys are immutable';
        end if;

        if new.last_actor_user_id is distinct from old.last_actor_user_id
            and new.last_actor_user_id is not null
            and new.last_actor_user_id is distinct from auth.uid()
        then
            raise exception 'last_actor_user_id must equal auth.uid()';
        end if;

        if old.workflow_status in ('completed', 'dismissed')
            and new.workflow_status is distinct from old.workflow_status
        then
            raise exception 'Invalid workflow transition';
        end if;
    end if;

    if new.workflow_status is null then
        new.workflow_status := 'open';
    end if;

    if TG_OP = 'INSERT' then
        new.completed := (new.workflow_status = 'completed');
        return new;
    end if;

    if new.workflow_status is distinct from old.workflow_status then
        new.completed := (new.workflow_status = 'completed');
        return new;
    end if;

    if new.completed is distinct from old.completed then
        if old.workflow_status = 'dismissed' then
            new.workflow_status := 'dismissed';
            new.completed := false;
        elsif new.completed then
            new.workflow_status := 'completed';
            new.completed := true;
        elsif old.workflow_status = 'completed' then
            new.workflow_status := 'completed';
            new.completed := true;
        else
            new.completed := (new.workflow_status = 'completed');
        end if;
        return new;
    end if;

    new.completed := (new.workflow_status = 'completed');
    return new;
end;
$$;

drop trigger if exists enforce_revenue_opportunity_workflow
on public.revenue_opportunities;

create trigger enforce_revenue_opportunity_workflow
before insert or update
on public.revenue_opportunities
for each row
execute function public.enforce_revenue_opportunity_workflow();

revoke all on function public.enforce_revenue_opportunity_workflow()
from public, anon, authenticated, service_role;

-- -----------------------------------------
-- 3. Append-only activity log
-- -----------------------------------------

create table if not exists public.opportunity_activities (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    opportunity_id uuid not null
        references public.revenue_opportunities(id)
        on delete cascade,

    actor_user_id uuid not null
        references auth.users(id),

    event_type text not null
        check (
            event_type in (
                'status_change',
                'contact_outcome',
                'note',
                'snooze',
                'complete',
                'dismiss'
            )
        ),

    from_status text
        check (
            from_status is null
            or from_status in (
                'open',
                'contacted',
                'scheduled',
                'completed',
                'dismissed'
            )
        ),

    to_status text
        check (
            to_status is null
            or to_status in (
                'open',
                'contacted',
                'scheduled',
                'completed',
                'dismissed'
            )
        ),

    contact_outcome text
        check (
            contact_outcome is null
            or contact_outcome in (
                'scheduled',
                'will_call_back',
                'no_answer',
                'left_voicemail',
                'declined',
                'wrong_number'
            )
        ),

    note text,

    snoozed_until timestamptz,

    created_at timestamptz not null default now()
);

create index if not exists opportunity_activities_opportunity_created
on public.opportunity_activities (practice_id, opportunity_id, created_at);

revoke all on table public.opportunity_activities from public;
revoke all on table public.opportunity_activities from anon;
revoke all on table public.opportunity_activities from authenticated;
revoke all on table public.opportunity_activities from service_role;

grant select, insert on table public.opportunity_activities to authenticated;
grant select on table public.opportunity_activities to service_role;

alter table public.opportunity_activities enable row level security;
alter table public.opportunity_activities force row level security;

drop policy if exists opportunity_activities_select
on public.opportunity_activities;

create policy opportunity_activities_select
on public.opportunity_activities
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists opportunity_activities_insert
on public.opportunity_activities;

create policy opportunity_activities_insert
on public.opportunity_activities
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
    and actor_user_id = auth.uid()
    and opportunity_id in (
        select id
        from public.revenue_opportunities
        where practice_id = opportunity_activities.practice_id
    )
);

-- No UPDATE or DELETE policies. Append-only.

-- -----------------------------------------
-- 4. Workflow-owned columns are RPC-only
--
-- Authenticated clients must not UPDATE
-- office workflow columns directly. The
-- apply_opportunity_workflow RPC is the
-- only authenticated mutation path.
--
-- Scanner-owned column grants from
-- 20260909000000 stay unchanged:
-- reason, recommended_action,
-- estimated_value, priority,
-- confidence_score, completed, updated_at.
-- -----------------------------------------

revoke update (
    workflow_status,
    contact_outcome,
    snoozed_until,
    last_actor_user_id,
    last_acted_at
)
on table public.revenue_opportunities
from authenticated;

-- -----------------------------------------
-- 5. Transactional workflow RPC
--
-- SECURITY DEFINER so the function can
-- write workflow columns without granting
-- those UPDATE privileges to authenticated.
-- Actor is always auth.uid(). There is no
-- actor argument. practice_id must already
-- belong to the caller. Only workflow-owned
-- columns are updated.
-- -----------------------------------------

create or replace function public.opportunity_workflow_transition_allowed(
    p_opportunity_type text,
    p_from text,
    p_to text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select case
        when p_from in ('completed', 'dismissed') then false
        when p_to = 'open' then false
        when p_to in ('contacted', 'scheduled') then
            p_opportunity_type in ('Recall', 'Treatment')
            and p_from in ('open', 'contacted', 'scheduled')
        when p_to in ('completed', 'dismissed') then
            p_from in ('open', 'contacted', 'scheduled')
        else false
    end;
$$;

revoke all on function public.opportunity_workflow_transition_allowed(text, text, text)
from public, anon;

grant execute on function public.opportunity_workflow_transition_allowed(text, text, text)
to authenticated;

create or replace function public.apply_opportunity_workflow(
    p_opportunity_id uuid,
    p_practice_id uuid,
    p_event_type text,
    p_to_status text default null,
    p_contact_outcome text default null,
    p_note text default null,
    p_snoozed_until timestamptz default null,
    p_clear_snooze boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor uuid := auth.uid();
    v_row public.revenue_opportunities%rowtype;
    v_updated public.revenue_opportunities%rowtype;
    v_activity public.opportunity_activities%rowtype;
    v_next text;
    v_snoozed timestamptz;
begin
    if v_actor is null then
        raise exception 'Not authenticated';
    end if;

    if p_practice_id is null
        or not exists (
            select 1
            from public.user_practice_ids() as ids
            where ids = p_practice_id
        )
    then
        raise exception 'Opportunity not found';
    end if;

    select *
    into v_row
    from public.revenue_opportunities
    where id = p_opportunity_id
      and practice_id = p_practice_id
    for update;

    if not found then
        raise exception 'Opportunity not found';
    end if;

    if p_event_type not in (
        'status_change',
        'contact_outcome',
        'note',
        'snooze',
        'complete',
        'dismiss'
    ) then
        raise exception 'Invalid workflow event';
    end if;

    v_next := coalesce(p_to_status, v_row.workflow_status);

    if v_row.opportunity_type = 'Claim'
        and (
            p_event_type = 'contact_outcome'
            or v_next in ('contacted', 'scheduled')
        )
    then
        raise exception 'Invalid workflow transition';
    end if;

    if p_event_type in ('note', 'snooze') then
        if p_to_status is not null
            and p_to_status is distinct from v_row.workflow_status
        then
            raise exception 'Invalid workflow transition';
        end if;

        if p_event_type = 'snooze'
            and v_row.workflow_status in ('completed', 'dismissed')
        then
            raise exception 'Invalid workflow transition';
        end if;

        if p_event_type = 'note'
            and (
                p_note is null
                or length(btrim(p_note)) = 0
            )
        then
            raise exception 'Note is required';
        end if;

        if p_event_type = 'snooze' and p_snoozed_until is null then
            raise exception 'Snooze until is required';
        end if;
    elsif p_event_type = 'contact_outcome' then
        if p_contact_outcome is null
            or p_to_status is null
            or not public.opportunity_workflow_transition_allowed(
                v_row.opportunity_type,
                v_row.workflow_status,
                p_to_status
            )
        then
            raise exception 'Invalid workflow transition';
        end if;
    elsif not public.opportunity_workflow_transition_allowed(
        v_row.opportunity_type,
        v_row.workflow_status,
        v_next
    ) then
        raise exception 'Invalid workflow transition';
    end if;

    if p_event_type = 'complete' and v_next is distinct from 'completed' then
        raise exception 'Invalid workflow transition';
    end if;

    if p_event_type = 'dismiss' and v_next is distinct from 'dismissed' then
        raise exception 'Invalid workflow transition';
    end if;

    v_snoozed := case
        when p_event_type = 'snooze' then p_snoozed_until
        when p_clear_snooze then null
        when v_next in ('completed', 'dismissed') then null
        else v_row.snoozed_until
    end;

    update public.revenue_opportunities
    set
        workflow_status = v_next,
        contact_outcome = case
            when p_event_type = 'contact_outcome' then p_contact_outcome
            else contact_outcome
        end,
        snoozed_until = v_snoozed,
        last_actor_user_id = v_actor,
        last_acted_at = now(),
        updated_at = now()
    where id = p_opportunity_id
      and practice_id = p_practice_id
    returning * into v_updated;

    insert into public.opportunity_activities (
        practice_id,
        opportunity_id,
        actor_user_id,
        event_type,
        from_status,
        to_status,
        contact_outcome,
        note,
        snoozed_until
    )
    values (
        p_practice_id,
        p_opportunity_id,
        v_actor,
        p_event_type,
        v_row.workflow_status,
        v_next,
        case
            when p_event_type = 'contact_outcome' then p_contact_outcome
            else null
        end,
        nullif(btrim(coalesce(p_note, '')), ''),
        case
            when p_event_type = 'snooze' then p_snoozed_until
            else null
        end
    )
    returning * into v_activity;

    return jsonb_build_object(
        'opportunity', to_jsonb(v_updated),
        'activity', to_jsonb(v_activity)
    );
end;
$$;

revoke all on function public.apply_opportunity_workflow(
    uuid, uuid, text, text, text, text, timestamptz, boolean
)
from public, anon, service_role;

grant execute on function public.apply_opportunity_workflow(
    uuid, uuid, text, text, text, text, timestamptz, boolean
)
to authenticated;
