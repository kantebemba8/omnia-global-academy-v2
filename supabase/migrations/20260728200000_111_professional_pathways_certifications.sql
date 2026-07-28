-- Programme 2 GM4 — Parcours professionnels et certifications
create table if not exists public.professional_pathways (
 id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, description text,
 status text not null default 'draft' check (status in ('draft','review','published','suspended','archived')),
 visibility text not null default 'authenticated' check (visibility in ('public','authenticated','structure','invitation')),
 certification_type text not null default 'oga' check (certification_type in ('oga','recognized','co_certified','professional','cpd')),
 recognition_program_id uuid references public.recognition_programs(id) on delete set null,
 validity_months integer check (validity_months is null or validity_months > 0),
 renewal_required boolean not null default false, cpd_enabled boolean not null default false,
 cpd_credit_value numeric(10,2), cpd_credit_unit text default 'hours', badge_template_id uuid,
 certificate_template_id uuid, prerequisites jsonb not null default '[]'::jsonb, metadata jsonb not null default '{}'::jsonb,
 created_by uuid, approved_by uuid, approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.professional_pathway_steps (
 id uuid primary key default gen_random_uuid(), pathway_id uuid not null references public.professional_pathways(id) on delete cascade,
 step_type text not null check (step_type in ('course','assessment','jury','project','evidence','renewal_training')),
 title text not null, position integer not null default 1, required boolean not null default true,
 course_id uuid references public.courses(id) on delete set null, assessment_id uuid, project_id uuid references public.omnia_projects(id) on delete set null,
 minimum_score numeric(5,2), rules jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(pathway_id,position)
);
create table if not exists public.professional_pathway_enrollments (
 id uuid primary key default gen_random_uuid(), pathway_id uuid not null references public.professional_pathways(id) on delete cascade,
 user_id uuid not null, status text not null default 'active' check (status in ('active','blocked','completed','expired','withdrawn')),
 progress_percent numeric(5,2) not null default 0, enrolled_at timestamptz not null default now(), completed_at timestamptz,
 valid_until timestamptz, certificate_id uuid, badge_credential_id uuid, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(pathway_id,user_id)
);
create table if not exists public.professional_pathway_step_results (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.professional_pathway_enrollments(id) on delete cascade,
 step_id uuid not null references public.professional_pathway_steps(id) on delete cascade, status text not null default 'pending' check (status in ('pending','in_progress','submitted','passed','failed','waived')),
 score numeric(5,2), evidence jsonb not null default '{}'::jsonb, validated_by uuid, validated_at timestamptz, comments text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(enrollment_id,step_id)
);
create table if not exists public.professional_pathway_renewals (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.professional_pathway_enrollments(id) on delete cascade,
 due_at timestamptz not null, status text not null default 'due' check (status in ('due','in_progress','submitted','approved','rejected','expired')),
 requirements jsonb not null default '[]'::jsonb, submitted_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, decision_notes text,
 new_valid_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.professional_pathway_audit_log (
 id uuid primary key default gen_random_uuid(), pathway_id uuid references public.professional_pathways(id) on delete set null,
 entity_type text not null, entity_id uuid, action text not null, actor_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists professional_pathway_steps_pathway_idx on public.professional_pathway_steps(pathway_id,position);
create index if not exists professional_pathway_enrollments_user_idx on public.professional_pathway_enrollments(user_id,status);
create index if not exists professional_pathway_renewals_due_idx on public.professional_pathway_renewals(due_at,status);
alter table public.professional_pathways enable row level security;
alter table public.professional_pathway_steps enable row level security;
alter table public.professional_pathway_enrollments enable row level security;
alter table public.professional_pathway_step_results enable row level security;
alter table public.professional_pathway_renewals enable row level security;
alter table public.professional_pathway_audit_log enable row level security;
