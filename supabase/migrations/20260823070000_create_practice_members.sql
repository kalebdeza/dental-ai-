-- =========================================
-- Practice membership.
--
-- Access was previously derived solely from organizations.owner_user_id,
-- so exactly one login could ever reach a practice's data. A dental office
-- needs separate logins for the front desk, hygienists, and the office
-- manager, and audit_logs.user_id only becomes meaningful once those
-- separate logins exist.
--
-- Everything here is additive. The ownership path stays in
-- user_practice_ids(), so every existing owner keeps access without a
-- single row being written and reverting this migration cannot lock
-- anyone out.
--
-- This migration deliberately changes no grants and enables no row level
-- security. Those belong to Gate E and Gate F.
-- =========================================

-- =========================================
-- 1. Membership table.
-- =========================================

create table if not exists practice_members (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    -- Matches the auth.users reference already used by audit_logs.user_id,
    -- but cascades rather than nulling: membership is current state, not
    -- history, so a deleted user should simply stop being a member.
    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    role text not null default 'front_desk',

    created_at timestamptz not null default now(),

    constraint practice_members_practice_user_key
        unique (practice_id, user_id),

    -- text plus a check rather than an enum, matching how the rest of this
    -- schema constrains strings. Adding a role stays a constraint swap.
    constraint practice_members_role_check
        check (role in ('owner', 'admin', 'clinician', 'front_desk', 'read_only'))
);

-- The unique constraint already indexes practice_id as its leading column,
-- so only the user_id direction needs an index of its own. It is the hot
-- path: user_practice_ids() looks up by user_id on every policy evaluation
-- once Gate F enables row level security.
create index if not exists idx_practice_members_user
on practice_members(user_id);

-- =========================================
-- 2. Close the gaps on organizations.owner_user_id.
--
--    The column was added as a bare nullable uuid with no reference, no
--    index, and no constraint, yet it is the root of every access check.
-- =========================================

create index if not exists idx_organizations_owner_user
on organizations(owner_user_id);

-- set null rather than cascade: deleting a user must never cascade into
-- deleting an organization and, through it, every patient record it owns.
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'organizations_owner_user_id_fkey'
    ) then
        alter table organizations
            add constraint organizations_owner_user_id_fkey
            foreign key (owner_user_id)
            references auth.users(id)
            on delete set null;
    end if;
end $$;

-- =========================================
-- 3. Backfill existing owners as owner members.
--
--    Additive and idempotent. Owners would keep access without this via
--    the ownership branch of user_practice_ids(); the backfill exists so
--    that membership becomes the primary source of truth going forward.
-- =========================================

insert into practice_members (practice_id, user_id, role)
select p.id, o.owner_user_id, 'owner'
from practices p
join organizations o
    on o.id = p.organization_id
where o.owner_user_id is not null
on conflict (practice_id, user_id) do nothing;

-- =========================================
-- 4. Resolve the practices the current user may reach.
--
--    security definer is now load-bearing rather than merely convenient.
--    A Gate F policy on practice_members that called this helper would
--    otherwise recurse: the policy asks the helper, the helper reads the
--    table, the read invokes the policy. Running as the definer bypasses
--    row level security inside the function and breaks that cycle, which
--    is also why search_path stays pinned.
-- =========================================

create or replace function public.user_practice_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select p.id
    from practices p
    join organizations o
        on o.id = p.organization_id
    where o.owner_user_id = auth.uid()

    union

    select m.practice_id
    from practice_members m
    where m.user_id = auth.uid();
$$;

revoke all on function public.user_practice_ids() from public;

grant execute on function public.user_practice_ids()
to authenticated, service_role;

-- =========================================
-- 5. Resolve the organizations the current user may reach.
--
--    Needed by the Gate F policies on practices, and by the auth helpers
--    so that a staff member can read the practice and organization rows
--    they belong to without owning anything.
-- =========================================

create or replace function public.user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select o.id
    from organizations o
    where o.owner_user_id = auth.uid()

    union

    select p.organization_id
    from practices p
    join practice_members m
        on m.practice_id = p.id
    where m.user_id = auth.uid();
$$;

revoke all on function public.user_organization_ids() from public;

grant execute on function public.user_organization_ids()
to authenticated, service_role;

-- =========================================
-- 6. Resolve the current user's role in one practice.
--
--    Reading practice_members directly from the application would depend
--    on a table grant that differs between environments, so the lookup is
--    wrapped instead. Falls back to 'owner' for the ownership path, where
--    no membership row is required, and returns null when the user has no
--    access at all.
-- =========================================

create or replace function public.user_practice_role(p_practice_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select m.role
            from practice_members m
            where m.practice_id = p_practice_id
              and m.user_id = auth.uid()
        ),
        (
            select 'owner'
            from practices p
            join organizations o
                on o.id = p.organization_id
            where p.id = p_practice_id
              and o.owner_user_id = auth.uid()
        )
    );
$$;

revoke all on function public.user_practice_role(uuid) from public;

grant execute on function public.user_practice_role(uuid)
to authenticated, service_role;

-- =========================================
-- 7. Create a practice and its owner membership together.
--
--    Onboarding previously inserted the practice from the browser with no
--    membership at all. Once Gate F is enabled, a practice with no members
--    is invisible to everyone including the person who created it, with no
--    application path to recover it. One transaction removes that state.
--
--    security definer, so the insert does not depend on table grants that
--    vary between environments. Because a definer function bypasses every
--    grant and, after Gate F, every policy, authorization is checked
--    explicitly below rather than inherited.
-- =========================================

create or replace function public.create_practice_with_owner(
    p_organization_id uuid,
    p_name text,
    p_phone text default null,
    p_email text default null,
    p_address text default null,
    p_city text default null,
    p_state text default null,
    p_zip_code text default null
)
returns practices
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_practice practices;
begin
    if v_user_id is null then
        raise exception 'create_practice_with_owner requires an authenticated user'
            using errcode = '28000';
    end if;

    if not exists (
        select 1
        from organizations o
        where o.id = p_organization_id
          and o.owner_user_id = v_user_id
    ) then
        raise exception 'not authorized to create a practice in this organization'
            using errcode = '42501';
    end if;

    insert into practices (
        organization_id, name, phone, email, address, city, state, zip_code
    )
    values (
        p_organization_id, p_name, p_phone, p_email, p_address, p_city,
        p_state, p_zip_code
    )
    returning * into v_practice;

    insert into practice_members (practice_id, user_id, role)
    values (v_practice.id, v_user_id, 'owner');

    return v_practice;
end;
$$;

revoke all on function public.create_practice_with_owner(
    uuid, text, text, text, text, text, text, text
) from public;

grant execute on function public.create_practice_with_owner(
    uuid, text, text, text, text, text, text, text
) to authenticated, service_role;
