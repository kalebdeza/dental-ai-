-- =========================================
-- Claim payment attribution MVP.
--
-- Stores Open Dental ClaimProc rows and an
-- append-audited attribution ledger. Recovered
-- revenue is summed only from active ledger
-- rows. It is never derived from
-- claims.amount_paid, claims.paid_at,
-- scanner_closed, or office Complete.
--
-- DateCP is stored as date_cp
-- ("Open Dental PMS payment-report date").
-- There is no paid_at column.
--
-- Authenticated clients may SELECT tenant rows.
-- They cannot INSERT/UPDATE/DELETE ClaimProc
-- or attribution rows. Scheduler uses
-- service_role.
-- =========================================

-- -----------------------------------------
-- 1. opendental_claimprocs
-- -----------------------------------------

create table if not exists public.opendental_claimprocs (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    integration_id uuid not null
        references public.integrations(id)
        on delete cascade,

    source_claimproc_id bigint not null,
    source_claim_id bigint,
    source_procedure_id bigint,
    source_patient_id bigint,

    ins_pay_amt numeric(12,2) not null default 0,
    ins_pay_est numeric(12,2) not null default 0,
    status text not null,
    write_off numeric(12,2) not null default 0,
    claim_payment_num bigint,

    date_cp date,
    date_entry date,
    proc_date date,

    fee_billed numeric(12,2),
    ded_applied numeric(12,2),
    copay_amt numeric(12,2),

    is_transfer boolean,
    is_overpay boolean,
    claim_adj_reason_codes text,

    absent_from_sync_at timestamptz,

    last_synced_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (integration_id, source_claimproc_id)
);

create index if not exists opendental_claimprocs_practice
on public.opendental_claimprocs (practice_id);

create index if not exists opendental_claimprocs_integration
on public.opendental_claimprocs (integration_id);

create index if not exists opendental_claimprocs_source_claimproc
on public.opendental_claimprocs (source_claimproc_id);

create index if not exists opendental_claimprocs_source_claim
on public.opendental_claimprocs (practice_id, source_claim_id);

create index if not exists opendental_claimprocs_source_procedure
on public.opendental_claimprocs (practice_id, source_procedure_id);

create index if not exists opendental_claimprocs_status
on public.opendental_claimprocs (practice_id, status);

create index if not exists opendental_claimprocs_claim_payment
on public.opendental_claimprocs (claim_payment_num);

-- -----------------------------------------
-- 2. opportunity_payment_attributions
--
-- One current row per ClaimProc while it is
-- actively credited. Reversed rows stay for
-- audit. A partial unique index prevents the
-- same ClaimProc from crediting two
-- opportunities at once.
-- -----------------------------------------

create table if not exists public.opportunity_payment_attributions (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    opportunity_id uuid not null
        references public.revenue_opportunities(id)
        on delete restrict,

    claimproc_id uuid not null
        references public.opendental_claimprocs(id)
        on delete restrict,

    source_claimproc_id bigint not null,

    credited_amount numeric(12,2) not null default 0,
    payment_dated_at date not null,
    identified_at_snapshot timestamptz not null,
    cap_snapshot numeric(12,2) not null,

    status text not null default 'active',
    reversed_at timestamptz,
    reversal_reason text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint opportunity_payment_attributions_status_check
        check (status in ('active', 'reversed')),

    constraint opportunity_payment_attributions_credited_nonnegative
        check (credited_amount >= 0)
);

create unique index if not exists opportunity_payment_attributions_one_active_claimproc
on public.opportunity_payment_attributions (claimproc_id)
where status = 'active';

create index if not exists opportunity_payment_attributions_practice
on public.opportunity_payment_attributions (practice_id);

create index if not exists opportunity_payment_attributions_opportunity
on public.opportunity_payment_attributions (practice_id, opportunity_id);

create index if not exists opportunity_payment_attributions_claimproc
on public.opportunity_payment_attributions (claimproc_id);

-- -----------------------------------------
-- 3. attribution events (mutation audit)
-- -----------------------------------------

create table if not exists public.opportunity_payment_attribution_events (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references public.practices(id)
        on delete cascade,

    attribution_id uuid not null
        references public.opportunity_payment_attributions(id)
        on delete cascade,

    opportunity_id uuid not null,
    claimproc_id uuid not null,
    source_claimproc_id bigint not null,

    event_type text not null,
    previous_credited_amount numeric(12,2),
    credited_amount numeric(12,2) not null,
    reason text,

    created_at timestamptz not null default now(),

    constraint opportunity_payment_attribution_events_type_check
        check (event_type in ('credit', 'adjust', 'reverse'))
);

create index if not exists opportunity_payment_attribution_events_practice
on public.opportunity_payment_attribution_events (practice_id, created_at);

create index if not exists opportunity_payment_attribution_events_attribution
on public.opportunity_payment_attribution_events (attribution_id, created_at);

-- -----------------------------------------
-- 4. Grants
-- -----------------------------------------

revoke all on table public.opendental_claimprocs from public;
revoke all on table public.opendental_claimprocs from anon;
revoke all on table public.opendental_claimprocs from authenticated;
revoke all on table public.opendental_claimprocs from service_role;

grant select on table public.opendental_claimprocs to authenticated;
grant select, insert, update on table public.opendental_claimprocs to service_role;

revoke all on table public.opportunity_payment_attributions from public;
revoke all on table public.opportunity_payment_attributions from anon;
revoke all on table public.opportunity_payment_attributions from authenticated;
revoke all on table public.opportunity_payment_attributions from service_role;

grant select on table public.opportunity_payment_attributions to authenticated;
grant select, insert, update on table public.opportunity_payment_attributions to service_role;

revoke all on table public.opportunity_payment_attribution_events from public;
revoke all on table public.opportunity_payment_attribution_events from anon;
revoke all on table public.opportunity_payment_attribution_events from authenticated;
revoke all on table public.opportunity_payment_attribution_events from service_role;

grant select on table public.opportunity_payment_attribution_events to authenticated;
grant select, insert on table public.opportunity_payment_attribution_events to service_role;

-- -----------------------------------------
-- 5. RLS
-- -----------------------------------------

alter table public.opendental_claimprocs enable row level security;
alter table public.opendental_claimprocs force row level security;

drop policy if exists opendental_claimprocs_select
on public.opendental_claimprocs;

create policy opendental_claimprocs_select
on public.opendental_claimprocs
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

alter table public.opportunity_payment_attributions enable row level security;
alter table public.opportunity_payment_attributions force row level security;

drop policy if exists opportunity_payment_attributions_select
on public.opportunity_payment_attributions;

create policy opportunity_payment_attributions_select
on public.opportunity_payment_attributions
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

alter table public.opportunity_payment_attribution_events enable row level security;
alter table public.opportunity_payment_attribution_events force row level security;

drop policy if exists opportunity_payment_attribution_events_select
on public.opportunity_payment_attribution_events;

create policy opportunity_payment_attribution_events_select
on public.opportunity_payment_attribution_events
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);
