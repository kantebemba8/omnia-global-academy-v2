-- Programme 1 — Grand module 3
-- Assessment Center : évaluations officielles, sessions, surveillance proportionnée,
-- incidents, accommodements et résultats par compétence.

begin;

create extension if not exists pgcrypto;

create or replace function public.omnia_assessment_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Configuration détaillée de chaque évaluation.
alter table public.course_assessments
  add column if not exists assessment_type text not null default 'quiz',
  add column if not exists delivery_mode text not null default 'asynchronous',
  add column if not exists security_level integer not null default 1,
  add column if not exists session_required boolean not null default false,
  add column if not exists identity_verification_required boolean not null default false,
  add column if not exists proctoring_settings jsonb not null default '{
    "camera_required":false,
    "microphone_required":false,
    "screen_share_required":false,
    "tab_switch_tracking":false,
    "fullscreen_required":false,
    "human_proctor_required":false,
    "recording_required":false
  }'::jsonb,
  add column if not exists result_release_mode text not null default 'after_review',
  add column if not exists competency_labels text[] not null default '{}',
  add column if not exists allowed_materials text not null default '',
  add column if not exists candidate_instructions text not null default '',
  add column if not exists integrity_rules text not null default '',
  add column if not exists assessment_center_enabled boolean not null default true;

alter table public.course_assessments drop constraint if exists course_assessments_assessment_type_check;
alter table public.course_assessments add constraint course_assessments_assessment_type_check
  check (assessment_type in ('quiz','exam','case_study','project','practical','oral','assignment'));

alter table public.course_assessments drop constraint if exists course_assessments_delivery_mode_check;
alter table public.course_assessments add constraint course_assessments_delivery_mode_check
  check (delivery_mode in ('asynchronous','scheduled_online','scheduled_in_person','hybrid'));

alter table public.course_assessments drop constraint if exists course_assessments_security_level_check;
alter table public.course_assessments add constraint course_assessments_security_level_check
  check (security_level between 1 and 4);

alter table public.course_assessments drop constraint if exists course_assessments_result_release_mode_check;
alter table public.course_assessments add constraint course_assessments_result_release_mode_check
  check (result_release_mode in ('immediate','after_review','manual'));

-- Valeurs cohérentes pour les évaluations déjà générées.
update public.course_assessments
set assessment_type = case
      when scope = 'final' then 'exam'
      when correction_mode in ('human','mixed') then 'assignment'
      else 'quiz'
    end,
    result_release_mode = case
      when correction_mode = 'automatic' then 'immediate'
      else 'after_review'
    end
where assessment_type = 'quiz'
  and delivery_mode = 'asynchronous';

-- 2) Sessions programmées.
create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending_approval',
  delivery_mode text not null default 'scheduled_online',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_deadline timestamptz,
  timezone text not null default 'UTC',
  capacity integer,
  location text,
  meeting_url text,
  access_instructions text,
  security_level integer not null default 2,
  proctoring_settings jsonb not null default '{}'::jsonb,
  identity_verification_required boolean not null default false,
  late_entry_minutes integer not null default 15,
  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_sessions_status_check check (status in ('draft','pending_approval','scheduled','open','in_progress','completed','cancelled','suspended')),
  constraint assessment_sessions_delivery_mode_check check (delivery_mode in ('scheduled_online','scheduled_in_person','hybrid')),
  constraint assessment_sessions_security_level_check check (security_level between 1 and 4),
  constraint assessment_sessions_capacity_check check (capacity is null or capacity > 0),
  constraint assessment_sessions_dates_check check (ends_at > starts_at),
  constraint assessment_sessions_late_entry_check check (late_entry_minutes between 0 and 180)
);
create index if not exists assessment_sessions_schedule_idx on public.assessment_sessions(status, starts_at);
create index if not exists assessment_sessions_assessment_idx on public.assessment_sessions(assessment_id, starts_at desc);
create index if not exists assessment_sessions_course_idx on public.assessment_sessions(course_id, starts_at desc);

create table if not exists public.assessment_session_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'registered',
  invited_by uuid references public.users(id) on delete set null,
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  attendance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,user_id),
  constraint assessment_session_candidates_status_check check (status in ('invited','registered','confirmed','started','completed','absent','cancelled'))
);
create index if not exists assessment_session_candidates_user_idx on public.assessment_session_candidates(user_id,status,created_at desc);
create index if not exists assessment_session_candidates_session_idx on public.assessment_session_candidates(session_id,status);

