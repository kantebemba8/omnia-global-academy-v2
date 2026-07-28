-- Programme 2 / GM1 — Omnia Projects
-- Fondation fonctionnelle : projets, candidatures, équipes, jalons, livrables,
-- confidentialité, propriété intellectuelle, récompenses, litiges et audit.

create extension if not exists pgcrypto;

create or replace function public.omnia_projects_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.omnia_projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  short_description text,
  description text not null,
  problem_statement text,
  objectives text,
  project_type text not null default 'real_project' check (project_type in (
    'real_project','challenge','case_study','short_mission','academic_project',
    'structure_internal','call_for_solutions','hackathon','volunteer_mission','rewarded_project'
  )),
  creator_user_id uuid not null references public.users(id) on delete restrict,
  organization_id uuid,
  organization_name text,
  organization_type text,
  country_code text,
  city text,
  geographic_scope text[] not null default '{}',
  languages text[] not null default array['fr']::text[],
  visibility text not null default 'authenticated' check (visibility in ('public','authenticated','structure','cohort','invitation')),
  visibility_structure_id uuid,
  visibility_cohort_id uuid,
  required_skills text[] not null default '{}',
  prerequisite_course_ids uuid[] not null default '{}',
  prerequisite_credential_ids uuid[] not null default '{}',
  level text not null default 'all' check (level in ('beginner','intermediate','advanced','expert','all')),
  participation_mode text not null default 'individual_or_team' check (participation_mode in ('individual','team','individual_or_team')),
  team_creation_mode text not null default 'candidate_or_owner' check (team_creation_mode in ('candidate','owner','candidate_or_owner')),
  selection_mode text not null default 'manual' check (selection_mode in ('manual','automatic','mixed')),
  min_participants integer not null default 1 check (min_participants >= 1),
  max_participants integer check (max_participants is null or max_participants >= min_participants),
  min_team_size integer not null default 1 check (min_team_size >= 1),
  max_team_size integer check (max_team_size is null or max_team_size >= min_team_size),
  estimated_hours integer check (estimated_hours is null or estimated_hours >= 0),
  application_opens_at timestamptz,
  application_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  deliverables_summary text,
  supervisors jsonb not null default '[]'::jsonb,
  confidentiality_level text not null default 'standard' check (confidentiality_level in ('public','standard','confidential','strictly_confidential')),
  nda_required boolean not null default false,
  portfolio_policy text not null default 'validated_summary' check (portfolio_policy in ('forbidden','anonymized_only','validated_summary','authorized_deliverable')),
  ip_policy text not null default 'participant_owned' check (ip_policy in ('participant_owned','partner_license','joint_ownership','separate_assignment_agreement')),
  ip_policy_details text,
  public_deliverables_allowed boolean not null default false,
  reward_type text not null default 'none' check (reward_type in ('none','participation_certificate','badge','recommendation','omnia_credit','financial_prize','partner_interview','internship_opportunity','job_opportunity','training_access','portfolio_publication','multiple')),
  reward_details jsonb not null default '{}'::jsonb,
  reward_funding_status text not null default 'not_applicable' check (reward_funding_status in ('not_applicable','unverified','proof_submitted','verified','blocked')),
  recruitment_opportunity boolean not null default false,
  recruitment_disclaimer text not null default 'Toute opportunité dépend du processus de sélection du partenaire. Aucun recrutement n’est garanti.',
  status text not null default 'draft' check (status in ('draft','pending_validation','changes_requested','published','selection','in_progress','suspended','closed','archived','rejected')),
  admin_feedback text,
  submitted_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  cover_url text,
  attachments jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists omnia_projects_status_idx on public.omnia_projects(status, published_at desc);
create index if not exists omnia_projects_creator_idx on public.omnia_projects(creator_user_id, created_at desc);
create index if not exists omnia_projects_org_idx on public.omnia_projects(organization_id, created_at desc);
create index if not exists omnia_projects_type_idx on public.omnia_projects(project_type, status);
create index if not exists omnia_projects_dates_idx on public.omnia_projects(application_closes_at, starts_at, ends_at);
create index if not exists omnia_projects_skills_gin on public.omnia_projects using gin(required_skills);

