-- =========================================
-- Prevent authenticated sessions from
-- reading integrations.customer_key.
--
-- Connect/test still INSERT/UPDATE the
-- encrypted key through the user session.
-- Scheduler and server-side key reads use
-- service_role, which keeps SELECT.
-- =========================================

revoke select (customer_key)
on table public.integrations
from authenticated;

-- Explicitly keep service_role SELECT,
-- including customer_key, for scheduler
-- customer-key load and sync stamps.
grant select (customer_key)
on table public.integrations
to service_role;
