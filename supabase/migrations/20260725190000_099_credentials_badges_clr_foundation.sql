-- ============================================================================
-- 099 — OMNIA CREDENTIALS / OPEN BADGES 3.0 / CLR 2.0 FOUNDATION
-- Reconstructs the database layer required by the existing credentials Edge
-- Function and the already validated Badges + Learning Record interfaces.
--
-- This migration is intentionally cumulative and idempotent:
--   1. it creates the complete schema on a fresh Supabase project;
--   2. it adds missing columns and named relationships when tables already
--      exist remotely;
--   3. it does not alter existing Omnia modules, roles, dashboards or routes.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Credential issuers
-- ---------------------------------------------------------------------------
create table if not exists public.credential_issuers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  issuer_type text not null default 'external',
  website_url text,
  email text,
  logo_url text,
  issuer_uri text not null,
  did text,
  status text not null default 'draft',
  public_key_set_uri text,
  verification_method jsonb not null default '{}'::jsonb,
  last_key_sync_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credential_issuers_type_check
    check (issuer_type in ('platform','structure','external')),
  constraint credential_issuers_status_check
    check (status in ('draft','active','suspended','archived'))
);

alter table public.credential_issuers
  add column if not exists code text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists issuer_type text default 'external',
  add column if not exists website_url text,
  add column if not exists email text,
  add column if not exists logo_url text,
  add column if not exists issuer_uri text,
  add column if not exists did text,
  add column if not exists status text default 'draft',
  add column if not exists public_key_set_uri text,
  add column if not exists verification_method jsonb default '{}'::jsonb,
  add column if not exists last_key_sync_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists credential_issuers_code_uidx
  on public.credential_issuers(code);
create unique index if not exists credential_issuers_uri_uidx
  on public.credential_issuers(issuer_uri);
create unique index if not exists credential_issuers_did_uidx
  on public.credential_issuers(did) where did is not null;
create index if not exists credential_issuers_status_idx
  on public.credential_issuers(status, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Badge taxonomy
-- ---------------------------------------------------------------------------
create table if not exists public.badge_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  category_type text not null default 'achievement',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_categories_type_check
    check (category_type in ('skill','achievement','trust','community','internal'))
);

alter table public.badge_categories
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists category_type text default 'achievement',
  add column if not exists display_order integer default 0,
  add column if not exists is_active boolean default true,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists badge_categories_slug_uidx
  on public.badge_categories(slug);
create index if not exists badge_categories_active_order_idx
  on public.badge_categories(is_active, display_order, name);

create table if not exists public.badge_levels (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  rank integer not null default 0,
  color text not null default '#002050',
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.badge_levels
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists rank integer default 0,
  add column if not exists color text default '#002050',
  add column if not exists is_active boolean default true,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists badge_levels_slug_uidx
  on public.badge_levels(slug);
create index if not exists badge_levels_active_rank_idx
  on public.badge_levels(is_active, rank, name);

-- ---------------------------------------------------------------------------
-- 3. Badge templates — criteria are stored in criteria_narrative and evidence
--    requirements are declared by evidence_required.
-- ---------------------------------------------------------------------------
create table if not exists public.badge_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  issuer_id uuid not null,
  category_id uuid not null,
  level_id uuid,
  name text not null,
  description text not null,
  image_url text,
  achievement_type text not null default 'Achievement',
  criteria_narrative text not null,
  evidence_required boolean not null default false,
  validity_days integer,
  default_visibility text not null default 'oga',
  allowed_issuer_roles text[] not null default array['super_admin']::text[],
  source_types text[] not null default array['manual']::text[],
  internal_only boolean not null default false,
  automatic_enabled boolean not null default false,
  status text not null default 'draft',
  achievement_uri text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_templates_issuer_id_fkey
    foreign key (issuer_id) references public.credential_issuers(id) on delete restrict,
  constraint badge_templates_category_id_fkey
    foreign key (category_id) references public.badge_categories(id) on delete restrict,
  constraint badge_templates_level_id_fkey
    foreign key (level_id) references public.badge_levels(id) on delete set null,
  constraint badge_templates_visibility_check
    check (default_visibility in ('private','oga','recruiters','structure','public')),
  constraint badge_templates_status_check
    check (status in ('draft','pending_validation','active','inactive','archived')),
  constraint badge_templates_validity_days_check
    check (validity_days is null or validity_days > 0),
  constraint badge_templates_internal_visibility_check
    check (not internal_only or default_visibility <> 'public')
);

