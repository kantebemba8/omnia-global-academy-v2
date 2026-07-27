-- Programme 1 — Grand module 4
-- Gouvernance des évaluations : experts, jurys, révisions de notes,
-- référentiels de compétences et registre vérifiable des compétences.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Paramètres complémentaires des évaluations officielles
-- ---------------------------------------------------------------------------
alter table public.course_assessments
  add column if not exists jury_required boolean not null default false,
  add column if not exists jury_min_members integer not null default 2,
  add column if not exists jury_decision_mode text not null default 'majority',
  add column if not exists appeal_enabled boolean not null default true,
  add column if not exists appeal_deadline_days integer not null default 7,
  add column if not exists competency_framework_id uuid;

alter table public.course_assessments drop constraint if exists course_assessments_jury_min_members_check;
alter table public.course_assessments add constraint course_assessments_jury_min_members_check
  check (jury_min_members between 1 and 15);

alter table public.course_assessments drop constraint if exists course_assessments_jury_decision_mode_check;
alter table public.course_assessments add constraint course_assessments_jury_decision_mode_check
  check (jury_decision_mode in ('majority','unanimous','president_final'));

alter table public.course_assessments drop constraint if exists course_assessments_appeal_deadline_days_check;
alter table public.course_assessments add constraint course_assessments_appeal_deadline_days_check
  check (appeal_deadline_days between 0 and 90);

-- ---------------------------------------------------------------------------
-- 2) Référentiels centraux de compétences
-- ---------------------------------------------------------------------------
create table if not exists public.competency_frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  version text not null default '1.0',
  scope text not null default 'omnia',
  organization_id uuid,
  status text not null default 'draft',
  effective_from date,
  effective_until date,
  review_due_at timestamptz,
  supersedes_id uuid references public.competency_frameworks(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competency_frameworks_scope_check check (scope in ('omnia','structure','external')),
  constraint competency_frameworks_status_check check (status in ('draft','pending_approval','published','archived')),
  constraint competency_frameworks_dates_check check (effective_until is null or effective_from is null or effective_until >= effective_from)
);
create unique index if not exists competency_frameworks_code_version_uidx
  on public.competency_frameworks(lower(code), version);
create index if not exists competency_frameworks_status_idx
  on public.competency_frameworks(status, updated_at desc);

create table if not exists public.competency_levels (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.competency_frameworks(id) on delete cascade,
  level_number integer not null,
  code text not null,
  name text not null,
  description text,
  observable_expectations jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(framework_id, level_number),
  unique(framework_id, code),
  constraint competency_levels_number_check check (level_number between 1 and 20)
);

create table if not exists public.competency_definitions (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.competency_frameworks(id) on delete cascade,
  parent_id uuid references public.competency_definitions(id) on delete set null,
  code text not null,
  name text not null,
  description text,
  domain text,
  category text,
  evidence_requirements jsonb not null default '[]'::jsonb,
  validity_months integer,
  renewal_mode text not null default 'none',
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(framework_id, code),
  constraint competency_definitions_validity_check check (validity_months is null or validity_months between 1 and 600),
  constraint competency_definitions_renewal_check check (renewal_mode in ('none','full_training','update_training','renewal_exam','new_evidence','expert_validation')),
  constraint competency_definitions_status_check check (status in ('active','inactive','deprecated'))
);
create index if not exists competency_definitions_framework_idx
  on public.competency_definitions(framework_id, status, domain, name);

create table if not exists public.assessment_competency_mappings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  competency_id uuid not null references public.competency_definitions(id) on delete cascade,
  target_level_id uuid references public.competency_levels(id) on delete set null,
  weight numeric(6,2) not null default 1,
  passing_score numeric(6,2),
  required boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assessment_id, competency_id),
  constraint assessment_competency_mappings_weight_check check (weight > 0 and weight <= 100),
  constraint assessment_competency_mappings_score_check check (passing_score is null or (passing_score >= 0 and passing_score <= 100))
);
create index if not exists assessment_competency_mappings_assessment_idx
  on public.assessment_competency_mappings(assessment_id, required);

alter table public.course_assessments
  drop constraint if exists course_assessments_competency_framework_id_fkey;
alter table public.course_assessments
  add constraint course_assessments_competency_framework_id_fkey
  foreign key (competency_framework_id) references public.competency_frameworks(id) on delete set null;

alter table public.assessment_result_competencies
  add column if not exists competency_id uuid references public.competency_definitions(id) on delete set null,
  add column if not exists competency_level_id uuid references public.competency_levels(id) on delete set null,
  add column if not exists framework_version text,
  add column if not exists valid_until timestamptz,
  add column if not exists verification_status text not null default 'verified';

alter table public.assessment_result_competencies drop constraint if exists assessment_result_competencies_verification_status_check;
alter table public.assessment_result_competencies add constraint assessment_result_competencies_verification_status_check
  check (verification_status in ('declared','evaluated','verified','jury_validated','expired','update_required'));

