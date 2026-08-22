create table providers (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    integration_id uuid not null
        references integrations(id)
        on delete cascade,

    source_provider_id text not null,

    provider_number text,

    first_name text not null,

    last_name text not null,

    abbreviation text,

    npi text,

    provider_type text,

    email text,

    phone text,

    active boolean not null default true,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(integration_id, source_provider_id)
);

create index idx_providers_practice
on providers(practice_id);

create index idx_providers_last_name
on providers(last_name);