alter table public.badge_templates
  add column if not exists code text,
  add column if not exists issuer_id uuid,
  add column if not exists category_id uuid,
  add column if not exists level_id uuid,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists achievement_type text default 'Achievement',
  add column if not exists criteria_narrative text,
  add column if not exists evidence_required boolean default false,
  add column if not exists validity_days integer,
  add column if not exists default_visibility text default 'oga',
  add column if not exists allowed_issuer_roles text[] default array['super_admin']::text[],
  add column if not exists source_types text[] default array['manual']::text[],
  add column if not exists internal_only boolean default false,
  add column if not exists automatic_enabled boolean default false,
  add column if not exists status text default 'draft',
  add column if not exists achievement_uri text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists badge_templates_code_uidx
  on public.badge_templates(code);
create unique index if not exists badge_templates_achievement_uri_uidx
  on public.badge_templates(achievement_uri) where achievement_uri is not null;
create index if not exists badge_templates_status_idx
  on public.badge_templates(status, created_at desc);
create index if not exists badge_templates_taxonomy_idx
  on public.badge_templates(category_id, level_id);
create index if not exists badge_templates_issuer_idx
  on public.badge_templates(issuer_id, status);

-- ---------------------------------------------------------------------------
-- 4. Public signing-key registry. Private keys are never stored in PostgreSQL.
-- ---------------------------------------------------------------------------
create table if not exists public.credential_signing_keys (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null,
  key_name text not null,
  key_id_uri text not null,
  algorithm text not null default 'RS256',
  public_jwk jsonb not null,
  jwk_thumbprint text not null,
  status text not null default 'active',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credential_signing_keys_issuer_id_fkey
    foreign key (issuer_id) references public.credential_issuers(id) on delete cascade,
  constraint credential_signing_keys_algorithm_check
    check (algorithm in ('RS256')),
  constraint credential_signing_keys_status_check
    check (status in ('active','retired','revoked')),
  constraint credential_signing_keys_validity_check
    check (valid_until is null or valid_until >= valid_from)
);

alter table public.credential_signing_keys
  add column if not exists issuer_id uuid,
  add column if not exists key_name text,
  add column if not exists key_id_uri text,
  add column if not exists algorithm text default 'RS256',
  add column if not exists public_jwk jsonb,
  add column if not exists jwk_thumbprint text,
  add column if not exists status text default 'active',
  add column if not exists valid_from timestamptz default now(),
  add column if not exists valid_until timestamptz,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists credential_signing_keys_key_uri_uidx
  on public.credential_signing_keys(key_id_uri);
create unique index if not exists credential_signing_keys_thumbprint_uidx
  on public.credential_signing_keys(jwk_thumbprint);
create unique index if not exists credential_signing_keys_one_active_per_issuer_uidx
  on public.credential_signing_keys(issuer_id) where status = 'active';
create index if not exists credential_signing_keys_status_idx
  on public.credential_signing_keys(status, valid_from desc);