create table if not exists public.omnia_project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  title text not null,
  description text,
  sequence_no integer not null default 1,
  due_at timestamptz,
  deliverable_required boolean not null default true,
  accepted_file_types text[] not null default '{}',
  max_file_size_mb integer not null default 25 check (max_file_size_mb between 1 and 500),
  status text not null default 'planned' check (status in ('planned','open','completed','cancelled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, sequence_no)
);
create index if not exists omnia_project_milestones_project_idx on public.omnia_project_milestones(project_id, sequence_no);

create table if not exists public.omnia_project_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  application_mode text not null default 'individual' check (application_mode in ('individual','team')),
  team_id uuid,
  motivation text,
  proposed_approach text,
  availability text,
  portfolio_links jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  consent_confirmed boolean not null default false,
  status text not null default 'submitted' check (status in ('draft','submitted','under_review','waitlisted','selected','rejected','withdrawn','cancelled')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, applicant_user_id)
);
create index if not exists omnia_project_applications_project_idx on public.omnia_project_applications(project_id, status, submitted_at desc);
create index if not exists omnia_project_applications_user_idx on public.omnia_project_applications(applicant_user_id, submitted_at desc);
create unique index if not exists omnia_project_applications_team_unique on public.omnia_project_applications(project_id, team_id) where team_id is not null;

create table if not exists public.omnia_project_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  name text not null,
  description text,
  leader_user_id uuid not null references public.users(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  status text not null default 'forming' check (status in ('forming','submitted','selected','active','completed','disbanded')),
  max_members integer check (max_members is null or max_members >= 1),
  invitation_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists omnia_project_teams_project_idx on public.omnia_project_teams(project_id, status);
create index if not exists omnia_project_teams_leader_idx on public.omnia_project_teams(leader_user_id, created_at desc);

alter table public.omnia_project_applications
  drop constraint if exists omnia_project_applications_team_id_fkey;
alter table public.omnia_project_applications
  add constraint omnia_project_applications_team_id_fkey foreign key (team_id) references public.omnia_project_teams(id) on delete set null;

create table if not exists public.omnia_project_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.omnia_project_teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('leader','member','mentor','observer')),
  invitation_status text not null default 'pending' check (invitation_status in ('pending','accepted','declined','removed','left')),
  invited_by uuid references public.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  consent_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, user_id)
);
create index if not exists omnia_project_team_members_user_idx on public.omnia_project_team_members(user_id, invitation_status);

-- Invitations directes : nécessaires pour les projets privés ou sur invitation.
-- L'utilisateur doit accepter explicitement avant d'obtenir l'accès au projet.
create table if not exists public.omnia_project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  team_id uuid references public.omnia_project_teams(id) on delete set null,
  invited_user_id uuid not null references public.users(id) on delete cascade,
  invited_email text,
  invitation_role text not null default 'participant' check (invitation_role in ('participant','team_leader','mentor','observer')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  message text,
  invited_by uuid not null references public.users(id) on delete restrict,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  consent_recorded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, invited_user_id, invitation_role)
);
create index if not exists omnia_project_invitations_user_idx on public.omnia_project_invitations(invited_user_id, status, invited_at desc);
create index if not exists omnia_project_invitations_project_idx on public.omnia_project_invitations(project_id, status, invited_at desc);

create table if not exists public.omnia_project_agreements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.omnia_project_teams(id) on delete set null,
  agreement_type text not null check (agreement_type in ('confidentiality','nda','ip_acknowledgement','publication_consent','custom')),
  agreement_version text not null default '1.0',
  agreement_text_hash text,
  accepted boolean not null default false,
  accepted_at timestamptz,
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id, agreement_type, agreement_version)
);
create index if not exists omnia_project_agreements_project_user_idx on public.omnia_project_agreements(project_id, user_id);