-- 3) Accommodements autorisés pour une session précise.
create table if not exists public.assessment_accommodations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  extra_time_minutes integer not null default 0,
  break_minutes integer not null default 0,
  adjustments jsonb not null default '{}'::jsonb,
  reason text,
  private_note text,
  requested_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,user_id),
  constraint assessment_accommodations_status_check check (status in ('pending','approved','rejected','cancelled')),
  constraint assessment_accommodations_time_check check (extra_time_minutes between 0 and 480 and break_minutes between 0 and 240)
);

-- 4) Traçabilité de la session et incidents.
create table if not exists public.assessment_activity_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  attempt_id uuid references public.assessment_attempts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint assessment_activity_events_severity_check check (severity in ('info','warning','critical'))
);
create index if not exists assessment_activity_events_session_idx on public.assessment_activity_events(session_id,occurred_at desc);
create index if not exists assessment_activity_events_attempt_idx on public.assessment_activity_events(attempt_id,occurred_at desc);
create index if not exists assessment_activity_events_user_idx on public.assessment_activity_events(user_id,occurred_at desc);

create table if not exists public.assessment_incidents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  attempt_id uuid references public.assessment_attempts(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  incident_type text not null default 'technical',
  severity text not null default 'minor',
  status text not null default 'open',
  title text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  reported_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  resolution text,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_incidents_type_check check (incident_type in ('technical','connectivity','identity','integrity','proctoring','accessibility','other')),
  constraint assessment_incidents_severity_check check (severity in ('minor','major','critical')),
  constraint assessment_incidents_status_check check (status in ('open','in_review','resolved','dismissed'))
);
create index if not exists assessment_incidents_status_idx on public.assessment_incidents(status,severity,created_at desc);
create index if not exists assessment_incidents_session_idx on public.assessment_incidents(session_id,created_at desc);

-- 5) Résultats publiés par compétence.
create table if not exists public.assessment_result_competencies (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  competency_name text not null,
  score numeric(6,2),
  status text not null default 'evaluated',
  evidence jsonb not null default '[]'::jsonb,
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id,competency_name),
  constraint assessment_result_competencies_score_check check (score is null or (score >= 0 and score <= 100)),
  constraint assessment_result_competencies_status_check check (status in ('evaluated','validated','not_validated'))
);
create index if not exists assessment_result_competencies_user_idx on public.assessment_result_competencies(user_id,status,created_at desc);
create index if not exists assessment_result_competencies_attempt_idx on public.assessment_result_competencies(attempt_id);

-- 6) État final de la tentative.
alter table public.assessment_attempts
  add column if not exists session_id uuid references public.assessment_sessions(id) on delete set null,
  add column if not exists result_status text not null default 'draft',
  add column if not exists result_published_at timestamptz,
  add column if not exists result_published_by uuid references public.users(id) on delete set null,
  add column if not exists integrity_status text not null default 'not_assessed',
  add column if not exists identity_verified_at timestamptz,
  add column if not exists security_snapshot jsonb not null default '{}'::jsonb;

alter table public.assessment_attempts drop constraint if exists assessment_attempts_result_status_check;
alter table public.assessment_attempts add constraint assessment_attempts_result_status_check
  check (result_status in ('draft','pending_review','published','withheld'));

alter table public.assessment_attempts drop constraint if exists assessment_attempts_integrity_status_check;
alter table public.assessment_attempts add constraint assessment_attempts_integrity_status_check
  check (integrity_status in ('not_assessed','clear','review_required','incident_confirmed'));

create index if not exists assessment_attempts_session_idx on public.assessment_attempts(session_id,user_id,status);
create index if not exists assessment_attempts_result_status_idx on public.assessment_attempts(result_status,graded_at desc);

-- 7) Stockage privé pour les preuves d'incident et de surveillance.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'assessment-evidence','assessment-evidence',false,10485760,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/json']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- 8) Accès uniquement via Edge Functions au rôle service.
alter table public.assessment_sessions enable row level security;
alter table public.assessment_session_candidates enable row level security;
alter table public.assessment_accommodations enable row level security;
alter table public.assessment_activity_events enable row level security;
alter table public.assessment_incidents enable row level security;
alter table public.assessment_result_competencies enable row level security;

revoke all on public.assessment_sessions from anon, authenticated;
revoke all on public.assessment_session_candidates from anon, authenticated;
revoke all on public.assessment_accommodations from anon, authenticated;
revoke all on public.assessment_activity_events from anon, authenticated;
revoke all on public.assessment_incidents from anon, authenticated;
revoke all on public.assessment_result_competencies from anon, authenticated;

-- 9) Triggers updated_at.
do $$
declare t text;
begin
  foreach t in array array[
    'assessment_sessions',
    'assessment_session_candidates',
    'assessment_accommodations',
    'assessment_incidents',
    'assessment_result_competencies'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t||'_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.omnia_assessment_set_updated_at()', t||'_set_updated_at', t);
  end loop;
end $$;

commit;
