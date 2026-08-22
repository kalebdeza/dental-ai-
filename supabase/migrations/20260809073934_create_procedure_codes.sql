create table procedure_codes (
    id uuid primary key default gen_random_uuid(),

    integration_id uuid not null
        references integrations(id)
        on delete cascade,

    source_code_id text not null,

    code text not null,

    description text not null,

    category text,

    fee numeric(12,2),

    active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_code_id)
);

create index idx_procedure_codes_code
on procedure_codes(code);