create table if not exists public.omnia_project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  milestone_id uuid references public.omnia_project_milestones(id) on delete set null,
  team_id uuid references public.omnia_project_teams(id) on delete set null,
  submitted_by uuid not null references public.users(id) on delete restrict,
  title text not null,
  description text,
  file_path text,
  external_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  version_no integer not null default 1,
  confidentiality_level text not null default 'project' check (confidentiality_level in ('public','project','owner_only','strictly_confidential')),
  portfolio_visibility text not null default 'not_allowed' check (portfolio_visibility in ('not_allowed','anonymized','summary','full_after_approval')),
  status text not null default 'submitted' check (status in ('draft','submitted','changes_requested','accepted','rejected','withdrawn')),
  evaluation_score numeric(5,2),
  evaluation_feedback text,
  evaluated_by uuid references public.users(id) on delete set null,
  evaluated_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists omnia_project_deliverables_project_idx on public.omnia_project_deliverables(project_id, submitted_at desc);
create index if not exists omnia_project_deliverables_team_idx on public.omnia_project_deliverables(team_id, submitted_at desc);

create table if not exists public.omnia_project_rewards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete set null,
  recipient_team_id uuid references public.omnia_project_teams(id) on delete set null,
  reward_type text not null,
  title text not null,
  description text,
  amount_minor bigint,
  currency text,
  funding_proof_path text,
  funding_status text not null default 'unverified' check (funding_status in ('unverified','proof_submitted','verified','blocked','paid','cancelled')),
  validation_status text not null default 'pending' check (validation_status in ('pending','approved','rejected','delivered','cancelled')),
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists omnia_project_rewards_project_idx on public.omnia_project_rewards(project_id, validation_status);

create table if not exists public.omnia_project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  reporter_user_id uuid not null references public.users(id) on delete restrict,
  report_type text not null check (report_type in ('misleading_information','unfunded_reward','confidentiality','intellectual_property','abuse','discrimination','technical','other')),
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','under_review','resolved','dismissed','escalated')),
  assigned_to uuid references public.users(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists omnia_project_reports_status_idx on public.omnia_project_reports(status, created_at desc);

create table if not exists public.omnia_project_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.omnia_projects(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null default 'project',
  entity_id uuid,
  previous_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists omnia_project_audit_project_idx on public.omnia_project_audit_log(project_id, created_at desc);
create index if not exists omnia_project_audit_actor_idx on public.omnia_project_audit_log(actor_user_id, created_at desc);

-- Préparation du GM2 : les preuves restent privées et ne deviennent publiables qu'après validation explicite.
create table if not exists public.omnia_project_verified_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.omnia_projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.omnia_project_teams(id) on delete set null,
  deliverable_id uuid references public.omnia_project_deliverables(id) on delete set null,
  evidence_type text not null default 'project_experience' check (evidence_type in ('project_experience','verified_deliverable','recommendation','demonstrated_skill')),
  title text not null,
  summary text,
  skill_codes text[] not null default '{}',
  validation_status text not null default 'pending' check (validation_status in ('pending','validated','rejected','revoked')),
  portfolio_permission text not null default 'private' check (portfolio_permission in ('private','anonymized','recruiters','public')),
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  exported_to_clr_at timestamptz,
  exported_to_skills_passport_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deliverable_id, user_id, evidence_type)
);
create index if not exists omnia_project_evidence_user_idx on public.omnia_project_verified_evidence(user_id, validation_status, created_at desc);

-- RLS défensif : l'application passe par l'Edge Function avec service_role.
do $$
declare t text;
begin
  foreach t in array array[
    'omnia_projects','omnia_project_milestones','omnia_project_applications','omnia_project_teams',
    'omnia_project_team_members','omnia_project_invitations','omnia_project_agreements','omnia_project_deliverables',
    'omnia_project_rewards','omnia_project_reports','omnia_project_audit_log','omnia_project_verified_evidence'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    if t <> 'omnia_project_audit_log' then
      execute format('create trigger %I before update on public.%I for each row execute function public.omnia_projects_set_updated_at()', t || '_set_updated_at', t);
    end if;
  end loop;
end $$;

-- Stockage privé des pièces et livrables. Les liens doivent être signés par l'Edge Function.
insert into storage.buckets (id, name, public, file_size_limit)
values ('omnia-projects', 'omnia-projects', false, 524288000)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
