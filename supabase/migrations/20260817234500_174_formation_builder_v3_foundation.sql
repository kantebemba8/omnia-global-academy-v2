BEGIN;

-- Builder V3 — fondation de données, progression, publication et tarification Professeur.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS builder_version text NOT NULL DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS is_catalog_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS catalog_deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cover_ai_generation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_first_lesson_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pricing_engine_version text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS pricing_recommended_xof bigint,
  ADD COLUMN IF NOT EXISTS pricing_range_min_xof bigint,
  ADD COLUMN IF NOT EXISTS pricing_range_max_xof bigint,
  ADD COLUMN IF NOT EXISTS moderator_price_recommendation_xof bigint;

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_builder_version_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_builder_version_check CHECK (builder_version IN ('v2','v3'));
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_cover_ai_generation_count_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_cover_ai_generation_count_check CHECK (cover_ai_generation_count BETWEEN 0 AND 2);

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_free_preview_mode_check;
ALTER TABLE public.courses ALTER COLUMN free_preview_mode SET DEFAULT 'introduction_first_lesson';
ALTER TABLE public.courses ADD CONSTRAINT courses_free_preview_mode_check CHECK (free_preview_mode IN ('none','introduction','introduction_first_lesson'));
UPDATE public.courses SET free_preview_mode='introduction_first_lesson' WHERE free_preview_mode='introduction';

UPDATE public.courses
SET is_catalog_active = true,
    catalog_activated_at = COALESCE(catalog_activated_at, now())
WHERE studio_status IN ('validated','published') AND is_catalog_active = true;

ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.lesson_blocks
  ADD COLUMN IF NOT EXISTS interaction_mode text NOT NULL DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS assessment_scope text,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_passing_score integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS rag_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preview_allowed boolean NOT NULL DEFAULT false;

ALTER TABLE public.lesson_blocks DROP CONSTRAINT IF EXISTS lesson_blocks_interaction_mode_check;
ALTER TABLE public.lesson_blocks ADD CONSTRAINT lesson_blocks_interaction_mode_check CHECK (interaction_mode IN ('content','training','assessment'));
ALTER TABLE public.lesson_blocks DROP CONSTRAINT IF EXISTS lesson_blocks_assessment_scope_check;
ALTER TABLE public.lesson_blocks ADD CONSTRAINT lesson_blocks_assessment_scope_check CHECK (assessment_scope IS NULL OR assessment_scope IN ('lesson','module','final'));
ALTER TABLE public.lesson_blocks DROP CONSTRAINT IF EXISTS lesson_blocks_training_passing_score_check;
ALTER TABLE public.lesson_blocks ADD CONSTRAINT lesson_blocks_training_passing_score_check CHECK (training_passing_score BETWEEN 0 AND 100);

-- Les interactions historiques de leçon deviennent des entraînements. Les évaluations
-- officielles existantes restent dans course_assessments et ne sont donc pas perdues.
UPDATE public.lesson_blocks
SET interaction_mode = 'training', is_required = false, training_passing_score = 80
WHERE interaction_mode = 'content'
  AND block_type IN ('qcm','true_false','open_question','exercise','assignment_upload','case_study','flashcards','interactive_table','checklist','cloze','dictation','pronunciation','matching','sentence_order','oral_response','listening_comprehension','written_expression');

-- Les ressources binaires ne sont pas indexées par défaut dans le RAG.
UPDATE public.lesson_blocks
SET rag_enabled = false
WHERE block_type IN ('pdf','word','excel','download','scorm','embed')
  AND rag_enabled = true;

