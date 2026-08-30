-- =========================================
-- Pin SECURITY DEFINER search_path to empty
-- and schema-qualify application tables.
--
-- Bodies, signatures, return types, auth.uid()
-- checks, and error codes are unchanged from
-- 20260823070000_create_practice_members.sql.
-- This only removes the search_path hijack
-- surface flagged by Security Advisor.
--
-- EXECUTE for authenticated and service_role
-- is restated. anon is not granted.
-- RLS policies are not modified.
-- =========================================

create or replace function public.user_practice_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.id
    from public.practices p
    join public.organizations o
        on o.id = p.organization_id
    where o.owner_user_id = auth.uid()

    union

    select m.practice_id
    from public.practice_members m
    where m.user_id = auth.uid();
$$;

revoke all on function public.user_practice_ids() from public;

grant execute on function public.user_practice_ids()
to authenticated, service_role;


create or replace function public.user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select o.id
    from public.organizations o
    where o.owner_user_id = auth.uid()

    union

    select p.organization_id
    from public.practices p
    join public.practice_members m
        on m.practice_id = p.id
    where m.user_id = auth.uid();
$$;

revoke all on function public.user_organization_ids() from public;

grant execute on function public.user_organization_ids()
to authenticated, service_role;


create or replace function public.user_practice_role(p_practice_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (
            select m.role
            from public.practice_members m
            where m.practice_id = p_practice_id
              and m.user_id = auth.uid()
        ),
        (
            select 'owner'
            from public.practices p
            join public.organizations o
                on o.id = p.organization_id
            where p.id = p_practice_id
              and o.owner_user_id = auth.uid()
        )
    );
$$;

revoke all on function public.user_practice_role(uuid) from public;

grant execute on function public.user_practice_role(uuid)
to authenticated, service_role;


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
returns public.practices
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_practice public.practices;
begin
    if v_user_id is null then
        raise exception 'create_practice_with_owner requires an authenticated user'
            using errcode = '28000';
    end if;

    if not exists (
        select 1
        from public.organizations o
        where o.id = p_organization_id
          and o.owner_user_id = v_user_id
    ) then
        raise exception 'not authorized to create a practice in this organization'
            using errcode = '42501';
    end if;

    insert into public.practices (
        organization_id, name, phone, email, address, city, state, zip_code
    )
    values (
        p_organization_id, p_name, p_phone, p_email, p_address, p_city,
        p_state, p_zip_code
    )
    returning * into v_practice;

    insert into public.practice_members (practice_id, user_id, role)
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
