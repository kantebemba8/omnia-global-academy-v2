-- OGA — modes de remise des activités évaluées V1
begin;

alter table public.assessment_questions
  add column if not exists response_mode text,
  add column if not exists response_layout text,
  add column if not exists max_submission_size_mb integer;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_response_mode_check;
alter table public.assessment_questions
  add constraint assessment_questions_response_mode_check
  check (response_mode is null or response_mode in ('text','file','text_file'));

alter table public.assessment_questions
  drop constraint if exists assessment_questions_response_layout_check;
alter table public.assessment_questions
  add constraint assessment_questions_response_layout_check
  check (response_layout is null or response_layout in ('single','per_question'));

alter table public.assessment_questions
  drop constraint if exists assessment_questions_max_submission_size_mb_check;
alter table public.assessment_questions
  add constraint assessment_questions_max_submission_size_mb_check
  check (max_submission_size_mb is null or (max_submission_size_mb >= 1 and max_submission_size_mb <= 50));

comment on column public.assessment_questions.response_mode is
  'Mode de remise pour les activités libres: text, file ou text_file. NULL conserve le comportement historique selon le type de question.';
comment on column public.assessment_questions.response_layout is
  'Pour une étude de cas textuelle: single = réponse globale, per_question = une réponse par question d analyse.';
comment on column public.assessment_questions.max_submission_size_mb is
  'Taille maximale d une pièce jointe pour la question, plafonnée à 50 Mo.';

commit;
