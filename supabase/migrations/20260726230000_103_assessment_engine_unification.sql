-- Programme 1 / Grand module 1
-- Moteur unique d'évaluation, tentatives avec remédiation, copies privées et remise à zéro des anciens plans.

create extension if not exists pgcrypto;

-- 1) Paramètres centraux du moteur d'évaluation récent.
alter table public.courses
  add column if not exists assessment_policy jsonb not null default '{
    "purchased_access":"until_passed",
    "certificate_requires_success":true,
    "default_retry_cooldown_hours":24,
    "default_remediation_after_attempts":3,
    "default_remediation_mode":"review_module"
  }'::jsonb;


alter table public.courses
  add column if not exists assessment_rules_locked boolean not null default false;

alter table public.courses
  alter column assessment_rules_locked set default false;

update public.courses
set assessment_rules_locked = false
where assessment_rules_locked is distinct from false;

alter table public.course_assessments
  add column if not exists retry_cooldown_hours integer not null default 24,
  add column if not exists remediation_after_attempts integer not null default 3,
  add column if not exists remediation_mode text not null default 'review_module',
  add column if not exists attempts_unlimited_for_purchased boolean not null default true,
  add column if not exists attempts_per_period integer,
  add column if not exists attempt_period text,
  add column if not exists retry_instructions text not null default '',
  add column if not exists policy_version integer not null default 1;

alter table public.course_assessments drop constraint if exists course_assessments_remediation_mode_check;
alter table public.course_assessments
  add constraint course_assessments_remediation_mode_check
  check (remediation_mode in ('none','review_lesson','review_module','exercise','manual'));

alter table public.course_assessments drop constraint if exists course_assessments_attempt_period_check;
alter table public.course_assessments
  add constraint course_assessments_attempt_period_check
  check (attempt_period is null or attempt_period in ('day','week','month','subscription_period'));

alter table public.course_assessments drop constraint if exists course_assessments_retry_cooldown_check;
alter table public.course_assessments
  add constraint course_assessments_retry_cooldown_check
  check (retry_cooldown_hours between 0 and 8760);

alter table public.course_assessments drop constraint if exists course_assessments_remediation_after_check;
alter table public.course_assessments
  add constraint course_assessments_remediation_after_check
  check (remediation_after_attempts >= 1);

alter table public.assessment_attempts
  add column if not exists retry_available_at timestamptz,
  add column if not exists remediation_required boolean not null default false,
  add column if not exists remediation_completed_at timestamptz,
  add column if not exists remediation_note text,
  add column if not exists source_engine text not null default 'course_assessments';

create index if not exists ix_assessment_attempts_retry
  on public.assessment_attempts(user_id,assessment_id,retry_available_at desc);