-- ---------------------------------------------------------------------------
-- 5. Badge awards and evidence
-- ---------------------------------------------------------------------------
create table if not exists public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  credential_uuid uuid not null default gen_random_uuid(),
  verification_code text not null,
  template_id uuid not null,
  issuer_id uuid not null,
  recipient_user_id uuid not null,
  awarded_by uuid,
  source_type text not null default 'manual',
  source_id text,
  status text not null default 'awarded',
  visibility text not null default 'oga',
  evidence_summary text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,
  recipient_subject_id text,
  standards_status text not null default 'ob3_draft',
  credential_json jsonb not null default '{}'::jsonb,
  credential_jwt text,
  signing_key_id uuid,
  signed_at timestamptz,
  signature_alg text,
  credential_media_type text,
  credential_hash text,
  last_verified_at timestamptz,
  verification_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_awards_template_id_fkey
    foreign key (template_id) references public.badge_templates(id) on delete restrict,
  constraint badge_awards_issuer_id_fkey
    foreign key (issuer_id) references public.credential_issuers(id) on delete restrict,
  constraint badge_awards_recipient_user_id_fkey
    foreign key (recipient_user_id) references public.users(id) on delete cascade,
  constraint badge_awards_awarded_by_fkey
    foreign key (awarded_by) references public.users(id) on delete set null,
  constraint badge_awards_revoked_by_fkey
    foreign key (revoked_by) references public.users(id) on delete set null,
  constraint badge_awards_signing_key_id_fkey
    foreign key (signing_key_id) references public.credential_signing_keys(id) on delete set null,
  constraint badge_awards_status_check
    check (status in ('pending','awarded','expired','revoked','suspended')),
  constraint badge_awards_visibility_check
    check (visibility in ('private','oga','recruiters','structure','public')),
  constraint badge_awards_standards_status_check
    check (standards_status in ('internal_verified','ob3_draft','ob3_signed')),
  constraint badge_awards_expiry_check
    check (expires_at is null or expires_at >= issued_at)
);

alter table public.badge_awards
  add column if not exists credential_uuid uuid default gen_random_uuid(),
  add column if not exists verification_code text,
  add column if not exists template_id uuid,
  add column if not exists issuer_id uuid,
  add column if not exists recipient_user_id uuid,
  add column if not exists awarded_by uuid,
  add column if not exists source_type text default 'manual',
  add column if not exists source_id text,
  add column if not exists status text default 'awarded',
  add column if not exists visibility text default 'oga',
  add column if not exists evidence_summary text,
  add column if not exists issued_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid,
  add column if not exists revocation_reason text,
  add column if not exists recipient_subject_id text,
  add column if not exists standards_status text default 'ob3_draft',
  add column if not exists credential_json jsonb default '{}'::jsonb,
  add column if not exists credential_jwt text,
  add column if not exists signing_key_id uuid,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_alg text,
  add column if not exists credential_media_type text,
  add column if not exists credential_hash text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_result jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.badge_awards
set credential_uuid = gen_random_uuid()
where credential_uuid is null;

update public.badge_awards
set verification_code = 'OGA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14))
where verification_code is null or btrim(verification_code) = '';

create unique index if not exists badge_awards_credential_uuid_uidx
  on public.badge_awards(credential_uuid);
create unique index if not exists badge_awards_verification_code_uidx
  on public.badge_awards(verification_code);
create index if not exists badge_awards_recipient_issued_idx
  on public.badge_awards(recipient_user_id, issued_at desc);
create index if not exists badge_awards_template_idx
  on public.badge_awards(template_id, issued_at desc);
create index if not exists badge_awards_status_idx
  on public.badge_awards(status, issued_at desc);
create index if not exists badge_awards_visibility_idx
  on public.badge_awards(visibility, issued_at desc);
create index if not exists badge_awards_standards_idx
  on public.badge_awards(standards_status, signed_at desc);
create index if not exists badge_awards_source_idx
  on public.badge_awards(source_type, source_id);

create table if not exists public.badge_evidence (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null,
  evidence_type text not null default 'other',
  title text not null,
  description text,
  url text,
  source_table text,
  source_record_id text,
  is_public boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_evidence_award_id_fkey
    foreign key (award_id) references public.badge_awards(id) on delete cascade
);

alter table public.badge_evidence
  add column if not exists award_id uuid,
  add column if not exists evidence_type text default 'other',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists url text,
  add column if not exists source_table text,
  add column if not exists source_record_id text,
  add column if not exists is_public boolean default false,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists badge_evidence_award_idx
  on public.badge_evidence(award_id, created_at);
create index if not exists badge_evidence_public_idx
  on public.badge_evidence(award_id, is_public, created_at);
create index if not exists badge_evidence_source_idx
  on public.badge_evidence(source_table, source_record_id);

-- ---------------------------------------------------------------------------
-- 6. Validation workflow and audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.badge_review_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null default 'template_validation',
  template_id uuid,
  award_id uuid,
  status text not null default 'pending',
  requested_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  request_payload jsonb not null default '{}'::jsonb,
  decision_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_review_requests_template_id_fkey
    foreign key (template_id) references public.badge_templates(id) on delete cascade,
  constraint badge_review_requests_award_id_fkey
    foreign key (award_id) references public.badge_awards(id) on delete cascade,
  constraint badge_review_requests_type_check
    check (request_type in ('template_validation','award_validation','evidence_validation','revocation_review')),
  constraint badge_review_requests_status_check
    check (status in ('pending','approved','rejected','cancelled'))
);

