-- =========================================
-- Revoke unused authenticated DELETE on
-- public.revenue_opportunities.
--
-- Dismissal is workflow_status = dismissed
-- via apply_opportunity_workflow. Scanner
-- merge inserts/updates and never deletes.
-- Authenticated clients no longer need
-- table DELETE.
--
-- service_role DELETE is left unchanged.
-- =========================================

revoke delete
on table public.revenue_opportunities
from authenticated;

drop policy if exists revenue_opportunities_delete
on public.revenue_opportunities;