create table if not exists public.learner_competency_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  competency_id uuid not null references public.competency_definitions(id) on delete cascade,
  competency_level_id uuid references public.competency_levels(id) on delete set null,
  source_type text not null,
  source_id text not null,
  assessment_id uuid references public.course_assessments(id) on delete set null,
  attempt_id uuid references public.assessment_attempts(id) on delete set null,
  score numeric(6,2),
  status text not null default 'evaluated',
  framework_version text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  evidence jsonb not null default '[]'::jsonb,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, competency_id, source_type, source_id),
  constraint learner_competency_records_score_check check (score is null or (score >= 0 and score <= 100)),
  constraint learner_competency_records_status_check check (status in ('evaluated','validated','not_validated','expired','update_required','revoked'))
);
create index if not exists learner_competency_records_user_idx
  on public.learner_competency_records(user_id, status, valid_until, updated_at desc);
create index if not exists learner_competency_records_competency_idx
  on public.learner_competency_records(competency_id, status, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3) Registre des experts et jurys limités à une évaluation
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_experts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  full_name text not null,
  organization_name text,
  expertise_domains text[] not null default '{}',
  biography text,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  proposed_by uuid references public.users(id) on delete set null,
  proposal_source text not null default 'professeur',
  validation_note text,
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_experts_status_check check (status in ('pending','approved','rejected','suspended')),
  constraint assessment_experts_source_check check (proposal_source in ('professeur','structure','super_admin'))
);
create unique index if not exists assessment_experts_email_uidx
  on public.assessment_experts(lower(email));
create index if not exists assessment_experts_status_idx
  on public.assessment_experts(status, created_at desc);

create table if not exists public.assessment_jury_panels (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  session_id uuid references public.assessment_sessions(id) on delete set null,
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  purpose text,
  status text not null default 'pending_approval',
  required_members integer not null default 2,
  quorum integer not null default 2,
  blind_review boolean not null default true,
  decision_mode text not null default 'majority',
  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approval_note text,
  approved_at timestamptz,
  scheduled_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_jury_panels_status_check check (status in ('draft','pending_approval','approved','active','deliberating','completed','rejected','cancelled')),
  constraint assessment_jury_panels_members_check check (required_members between 1 and 15 and quorum between 1 and 15 and quorum <= required_members),
  constraint assessment_jury_panels_decision_check check (decision_mode in ('majority','unanimous','president_final'))
);
create index if not exists assessment_jury_panels_status_idx
  on public.assessment_jury_panels(status, created_at desc);
create index if not exists assessment_jury_panels_assessment_idx
  on public.assessment_jury_panels(assessment_id, status);

create table if not exists public.assessment_jury_members (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.assessment_jury_panels(id) on delete cascade,
  expert_id uuid references public.assessment_experts(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  external_email text,
  external_name text,
  member_role text not null default 'member',
  status text not null default 'proposed',
  permissions jsonb not null default '{
    "view_case":true,
    "view_evidence":true,
    "score":true,
    "comment":true,
    "request_complement":false,
    "deliberate":true,
    "sign_decision":false,
    "view_candidate_identity":false
  }'::jsonb,
  invitation_token_hash text,
  access_pin_hash text,
  invite_expires_at timestamptz,
  confidentiality_accepted_at timestamptz,
  conflict_status text not null default 'pending',
  conflict_details text,
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(panel_id, expert_id),
  constraint assessment_jury_members_role_check check (member_role in ('member','president','rapporteur','observer')),
  constraint assessment_jury_members_status_check check (status in ('proposed','pending_validation','invited','accepted','declined','removed','completed')),
  constraint assessment_jury_members_conflict_check check (conflict_status in ('pending','none','declared')),
  constraint assessment_jury_members_identity_check check (user_id is not null or expert_id is not null or external_email is not null)
);
create unique index if not exists assessment_jury_members_panel_identity_uidx
  on public.assessment_jury_members(panel_id, coalesce(user_id::text, expert_id::text, lower(external_email)));
create index if not exists assessment_jury_members_user_idx
  on public.assessment_jury_members(user_id, status, created_at desc);

create table if not exists public.assessment_jury_cases (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.assessment_jury_panels(id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  candidate_alias text not null,
  status text not null default 'assigned',
  review_due_at timestamptz,
  final_decision text,
  final_score numeric(6,2),
  final_mention text,
  final_comment text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(panel_id, attempt_id),
  constraint assessment_jury_cases_status_check check (status in ('assigned','in_review','ready','deliberating','decided','cancelled')),
  constraint assessment_jury_cases_decision_check check (final_decision is null or final_decision in ('passed','failed','retry','complement_required','confirmed','modified')),
  constraint assessment_jury_cases_score_check check (final_score is null or (final_score >= 0 and final_score <= 100))
);
create index if not exists assessment_jury_cases_panel_idx
  on public.assessment_jury_cases(panel_id, status, created_at desc);
create index if not exists assessment_jury_cases_attempt_idx
  on public.assessment_jury_cases(attempt_id);

create table if not exists public.assessment_jury_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.assessment_jury_cases(id) on delete cascade,
  member_id uuid not null references public.assessment_jury_members(id) on delete cascade,
  status text not null default 'draft',
  score numeric(6,2),
  max_score numeric(6,2) not null default 100,
  recommendation text,
  criteria_scores jsonb not null default '{}'::jsonb,
  comment text,
  complement_request text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(case_id, member_id),
  constraint assessment_jury_reviews_status_check check (status in ('draft','submitted','withdrawn')),
  constraint assessment_jury_reviews_score_check check (score is null or (score >= 0 and score <= 100)),
  constraint assessment_jury_reviews_recommendation_check check (recommendation is null or recommendation in ('pass','fail','retry','complement'))
);

