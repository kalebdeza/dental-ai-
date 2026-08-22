create table practices (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references organizations(id)
        on delete cascade,

    name text not null,

    timezone text not null default 'America/New_York',

    address text,

    city text,

    state text,

    zip_code text,

    phone text,

    email text,

    active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);