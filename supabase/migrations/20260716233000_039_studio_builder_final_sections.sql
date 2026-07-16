-- Studio étape 1 : brouillons idempotents, conclusion, examen final et exercices avec dépôt
alter table public.courses add column if not exists client_draft_key text;
create unique index if not exists courses_creator_draft_key_uq on public.courses(creator_id, client_draft_key) where client_draft_key is not null;

alter table public.course_modules add column if not exists is_conclusion boolean not null default false;
alter table public.course_modules add column if not exists is_final_exam boolean not null default false;
alter table public.course_lessons add column if not exists is_conclusion boolean not null default false;
alter table public.course_lessons add column if not exists is_final_exam boolean not null default false;

create table if not exists public.course_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  block_id uuid not null references public.lesson_blocks(id) on delete cascade,
  learner_id uuid not null references public.users(id) on delete cascade,
  file_url text,
  file_name text,
  file_mime text,
  answer_text text,
  status text not null default 'submitted' check (status in ('draft','submitted','under_review','changes_requested','graded')),
  score numeric(6,2),
  evaluator_comment text,
  evaluated_by uuid references public.users(id),
  submitted_at timestamptz default now(),
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assignment_submissions_learner_idx on public.course_assignment_submissions(learner_id, course_id);
create index if not exists assignment_submissions_evaluator_idx on public.course_assignment_submissions(course_id, status);
alter table public.course_assignment_submissions enable row level security;
drop policy if exists "learners_manage_own_assignment_submissions" on public.course_assignment_submissions;
create policy "learners_manage_own_assignment_submissions" on public.course_assignment_submissions for all to authenticated using (learner_id=auth.uid()) with check (learner_id=auth.uid());
drop policy if exists "course_creators_view_assignment_submissions" on public.course_assignment_submissions;
create policy "course_creators_view_assignment_submissions" on public.course_assignment_submissions for select to authenticated using (exists(select 1 from public.courses c where c.id=course_id and c.creator_id=auth.uid()));