-- 2) Copies et corrections privées.
create table if not exists public.assessment_submission_files (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  answer_id uuid references public.assessment_answers(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  bucket_name text not null default 'assessment-submissions',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  uploaded_at timestamptz not null default now(),
  unique(bucket_name,storage_path)
);

alter table public.assessment_submission_files
  add column if not exists attempt_id uuid references public.assessment_attempts(id) on delete cascade,
  add column if not exists answer_id uuid references public.assessment_answers(id) on delete cascade,
  add column if not exists owner_user_id uuid references public.users(id) on delete cascade,
  add column if not exists bucket_name text not null default 'assessment-submissions',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint not null default 0,
  add column if not exists uploaded_at timestamptz not null default now();

create index if not exists ix_assessment_submission_files_attempt
  on public.assessment_submission_files(attempt_id,uploaded_at);

create unique index if not exists ux_assessment_submission_files_storage
  on public.assessment_submission_files(bucket_name,storage_path);

create table if not exists public.assessment_corrections (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  grader_id uuid not null references public.users(id),
  status text not null default 'draft',
  score numeric(6,2),
  max_score numeric(8,2),
  comment text,
  corrected_bucket_name text,
  corrected_storage_path text,
  corrected_file_name text,
  corrected_mime_type text,
  corrected_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique(attempt_id,grader_id)
);

alter table public.assessment_corrections
  add column if not exists attempt_id uuid references public.assessment_attempts(id) on delete cascade,
  add column if not exists grader_id uuid references public.users(id),
  add column if not exists status text not null default 'draft',
  add column if not exists score numeric(6,2),
  add column if not exists max_score numeric(8,2),
  add column if not exists comment text,
  add column if not exists corrected_bucket_name text,
  add column if not exists corrected_storage_path text,
  add column if not exists corrected_file_name text,
  add column if not exists corrected_mime_type text,
  add column if not exists corrected_size_bytes bigint,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists published_at timestamptz;

alter table public.assessment_corrections drop constraint if exists assessment_corrections_status_check;
alter table public.assessment_corrections
  add constraint assessment_corrections_status_check
  check (status in ('draft','published','changes_requested'));

create index if not exists ix_assessment_corrections_attempt
  on public.assessment_corrections(attempt_id,status,updated_at desc);

create unique index if not exists ux_assessment_corrections_attempt_grader
  on public.assessment_corrections(attempt_id,grader_id);

alter table public.assessment_submission_files enable row level security;
alter table public.assessment_corrections enable row level security;

-- Les lectures et écritures passent par l'Edge Function studio-unified.
revoke all on public.assessment_submission_files from anon, authenticated;
revoke all on public.assessment_corrections from anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'assessment-submissions',
  'assessment-submissions',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'assessment-corrections',
  'assessment-corrections',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Harmonisation des valeurs actuelles du moteur canonique.
update public.course_assessments
set
  retry_cooldown_hours = coalesce(retry_cooldown_hours,24),
  remediation_after_attempts = greatest(1,coalesce(remediation_after_attempts,max_attempts,3)),
  remediation_mode = coalesce(nullif(remediation_mode,''),'review_module'),
  attempts_unlimited_for_purchased = true,
  updated_at = now();

-- 4) Archivage puis remise à zéro des anciens plans et packs.
create table if not exists public.legacy_commerce_archive (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_row jsonb not null,
  archived_at timestamptz not null default now(),
  archive_reason text not null default 'central_commerce_reset_programme_1'
);

create or replace function public.archive_and_clear_legacy_table(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_is_active boolean;
  has_status boolean;
begin
  if to_regclass('public.' || p_table) is null then
    return;
  end if;

  execute format(
    'insert into public.legacy_commerce_archive(source_table,source_row)
     select %L,to_jsonb(t) from public.%I t
     where not exists (
       select 1 from public.legacy_commerce_archive a
       where a.source_table=%L and a.source_row=to_jsonb(t)
     )',
    p_table,p_table,p_table
  );

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='is_active'
  ) into has_is_active;
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='status'
  ) into has_status;

  -- Les lignes sont retirées des interfaces actives, mais restent disponibles
  -- pour l'audit financier et la future migration vers le moteur central.
  if has_is_active then
    execute format('update public.%I set is_active=false where is_active is distinct from false',p_table);
  elsif has_status and p_table='live_subscription_plans' then
    execute format('update public.%I set status=%L where status is distinct from %L',p_table,'inactive','inactive');
  elsif has_status and p_table='live_structure_packs' then
    execute format('update public.%I set status=%L where status is distinct from %L',p_table,'cancelled','cancelled');
  else
    raise notice 'La table % est archivée et n’est plus appelée par les interfaces ; ses lignes restent intactes pour l’historique.',p_table;
  end if;
end;
$$;

revoke all on function public.archive_and_clear_legacy_table(text) from public, anon, authenticated;

-- Archivage et désactivation des anciens catalogues. Les écritures financières restent intactes.
select public.archive_and_clear_legacy_table('coaching_package_redemptions');
select public.archive_and_clear_legacy_table('coaching_package_purchases');
select public.archive_and_clear_legacy_table('coaching_subscriptions');
select public.archive_and_clear_legacy_table('coaching_packages');
select public.archive_and_clear_legacy_table('coaching_subscription_plans');
select public.archive_and_clear_legacy_table('live_structure_packs');
select public.archive_and_clear_legacy_table('live_subscription_plans');
select public.archive_and_clear_legacy_table('career_token_packs');

