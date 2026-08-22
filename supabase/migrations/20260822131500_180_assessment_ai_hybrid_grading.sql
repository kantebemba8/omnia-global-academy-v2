-- OGA — modes de correction officiels V1
begin;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_grading_mode_check;

alter table public.assessment_questions
  add constraint assessment_questions_grading_mode_check
  check (grading_mode in ('automatic','ai','human','ai_human'));

alter table public.assessment_answers
  add column if not exists ai_score numeric(8,2),
  add column if not exists ai_feedback text,
  add column if not exists ai_grading_json jsonb not null default '{}'::jsonb,
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists ai_graded_at timestamptz,
  add column if not exists human_validated_ai boolean not null default false;

comment on column public.assessment_questions.grading_mode is
  'automatic = règle déterministe; ai = correction IA définitive selon rubric/barème; human = évaluateur; ai_human = proposition IA obligatoirement validée/modifiée par un humain.';
comment on column public.assessment_answers.ai_score is
  'Proposition de score IA en points. Ne constitue jamais une question ni des points supplémentaires.';
comment on column public.assessment_answers.human_validated_ai is
  'Vrai uniquement lorsqu un évaluateur humain a validé ou modifié une proposition IA en mode ai_human.';

commit;
