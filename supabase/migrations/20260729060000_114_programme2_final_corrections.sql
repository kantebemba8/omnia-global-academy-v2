-- Programme 2 — Correction finale GM1 à GM5
-- Migration additive : conserve les données existantes et ne rejoue pas les migrations 108 à 113.

create extension if not exists pgcrypto;

-- ==========================================================================
-- GM1 — Autorisation explicite des professeurs et partenaires multiples
-- ==========================================================================
create table if not exists public.omnia_project_creator_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'allowed' check (status in ('allowed','suspended','revoked')),
  allowed_project_types text[] not null default array[
    'real_project','challenge','case_study','short_mission','academic_project',
    'structure_internal','call_for_solutions','hackathon','volunteer_mission','rewarded_project'
  ]::text[],
  organization_scope_id uuid,
  notes text,
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.omnia_project_partners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  partner_kind text not null default 'external' check (partner_kind in ('structure','recognition_partner','external')),
  organization_id uuid,
  recognition_partner_id uuid references public.recognition_partners(id) on delete set null,
  partner_name text not null,
  partner_role text not null default 'participant' check (partner_role in (
    'owner','co_owner','client','sponsor','technical','academic','institutional','mentor','evaluator','participant'
  )),
  status text not null default 'proposed' check (status in ('proposed','confirmed','declined','withdrawn')),
  logo_usage_allowed boolean not null default false,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  confirmed_by uuid references public.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint omnia_project_partners_identity_check check (
    organization_id is not null or recognition_partner_id is not null or btrim(partner_name) <> ''
  )
);

create index if not exists omnia_project_creator_permissions_status_idx
  on public.omnia_project_creator_permissions(status,user_id);
create index if not exists omnia_project_partners_project_idx
  on public.omnia_project_partners(project_id,status,partner_role);
create unique index if not exists omnia_project_partners_unique_org_idx
  on public.omnia_project_partners(project_id,organization_id,partner_role)
  where organization_id is not null and status <> 'withdrawn';
create unique index if not exists omnia_project_partners_unique_recognition_idx
  on public.omnia_project_partners(project_id,recognition_partner_id,partner_role)
  where recognition_partner_id is not null and status <> 'withdrawn';

alter table public.omnia_project_creator_permissions enable row level security;
alter table public.omnia_project_partners enable row level security;

-- Les professeurs ayant déjà créé des projets conservent leur accès.
insert into public.omnia_project_creator_permissions(user_id,status,notes)
select distinct p.creator_user_id,'allowed','Autorisation conservée lors de la correction finale du Programme 2.'
from public.omnia_projects p
where exists (
  select 1 from public.user_roles r
  where r.user_id=p.creator_user_id
    and lower(r.role) in ('professor','professeur','teacher','instructor')
)
on conflict (user_id) do nothing;

-- ==========================================================================
-- GM2 — Traçabilité des preuves et accès recruteur contrôlé
-- ==========================================================================
alter table public.omnia_project_verified_evidence
  add column if not exists source_reference text;
create unique index if not exists omnia_project_verified_evidence_source_reference_uidx
  on public.omnia_project_verified_evidence(user_id,source_reference)
  where source_reference is not null;

-- ==========================================================================
-- GM3 — Open CPD comme partenaire possible, sans simuler une accréditation
-- ==========================================================================
insert into public.recognition_partners(
  name,slug,partner_type,description,status,publication_status,validation_process,metadata
)
select
  'Open CPD','open-cpd','cpd',
  'Organisme CPD préenregistré comme partenaire possible. Toute convention, reconnaissance ou autorisation de logo doit être vérifiée et validée par le Super Admin avant activation.',
  'preparation','private',
  'Vérification documentaire, convention et validation Super Admin obligatoires.',
  jsonb_build_object(
    'seeded_by','programme2_final_correction',
    'placeholder_only',true,
    'no_accreditation_claim',true
  )
where not exists(select 1 from public.recognition_partners where slug='open-cpd');

-- ==========================================================================
-- GM4 — Prérequis, relevés professionnels et credentials de parcours
-- ==========================================================================
create table if not exists public.professional_pathway_prerequisites (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.professional_pathways(id) on delete cascade,
  prerequisite_type text not null check (prerequisite_type in ('course','pathway','badge','skill','manual')),
  course_id uuid references public.courses(id) on delete set null,
  required_pathway_id uuid references public.professional_pathways(id) on delete set null,
  badge_template_id uuid references public.badge_templates(id) on delete set null,
  skill_code text,
  title text not null,
  required boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_pathway_prerequisite_target_check check (
    (prerequisite_type='course' and course_id is not null)
    or (prerequisite_type='pathway' and required_pathway_id is not null)
    or (prerequisite_type='badge' and badge_template_id is not null)
    or (prerequisite_type='skill' and nullif(btrim(skill_code),'') is not null)
    or prerequisite_type='manual'
  )
);

