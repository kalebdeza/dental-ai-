create table patients (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    integration_id uuid not null
        references integrations(id)
        on delete cascade,

    source_patient_id text not null,

    chart_number text,

    first_name text not null,

    last_name text not null,

    preferred_name text,

    middle_name text,

    birth_date date,

    gender text,

    email text,

    mobile_phone text,

    home_phone text,

    work_phone text,

    address text,

    city text,

    state text,

    zip_code text,

    balance numeric(12,2) not null default 0,

    insurance_estimate numeric(12,2) not null default 0,

    last_visit date,

    next_visit date,

    patient_status text,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_patient_id)
);

create index idx_patients_practice
on patients(practice_id);

create index idx_patients_integration
on patients(integration_id);

create index idx_patients_last_name
on patients(last_name);

create index idx_patients_chart
on patients(chart_number);