create table if not exists public.assessment_jury_access_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.assessment_jury_members(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists assessment_jury_access_sessions_member_idx
  on public.assessment_jury_access_sessions(member_id, expires_at desc);

-- ---------------------------------------------------------------------------
-- 4) Révision d'une note
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_grade_appeals (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'submitted',
  reason text not null,
  evidence jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  admissibility_decided_by uuid references public.users(id) on delete set null,
  admissibility_decided_at timestamptz,
  admissibility_reason text,
  assigned_to uuid references public.users(id) on delete set null,
  panel_id uuid references public.assessment_jury_panels(id) on delete set null,
  original_score numeric(6,2),
  original_feedback text,
  final_score numeric(6,2),
  final_feedback text,
  decision text,
  decision_reason text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  review_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id),
  constraint assessment_grade_appeals_status_check check (status in ('submitted','admissibility_review','accepted','rejected','in_review','decided','withdrawn')),
  constraint assessment_grade_appeals_decision_check check (decision is null or decision in ('confirmed','modified','new_attempt','rejected')),
  constraint assessment_grade_appeals_scores_check check ((original_score is null or (original_score >= 0 and original_score <= 100)) and (final_score is null or (final_score >= 0 and final_score <= 100)))
);
create index if not exists assessment_grade_appeals_status_idx
  on public.assessment_grade_appeals(status, submitted_at desc);
create index if not exists assessment_grade_appeals_user_idx
  on public.assessment_grade_appeals(user_id, submitted_at desc);

create table if not exists public.assessment_appeal_history (
  id uuid primary key default gen_random_uuid(),
  appeal_id uuid not null references public.assessment_grade_appeals(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  previous_status text,
  new_status text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assessment_appeal_history_appeal_idx
  on public.assessment_appeal_history(appeal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Mise à jour automatique des timestamps
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competency_frameworks','competency_levels','competency_definitions',
    'assessment_competency_mappings','learner_competency_records',
    'assessment_experts','assessment_jury_panels','assessment_jury_members',
    'assessment_jury_cases','assessment_jury_reviews','assessment_grade_appeals'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.omnia_assessment_set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Sécurité : accès uniquement via les Edge Functions avec la service role
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competency_frameworks','competency_levels','competency_definitions',
    'assessment_competency_mappings','learner_competency_records',
    'assessment_experts','assessment_jury_panels','assessment_jury_members',
    'assessment_jury_cases','assessment_jury_reviews','assessment_jury_access_sessions',
    'assessment_grade_appeals','assessment_appeal_history'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-governance',
  'assessment-governance',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg','image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 7) Référentiel Omnia initial, sans imposer de compétences métier
-- ---------------------------------------------------------------------------
with framework as (
  insert into public.competency_frameworks (
    code, name, description, version, scope, status, effective_from, created_at, updated_at
  ) values (
    'OGA-CORE',
    'Référentiel central Omnia',
    'Référentiel administrable reliant formations, évaluations, badges, certificats, CLR et Skills Passport.',
    '1.0',
    'omnia',
    'published',
    current_date,
    now(),
    now()
  )
  on conflict do nothing
  returning id
), selected_framework as (
  select id from framework
  union all
  select id from public.competency_frameworks where lower(code) = 'oga-core' and version = '1.0'
  limit 1
)
insert into public.competency_levels (framework_id, level_number, code, name, description, sort_order)
select id, level_number, code, name, description, level_number
from selected_framework
cross join (values
  (1, 'N1', 'Comprendre', 'Comprend les notions et identifie les étapes essentielles.'),
  (2, 'N2', 'Appliquer', 'Réalise une activité avec un cadre, des consignes ou une supervision.'),
  (3, 'N3', 'Maîtriser', 'Réalise l’activité de manière autonome et traite les situations courantes.'),
  (4, 'N4', 'Piloter', 'Conçoit, supervise, améliore et transmet la pratique professionnelle.')
) as levels(level_number, code, name, description)
on conflict (framework_id, level_number) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

comment on table public.assessment_jury_members is
  'Permissions temporaires et limitées à un jury précis. Aucun rôle global Jury n’est attribué.';
comment on table public.learner_competency_records is
  'Registre canonique des compétences évaluées ou validées, utilisé par le CLR et le Skills Passport.';
comment on table public.assessment_grade_appeals is
  'Une demande standard de révision par tentative, avec conservation de la note initiale et de la décision finale.';

commit;
