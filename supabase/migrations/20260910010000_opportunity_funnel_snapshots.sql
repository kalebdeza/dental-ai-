-- =========================================
-- Opportunity funnel snapshots and close
-- reason. Preserves the first identified
-- estimated value and distinguishes office
-- close from scanner close.
--
-- identified_at / identified_estimated_value
-- are set on INSERT and frozen on UPDATE.
-- Scanner may still refresh estimated_value.
-- =========================================

alter table public.revenue_opportunities
    add column if not exists identified_at timestamptz,
    add column if not exists identified_estimated_value numeric(12,2),
    add column if not exists close_reason text;

update public.revenue_opportunities
set
    identified_at = coalesce(identified_at, created_at, now()),
    identified_estimated_value = coalesce(
        identified_estimated_value,
        estimated_value,
        0
    )
where identified_at is null
   or identified_estimated_value is null;

alter table public.revenue_opportunities
    alter column identified_at set default now(),
    alter column identified_at set not null,
    alter column identified_estimated_value set default 0,
    alter column identified_estimated_value set not null;

alter table public.revenue_opportunities
    drop constraint if exists revenue_opportunities_close_reason_check;

alter table public.revenue_opportunities
    add constraint revenue_opportunities_close_reason_check
    check (
        close_reason is null
        or close_reason in (
            'office_completed',
            'office_dismissed',
            'scanner_closed'
        )
    );

update public.revenue_opportunities
set close_reason = 'office_dismissed'
where workflow_status = 'dismissed'
  and close_reason is null;

update public.revenue_opportunities as opportunity
set close_reason = 'office_completed'
where opportunity.workflow_status = 'completed'
  and opportunity.close_reason is null
  and exists (
      select 1
      from public.opportunity_activities as activity
      where activity.opportunity_id = opportunity.id
        and activity.to_status = 'completed'
        and activity.event_type in ('complete', 'status_change')
  );

update public.revenue_opportunities
set close_reason = 'scanner_closed'
where workflow_status = 'completed'
  and close_reason is null;

create index if not exists revenue_opportunities_practice_close_reason
on public.revenue_opportunities (practice_id, close_reason);

-- Scanner may stamp scanner_closed when it
-- completes leftover open rows. Office
-- completed/dismissed is written by the RPC.
grant update (close_reason)
on table public.revenue_opportunities
to authenticated;

grant update (close_reason)
on table public.revenue_opportunities
to service_role;

revoke update (identified_at, identified_estimated_value)
on table public.revenue_opportunities
from authenticated;

revoke update (identified_at, identified_estimated_value)
on table public.revenue_opportunities
from service_role;

create or replace function public.enforce_revenue_opportunity_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if TG_OP = 'INSERT' then
        if new.workflow_status is null then
            new.workflow_status := 'open';
        end if;

        new.completed := (new.workflow_status = 'completed');
        new.identified_at := coalesce(
            new.identified_at,
            new.created_at,
            now()
        );
        new.identified_estimated_value := coalesce(new.estimated_value, 0);
        return new;
    end if;

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

    new.identified_at := old.identified_at;
    new.identified_estimated_value := old.identified_estimated_value;

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

    if new.workflow_status is null then
        new.workflow_status := 'open';
    end if;

    if new.workflow_status is distinct from old.workflow_status then
        new.completed := (new.workflow_status = 'completed');
    elsif new.completed is distinct from old.completed then
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
    else
        new.completed := (new.workflow_status = 'completed');
    end if;

    if old.close_reason in ('office_completed', 'office_dismissed') then
        new.close_reason := old.close_reason;
    elsif new.workflow_status = 'dismissed' then
        new.close_reason := coalesce(new.close_reason, 'office_dismissed');
    elsif new.workflow_status = 'completed' then
        new.close_reason := coalesce(new.close_reason, 'scanner_closed');
    end if;

    if new.close_reason is not null
        and new.close_reason not in (
            'office_completed',
            'office_dismissed',
            'scanner_closed'
        )
    then
        raise exception 'Invalid close_reason';
    end if;

    return new;
end;
$$;

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
    v_close text;
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

    v_close := case
        when v_next = 'completed' then 'office_completed'
        when v_next = 'dismissed' then 'office_dismissed'
        else v_row.close_reason
    end;

    update public.revenue_opportunities
    set
        workflow_status = v_next,
        contact_outcome = case
            when p_event_type = 'contact_outcome' then p_contact_outcome
            else contact_outcome
        end,
        snoozed_until = v_snoozed,
        close_reason = v_close,
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
