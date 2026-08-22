create table recalls (
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

    source_recall_id text not null,

    recall_type text,

    due_date date,

    completed_date date,

    status text not null default 'due',

    estimated_revenue numeric(12,2) not null default 0,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_recall_id)
);

create index idx_recalls_patient
on recalls(patient_id);

create index idx_recalls_due
on recalls(due_date);

create index idx_recalls_status
on recalls(status);