create table if not exists public.professional_pathway_prerequisite_validations (
  id uuid primary key default gen_random_uuid(),
  prerequisite_id uuid not null references public.professional_pathway_prerequisites(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','expired')),
  evidence jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(prerequisite_id,user_id)
);

create table if not exists public.professional_pathway_credentials (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.professional_pathway_enrollments(id) on delete cascade,
  pathway_id uuid not null references public.professional_pathways(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  credential_type text not null check (credential_type in ('certificate','professional_record')),
  credential_uuid uuid not null default gen_random_uuid(),
  verification_code text not null default ('OGA-PATH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,14))),
  title text not null,
  status text not null default 'issued' check (status in ('issued','expired','revoked','suspended')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revocation_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id,credential_type),
  unique(credential_uuid),
  unique(verification_code)
);

create table if not exists public.professional_pathway_transcripts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.professional_pathway_enrollments(id) on delete cascade,
  pathway_id uuid not null references public.professional_pathways(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'issued' check (status in ('draft','issued','updated','revoked')),
  transcript_json jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.professional_pathway_enrollments
  add column if not exists completion_checked_at timestamptz,
  add column if not exists credential_id uuid,
  add column if not exists transcript_id uuid;

create index if not exists professional_pathway_prerequisites_pathway_idx
  on public.professional_pathway_prerequisites(pathway_id,prerequisite_type);
create index if not exists professional_pathway_prerequisite_validations_status_idx
  on public.professional_pathway_prerequisite_validations(status,submitted_at desc);
create index if not exists professional_pathway_credentials_user_idx
  on public.professional_pathway_credentials(user_id,status,issued_at desc);
create index if not exists professional_pathway_transcripts_user_idx
  on public.professional_pathway_transcripts(user_id,updated_at desc);
create unique index if not exists professional_pathway_renewals_open_uidx
  on public.professional_pathway_renewals(enrollment_id)
  where status in ('due','in_progress','submitted');

alter table public.professional_pathway_prerequisites enable row level security;
alter table public.professional_pathway_prerequisite_validations enable row level security;
alter table public.professional_pathway_credentials enable row level security;
alter table public.professional_pathway_transcripts enable row level security;

-- Contraintes absentes de la migration 111. NOT VALID évite qu'une ancienne
-- donnée incohérente ne bloque la correction complète.
do $$
begin
  if not exists(select 1 from pg_constraint where conname='professional_pathway_enrollments_user_id_fkey') then
    alter table public.professional_pathway_enrollments
      add constraint professional_pathway_enrollments_user_id_fkey
      foreign key(user_id) references public.users(id) on delete cascade not valid;
  end if;
  if to_regclass('public.course_assessments') is not null
     and not exists(select 1 from pg_constraint where conname='professional_pathway_steps_assessment_id_fkey') then
    alter table public.professional_pathway_steps
      add constraint professional_pathway_steps_assessment_id_fkey
      foreign key(assessment_id) references public.course_assessments(id) on delete set null not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='professional_pathway_enrollments_credential_id_fkey') then
    alter table public.professional_pathway_enrollments
      add constraint professional_pathway_enrollments_credential_id_fkey
      foreign key(credential_id) references public.professional_pathway_credentials(id) on delete set null not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='professional_pathway_enrollments_transcript_id_fkey') then
    alter table public.professional_pathway_enrollments
      add constraint professional_pathway_enrollments_transcript_id_fkey
      foreign key(transcript_id) references public.professional_pathway_transcripts(id) on delete set null not valid;
  end if;
end $$;

-- Liaison facultative aux Structures historiques uniquement si leur table existe.
do $$
begin
  if to_regclass('public.partner_organizations') is not null then
    if not exists(select 1 from pg_constraint where conname='omnia_project_creator_permissions_organization_scope_id_fkey') then
      alter table public.omnia_project_creator_permissions
        add constraint omnia_project_creator_permissions_organization_scope_id_fkey
        foreign key(organization_scope_id) references public.partner_organizations(id) on delete set null not valid;
    end if;
    if not exists(select 1 from pg_constraint where conname='omnia_project_partners_organization_id_fkey') then
      alter table public.omnia_project_partners
        add constraint omnia_project_partners_organization_id_fkey
        foreign key(organization_id) references public.partner_organizations(id) on delete set null not valid;
    end if;
  end if;
end $$;

-- ==========================================================================
-- GM5 — Identité Omnia, demandes de contact et consentement complet
-- ==========================================================================
do $$
declare c record;
begin
  for c in
    select conname,conrelid::regclass as table_name
    from pg_constraint
    where contype='f' and conname in (
      'employability_profiles_user_id_fkey',
      'employability_opportunity_matches_user_id_fkey',
      'employability_recruiter_access_log_recruiter_user_id_fkey',
      'employability_recruiter_access_log_talent_user_id_fkey',
      'employability_audit_log_actor_user_id_fkey',
      'employability_audit_log_subject_user_id_fkey'
    )
  loop
    execute format('alter table %s drop constraint %I',c.table_name,c.conname);
  end loop;
end $$;

alter table public.employability_profiles
  add constraint employability_profiles_user_id_fkey
  foreign key(user_id) references public.users(id) on delete cascade not valid;
alter table public.employability_opportunity_matches
  add constraint employability_opportunity_matches_user_id_fkey
  foreign key(user_id) references public.users(id) on delete cascade not valid;
alter table public.employability_recruiter_access_log
  add constraint employability_recruiter_access_log_recruiter_user_id_fkey
  foreign key(recruiter_user_id) references public.users(id) on delete cascade not valid;
alter table public.employability_recruiter_access_log
  add constraint employability_recruiter_access_log_talent_user_id_fkey
  foreign key(talent_user_id) references public.users(id) on delete cascade not valid;
alter table public.employability_audit_log
  add constraint employability_audit_log_actor_user_id_fkey
  foreign key(actor_user_id) references public.users(id) on delete set null not valid;
alter table public.employability_audit_log
  add constraint employability_audit_log_subject_user_id_fkey
  foreign key(subject_user_id) references public.users(id) on delete set null not valid;

alter table public.employability_profiles
  add column if not exists last_matched_at timestamptz,
  add column if not exists consent_withdrawn_at timestamptz;

create table if not exists public.employability_contact_requests (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references public.users(id) on delete cascade,
  talent_user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid references public.job_offers(id) on delete set null,
  subject text,
  message text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','closed')),
  talent_response text,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employability_contact_requests_talent_idx
  on public.employability_contact_requests(talent_user_id,status,requested_at desc);
create index if not exists employability_contact_requests_recruiter_idx
  on public.employability_contact_requests(recruiter_user_id,status,requested_at desc);

-- Préserve la demande en attente la plus récente avant d'ajouter l'unicité.
with ranked as (
  select id,row_number() over(
    partition by recruiter_user_id,talent_user_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid)
    order by requested_at desc,id desc
  ) as rn
  from public.employability_contact_requests
  where status='pending'
)
update public.employability_contact_requests r
set status='cancelled',updated_at=now()
from ranked x where r.id=x.id and x.rn>1;

create unique index if not exists employability_contact_requests_pending_uidx
  on public.employability_contact_requests(
    recruiter_user_id,talent_user_id,coalesce(job_id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) where status='pending';

alter table public.employability_contact_requests enable row level security;

-- Les accès métier passent par les Edge Functions en service_role et user_sessions.
drop policy if exists "users manage own employability profile" on public.employability_profiles;
drop policy if exists "users read own opportunity matches" on public.employability_opportunity_matches;
drop policy if exists "users update own opportunity matches" on public.employability_opportunity_matches;

-- ==========================================================================
-- Triggers updated_at
-- ==========================================================================
create or replace function public.programme2_final_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'omnia_project_creator_permissions','omnia_project_partners',
    'professional_pathway_prerequisites','professional_pathway_prerequisite_validations',
    'professional_pathway_credentials','employability_contact_requests'
  ] loop
    execute format('drop trigger if exists %I on public.%I','trg_'||t||'_updated_at',t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.programme2_final_set_updated_at()',
      'trg_'||t||'_updated_at',t
    );
  end loop;
end $$;

comment on table public.omnia_project_creator_permissions is
  'Autorisation explicite accordée aux professeurs pour créer des projets Omnia.';
comment on table public.omnia_project_partners is
  'Entreprises, Structures et institutions participant à un projet au-delà du seul porteur principal.';
comment on table public.professional_pathway_credentials is
  'Certificats de parcours et relevés professionnels vérifiables, distincts des certificats de cours.';
comment on table public.employability_contact_requests is
  'Demandes de contact contrôlées entre recruteurs autorisés et talents consentants.';
