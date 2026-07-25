-- Omnia Global Academy
-- Grand module 4 — Omnia Skills Passport
-- Prérequis :
--   20260725190000_099_credentials_badges_clr_foundation.sql
--   20260725210000_100_clr2_complete.sql

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Passeport professionnel sélectif
-- ---------------------------------------------------------------------------
create table if not exists public.skills_passports (
  id uuid primary key default gen_random_uuid(),
  passport_uuid uuid not null default gen_random_uuid(),
  user_id uuid not null,
  clr_record_id uuid not null,
  title text not null default 'Omnia Skills Passport',
  professional_headline text,
  professional_summary text,
  target_roles text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  location_text text,
  availability_text text,
  selected_sections text[] not null default array[
    'competences_verifiees','certificats','badges','evaluations',
    'projets','experiences','recommandations'
  ]::text[],
  status text not null default 'draft',
  version integer not null default 1,
  presentation_json jsonb not null default '{}'::jsonb,
  presentation_jwt text,
  signing_key_id uuid,
  signature_alg text,
  credential_hash text,
  verification_result jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  last_built_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_passports_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint skills_passports_clr_record_id_fkey
    foreign key (clr_record_id) references public.clr_records(id) on delete cascade,
  constraint skills_passports_signing_key_id_fkey
    foreign key (signing_key_id) references public.credential_signing_keys(id) on delete set null,
  constraint skills_passports_status_check
    check (status in ('draft','published','suspended','archived')),
  constraint skills_passports_version_check
    check (version >= 1),
  constraint skills_passports_sections_check
    check (selected_sections <@ array[
      'competences_verifiees','certificats','badges','evaluations',
      'projets','experiences','recommandations'
    ]::text[])
);

alter table public.skills_passports
  add column if not exists passport_uuid uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists clr_record_id uuid,
  add column if not exists title text not null default 'Omnia Skills Passport',
  add column if not exists professional_headline text,
  add column if not exists professional_summary text,
  add column if not exists target_roles text[] not null default '{}'::text[],
  add column if not exists languages text[] not null default '{}'::text[],
  add column if not exists location_text text,
  add column if not exists availability_text text,
  add column if not exists selected_sections text[] not null default array[
    'competences_verifiees','certificats','badges','evaluations',
    'projets','experiences','recommandations'
  ]::text[],
  add column if not exists status text not null default 'draft',
  add column if not exists version integer not null default 1,
  add column if not exists presentation_json jsonb not null default '{}'::jsonb,
  add column if not exists presentation_jwt text,
  add column if not exists signing_key_id uuid,
  add column if not exists signature_alg text,
  add column if not exists credential_hash text,
  add column if not exists verification_result jsonb not null default '{}'::jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists last_built_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.skills_passports
set passport_uuid = gen_random_uuid()
where passport_uuid is null;

create unique index if not exists skills_passports_uuid_uidx
  on public.skills_passports(passport_uuid);
create unique index if not exists skills_passports_user_uidx
  on public.skills_passports(user_id);
create index if not exists skills_passports_status_idx
  on public.skills_passports(status, updated_at desc);

-- ---------------------------------------------------------------------------
-- 2. Sélection des éléments CLR
-- ---------------------------------------------------------------------------
create table if not exists public.skills_passport_items (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null,
  clr_achievement_id uuid not null,
  display_order integer not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_passport_items_passport_id_fkey
    foreign key (passport_id) references public.skills_passports(id) on delete cascade,
  constraint skills_passport_items_clr_achievement_id_fkey
    foreign key (clr_achievement_id) references public.clr_achievements(id) on delete cascade,
  constraint skills_passport_items_order_check
    check (display_order >= 0),
  unique(passport_id, clr_achievement_id)
);

alter table public.skills_passport_items
  add column if not exists passport_id uuid,
  add column if not exists clr_achievement_id uuid,
  add column if not exists display_order integer not null default 0,
  add column if not exists is_featured boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists skills_passport_items_order_idx
  on public.skills_passport_items(passport_id, display_order, created_at);

