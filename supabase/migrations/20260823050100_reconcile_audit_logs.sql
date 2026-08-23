-- =========================================
-- 1. Converge structure.
--    No-op on the remote, which already has this table. Creates it on a
--    fresh database, where audit_logs was never in the migration history.
--    Definition mirrors the verified remote state exactly.
-- =========================================

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),

    user_id uuid
        references auth.users(id)
        on delete set null,

    practice_id uuid
        references practices(id)
        on delete set null,

    action text not null,

    resource text,

    metadata jsonb,

    created_at timestamptz not null default now()
);

-- =========================================
-- 2. Indexes.
--    The first three reproduce the objects that already exist on the
--    remote, so a fresh database converges to the same shape. The fourth
--    is new and serves the tenant-scoped, time-ordered read pattern.
-- =========================================

create index if not exists audit_logs_practice_id_idx
on audit_logs(practice_id);

create index if not exists audit_logs_user_id_idx
on audit_logs(user_id);

create index if not exists audit_logs_created_at_idx
on audit_logs(created_at);

create index if not exists idx_audit_logs_practice_created
on audit_logs(practice_id, created_at desc);

-- =========================================
-- 3. Privileges.
--    Revoke wholesale, then re-grant the minimum. This strips UPDATE,
--    DELETE, TRUNCATE, REFERENCES, and TRIGGER, and removes anon entirely.
--    TRUNCATE matters most here: row level security does not apply to it,
--    so no policy can substitute for withholding the grant.
--
--    Every one of these roles is revoked before being granted, because the
--    two environments start from different states: the remote already holds
--    wholesale grants on an existing table, while a fresh database inherits
--    only non-data privileges from this project's default ACLs. Revoking
--    first is what makes both converge on the same privilege model.
-- =========================================

revoke all on table audit_logs from anon;

revoke all on table audit_logs from authenticated;

grant select, insert on table audit_logs to authenticated;

-- service_role is the server-side compliance and export path. It needs
-- SELECT to read orphaned records, whose practice_id is null once a practice
-- is deleted and which therefore match no tenant-scoped policy, and INSERT
-- for audit writes originating outside a user session. It is denied UPDATE,
-- DELETE, and TRUNCATE so that no application credential can rewrite or
-- destroy audit history.

revoke all on table audit_logs from service_role;

grant select, insert on table audit_logs to service_role;

-- =========================================
-- 4. Row level security. Already enabled on the remote; this is a no-op
--    there and required on a fresh database.
-- =========================================

alter table audit_logs enable row level security;

-- =========================================
-- 5. Policies.
--    New policies are created before the old ones are dropped. Permissive
--    policies OR together, so there is never a window in which RLS
--    default-denies and audit inserts fail. The insert policy adds a
--    user_id check the existing policy lacks, closing attribution forgery.
--
--    Both policies target authenticated only, and deliberately so.
--    service_role carries the BYPASSRLS attribute, so policies never apply
--    to it; its access is bounded by the table grants above rather than by
--    RLS. That is what lets it read orphaned rows with a null practice_id,
--    which no practice-scoped policy can ever match.
-- =========================================

drop policy if exists audit_logs_select on audit_logs;

create policy audit_logs_select
on audit_logs
for select
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
);

drop policy if exists audit_logs_insert on audit_logs;

create policy audit_logs_insert
on audit_logs
for insert
to authenticated
with check (
    practice_id in (
        select public.user_practice_ids()
    )
    and (
        user_id is null
        or user_id = auth.uid()
    )
);

drop policy if exists
    "Users can view their practice audit logs" on audit_logs;

drop policy if exists
    "Users can create their practice audit logs" on audit_logs;
