-- Étape 2 : évaluations obligatoires, tentatives, correction et progression
create extension if not exists pgcrypto;

create table if not exists public.course_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete cascade,
  lesson_id uuid references public.course_lessons(id) on delete cascade,
  scope text not null check (scope in ('lesson','module','final')),
  title text not null,
  instructions text default '',
  passing_score integer not null,
  max_attempts integer not null default 3,
  time_limit_minutes integer,
  weight_percent numeric(6,2) not null default 0,
  required boolean not null default true,
  randomize_questions boolean not null default false,
  correction_mode text not null default 'automatic' check (correction_mode in ('automatic','ai','human','mixed')),
  estimated_minutes integer not null default 10,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_scope_target check (
    (scope='lesson' and lesson_id is not null) or
    (scope='module' and module_id is not null and lesson_id is null) or
    (scope='final' and module_id is null and lesson_id is null)
  )
);
create unique index if not exists ux_assessment_lesson on public.course_assessments(lesson_id) where scope='lesson';
create unique index if not exists ux_assessment_module on public.course_assessments(module_id) where scope='module';
create unique index if not exists ux_assessment_final on public.course_assessments(course_id) where scope='final';

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  question_type text not null check (question_type in ('qcm','true_false','open_question','exercise')),
  position integer not null default 0,
  prompt text not null default '',
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  explanation text default '',
  points numeric(8,2) not null default 1,
  grading_mode text not null default 'automatic' check (grading_mode in ('automatic','ai','human')),
  resource_files jsonb not null default '[]'::jsonb,
  accepted_submission_types text[] not null default array['pdf','doc','docx','xls','xlsx','zip','png','jpg'],
  rubric jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_assessment_questions_assessment on public.assessment_questions(assessment_id,position);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  attempt_number integer not null,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','pending_review','passed','failed')),
  score numeric(6,2),
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.users(id),
  time_spent_seconds integer not null default 0,
  feedback text default '',
  unique(assessment_id,user_id,attempt_number)
);
create index if not exists ix_attempts_user_course on public.assessment_attempts(user_id,course_id,status);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  answer_json jsonb,
  submission_files jsonb not null default '[]'::jsonb,
  auto_score numeric(8,2),
  final_score numeric(8,2),
  ai_feedback text,
  grader_feedback text,
  review_status text not null default 'not_required' check (review_status in ('not_required','pending','reviewed','changes_requested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id,question_id)
);

create table if not exists public.assessment_grading_history (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  answer_id uuid references public.assessment_answers(id) on delete cascade,
  grader_id uuid references public.users(id),
  previous_score numeric(8,2),
  new_score numeric(8,2),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  structure_id uuid,
  title text not null,
  question_type text not null,
  content_json jsonb not null default '{}'::jsonb,
  category text,
  level text,
  tags text[] not null default '{}',
  usage_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses add column if not exists lesson_passing_score integer not null default 80;
alter table public.courses add column if not exists module_passing_score integer not null default 80;
alter table public.courses add column if not exists final_passing_score integer not null default 70;
alter table public.courses add column if not exists assessment_rules_locked boolean not null default true;
alter table public.courses add column if not exists calculated_duration_minutes integer not null default 0;
alter table public.courses add column if not exists certificate_conditions jsonb not null default '{"all_lessons_passed":true,"all_modules_passed":true,"final_exam_passed":true,"manual_reviews_completed":true,"minimum_time_reached":true}'::jsonb;

alter table public.course_assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.assessment_grading_history enable row level security;
alter table public.question_bank enable row level security;

-- Lecture publique des définitions seulement pour les cours accessibles ; les écritures passent par studio-unified.
drop policy if exists assessment_read_authenticated on public.course_assessments;
create policy assessment_read_authenticated on public.course_assessments for select to authenticated using (true);
drop policy if exists assessment_questions_read_authenticated on public.assessment_questions;
create policy assessment_questions_read_authenticated on public.assessment_questions for select to authenticated using (true);
drop policy if exists attempts_own_read on public.assessment_attempts;
create policy attempts_own_read on public.assessment_attempts for select to authenticated using (user_id=auth.uid());
drop policy if exists answers_own_read on public.assessment_answers;
create policy answers_own_read on public.assessment_answers for select to authenticated using (exists(select 1 from public.assessment_attempts a where a.id=attempt_id and a.user_id=auth.uid()));
