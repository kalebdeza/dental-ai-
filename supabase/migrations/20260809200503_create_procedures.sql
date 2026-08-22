create table procedures (
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

    appointment_id uuid
        references appointments(id)
        on delete set null,

    procedure_code_id uuid not null
        references procedure_codes(id)
        on delete restrict,

    source_procedure_id text not null,

    tooth text,
    surface text,

    status text not null,

    fee numeric(12,2) not null default 0,

    insurance_estimate numeric(12,2) not null default 0,

    insurance_paid numeric(12,2) not null default 0,

    patient_portion numeric(12,2) not null default 0,

    completed_at timestamptz,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_procedure_id)
);

create index idx_procedures_patient
on procedures(patient_id);

create index idx_procedures_provider
on procedures(provider_id);

create index idx_procedures_completed
on procedures(completed_at);