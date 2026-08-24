-- =========================================
-- Revoke EXECUTE on the SECURITY DEFINER
-- helpers from anon.
--
-- Gate D already granted EXECUTE to
-- authenticated and service_role and revoked
-- from public. Production verification still
-- showed anon holding EXECUTE. This migration
-- removes that grant only. It does not change
-- function bodies, RLS, table grants, policies,
-- or EXECUTE for authenticated / service_role.
--
-- REVOKE is idempotent if anon never held the
-- privilege.
-- =========================================

revoke execute on function public.user_practice_ids()
from anon;

revoke execute on function public.user_organization_ids()
from anon;

revoke execute on function public.user_practice_role(uuid)
from anon;

revoke execute on function public.create_practice_with_owner(
    uuid, text, text, text, text, text, text, text
)
from anon;
