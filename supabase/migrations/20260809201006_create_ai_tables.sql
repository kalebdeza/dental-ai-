create table revenue_opportunities (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    patient_id uuid
        references patients(id)
        on delete cascade,

    claim_id uuid
        references claims(id)
        on delete cascade,

    procedure_id uuid
        references procedures(id)
        on delete cascade,

    opportunity_type text not null,

    priority text not null,

    estimated_value numeric(12,2) not null default 0,

    confidence_score integer,

    reason text,

    recommended_action text,

    completed boolean not null default false,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

create index idx_revenue_opportunities_practice
on revenue_opportunities(practice_id);

create index idx_revenue_opportunities_priority
on revenue_opportunities(priority);

create table ai_conversations (
    id uuid primary key default gen_random_uuid(),

    practice_id uuid not null
        references practices(id)
        on delete cascade,

    patient_id uuid
        references patients(id)
        on delete set null,

    claim_id uuid
        references claims(id)
        on delete set null,

    question text not null,

    answer text not null,

    created_at timestamptz not null default now()
);