-- =========================================
-- Gate E, part two: least-privilege DML for authenticated.
--
-- Gate E part one removed TRUNCATE. Gate F enabled tenant RLS. Fresh local
-- databases still give authenticated no SELECT/INSERT/UPDATE/DELETE on
-- tenant tables, so policies exist but every request fails at the grant
-- layer. Production, last audited, still held wholesale DML for anon and
-- service_role as well.
--
-- Revoke first, then grant the minimum the application actually uses.
-- That converges both environments without touching row level security
-- or audit_logs (Gate B already set that table to SELECT + INSERT).
--
-- create_practice_with_owner and the user_* helpers are security definer
-- and already have EXECUTE. They do not need table DML from the caller.
-- =========================================

-- Tables this migration may touch. audit_logs is intentionally absent.
-- practice_members, appointments, and ai_conversations stay in the
-- revoke list so leftover DML is stripped, and receive no grants.

-- =========================================
-- 1. anon: no tenant DML, and no TRUNCATE.
-- =========================================

revoke insert, select, update, delete, truncate on table
    organizations,
    practices,
    practice_members,
    integrations,
    patients,
    providers,
    appointments,
    procedure_codes,
    procedures,
    claims,
    recalls,
    revenue_opportunities,
    ai_conversations
from anon;

-- =========================================
-- 2. service_role: no tenant DML.
--    audit_logs SELECT + INSERT is left as Gate B set it.
-- =========================================

revoke insert, select, update, delete, truncate on table
    organizations,
    practices,
    practice_members,
    integrations,
    patients,
    providers,
    appointments,
    procedure_codes,
    procedures,
    claims,
    recalls,
    revenue_opportunities,
    ai_conversations
from service_role;

-- =========================================
-- 3. authenticated: strip leftover DML, then grant the audit matrix.
--    TRUNCATE stays revoked. REFERENCES / TRIGGER / MAINTAIN stay.
-- =========================================

revoke insert, select, update, delete, truncate on table
    organizations,
    practices,
    practice_members,
    integrations,
    patients,
    providers,
    appointments,
    procedure_codes,
    procedures,
    claims,
    recalls,
    revenue_opportunities,
    ai_conversations
from authenticated;

grant select, insert on table organizations to authenticated;

grant select on table practices to authenticated;

grant select, insert, update on table integrations to authenticated;

grant select, insert, update on table patients to authenticated;

grant select on table providers to authenticated;

grant select, insert, update on table procedure_codes to authenticated;

grant select, insert, update on table procedures to authenticated;

grant select, insert, update on table claims to authenticated;

grant select, insert, update on table recalls to authenticated;

grant select, insert, delete on table revenue_opportunities to authenticated;

-- practice_members, appointments, ai_conversations: no grants.

-- =========================================
-- 4. Future tables created by postgres.
--
--    Default privileges key on the creating role. Migrations run as
--    postgres. After Gate E, postgres already withholds TRUNCATE from
--    the three application roles; this also withholds DML so a new
--    table cannot ship with SELECT/INSERT/UPDATE/DELETE until a later
--    migration grants them explicitly.
--
--    postgres's own default (full owner privileges) is not revoked.
--    supabase_admin defaults cannot be changed by this role.
-- =========================================

alter default privileges for role postgres in schema public
    revoke insert, select, update, delete, truncate on tables
    from anon, authenticated, service_role;
