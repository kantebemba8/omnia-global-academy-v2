-- OGA Formation — Assessment composition / point aggregation V1
begin;

create table if not exists public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.course_assessments(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  target_points numeric(8,2),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_sections_target_points_check
    check (target_points is null or target_points > 0)
);

create index if not exists assessment_sections_assessment_position_idx
  on public.assessment_sections(assessment_id, position, id);

alter table public.assessment_sections enable row level security;

drop policy if exists assessment_sections_read_authenticated on public.assessment_sections;
create policy assessment_sections_read_authenticated
  on public.assessment_sections
  for select
  to authenticated
  using (true);

alter table public.assessment_questions
  add column if not exists section_id uuid references public.assessment_sections(id) on delete set null;

create index if not exists assessment_questions_section_idx
  on public.assessment_questions(section_id, position);

comment on table public.assessment_sections is
  'Sections/parties d une evaluation officielle. Les points reels restent portes par assessment_questions; target_points sert de controle pedagogique et ne doit jamais etre additionne au score.';
comment on column public.assessment_questions.section_id is
  'Partie visuelle/pedagogique de l evaluation. Ne change pas le calcul: earned/total utilise uniquement les points des questions.';
comment on column public.assessment_sections.target_points is
  'Objectif de points de la partie; compare a la somme des assessment_questions.points pour detecter les incoherences, sans double comptage.';

commit;
