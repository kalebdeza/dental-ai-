-- =========================================
-- Opportunity merge: stable natural keys +
-- the UPDATE privilege the merge requires.
--
-- Scanners used to DELETE incomplete rows and
-- INSERT new ids. Merge updates scanner-owned
-- columns and marks unmatched open rows
-- completed. That needs UPDATE.
--
-- UPDATE is limited to scanner-owned columns
-- plus completed and updated_at. practice_id
-- and source FKs are not in the grant.
--
-- Partial unique indexes include
-- opportunity_type in the predicate so a
-- Treatment procedure_id cannot collide with
-- an unclaimed Claim procedure_id.
-- =========================================

alter table revenue_opportunities
    add column if not exists recall_id uuid
        references recalls(id)
        on delete set null;

create unique index if not exists revenue_opportunities_recall_key
on revenue_opportunities (practice_id, recall_id)
where opportunity_type = 'Recall'
  and recall_id is not null;

create unique index if not exists revenue_opportunities_treatment_procedure_key
on revenue_opportunities (practice_id, procedure_id)
where opportunity_type = 'Treatment'
  and procedure_id is not null;

create unique index if not exists revenue_opportunities_claim_key
on revenue_opportunities (practice_id, claim_id)
where opportunity_type = 'Claim'
  and claim_id is not null;

create unique index if not exists revenue_opportunities_claim_procedure_key
on revenue_opportunities (practice_id, procedure_id)
where opportunity_type = 'Claim'
  and claim_id is null
  and procedure_id is not null;

create index if not exists revenue_opportunities_practice_type
on revenue_opportunities (practice_id, opportunity_type);

-- Tenant-scoped UPDATE so merge can refresh
-- scanner fields and complete unmatched open
-- rows. Same practice_id predicate as SELECT.
drop policy if exists revenue_opportunities_update on revenue_opportunities;

create policy revenue_opportunities_update
on revenue_opportunities
for update
to authenticated
using (
    practice_id in (
        select public.user_practice_ids()
    )
)
with check (
    practice_id in (
        select public.user_practice_ids()
    )
);

grant update (
    reason,
    recommended_action,
    estimated_value,
    priority,
    confidence_score,
    completed,
    updated_at
)
on table revenue_opportunities
to authenticated;

grant update (
    reason,
    recommended_action,
    estimated_value,
    priority,
    confidence_score,
    completed,
    updated_at
)
on table revenue_opportunities
to service_role;
