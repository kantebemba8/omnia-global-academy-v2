-- Programme 1 — Grand module 2
-- Centre Qualité unifié : formations, évaluations, audits, non-conformités et actions correctives.

begin;

create or replace function public.omnia_quality_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table if exists public.courses
  add column if not exists quality_review_status text not null default 'not_submitted',
  add column if not exists quality_review_id uuid,
  add column if not exists quality_last_reviewed_at timestamptz,
  add column if not exists quality_next_review_at timestamptz,
  add column if not exists quality_cpd_status text not null default 'not_assessed',
  add column if not exists quality_suspended_at timestamptz,
  add column if not exists quality_suspension_reason text;

alter table if exists public.course_assessments
  add column if not exists quality_review_status text not null default 'not_submitted',
  add column if not exists quality_review_id uuid,
  add column if not exists quality_approved_at timestamptz,
  add column if not exists quality_approved_by uuid references public.users(id) on delete set null;

create table if not exists public.quality_criteria (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category text not null default 'pedagogie',
  entity_type text not null default 'course',
  response_type text not null default 'status',
  weight numeric(6,2) not null default 1,
  is_required boolean not null default true,
  cpd_relevant boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_criteria_entity_type_check check (entity_type in ('course','assessment','both')),
  constraint quality_criteria_response_type_check check (response_type in ('status','score','text')),
  constraint quality_criteria_category_check check (category in ('pedagogie','contenu','evaluation','accessibilite','conformite','cpd','commercial','technique'))
);

create table if not exists public.quality_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'course',
  course_id uuid references public.courses(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  review_type text not null default 'initial',
  status text not null default 'submitted',
  submitted_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  started_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  decision text,
  decision_summary text,
  overall_score numeric(6,2),
  cpd_status text not null default 'not_assessed',
  cpd_notes text,
  accelerated boolean not null default false,
  version_label text,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_reviews_entity_type_check check (entity_type in ('course','assessment')),
  constraint quality_reviews_review_type_check check (review_type in ('initial','periodic','update','complaint','fast_track')),
  constraint quality_reviews_status_check check (status in ('draft','submitted','in_review','changes_requested','approved','rejected','suspended','archived')),
  constraint quality_reviews_decision_check check (decision is null or decision in ('approved','changes_requested','rejected','suspended','restored')),
  constraint quality_reviews_cpd_status_check check (cpd_status in ('not_assessed','not_applicable','pending','compliant','partially_compliant','non_compliant')),
  constraint quality_reviews_entity_reference_check check (
    (entity_type='course' and course_id is not null and assessment_id is null)
    or (entity_type='assessment' and assessment_id is not null)
  )
);

create unique index if not exists quality_reviews_open_course_unique
  on public.quality_reviews(course_id)
  where entity_type='course' and status in ('draft','submitted','in_review','changes_requested');
create unique index if not exists quality_reviews_open_assessment_unique
  on public.quality_reviews(assessment_id)
  where entity_type='assessment' and status in ('draft','submitted','in_review','changes_requested');
create index if not exists quality_reviews_queue_idx on public.quality_reviews(status, created_at);
create index if not exists quality_reviews_course_idx on public.quality_reviews(course_id, created_at desc);
create index if not exists quality_reviews_assessment_idx on public.quality_reviews(assessment_id, created_at desc);

create table if not exists public.quality_review_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.quality_reviews(id) on delete cascade,
  criterion_id uuid not null references public.quality_criteria(id) on delete restrict,
  status text not null default 'not_reviewed',
  score numeric(6,2),
  comment text,
  required_action text,
  evidence jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(review_id, criterion_id),
  constraint quality_review_items_status_check check (status in ('not_reviewed','conform','partial','non_conform','not_applicable'))
);
create index if not exists quality_review_items_review_idx on public.quality_review_items(review_id, created_at);

