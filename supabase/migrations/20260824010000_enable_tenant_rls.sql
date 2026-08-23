-- =========================================
-- Gate F: tenant row level security.
--
-- Gate E removed TRUNCATE. This migration does not touch grants. It only
-- enables row level security and adds the minimum authenticated policies
-- the current application needs. anon receives no policies, so the default
-- deny applies even if a later grant accidentally restores DML. service_role
-- carries BYPASSRLS; its access stays a grant question, not a policy one,
-- matching the Gate B treatment of audit_logs.
--
-- audit_logs is not mentioned below. Gate B already enabled RLS and created
-- the SELECT/INSERT policies. Replacing those is out of scope.
--
-- user_practice_ids() and user_organization_ids() are SECURITY DEFINER with
-- a pinned search_path. Policies may call them, including policies on
-- practice_members, practices, and organizations, without recursing: the
-- helper reads those tables as the definer and bypasses RLS inside the
-- function body.
-- =========================================


-- -----------------------------------------
-- organizations
--
-- Not practice-scoped. Staff reach an organization through membership in
-- one of its practices; owners reach it through owner_user_id even when
-- they have not created a practice yet. user_organization_ids() is the
-- helper that encodes both paths. user_practice_ids() alone would lock
-- an owner out of their brand-new organization during onboarding.
--
-- INSERT is the onboarding page writing owner_user_id = auth.uid().
-- -----------------------------------------

alter table organizations enable row level security;

drop policy if exists organizations_select on organizations;

create policy organizations_select
on organizations
for select
to authenticated
using (
    id in (
        select public.user_organization_ids()
    )
);

drop policy if exists organizations_insert on organizations;

create policy organizations_insert
on organizations
for insert
to authenticated
with check (
    owner_user_id = auth.uid()
);


-- -----------------------------------------
-- practices
--
-- Tenant-selection records. SELECT is requirePractice / requirePracticeForPage.
-- INSERT goes through create_practice_with_owner, which is SECURITY DEFINER
-- and checks organization ownership itself. No authenticated INSERT policy,
-- so a client cannot create a practice without the owner membership row.
-- -----------------------------------------

alter table practices enable row level security;

drop policy if exists practices_select on practices;

create policy practices_select
on practices
for select
to authenticated
using (
    id in (
        select public.user_practice_ids()
    )
);


-- -----------------------------------------
-- practice_members
--
-- No application query or write exists yet. SELECT is still defined so a
-- member can read the roster of practices they can already reach; the
-- helper is SECURITY DEFINER, so this does not recurse. Writes stay denied
-- until a staff-invitation path exists. create_practice_with_owner inserts
-- the owner row as the definer and does not need a policy.
-- -----------------------------------------

alter table practice_members enable row level security;

drop policy if exists practice_members_select on practice_members;

create policy practice_members_select
on practice_members
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- -----------------------------------------
-- Shared USING / WITH CHECK for every table that carries practice_id.
-- -----------------------------------------

-- integrations: SELECT + INSERT + UPDATE
--   getOpenDentalIntegration, saveOpenDentalCredentials, last_sync_at.

alter table integrations enable row level security;

drop policy if exists integrations_select on integrations;

create policy integrations_select
on integrations
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists integrations_insert on integrations;

create policy integrations_insert
on integrations
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists integrations_update on integrations;

create policy integrations_update
on integrations
for update
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
)
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- patients: SELECT + upsert (INSERT/UPDATE) from Open Dental sync and
-- every authenticated reader (dashboard, scanners, patient page, lib/data).

alter table patients enable row level security;

drop policy if exists patients_select on patients;

create policy patients_select
on patients
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists patients_insert on patients;

create policy patients_insert
on patients
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists patients_update on patients;

create policy patients_update
on patients
for update
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
)
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- providers: SELECT only (claim detail). Sync does not write this table.

alter table providers enable row level security;

drop policy if exists providers_select on providers;

create policy providers_select
on providers
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- appointments: no application caller today. SELECT isolates any existing
-- rows; writes stay denied until a sync path exists.

alter table appointments enable row level security;

drop policy if exists appointments_select on appointments;

create policy appointments_select
on appointments
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- procedure_codes: scoped through integrations, not practice_id.
-- SELECT + upsert from Open Dental sync.

alter table procedure_codes enable row level security;

drop policy if exists procedure_codes_select on procedure_codes;

create policy procedure_codes_select
on procedure_codes
for select
to authenticated
using (
    exists (
        select 1
        from integrations i
        where i.id = procedure_codes.integration_id
          and i.practice_id in (
              select public.user_practice_ids()
          )
    )
);

drop policy if exists procedure_codes_insert on procedure_codes;

create policy procedure_codes_insert
on procedure_codes
for insert
to authenticated
with check (
    exists (
        select 1
        from integrations i
        where i.id = procedure_codes.integration_id
          and i.practice_id in (
              select public.user_practice_ids()
          )
    )
);

drop policy if exists procedure_codes_update on procedure_codes;

create policy procedure_codes_update
on procedure_codes
for update
to authenticated
using (
    exists (
        select 1
        from integrations i
        where i.id = procedure_codes.integration_id
          and i.practice_id in (
              select public.user_practice_ids()
          )
    )
)
with check (
    exists (
        select 1
        from integrations i
        where i.id = procedure_codes.integration_id
          and i.practice_id in (
              select public.user_practice_ids()
          )
    )
);


-- procedures: SELECT (revenue/treatment scanners) + upsert from sync.

alter table procedures enable row level security;

drop policy if exists procedures_select on procedures;

create policy procedures_select
on procedures
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists procedures_insert on procedures;

create policy procedures_insert
on procedures
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists procedures_update on procedures;

create policy procedures_update
on procedures
for update
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
)
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- claims: SELECT (revenue scanner, assistant, lib/data) + upsert from sync.

alter table claims enable row level security;

drop policy if exists claims_select on claims;

create policy claims_select
on claims
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists claims_insert on claims;

create policy claims_insert
on claims
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists claims_update on claims;

create policy claims_update
on claims
for update
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
)
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- recalls: SELECT (recall scanner, lib/data) + upsert from sync.

alter table recalls enable row level security;

drop policy if exists recalls_select on recalls;

create policy recalls_select
on recalls
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists recalls_insert on recalls;

create policy recalls_insert
on recalls
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists recalls_update on recalls;

create policy recalls_update
on recalls
for update
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
)
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- revenue_opportunities: SELECT everywhere; DELETE+INSERT from the
-- scanners and opportunityService.replaceOpenOpportunities. No UPDATE.

alter table revenue_opportunities enable row level security;

drop policy if exists revenue_opportunities_select on revenue_opportunities;

create policy revenue_opportunities_select
on revenue_opportunities
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists revenue_opportunities_insert on revenue_opportunities;

create policy revenue_opportunities_insert
on revenue_opportunities
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists revenue_opportunities_delete on revenue_opportunities;

create policy revenue_opportunities_delete
on revenue_opportunities
for delete
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);


-- ai_conversations: no application caller. SELECT isolates leftover PHI
-- to the owning practice; writes stay denied.

alter table ai_conversations enable row level security;

drop policy if exists ai_conversations_select on ai_conversations;

create policy ai_conversations_select
on ai_conversations
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);