-- ---------------------------------------------------------------------------
-- 3. Partages publics limités et révocables
-- ---------------------------------------------------------------------------
create table if not exists public.skills_passport_shares (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null,
  token_hash text not null,
  label text,
  expires_at timestamptz,
  max_views integer,
  view_count integer not null default 0,
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_passport_shares_passport_id_fkey
    foreign key (passport_id) references public.skills_passports(id) on delete cascade,
  constraint skills_passport_shares_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null,
  constraint skills_passport_shares_max_views_check
    check (max_views is null or max_views > 0),
  constraint skills_passport_shares_view_count_check
    check (view_count >= 0)
);

alter table public.skills_passport_shares
  add column if not exists passport_id uuid,
  add column if not exists token_hash text,
  add column if not exists label text,
  add column if not exists expires_at timestamptz,
  add column if not exists max_views integer,
  add column if not exists view_count integer not null default 0,
  add column if not exists last_accessed_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists skills_passport_shares_token_uidx
  on public.skills_passport_shares(token_hash);
create index if not exists skills_passport_shares_active_idx
  on public.skills_passport_shares(passport_id, expires_at)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- 4. Exports, vérifications et audit
-- ---------------------------------------------------------------------------
create table if not exists public.skills_passport_exports (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.skills_passports(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  export_format text not null check (export_format in ('passport_json','vc_jwt')),
  credential_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.skills_passport_verification_events (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references public.skills_passports(id) on delete cascade,
  signing_key_id uuid references public.credential_signing_keys(id) on delete set null,
  verification_source text not null default 'api',
  signature_valid boolean not null default false,
  structure_valid boolean not null default false,
  status_valid boolean not null default false,
  overall_valid boolean not null default false,
  error_code text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.skills_passport_audit_logs (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references public.skills_passports(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skills_passport_exports_idx
  on public.skills_passport_exports(passport_id, created_at desc);
create index if not exists skills_passport_verifications_idx
  on public.skills_passport_verification_events(passport_id, created_at desc);
create index if not exists skills_passport_audit_idx
  on public.skills_passport_audit_logs(passport_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Mise à jour automatique et protection
-- ---------------------------------------------------------------------------
drop trigger if exists skills_passports_set_updated_at on public.skills_passports;
create trigger skills_passports_set_updated_at
before update on public.skills_passports
for each row execute function public.omnia_credentials_set_updated_at();

drop trigger if exists skills_passport_items_set_updated_at on public.skills_passport_items;
create trigger skills_passport_items_set_updated_at
before update on public.skills_passport_items
for each row execute function public.omnia_credentials_set_updated_at();

drop trigger if exists skills_passport_shares_set_updated_at on public.skills_passport_shares;
create trigger skills_passport_shares_set_updated_at
before update on public.skills_passport_shares
for each row execute function public.omnia_credentials_set_updated_at();

alter table public.skills_passports enable row level security;
alter table public.skills_passport_items enable row level security;
alter table public.skills_passport_shares enable row level security;
alter table public.skills_passport_exports enable row level security;
alter table public.skills_passport_verification_events enable row level security;
alter table public.skills_passport_audit_logs enable row level security;

revoke all on table public.skills_passports from anon, authenticated;
revoke all on table public.skills_passport_items from anon, authenticated;
revoke all on table public.skills_passport_shares from anon, authenticated;
revoke all on table public.skills_passport_exports from anon, authenticated;
revoke all on table public.skills_passport_verification_events from anon, authenticated;
revoke all on table public.skills_passport_audit_logs from anon, authenticated;

comment on table public.skills_passports is
  'Présentation professionnelle sélective et signée construite depuis le CLR.';
comment on table public.skills_passport_items is
  'Réalisations CLR explicitement sélectionnées par le titulaire.';

