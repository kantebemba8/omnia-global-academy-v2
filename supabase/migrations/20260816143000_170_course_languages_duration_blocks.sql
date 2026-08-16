BEGIN;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS instruction_language text,
  ADD COLUMN IF NOT EXISTS target_language text,
  ADD COLUMN IF NOT EXISTS cefr_start_level text,
  ADD COLUMN IF NOT EXISTS cefr_target_level text,
  ADD COLUMN IF NOT EXISTS language_framework text;

UPDATE public.courses
SET instruction_language = COALESCE(NULLIF(instruction_language, ''), NULLIF(language, ''), 'fr')
WHERE instruction_language IS NULL OR instruction_language = '';

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_course_type_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_course_type_check CHECK (course_type IN ('standard','language_learning'));
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_cefr_start_level_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_cefr_start_level_check CHECK (cefr_start_level IS NULL OR cefr_start_level IN ('A1','A2','B1','B2','C1','C2'));
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_cefr_target_level_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_cefr_target_level_check CHECK (cefr_target_level IS NULL OR cefr_target_level IN ('A1','A2','B1','B2','C1','C2'));


INSERT INTO public.course_studio_templates(key,label,description,mode,blueprint)
VALUES (
  'language_learning',
  'Formation linguistique',
  'Vocabulaire, compréhension orale, prononciation et expression selon le CECRL / CEFR',
  'advanced',
  '{"modules":[{"title":"Module 1","objective":"Développer les compétences linguistiques visées","lessons":[{"title":"Vocabulaire et compréhension","blocks":["objective","vocabulary","flashcards","matching","listening_comprehension","dictation","summary"]},{"title":"Expression et prononciation","blocks":["dialogue","pronunciation","sentence_order","cloze","oral_response","written_expression"]}]}]}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  label=excluded.label,
  description=excluded.description,
  mode=excluded.mode,
  blueprint=excluded.blueprint,
  is_active=true,
  updated_at=now();

-- La durée des formations internes est une donnée dérivée : jamais une saisie commerciale manuelle.
UPDATE public.courses
SET total_duration_seconds = GREATEST(60, COALESCE(calculated_duration_minutes, 1) * 60)
WHERE COALESCE(calculated_duration_minutes, 0) > 0
  AND COALESCE(total_duration_seconds, 0) IS DISTINCT FROM COALESCE(calculated_duration_minutes, 0) * 60;

COMMENT ON COLUMN public.courses.calculated_duration_minutes IS 'Durée pédagogique calculée automatiquement depuis les blocs et évaluations. Non éditable manuellement.';
COMMENT ON COLUMN public.courses.total_duration_seconds IS 'Projection en secondes de la durée pédagogique calculée pour catalogue/cartes/filtres.';
COMMENT ON COLUMN public.courses.course_type IS 'standard ou language_learning';
COMMENT ON COLUMN public.courses.instruction_language IS 'Langue d’enseignement / de médiation pédagogique.';
COMMENT ON COLUMN public.courses.target_language IS 'Langue étudiée, uniquement pour course_type=language_learning.';

COMMIT;
