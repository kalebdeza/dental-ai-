create table integrations (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    provider text not null,

    status text not null default 'disconnected',

    customer_key text,

    external_practice_id text,

    last_sync_at timestamptz,

    sync_frequency_minutes integer not null default 15,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(practice_id, provider)
);