CREATE TABLE IF NOT EXISTS public.training_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.course_modules(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.lesson_blocks(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  score numeric(6,2) NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answer_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, block_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_training_attempts_user_lesson ON public.training_attempts(user_id, lesson_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_attempts_block ON public.training_attempts(block_id, user_id, attempt_number DESC);
ALTER TABLE public.training_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS training_attempts_read_own ON public.training_attempts;
CREATE POLICY training_attempts_read_own ON public.training_attempts FOR SELECT USING (user_id = auth.uid());

-- Suivi individuel des checklists.
CREATE TABLE IF NOT EXISTS public.learner_block_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.lesson_blocks(id) ON DELETE CASCADE,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, block_id)
);
ALTER TABLE public.learner_block_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learner_block_state_read_own ON public.learner_block_state;
CREATE POLICY learner_block_state_read_own ON public.learner_block_state FOR SELECT USING (user_id = auth.uid());

-- Import intelligent V3 : analyse puis prévisualisation avant application.
CREATE TABLE IF NOT EXISTS public.course_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'course',
  target_id uuid,
  mode text NOT NULL DEFAULT 'structured',
  bucket_name text NOT NULL,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  sha256 text,
  detected_language text,
  status text NOT NULL DEFAULT 'ready',
  blueprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  CHECK (target_type IN ('course','module','lesson','block')),
  CHECK (mode IN ('faithful','structured','enriched')),
  CHECK (status IN ('processing','ready','applied','failed'))
);
CREATE INDEX IF NOT EXISTS idx_course_import_jobs_user ON public.course_import_jobs(user_id, created_at DESC);
ALTER TABLE public.course_import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_import_jobs_read_own ON public.course_import_jobs;
CREATE POLICY course_import_jobs_read_own ON public.course_import_jobs FOR SELECT USING (user_id = auth.uid());



-- Bambara devient une langue UI officielle, pas seulement une langue de contenu.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_preferred_language_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_preferred_language_check
  CHECK (preferred_language IN ('fr','en','es','pt','ar','zh','ru','de','bm'));

CREATE OR REPLACE FUNCTION public.oga_i18n_overview()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH langs(code) AS (VALUES ('en'),('es'),('pt'),('ar'),('zh'),('ru'),('de'),('bm')),
  totals AS (SELECT count(*)::integer AS total FROM public.platform_ui_translations),
  stats AS (
    SELECT l.code,
      count(*) FILTER (WHERE nullif(trim(t.translations ->> l.code),'') IS NOT NULL)::integer AS translated,
      count(*) FILTER (WHERE l.code = ANY(t.reviewed_languages))::integer AS reviewed
    FROM langs l CROSS JOIN public.platform_ui_translations t GROUP BY l.code
  )
  SELECT jsonb_build_object(
    'total', totals.total,
    'languages', coalesce(jsonb_object_agg(stats.code, jsonb_build_object(
      'translated', stats.translated,
      'reviewed', stats.reviewed,
      'percentage', CASE WHEN totals.total=0 THEN 100 ELSE round(stats.translated*100.0/totals.total,1) END
    )), '{}'::jsonb),
    'updated_at', (SELECT max(updated_at) FROM public.platform_ui_translations)
  ) FROM totals LEFT JOIN stats ON true GROUP BY totals.total;
$$;
REVOKE ALL ON FUNCTION public.oga_i18n_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oga_i18n_overview() TO service_role;

-- Evaluations V3 : randomisation réelle et traçabilité des questions issues de la banque.
ALTER TABLE public.course_assessments
  ADD COLUMN IF NOT EXISTS random_question_count integer;
ALTER TABLE public.course_assessments DROP CONSTRAINT IF EXISTS course_assessments_random_question_count_check;
ALTER TABLE public.course_assessments ADD CONSTRAINT course_assessments_random_question_count_check CHECK (random_question_count IS NULL OR random_question_count > 0);

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS source_question_bank_id uuid REFERENCES public.question_bank(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_lesson_block_id uuid REFERENCES public.lesson_blocks(id) ON DELETE SET NULL;
ALTER TABLE public.assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_question_type_check;
ALTER TABLE public.assessment_questions ADD CONSTRAINT assessment_questions_question_type_check CHECK (question_type IN (
  'qcm','true_false','open_question','exercise','assignment_upload','case_study',
  'cloze','dictation','pronunciation','matching','sentence_order','oral_response',
  'listening_comprehension','written_expression'
));
CREATE INDEX IF NOT EXISTS idx_assessment_questions_source_bank ON public.assessment_questions(source_question_bank_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_source_block ON public.assessment_questions(source_lesson_block_id);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_questions_source_block_unique ON public.assessment_questions(assessment_id,source_lesson_block_id) WHERE source_lesson_block_id IS NOT NULL;

-- Versionnement pédagogique : enrichissement de la table historique existante.
ALTER TABLE public.course_versions
  ADD COLUMN IF NOT EXISTS parent_version_id uuid REFERENCES public.course_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_type text NOT NULL DEFAULT 'major',
  ADD COLUMN IF NOT EXISTS applies_to_existing_learners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE public.course_versions DROP CONSTRAINT IF EXISTS course_versions_change_type_check;
ALTER TABLE public.course_versions ADD CONSTRAINT course_versions_change_type_check CHECK (change_type IN ('minor','major'));

-- Nouveau moteur tarifaire V3. Aucune formule de score module/leçon/niveau.
CREATE TABLE IF NOT EXISTS public.professor_pricing_duration_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  min_minutes integer NOT NULL DEFAULT 0,
  max_minutes integer,
  base_price_xof bigint NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_minutes >= 0),
  CHECK (max_minutes IS NULL OR max_minutes > min_minutes),
  CHECK (base_price_xof >= 0)
);

