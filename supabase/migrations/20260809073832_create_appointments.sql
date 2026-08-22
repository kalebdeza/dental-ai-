create table appointments (
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

    source_appointment_id text not null,

    appointment_type text,

    operatory text,

    start_time timestamptz not null,

    end_time timestamptz not null,

    status text not null,

    notes text,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_appointment_id)
);

create index idx_appointments_practice
on appointments(practice_id);

create index idx_appointments_patient
on appointments(patient_id);

create index idx_appointments_start
on appointments(start_time);