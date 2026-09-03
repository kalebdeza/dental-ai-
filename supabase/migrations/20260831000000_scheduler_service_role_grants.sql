-- =========================================
-- Scheduler preparation: service_role grants + scan timestamps.
--
-- A future server-side job (not a browser session) must enumerate connected
-- Open Dental integrations and write sync/scan results. Gate E revoked all
-- tenant DML from service_role, so that job cannot run today.
--
-- This migration restores the minimum service_role privileges for that path
-- only. It does not change anon or authenticated grants, does not change
-- RLS policies, and does not grant TRUNCATE.
--
-- Reverse:
--   revoke select on table integrations from service_role;
--   revoke update (last_sync_at, last_claim_scan_at, last_recall_scan_at,
--                  last_treatment_scan_at, updated_at)
--     on table integrations from service_role;
--   revoke select, insert, update, delete
--     on table patients, procedure_codes, procedures, claims, recalls,
--              revenue_opportunities
--     from service_role;
--   alter table integrations
--     drop column if exists last_claim_scan_at,
--     drop column if exists last_recall_scan_at,
--     drop column if exists last_treatment_scan_at;
-- =========================================

-- Due-time bookkeeping for claim / recall / treatment scans.
-- last_sync_at already exists. New columns are nullable so current rows
-- stay valid and are treated as "never scanned" until the job runs.
alter table integrations
    add column if not exists last_claim_scan_at timestamptz;

alter table integrations
    add column if not exists last_recall_scan_at timestamptz;

alter table integrations
    add column if not exists last_treatment_scan_at timestamptz;

-- Enumerate connected integrations and stamp last_* timestamps.
-- INSERT/DELETE are withheld: connect/disconnect stay on the
-- authenticated user path. UPDATE is limited to bookkeeping columns
-- so this role cannot reassign practice_id or overwrite customer_key.
grant select on table integrations to service_role;

grant update (
    last_sync_at,
    last_claim_scan_at,
    last_recall_scan_at,
    last_treatment_scan_at,
    updated_at
) on table integrations to service_role;

-- Open Dental sync upserts these tables per practice / integration.
grant select, insert, update on table patients to service_role;
grant select, insert, update on table procedure_codes to service_role;
grant select, insert, update on table procedures to service_role;
grant select, insert, update on table claims to service_role;
grant select, insert, update on table recalls to service_role;

-- Scanners replace open opportunities (delete + insert) for one practice.
grant select, insert, delete on table revenue_opportunities to service_role;
