create table claims (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    integration_id uuid not null
        references integrations(id)
        on delete cascade,

    patient_id uuid not null
        references patients(id)
        on delete cascade,

    provider_id uuid
        references providers(id)
        on delete set null,

    source_claim_id text not null,

    claim_number text,

    insurance_company text,

    status text not null,

    amount_billed numeric(12,2) not null default 0,

    amount_paid numeric(12,2) not null default 0,

    remaining_balance numeric(12,2) not null default 0,

    submitted_at timestamptz,

    paid_at timestamptz,

    last_action text,

    denial_reason text,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_claim_id)
);

create index idx_claims_patient
on claims(patient_id);

create index idx_claims_status
on claims(status);

create index idx_claims_balance
on claims(remaining_balance);