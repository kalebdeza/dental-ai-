-- Resolves the practices owned by the current user.
--
-- security definer so that policies using this helper are not themselves
-- filtered by row level security on practices or organizations once Gate F
-- enables it. search_path is pinned because a definer function with a
-- mutable search_path can be hijacked.
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
    where o.owner_user_id = auth.uid();
$$;

revoke all on function public.user_practice_ids() from public;

grant execute on function public.user_practice_ids()
to authenticated, service_role;
