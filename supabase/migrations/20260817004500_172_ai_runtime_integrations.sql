-- OGA 172 — AI runtime & media integrations stabilization
BEGIN;

ALTER TABLE public.subtitle_jobs
  ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES public.lesson_blocks(id) ON DELETE CASCADE;

-- Backfill historical jobs from the most recent video block of the lesson when possible.
UPDATE public.subtitle_jobs j
SET block_id = (
  SELECT b.id
  FROM public.lesson_blocks b
  WHERE b.lesson_id = j.lesson_id
    AND b.block_type = 'video'
  ORDER BY b.position DESC, b.created_at DESC
  LIMIT 1
)
WHERE j.block_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.lesson_blocks b
    WHERE b.lesson_id = j.lesson_id
      AND b.block_type = 'video'
  );

ALTER TABLE public.subtitle_jobs
  DROP CONSTRAINT IF EXISTS subtitle_jobs_lesson_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS subtitle_jobs_block_language_uidx
  ON public.subtitle_jobs(block_id, target_language)
  WHERE block_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subtitle_jobs_block_idx
  ON public.subtitle_jobs(block_id, created_at DESC)
  WHERE block_id IS NOT NULL;

-- Career AI governance: expose the interview coach in the existing Super-admin
-- configuration and retire the historical token-length field that is no longer
-- a source of authority for modern models.
INSERT INTO public.career_ai_config(config_key, config_value, description_fr, is_active)
VALUES ('interview_feedback_enabled', 'true', 'Coach d’entretien IA', true)
ON CONFLICT (config_key) DO UPDATE
SET description_fr = EXCLUDED.description_fr,
    updated_at = now();

UPDATE public.career_ai_config
SET is_active = false,
    description_fr = 'Ancienne limite de sortie IA — gérée automatiquement par le runtime',
    updated_at = now()
WHERE config_key = 'max_tokens';

UPDATE public.career_ai_config
SET description_fr = 'Traduction professionnelle multilingue'
WHERE config_key = 'translation_enabled';

COMMIT;
