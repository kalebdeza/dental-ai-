-- =========================================
-- Gate E, part one: take TRUNCATE away from the application roles.
--
-- Gate B already made this argument for audit_logs; this migration applies the
-- same reasoning to the remaining application tables. TRUNCATE is the one
-- data-destroying privilege that row level security does not mediate: a policy
-- restricts which rows a statement may touch, but TRUNCATE operates on the
-- table rather than its rows, so it is never filtered. Enabling tenant
-- policies in Gate F while anon still holds TRUNCATE would produce careful
-- per-practice rules on tables any caller could empty in a single statement.
--
-- Nothing in the application truncates anything. The repository contains no
-- TRUNCATE statement outside the Gate B commentary, and after Gate C-1 no
-- request path holds a service_role client at all, so removing this privilege
-- cannot affect any current code path.
--
-- Two sources grant it, and both have to be closed or the change decays:
--
--   1. Grants already sitting on the existing tables.
--   2. The default privileges attached to the creating role, which hand the
--      same privilege to every table created from here on.
--
-- Closing only the first would leave the next migration's table shipping with
-- anon holding TRUNCATE again, which is how this state arose.
--
-- This migration deliberately enables no row level security and adds no
-- policies. Those are Gate F. It also grants nothing: every statement below
-- only removes a privilege, which is what makes it safe to apply ahead of the
-- policy work rather than alongside it.
-- =========================================

-- =========================================
-- 1. Existing tables.
--
--    All thirteen are owned by postgres, and the grants were made by postgres,
--    so the migration role can revoke them directly.
--
--    audit_logs is included as a defensive no-op. Gate B already reduced it
--    to SELECT and INSERT for authenticated and service_role and removed
--    anon entirely, so locally it holds no TRUNCATE to remove. Including it
--    still covers an environment where Gate B has not landed.
--
--    REVOKE is idempotent: re-running it, or running it against a role that
--    never held the privilege, is a no-op rather than an error.
-- =========================================

revoke truncate on table
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
    ai_conversations,
    audit_logs
from anon, authenticated, service_role;

-- =========================================
-- 2. Future tables.
--
--    Default privileges are keyed on the role that creates the object, not on
--    the schema alone. Migrations here run as postgres, so it is postgres's
--    defaults that decide what a new table grants, and those currently hand
--    anon, authenticated, and service_role TRUNCATE alongside REFERENCES,
--    TRIGGER, and MAINTAIN. Removing TRUNCATE leaves the other three intact.
--
--    Named explicitly rather than relying on the current role, so the
--    statement targets the measured ACL rather than whichever role happens to
--    be applying the migration.
-- =========================================

alter default privileges for role postgres in schema public
    revoke truncate on tables
    from anon, authenticated, service_role;
