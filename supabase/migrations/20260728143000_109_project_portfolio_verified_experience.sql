-- 109 — PROGRAMME 2 / GM2 — PORTFOLIO ET PREUVES D'EXPERIENCE
-- Complète Omnia Projects sans fusionner Omnia Career, Omnia Talent, CLR ou Skills Passport.

create extension if not exists pgcrypto;

alter table public.omnia_project_verified_evidence
  add column if not exists description text,
  add column if not exists issuer_name text,
  add column if not exists evidence_url text,
  add column if not exists evidence_payload jsonb not null default '{}'::jsonb,
  add column if not exists visibility_updated_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

create table if not exists public.project_portfolio_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  headline text,
  professional_summary text,
  target_roles text[] not null default '{}',
  featured_skill_codes text[] not null default '{}',
  default_visibility text not null default 'private'
    check (default_visibility in ('private','recruiters','public')),
  allow_recruiter_contact boolean not null default false,
  show_identity_publicly boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.project_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.project_portfolio_profiles(id) on delete cascade,
  evidence_id uuid not null references public.omnia_project_verified_evidence(id) on delete cascade,
  display_title text,
  display_summary text,
  visibility text not null default 'private'
    check (visibility in ('private','anonymized','recruiters','public')),
  is_featured boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  show_score boolean not null default false,
  show_organization boolean not null default true,
  show_deliverable_link boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, evidence_id)
);

create table if not exists public.project_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  author_name_snapshot text not null,
  author_role_snapshot text,
  organization_name_snapshot text,
  recommendation_text text not null,
  skill_codes text[] not null default '{}',
  rating smallint check (rating between 1 and 5),
  status text not null default 'draft'
    check (status in ('draft','submitted','accepted','declined','revoked')),
  recipient_visibility text not null default 'private'
    check (recipient_visibility in ('private','anonymized','recruiters','public')),
  submitted_at timestamptz,
  responded_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_portfolio_items_profile_idx
  on public.project_portfolio_items(profile_id, display_order, created_at);
create index if not exists project_portfolio_items_visibility_idx
  on public.project_portfolio_items(visibility, is_featured);
create index if not exists project_recommendations_recipient_idx
  on public.project_recommendations(recipient_user_id, status, created_at desc);
create index if not exists project_recommendations_project_idx
  on public.project_recommendations(project_id, status, created_at desc);

create unique index if not exists project_recommendation_author_recipient_uidx
  on public.project_recommendations(project_id, recipient_user_id, author_user_id)
  where status <> 'revoked';

create or replace function public.project_portfolio_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['project_portfolio_profiles','project_portfolio_items','project_recommendations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.project_portfolio_set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- Les accès métier passent par les Edge Functions avec service_role.
-- Aucune politique publique directe n'est créée.

comment on table public.project_portfolio_profiles is
  'Présentation professionnelle contrôlée par l’apprenant pour ses expériences Omnia Projects.';
comment on table public.project_portfolio_items is
  'Sélection explicite des preuves validées affichables dans le portfolio de projets.';
comment on table public.project_recommendations is
  'Recommandations vérifiables émises par les porteurs de projets et acceptées par le destinataire.';