-- Produits/avantages historiques Omnia Live : archivés puis rendus inaccessibles.
-- Les commandes et écritures financières sont conservées pour l'audit.
do $$
begin
  if to_regclass('public.live_commerce_products') is not null then
    insert into public.legacy_commerce_archive(source_table,source_row)
    select 'live_commerce_products_legacy_types',to_jsonb(p)
    from public.live_commerce_products p
    where p.product_type in ('subscription','structure_pack')
      and not exists (
        select 1 from public.legacy_commerce_archive a
        where a.source_table='live_commerce_products_legacy_types'
          and a.source_row=to_jsonb(p)
      );

    update public.live_commerce_products
    set status='inactive',updated_at=now()
    where product_type in ('subscription','structure_pack')
      and status is distinct from 'inactive';
  end if;

  if to_regclass('public.live_entitlements') is not null then
    insert into public.legacy_commerce_archive(source_table,source_row)
    select 'live_entitlements_legacy_types',to_jsonb(e)
    from public.live_entitlements e
    where e.entitlement_type in ('subscription','structure_pack')
      and not exists (
        select 1 from public.legacy_commerce_archive a
        where a.source_table='live_entitlements_legacy_types'
          and a.source_row=to_jsonb(e)
      );

    update public.live_entitlements
    set revoked_at=coalesce(revoked_at,now())
    where entitlement_type in ('subscription','structure_pack');
  end if;

  if to_regclass('public.live_feature_flags') is not null then
    insert into public.legacy_commerce_archive(source_table,source_row)
    select 'live_feature_flags_legacy_commerce',to_jsonb(f)
    from public.live_feature_flags f
    where f.flag_key in ('omnia_live_pass','oga_premium_live')
      and not exists (
        select 1 from public.legacy_commerce_archive a
        where a.source_table='live_feature_flags_legacy_commerce'
          and a.source_row=to_jsonb(f)
      );

    delete from public.live_feature_flags
    where flag_key in ('omnia_live_pass','oga_premium_live');
  end if;

  if to_regclass('public.live_global_settings') is not null then
    update public.live_global_settings
    set config_value='{
      "omnia_live_pass_enabled": false,
      "oga_premium_live_enabled": false,
      "structure_packs_enabled": false,
      "managed_by_central_commerce": true
    }'::jsonb,
    updated_at=now()
    where config_key='subscriptions';
  end if;
end $$;

-- Désactivation explicite de la vente de jetons Career, sans supprimer l'historique des transactions.
do $$
begin
  if to_regclass('public.career_admin_rules') is not null then
    update public.career_admin_rules
    set value_json='{"value":false}'::jsonb,
        is_active=false,
        updated_at=now()
    where rule_key='token_sales_enabled';
  end if;
end $$;

insert into public.site_settings(key,value,updated_at)
values ('legacy_commerce_state','{"enabled":false,"reset_reason":"central_commerce_programme_1","replacement":"central_commerce_module_5"}'::jsonb,now())
on conflict (key) do update set value=excluded.value,updated_at=excluded.updated_at;

alter table public.legacy_commerce_archive enable row level security;
revoke all on public.legacy_commerce_archive from anon, authenticated;

-- 5) Suppression de l'ancien moteur d'évaluation et de ses données de test.
-- user_lesson_progress est conservée uniquement comme journal de progression/temps CPD.
drop table if exists public.quiz_attempts cascade;
drop table if exists public.user_module_progress cascade;
drop table if exists public.user_final_validation cascade;
drop table if exists public.course_questions cascade;

comment on table public.course_assessments is
  'Moteur unique des évaluations Omnia. Les anciens quiz et validations finales ont été retirés par la migration 103.';
comment on table public.user_lesson_progress is
  'Progression et temps pédagogique uniquement. quiz_passed est un cache du résultat course_assessments, pas un moteur distinct.';

-- La fonction d'archivage reste disponible pour le futur module de monétisation centrale.
