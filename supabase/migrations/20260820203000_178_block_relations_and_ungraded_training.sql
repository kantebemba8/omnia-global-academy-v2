-- OGA Formation Builder V3 — relations pédagogiques + entraînements non notés
ALTER TABLE public.lesson_blocks
  ADD COLUMN IF NOT EXISTS training_is_graded boolean NOT NULL DEFAULT true;

UPDATE public.lesson_blocks
SET training_is_graded = false
WHERE interaction_mode = 'training'
  AND training_passing_score = 0;

CREATE TABLE IF NOT EXISTS public.lesson_block_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  source_block_id uuid NOT NULL REFERENCES public.lesson_blocks(id) ON DELETE CASCADE,
  target_block_id uuid NOT NULL REFERENCES public.lesson_blocks(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('rubric_for','correction_for')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_block_links_distinct_blocks CHECK (source_block_id <> target_block_id),
  CONSTRAINT lesson_block_links_unique UNIQUE (source_block_id,target_block_id,relation_type)
);

CREATE INDEX IF NOT EXISTS idx_lesson_block_links_source
  ON public.lesson_block_links(source_block_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_lesson_block_links_target
  ON public.lesson_block_links(target_block_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_lesson_block_links_lesson
  ON public.lesson_block_links(lesson_id);
ALTER TABLE public.lesson_block_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.lesson_block_links IS
'Relations pédagogiques entre blocs : une grille d’évaluation peut cibler plusieurs activités ; une correction cible explicitement une activité.';
COMMENT ON COLUMN public.lesson_blocks.training_is_graded IS
'False = entraînement de réalisation uniquement : une tentative suffit, aucun seuil ni note ne bloque la progression.';
