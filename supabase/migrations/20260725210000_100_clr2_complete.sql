-- Omnia Global Academy
-- Grand module 3 — CLR 2.0 complet
-- Prérequis : 20260725190000_099_credentials_badges_clr_foundation.sql

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Profil, synchronisation et signature du Learning Record
-- ---------------------------------------------------------------------------
alter table public.clr_records
  add column if not exists profile_headline text,
  add column if not exists summary text,
  add column if not exists language_code text not null default 'fr',
  add column if not exists section_order text[] not null default array[
    'formations','certificats','competences_verifiees','evaluations','badges',
    'coaching','omnia_live','projets','experiences','recommandations',
    'engagement_communautaire'
  ]::text[],
  add column if not exists hidden_sections text[] not null default '{}'::text[],
  add column if not exists last_synced_at timestamptz,
  add column if not exists clr_jwt text,
  add column if not exists signed_at timestamptz,
  add column if not exists signing_key_id uuid,
  add column if not exists signature_alg text,
  add column if not exists credential_hash text,
  add column if not exists verification_result jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clr_records_signing_key_id_fkey'
      and conrelid = 'public.clr_records'::regclass
  ) then
    alter table public.clr_records
      add constraint clr_records_signing_key_id_fkey
      foreign key (signing_key_id)
      references public.credential_signing_keys(id)
      on delete set null not valid;
  end if;
end $$;

create index if not exists clr_records_last_synced_idx
  on public.clr_records(last_synced_at desc);
create index if not exists clr_records_signed_idx
  on public.clr_records(signed_at desc)
  where clr_jwt is not null;

-- ---------------------------------------------------------------------------
-- 2. Réalisations multi-sources
-- ---------------------------------------------------------------------------
alter table public.clr_achievements
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists score numeric(10,2),
  add column if not exists score_max numeric(10,2),
  add column if not exists result_label text,
  add column if not exists skills text[] not null default '{}'::text[],
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists external_url text,
  add column if not exists issuer_name text,
  add column if not exists issuer_url text,
  add column if not exists entry_origin text not null default 'platform',
  add column if not exists verification_status text not null default 'verified',
  add column if not exists learner_editable boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists source_updated_at timestamptz;

update public.clr_achievements
set
  skills = coalesce(skills, '{}'::text[]),
  evidence = coalesce(evidence, '[]'::jsonb),
  metadata = coalesce(metadata, '{}'::jsonb),
  entry_origin = coalesce(nullif(entry_origin, ''), 'platform'),
  verification_status = case
    when status = 'revoked' then 'revoked'
    else coalesce(nullif(verification_status, ''), 'verified')
  end,
  learner_editable = coalesce(learner_editable, false),
  is_featured = coalesce(is_featured, false),
  sort_order = coalesce(sort_order, 0);

create unique index if not exists clr_achievements_source_unique_idx
  on public.clr_achievements(clr_record_id, source_type, source_id)
  where source_id is not null;
create index if not exists clr_achievements_verification_idx
  on public.clr_achievements(clr_record_id, verification_status, section);
create index if not exists clr_achievements_featured_idx
  on public.clr_achievements(clr_record_id, is_featured, sort_order);
create index if not exists clr_achievements_origin_idx
  on public.clr_achievements(clr_record_id, entry_origin, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. Imports externes contrôlés
-- ---------------------------------------------------------------------------
create table if not exists public.clr_imports (
  id uuid primary key default gen_random_uuid(),
  clr_record_id uuid not null,
  user_id uuid not null,
  source_format text not null,
  source_file_name text,
  source_issuer text,
  credential_type text,
  raw_payload jsonb not null default '{}'::jsonb,
  compact_jwt text,
  status text not null default 'pending',
  verification_result jsonb not null default '{}'::jsonb,
  imported_entries_count integer not null default 0,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clr_imports_record_id_fkey
    foreign key (clr_record_id) references public.clr_records(id) on delete cascade,
  constraint clr_imports_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint clr_imports_reviewed_by_fkey
    foreign key (reviewed_by) references public.users(id) on delete set null,
  constraint clr_imports_format_check
    check (source_format in ('json','json_ld','vc_jwt')),
  constraint clr_imports_status_check
    check (status in ('pending','imported','rejected','failed')),
  constraint clr_imports_count_check
    check (imported_entries_count >= 0)
);

alter table public.clr_imports
  add column if not exists clr_record_id uuid,
  add column if not exists user_id uuid,
  add column if not exists source_format text,
  add column if not exists source_file_name text,
  add column if not exists source_issuer text,
  add column if not exists credential_type text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists compact_jwt text,
  add column if not exists status text not null default 'pending',
  add column if not exists verification_result jsonb not null default '{}'::jsonb,
  add column if not exists imported_entries_count integer not null default 0,
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clr_imports_user_idx
  on public.clr_imports(user_id, created_at desc);
create index if not exists clr_imports_record_idx
  on public.clr_imports(clr_record_id, status, created_at desc);
create index if not exists clr_imports_pending_idx
  on public.clr_imports(status, created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 4. Registre d’exports CLR
-- ---------------------------------------------------------------------------
create table if not exists public.clr_exports (
  id uuid primary key default gen_random_uuid(),
  clr_record_id uuid not null,
  user_id uuid not null,
  export_format text not null,
  credential_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint clr_exports_record_id_fkey
    foreign key (clr_record_id) references public.clr_records(id) on delete cascade,
  constraint clr_exports_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint clr_exports_format_check
    check (export_format in ('clr_json','vc_jwt'))
);

alter table public.clr_exports
  add column if not exists clr_record_id uuid,
  add column if not exists user_id uuid,
  add column if not exists export_format text,
  add column if not exists credential_hash text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists clr_exports_record_idx
  on public.clr_exports(clr_record_id, created_at desc);
create index if not exists clr_exports_user_idx
  on public.clr_exports(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Mise à jour automatique et protection
-- ---------------------------------------------------------------------------
drop trigger if exists clr_imports_set_updated_at on public.clr_imports;
create trigger clr_imports_set_updated_at
before update on public.clr_imports
for each row execute function public.omnia_credentials_set_updated_at();

alter table public.clr_imports enable row level security;
alter table public.clr_exports enable row level security;

revoke all on table public.clr_imports from anon, authenticated;
revoke all on table public.clr_exports from anon, authenticated;

comment on table public.clr_imports is
  'Imports CLR, JSON-LD et VC-JWT soumis au contrôle Omnia.';
comment on table public.clr_exports is
  'Journal des exports CLR JSON-LD et VC-JWT.';