create table if not exists public.quality_change_requests (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.quality_reviews(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  criterion_id uuid references public.quality_criteria(id) on delete set null,
  title text not null,
  description text not null,
  severity text not null default 'major',
  status text not null default 'open',
  requested_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  due_at timestamptz,
  creator_response text,
  response_evidence jsonb not null default '[]'::jsonb,
  responded_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_change_requests_severity_check check (severity in ('minor','major','critical')),
  constraint quality_change_requests_status_check check (status in ('open','responded','accepted','rejected','resolved','cancelled'))
);
create index if not exists quality_change_requests_review_idx on public.quality_change_requests(review_id, status, created_at);
create index if not exists quality_change_requests_course_idx on public.quality_change_requests(course_id, status);

create table if not exists public.quality_audits (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  review_id uuid references public.quality_reviews(id) on delete set null,
  audit_type text not null default 'periodic',
  status text not null default 'planned',
  title text not null,
  scope text,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  auditor_id uuid references public.users(id) on delete set null,
  summary text,
  score numeric(6,2),
  next_audit_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_audits_type_check check (audit_type in ('periodic','complaint','cpd','version','security','targeted')),
  constraint quality_audits_status_check check (status in ('planned','in_progress','actions_required','completed','cancelled'))
);
create index if not exists quality_audits_schedule_idx on public.quality_audits(status, scheduled_for);
create index if not exists quality_audits_course_idx on public.quality_audits(course_id, created_at desc);

create table if not exists public.quality_nonconformities (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.quality_reviews(id) on delete cascade,
  audit_id uuid references public.quality_audits(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  severity text not null default 'major',
  status text not null default 'open',
  detected_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  due_at timestamptz,
  root_cause text,
  corrective_action text,
  corrective_evidence jsonb not null default '[]'::jsonb,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  closed_by uuid references public.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_nonconformities_severity_check check (severity in ('minor','major','critical')),
  constraint quality_nonconformities_status_check check (status in ('open','corrective_action_submitted','verification','closed','waived'))
);
create index if not exists quality_nonconformities_status_idx on public.quality_nonconformities(status, severity, due_at);
create index if not exists quality_nonconformities_course_idx on public.quality_nonconformities(course_id, created_at desc);

create table if not exists public.quality_review_history (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.quality_reviews(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assessment_id uuid references public.course_assessments(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quality_review_history_review_idx on public.quality_review_history(review_id, created_at desc);
create index if not exists quality_review_history_course_idx on public.quality_review_history(course_id, created_at desc);

create table if not exists public.quality_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.quality_settings(key,value,description)
values
 ('default_review_deadline_days','{"value":7}'::jsonb,'Délai standard de revue qualité.'),
 ('default_periodic_review_months','{"value":12}'::jsonb,'Périodicité standard des audits.'),
 ('super_admin_fast_track','{"enabled":true,"requires_summary":true,"minimum_score":80}'::jsonb,'Procédure accélérée et tracée pour les formations Omnia.'),
 ('cpd_enabled','{"enabled":true}'::jsonb,'Active le contrôle CPD dans le Centre Qualité.')
on conflict (key) do nothing;

insert into public.quality_criteria(code,name,description,category,entity_type,response_type,weight,is_required,cpd_relevant,sort_order)
values
 ('COURSE_OBJECTIVES','Objectifs pédagogiques','Objectifs clairs, mesurables et cohérents avec le niveau annoncé.','pedagogie','course','status',2,true,true,10),
 ('COURSE_STRUCTURE','Structure du parcours','Modules, leçons, introduction, conclusion et progression cohérente.','pedagogie','course','status',2,true,true,20),
 ('COURSE_CONTENT_ACCURACY','Exactitude du contenu','Contenu fiable, actuel, sourcé lorsque nécessaire et sans affirmation trompeuse.','contenu','course','status',3,true,true,30),
 ('COURSE_ASSESSMENT_ALIGNMENT','Alignement des évaluations','Les évaluations mesurent les objectifs et compétences annoncés.','evaluation','course','status',3,true,true,40),
 ('COURSE_ATTEMPT_POLICY','Tentatives et remédiation','Seuils, délais et remédiations sont configurés et proportionnés.','evaluation','course','status',2,true,false,50),
 ('COURSE_ACCESSIBILITY','Accessibilité','Contenus lisibles, alternatives prévues et médias utilisables dans différents contextes.','accessibilite','course','status',1,true,true,60),
 ('COURSE_CPD_EVIDENCE','Preuves CPD','Objectifs, durée, méthodes, évaluations et amélioration continue sont documentés.','cpd','course','status',2,false,true,70),
 ('COURSE_COMMERCIAL_CLARITY','Clarté commerciale','Prix, durée, prérequis et conditions d’obtention sont cohérents.','commercial','course','status',1,true,false,80),
 ('COURSE_TECHNICAL_READINESS','Préparation technique','Ressources, fichiers, liens et médias sont accessibles et correctement configurés.','technique','course','status',1,true,false,90),
 ('ASSESSMENT_COMPETENCY_ALIGNMENT','Compétences évaluées','Les critères et questions correspondent aux compétences annoncées.','evaluation','assessment','status',3,true,true,110),
 ('ASSESSMENT_SCORING','Barème et seuil','Le barème, la note minimale et les réponses attendues sont cohérents.','evaluation','assessment','status',3,true,true,120),
 ('ASSESSMENT_SECURITY','Surveillance proportionnée','Les mesures de surveillance sont adaptées au type et à l’enjeu de l’évaluation.','conformite','assessment','status',2,true,false,130),
 ('ASSESSMENT_FAIRNESS','Équité et accessibilité','La durée, les consignes et les accommodements sont équitables.','accessibilite','assessment','status',2,true,true,140),
 ('ASSESSMENT_REMEDIATION','Remédiation','Les règles de nouvelle tentative et de remédiation sont définies.','evaluation','assessment','status',2,true,false,150)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  entity_type=excluded.entity_type,
  response_type=excluded.response_type,
  weight=excluded.weight,
  is_required=excluded.is_required,
  cpd_relevant=excluded.cpd_relevant,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

-- Relations ajoutées après création des tables pour conserver la compatibilité avec les installations partielles.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='courses_quality_review_id_fkey') then
    alter table public.courses add constraint courses_quality_review_id_fkey foreign key (quality_review_id) references public.quality_reviews(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='course_assessments_quality_review_id_fkey') then
    alter table public.course_assessments add constraint course_assessments_quality_review_id_fkey foreign key (quality_review_id) references public.quality_reviews(id) on delete set null;
  end if;
end $$;

create index if not exists courses_quality_review_status_idx on public.courses(quality_review_status, updated_at desc);
create index if not exists courses_quality_next_review_idx on public.courses(quality_next_review_at) where quality_next_review_at is not null;
create index if not exists course_assessments_quality_review_status_idx on public.course_assessments(quality_review_status, updated_at desc);

-- Bucket privé des preuves qualité.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('quality-evidence','quality-evidence',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Le Centre Qualité passe exclusivement par les Edge Functions au rôle service.
alter table public.quality_criteria enable row level security;
alter table public.quality_reviews enable row level security;
alter table public.quality_review_items enable row level security;
alter table public.quality_change_requests enable row level security;
alter table public.quality_audits enable row level security;
alter table public.quality_nonconformities enable row level security;
alter table public.quality_review_history enable row level security;
alter table public.quality_settings enable row level security;

revoke all on public.quality_criteria from anon, authenticated;
revoke all on public.quality_reviews from anon, authenticated;
revoke all on public.quality_review_items from anon, authenticated;
revoke all on public.quality_change_requests from anon, authenticated;
revoke all on public.quality_audits from anon, authenticated;
revoke all on public.quality_nonconformities from anon, authenticated;
revoke all on public.quality_review_history from anon, authenticated;
revoke all on public.quality_settings from anon, authenticated;

-- Triggers updated_at.
do $$
declare t text;
begin
  foreach t in array array['quality_criteria','quality_reviews','quality_review_items','quality_change_requests','quality_audits','quality_nonconformities'] loop
    execute format('drop trigger if exists %I on public.%I', t||'_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.omnia_quality_set_updated_at()', t||'_set_updated_at', t);
  end loop;
end $$;

commit;