CREATE TABLE IF NOT EXISTS public.professor_pricing_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_key text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  description_fr text,
  factor_type text NOT NULL DEFAULT 'multiplier',
  trigger_type text NOT NULL DEFAULT 'manual_or_detected',
  multiplier numeric(10,4) NOT NULL DEFAULT 1,
  fixed_amount_xof bigint NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (factor_type IN ('multiplier','fixed_amount','percentage')),
  CHECK (multiplier >= 0),
  CHECK (fixed_amount_xof >= 0)
);

CREATE TABLE IF NOT EXISTS public.professor_pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key text NOT NULL UNIQUE DEFAULT 'default',
  lower_range_percent numeric(8,3) NOT NULL DEFAULT 0,
  upper_range_percent numeric(8,3) NOT NULL DEFAULT 0,
  rounding_step_xof integer NOT NULL DEFAULT 1,
  allow_professor_desired_price boolean NOT NULL DEFAULT true,
  large_gap_warning_percent numeric(8,3) NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (rounding_step_xof > 0)
);

INSERT INTO public.professor_pricing_settings(singleton_key)
VALUES ('default') ON CONFLICT (singleton_key) DO NOTHING;

ALTER TABLE public.professor_pricing_duration_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_pricing_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_pricing_settings ENABLE ROW LEVEL SECURITY;

-- Désactivation fonctionnelle de l'ancien moteur : la configuration reste seulement historique.
INSERT INTO public.site_settings(key,value)
VALUES ('course_pricing_engine', '{"version":"v3","legacy_score_engine_enabled":false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

UPDATE public.courses
SET pricing_engine_version = CASE WHEN creator_context IN ('professor','professeur') THEN 'v3' ELSE pricing_engine_version END
WHERE creator_context IN ('professor','professeur');


-- Certification V3 : choix simple dans la Finalisation.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS certificate_mode text NOT NULL DEFAULT 'omnia';
DO $$ BEGIN
  ALTER TABLE public.courses ADD CONSTRAINT courses_certificate_mode_check CHECK (certificate_mode IN ('omnia','external','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.courses SET certificate_mode = CASE WHEN certification_requested = true THEN 'external' ELSE 'omnia' END WHERE certificate_mode IS NULL OR certificate_mode NOT IN ('omnia','external','none');

-- Versionnement pédagogique V3 : une nouvelle version majeure possède son propre course_id.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS version_family_id uuid,
  ADD COLUMN IF NOT EXISTS previous_version_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current_catalog_version boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

UPDATE public.courses SET version_family_id = id WHERE version_family_id IS NULL;
ALTER TABLE public.courses ALTER COLUMN version_family_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courses_version_family ON public.courses(version_family_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS courses_one_current_catalog_version_idx
  ON public.courses(version_family_id) WHERE is_current_catalog_version = true;


-- L'ancien moteur automatique Score → Palier est archivé et n'est plus adressable
-- sous ses noms historiques. Les données sont conservées uniquement pour audit.
DO $$ BEGIN
  IF to_regclass('public.pricing_tiers') IS NOT NULL AND to_regclass('public.legacy_pricing_tiers_archive') IS NULL THEN
    ALTER TABLE public.pricing_tiers RENAME TO legacy_pricing_tiers_archive;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.category_multipliers') IS NOT NULL AND to_regclass('public.legacy_category_multipliers_archive') IS NULL THEN
    ALTER TABLE public.category_multipliers RENAME TO legacy_category_multipliers_archive;
  END IF;
END $$;

COMMIT;
