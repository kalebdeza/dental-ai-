-- Scheduling cron needs practice name and timezone
-- to render demo SMS. service_role currently cannot
-- SELECT practices, so cancellation_recovery jobs fail
-- with "permission denied for table practices".

grant select on table public.practices to service_role;
