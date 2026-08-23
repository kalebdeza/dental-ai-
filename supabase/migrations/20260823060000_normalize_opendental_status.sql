-- =========================================
-- Normalize Open Dental status codes.
--
-- Open Dental transmits short codes ("C", "TP") that were previously stored
-- verbatim, while the scanners compared them against readable names such as
-- "Completed". Those comparisons could never match, so the claim pipeline
-- silently produced nothing and the treatment pipeline never excluded work
-- that was already done.
--
-- Every step below is additive or derived from source_status, so the whole
-- migration is idempotent and reversible.
-- =========================================

-- =========================================
-- 1. Preserve the raw codes.
--    Nullable, so this neither rewrites history nor breaks rows that the
--    sync has not touched yet.
-- =========================================

alter table procedures
    add column if not exists source_status text;

alter table claims
    add column if not exists source_status text;

alter table recalls
    add column if not exists source_status text;

-- =========================================
-- 2. Capture the current value before anything rewrites it.
--    Guarded on "is null" so a second run cannot overwrite a captured raw
--    code with an already-normalized one.
-- =========================================

update procedures
set source_status = status
where source_status is null;

update claims
set source_status = status
where source_status is null;

update recalls
set source_status = status
where source_status is null;

-- =========================================
-- 3. Normalize procedures.status.
--    Derived purely from source_status, which never changes after step 2,
--    so re-running produces an identical result.
--
--    Note that EC and EO do not become billable statuses: they record work
--    performed previously or by another provider.
-- =========================================

update procedures p
set status = mapped.normalized
from (
    select
        id,
        case source_status
            when 'C'   then 'Completed'
            when 'TP'  then 'TreatmentPlanned'
            when 'TPi' then 'TreatmentPlannedInactive'
            when 'EC'  then 'ExistingCurrentProvider'
            when 'EO'  then 'ExistingOtherProvider'
            when 'R'   then 'ReferredOut'
            when 'D'   then 'Deleted'
            when 'Cn'  then 'Condition'
            else 'Unknown'
        end as normalized
    from procedures
    where source_status is not null
) mapped
where p.id = mapped.id
  and p.status is distinct from mapped.normalized;

-- =========================================
-- 4. Normalize claims.status.
-- =========================================

update claims c
set status = mapped.normalized
from (
    select
        id,
        case source_status
            when 'U' then 'Unsent'
            when 'H' then 'HoldUntilPrimaryReceived'
            when 'W' then 'WaitingInQueue'
            when 'I' then 'HoldForInProcess'
            when 'S' then 'Sent'
            when 'R' then 'Received'
            else 'Unknown'
        end as normalized
    from claims
    where source_status is not null
) mapped
where c.id = mapped.id
  and c.status is distinct from mapped.normalized;

-- =========================================
-- 5. recalls.status is deliberately left alone.
--
--    Open Dental's RecallStatus is an integer key into the definition table
--    describing the reminder that was sent, not whether the recall was
--    fulfilled, so there is no completed value to normalize toward. The
--    stored integers cannot be turned back into their display names here
--    either, because that mapping lives in Open Dental. The next sync
--    replaces the column with the API's display string; until then the
--    stale value is harmless, because no code reads it any more.
-- =========================================

-- =========================================
-- 6. Clear Open Dental's empty-date sentinel.
--    Absent dates arrive as "0001-01-01", which was stored as a real date
--    in year 1. Anything truthy in completed_date made the recall scanner
--    treat every never-completed recall as finished and skip it.
--
--    Compared against a threshold rather than the exact sentinel so that
--    date and timestamp columns are both covered.
-- =========================================

update procedures
set completed_at = null
where completed_at < timestamptz '1900-01-01';

update recalls
set completed_date = null
where completed_date < date '1900-01-01';

update recalls
set due_date = null
where due_date < date '1900-01-01';

update patients
set last_visit = null
where last_visit < date '1900-01-01';

-- Matched exactly rather than by threshold, so that an implausible but
-- genuine birth date is never silently discarded.
update patients
set birth_date = null
where birth_date = date '0001-01-01';

-- =========================================
-- 7. Serve the revenue scanner's filter, which selects a practice's
--    procedures by normalized status.
-- =========================================

create index if not exists idx_procedures_practice_status
on procedures(practice_id, status);