alter table public.badge_review_requests
  add column if not exists request_type text default 'template_validation',
  add column if not exists template_id uuid,
  add column if not exists award_id uuid,
  add column if not exists status text default 'pending',
  add column if not exists requested_by uuid,
  add column if not exists assigned_to uuid,
  add column if not exists reviewed_by uuid,
  add column if not exists request_payload jsonb default '{}'::jsonb,
  add column if not exists decision_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists badge_review_requests_status_idx
  on public.badge_review_requests(status, created_at desc);
create index if not exists badge_review_requests_template_idx
  on public.badge_review_requests(template_id, created_at desc);
create index if not exists badge_review_requests_award_idx
  on public.badge_review_requests(award_id, created_at desc);

create table if not exists public.badge_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  previous_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.badge_audit_logs
  add column if not exists actor_user_id uuid,
  add column if not exists action text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists previous_data jsonb,
  add column if not exists new_data jsonb,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists badge_audit_logs_entity_idx
  on public.badge_audit_logs(entity_type, entity_id, created_at desc);
create index if not exists badge_audit_logs_actor_idx
  on public.badge_audit_logs(actor_user_id, created_at desc);
create index if not exists badge_audit_logs_action_idx
  on public.badge_audit_logs(action, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Verification and export history
-- ---------------------------------------------------------------------------
create table if not exists public.credential_verification_events (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null,
  signing_key_id uuid,
  verification_source text not null default 'api',
  signature_valid boolean not null default false,
  structure_valid boolean not null default false,
  status_valid boolean not null default false,
  overall_valid boolean not null default false,
  error_code text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credential_verification_events_award_id_fkey
    foreign key (award_id) references public.badge_awards(id) on delete cascade,
  constraint credential_verification_events_signing_key_id_fkey
    foreign key (signing_key_id) references public.credential_signing_keys(id) on delete set null,
  constraint credential_verification_events_source_check
    check (verification_source in ('public_page','admin','learner','api','export','internal'))
);

alter table public.credential_verification_events
  add column if not exists award_id uuid,
  add column if not exists signing_key_id uuid,
  add column if not exists verification_source text default 'api',
  add column if not exists signature_valid boolean default false,
  add column if not exists structure_valid boolean default false,
  add column if not exists status_valid boolean default false,
  add column if not exists overall_valid boolean default false,
  add column if not exists error_code text,
  add column if not exists result jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists credential_verification_events_award_idx
  on public.credential_verification_events(award_id, created_at desc);
create index if not exists credential_verification_events_result_idx
  on public.credential_verification_events(overall_valid, created_at desc);
create index if not exists credential_verification_events_key_idx
  on public.credential_verification_events(signing_key_id, created_at desc);

create table if not exists public.credential_exports (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null,
  export_format text not null,
  requested_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credential_exports_award_id_fkey
    foreign key (award_id) references public.badge_awards(id) on delete cascade,
  constraint credential_exports_format_check
    check (export_format in ('vc_jwt','json_ld','qr_svg'))
);

alter table public.credential_exports
  add column if not exists award_id uuid,
  add column if not exists export_format text,
  add column if not exists requested_by uuid,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists credential_exports_award_idx
  on public.credential_exports(award_id, created_at desc);
create index if not exists credential_exports_format_idx
  on public.credential_exports(export_format, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Omnia Learning Record — CLR 2.0 preparation layer
-- ---------------------------------------------------------------------------
create table if not exists public.clr_records (
  id uuid primary key default gen_random_uuid(),
  record_uuid uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'Omnia Learning Record',
  description text,
  status text not null default 'active',
  default_visibility text not null default 'oga',
  version integer not null default 1,
  standards_status text not null default 'internal_record',
  clr_json jsonb not null default '{}'::jsonb,
  last_built_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clr_records_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint clr_records_status_check
    check (status in ('active','archived','suspended')),
  constraint clr_records_visibility_check
    check (default_visibility in ('private','oga','recruiters','structure','public')),
  constraint clr_records_standards_status_check
    check (standards_status in ('internal_record','clr2_draft','clr2_signed')),
  constraint clr_records_version_check
    check (version >= 1)
);

alter table public.clr_records
  add column if not exists record_uuid uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists title text default 'Omnia Learning Record',
  add column if not exists description text,
  add column if not exists status text default 'active',
  add column if not exists default_visibility text default 'oga',
  add column if not exists version integer default 1,
  add column if not exists standards_status text default 'internal_record',
  add column if not exists clr_json jsonb default '{}'::jsonb,
  add column if not exists last_built_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.clr_records
set record_uuid = gen_random_uuid()
where record_uuid is null;

create unique index if not exists clr_records_record_uuid_uidx
  on public.clr_records(record_uuid);
create unique index if not exists clr_records_user_id_uidx
  on public.clr_records(user_id);
create index if not exists clr_records_status_idx
  on public.clr_records(status, updated_at desc);
create index if not exists clr_records_standards_idx
  on public.clr_records(standards_status, updated_at desc);

create table if not exists public.clr_achievements (
  id uuid primary key default gen_random_uuid(),
  clr_record_id uuid not null,
  award_id uuid,
  source_type text not null,
  source_id text,
  title text not null,
  description text,
  achievement_type text not null default 'Achievement',
  section text not null default 'badges',
  status text not null default 'active',
  visibility text not null default 'oga',
  issued_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clr_achievements_record_id_fkey
    foreign key (clr_record_id) references public.clr_records(id) on delete cascade,
  constraint clr_achievements_award_id_fkey
    foreign key (award_id) references public.badge_awards(id) on delete cascade,
  constraint clr_achievements_status_check
    check (status in ('active','hidden','revoked','expired')),
  constraint clr_achievements_visibility_check
    check (visibility in ('private','oga','recruiters','structure','public'))
);

alter table public.clr_achievements
  add column if not exists clr_record_id uuid,
  add column if not exists award_id uuid,
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists achievement_type text default 'Achievement',
  add column if not exists section text default 'badges',
  add column if not exists status text default 'active',
  add column if not exists visibility text default 'oga',
  add column if not exists issued_at timestamptz,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists clr_achievements_award_uidx
  on public.clr_achievements(award_id) where award_id is not null;
create index if not exists clr_achievements_record_issued_idx
  on public.clr_achievements(clr_record_id, issued_at desc);
create index if not exists clr_achievements_section_idx
  on public.clr_achievements(clr_record_id, section, status);
create index if not exists clr_achievements_visibility_idx
  on public.clr_achievements(clr_record_id, visibility, issued_at desc);
create index if not exists clr_achievements_source_idx
  on public.clr_achievements(source_type, source_id);

create table if not exists public.clr_shares (
  id uuid primary key default gen_random_uuid(),
  clr_record_id uuid not null,
  token_hash text not null,
  label text,
  include_sections text[] not null default '{}'::text[],
  visibility_filter text not null default 'public',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clr_shares_record_id_fkey
    foreign key (clr_record_id) references public.clr_records(id) on delete cascade,
  constraint clr_shares_visibility_check
    check (visibility_filter in ('oga','recruiters','structure','public')),
  constraint clr_shares_expiry_check
    check (expires_at is null or expires_at >= created_at)
);

alter table public.clr_shares
  add column if not exists clr_record_id uuid,
  add column if not exists token_hash text,
  add column if not exists label text,
  add column if not exists include_sections text[] default '{}'::text[],
  add column if not exists visibility_filter text default 'public',
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_accessed_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists clr_shares_token_hash_uidx
  on public.clr_shares(token_hash);
create index if not exists clr_shares_record_idx
  on public.clr_shares(clr_record_id, created_at desc);
create index if not exists clr_shares_active_idx
  on public.clr_shares(clr_record_id, expires_at)
  where revoked_at is null;

create table if not exists public.clr_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  record_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint clr_audit_logs_record_id_fkey
    foreign key (record_id) references public.clr_records(id) on delete cascade
);

alter table public.clr_audit_logs
  add column if not exists actor_user_id uuid,
  add column if not exists record_id uuid,
  add column if not exists action text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists clr_audit_logs_record_idx
  on public.clr_audit_logs(record_id, created_at desc);
create index if not exists clr_audit_logs_actor_idx
  on public.clr_audit_logs(actor_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. Named foreign keys for pre-existing remote tables. The explicit names
--    also make PostgREST relationship hints deterministic.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credential_issuers_created_by_fkey' and conrelid = 'public.credential_issuers'::regclass) then
    alter table public.credential_issuers add constraint credential_issuers_created_by_fkey foreign key (created_by) references public.users(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_categories_created_by_fkey' and conrelid = 'public.badge_categories'::regclass) then
    alter table public.badge_categories add constraint badge_categories_created_by_fkey foreign key (created_by) references public.users(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_levels_created_by_fkey' and conrelid = 'public.badge_levels'::regclass) then
    alter table public.badge_levels add constraint badge_levels_created_by_fkey foreign key (created_by) references public.users(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_templates_issuer_id_fkey' and conrelid = 'public.badge_templates'::regclass) then
    alter table public.badge_templates add constraint badge_templates_issuer_id_fkey foreign key (issuer_id) references public.credential_issuers(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_templates_category_id_fkey' and conrelid = 'public.badge_templates'::regclass) then
    alter table public.badge_templates add constraint badge_templates_category_id_fkey foreign key (category_id) references public.badge_categories(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_templates_level_id_fkey' and conrelid = 'public.badge_templates'::regclass) then
    alter table public.badge_templates add constraint badge_templates_level_id_fkey foreign key (level_id) references public.badge_levels(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_templates_created_by_fkey' and conrelid = 'public.badge_templates'::regclass) then
    alter table public.badge_templates add constraint badge_templates_created_by_fkey foreign key (created_by) references public.users(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_templates_updated_by_fkey' and conrelid = 'public.badge_templates'::regclass) then
    alter table public.badge_templates add constraint badge_templates_updated_by_fkey foreign key (updated_by) references public.users(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credential_signing_keys_issuer_id_fkey' and conrelid = 'public.credential_signing_keys'::regclass) then
    alter table public.credential_signing_keys add constraint credential_signing_keys_issuer_id_fkey foreign key (issuer_id) references public.credential_issuers(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credential_signing_keys_created_by_fkey' and conrelid = 'public.credential_signing_keys'::regclass) then
    alter table public.credential_signing_keys add constraint credential_signing_keys_created_by_fkey foreign key (created_by) references public.users(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_awards_template_id_fkey' and conrelid = 'public.badge_awards'::regclass) then
    alter table public.badge_awards add constraint badge_awards_template_id_fkey foreign key (template_id) references public.badge_templates(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_awards_issuer_id_fkey' and conrelid = 'public.badge_awards'::regclass) then
    alter table public.badge_awards add constraint badge_awards_issuer_id_fkey foreign key (issuer_id) references public.credential_issuers(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_awards_recipient_user_id_fkey' and conrelid = 'public.badge_awards'::regclass) then
    alter table public.badge_awards add constraint badge_awards_recipient_user_id_fkey foreign key (recipient_user_id) references public.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_awards_awarded_by_fkey' and conrelid = 'public.badge_awards'::regclass) then
    alter table public.badge_awards add constraint badge_awards_awarded_by_fkey foreign key (awarded_by) references public.users(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_awards_revoked_by_fkey' and conrelid = 'public.badge_awards'::regclass) then
    alter table public.badge_awards add constraint badge_awards_revoked_by_fkey foreign key (revoked_by) references public.users(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_awards_signing_key_id_fkey' and conrelid = 'public.badge_awards'::regclass) then
    alter table public.badge_awards add constraint badge_awards_signing_key_id_fkey foreign key (signing_key_id) references public.credential_signing_keys(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_evidence_award_id_fkey' and conrelid = 'public.badge_evidence'::regclass) then
    alter table public.badge_evidence add constraint badge_evidence_award_id_fkey foreign key (award_id) references public.badge_awards(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_evidence_created_by_fkey' and conrelid = 'public.badge_evidence'::regclass) then
    alter table public.badge_evidence add constraint badge_evidence_created_by_fkey foreign key (created_by) references public.users(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'badge_review_requests_template_id_fkey' and conrelid = 'public.badge_review_requests'::regclass) then
    alter table public.badge_review_requests add constraint badge_review_requests_template_id_fkey foreign key (template_id) references public.badge_templates(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'badge_review_requests_award_id_fkey' and conrelid = 'public.badge_review_requests'::regclass) then
    alter table public.badge_review_requests add constraint badge_review_requests_award_id_fkey foreign key (award_id) references public.badge_awards(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credential_verification_events_award_id_fkey' and conrelid = 'public.credential_verification_events'::regclass) then
    alter table public.credential_verification_events add constraint credential_verification_events_award_id_fkey foreign key (award_id) references public.badge_awards(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credential_verification_events_signing_key_id_fkey' and conrelid = 'public.credential_verification_events'::regclass) then
    alter table public.credential_verification_events add constraint credential_verification_events_signing_key_id_fkey foreign key (signing_key_id) references public.credential_signing_keys(id) on delete set null not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credential_exports_award_id_fkey' and conrelid = 'public.credential_exports'::regclass) then
    alter table public.credential_exports add constraint credential_exports_award_id_fkey foreign key (award_id) references public.badge_awards(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clr_records_user_id_fkey' and conrelid = 'public.clr_records'::regclass) then
    alter table public.clr_records add constraint clr_records_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clr_achievements_record_id_fkey' and conrelid = 'public.clr_achievements'::regclass) then
    alter table public.clr_achievements add constraint clr_achievements_record_id_fkey foreign key (clr_record_id) references public.clr_records(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clr_achievements_award_id_fkey' and conrelid = 'public.clr_achievements'::regclass) then
    alter table public.clr_achievements add constraint clr_achievements_award_id_fkey foreign key (award_id) references public.badge_awards(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clr_shares_record_id_fkey' and conrelid = 'public.clr_shares'::regclass) then
    alter table public.clr_shares add constraint clr_shares_record_id_fkey foreign key (clr_record_id) references public.clr_records(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clr_audit_logs_record_id_fkey' and conrelid = 'public.clr_audit_logs'::regclass) then
    alter table public.clr_audit_logs add constraint clr_audit_logs_record_id_fkey foreign key (record_id) references public.clr_records(id) on delete cascade not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 10. updated_at automation
-- ---------------------------------------------------------------------------
create or replace function public.omnia_credentials_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'credential_issuers',
    'badge_categories',
    'badge_levels',
    'badge_templates',
    'credential_signing_keys',
    'badge_awards',
    'badge_evidence',
    'badge_review_requests',
    'clr_records',
    'clr_achievements',
    'clr_shares'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.omnia_credentials_set_updated_at()',
      'trg_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Initial Omnia taxonomy and platform issuer
-- ---------------------------------------------------------------------------
insert into public.credential_issuers (
  code,
  name,
  description,
  issuer_type,
  website_url,
  issuer_uri,
  status
)
values (
  'omnia-global-academy',
  'Omnia Global Academy',
  'Émetteur officiel des credentials vérifiés Omnia Global Academy.',
  'platform',
  'https://omniaglobalacademy.com',
  'https://omniaglobalacademy.com/credentials/issuers/omnia-global-academy',
  'active'
)
on conflict (code) do nothing;

insert into public.badge_categories (slug, name, description, category_type, display_order, is_active)
values
  ('competences', 'Compétences', 'Compétences démontrées par une formation, une évaluation ou un projet validé.', 'skill', 10, true),
  ('reussites', 'Réussites', 'Étapes, objectifs et résultats vérifiés dans Omnia.', 'achievement', 20, true),
  ('confiance', 'Confiance', 'Reconnaissances liées à la fiabilité, à la qualité ou à une recommandation vérifiée.', 'trust', 30, true),
  ('engagement', 'Engagement communautaire', 'Contributions utiles, mentorat, modération et engagement communautaire, distincts des compétences professionnelles.', 'community', 40, true),
  ('internes', 'Badges internes', 'Reconnaissances internes à Omnia, non publiables comme credentials externes.', 'internal', 50, true)
on conflict (slug) do nothing;

insert into public.badge_levels (slug, name, description, rank, color, is_active)
values
  ('initiation', 'Initiation', 'Première maîtrise vérifiée.', 10, '#002050', true),
  ('intermediaire', 'Intermédiaire', 'Maîtrise opérationnelle vérifiée.', 20, '#BF8813', true),
  ('avance', 'Avancé', 'Maîtrise approfondie vérifiée.', 30, '#002050', true),
  ('expert', 'Expert', 'Maîtrise experte vérifiée.', 40, '#BF8813', true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 12. Safe backfill for environments where badge awards already exist.
-- ---------------------------------------------------------------------------
insert into public.clr_records (user_id, title, description, status, default_visibility)
select distinct
  award.recipient_user_id,
  'Omnia Learning Record',
  'Dossier vérifié des réalisations Omnia.',
  'active',
  'oga'
from public.badge_awards award
where award.recipient_user_id is not null
on conflict (user_id) do nothing;

insert into public.clr_achievements (
  clr_record_id,
  award_id,
  source_type,
  source_id,
  title,
  description,
  achievement_type,
  section,
  status,
  visibility,
  issued_at,
  payload
)
select
  record.id,
  award.id,
  'badge',
  award.id::text,
  template.name,
  template.description,
  template.achievement_type,
  case category.category_type
    when 'community' then 'engagement_communautaire'
    when 'skill' then 'competences_verifiees'
    else 'badges'
  end,
  case award.status
    when 'revoked' then 'revoked'
    when 'expired' then 'expired'
    else 'active'
  end,
  award.visibility,
  award.issued_at,
  coalesce(award.credential_json, '{}'::jsonb)
from public.badge_awards award
join public.clr_records record on record.user_id = award.recipient_user_id
join public.badge_templates template on template.id = award.template_id
join public.badge_categories category on category.id = template.category_id
where not exists (
  select 1
  from public.clr_achievements existing
  where existing.award_id = award.id
);

-- ---------------------------------------------------------------------------
-- 13. RLS: all application access currently goes through the credentials Edge
--     Function with the service role. No public table access is opened here.
-- ---------------------------------------------------------------------------
alter table public.credential_issuers enable row level security;
alter table public.badge_categories enable row level security;
alter table public.badge_levels enable row level security;
alter table public.badge_templates enable row level security;
alter table public.credential_signing_keys enable row level security;
alter table public.badge_awards enable row level security;
alter table public.badge_evidence enable row level security;
alter table public.badge_review_requests enable row level security;
alter table public.badge_audit_logs enable row level security;
alter table public.credential_verification_events enable row level security;
alter table public.credential_exports enable row level security;
alter table public.clr_records enable row level security;
alter table public.clr_achievements enable row level security;
alter table public.clr_shares enable row level security;
alter table public.clr_audit_logs enable row level security;

revoke all on table public.credential_issuers from anon, authenticated;
revoke all on table public.badge_categories from anon, authenticated;
revoke all on table public.badge_levels from anon, authenticated;
revoke all on table public.badge_templates from anon, authenticated;
revoke all on table public.credential_signing_keys from anon, authenticated;
revoke all on table public.badge_awards from anon, authenticated;
revoke all on table public.badge_evidence from anon, authenticated;
revoke all on table public.badge_review_requests from anon, authenticated;
revoke all on table public.badge_audit_logs from anon, authenticated;
revoke all on table public.credential_verification_events from anon, authenticated;
revoke all on table public.credential_exports from anon, authenticated;
revoke all on table public.clr_records from anon, authenticated;
revoke all on table public.clr_achievements from anon, authenticated;
revoke all on table public.clr_shares from anon, authenticated;
revoke all on table public.clr_audit_logs from anon, authenticated;

comment on table public.credential_issuers is 'Open Badges / CLR credential issuers registered by Omnia.';
comment on table public.credential_signing_keys is 'Public RSA signing-key registry. Private keys remain only in Edge Function secrets.';
comment on table public.badge_templates is 'Reusable Omnia badge definitions, criteria and publication rules.';
comment on table public.badge_awards is 'Awarded Open Badges credentials and their cryptographic state.';
comment on table public.clr_records is 'Per-user Omnia Learning Record prepared for CLR 2.0.';
comment on table public.clr_achievements is 'Verified achievements included in an Omnia Learning Record.';
