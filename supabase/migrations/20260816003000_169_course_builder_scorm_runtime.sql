BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Runtime SCORM persistant. Les lignes ne sont jamais exposées directement au client :
-- lesson-content reste l'autorité serveur et délivre un token de lecture temporaire.
CREATE TABLE IF NOT EXISTS public.scorm_runtime_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.lesson_blocks(id) ON DELETE CASCADE,
  package_type text NOT NULL CHECK (package_type = 'scorm_2004'),
  package_prefix text NOT NULL,
  launch_path text NOT NULL,
  cmi_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress_percent numeric(6,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completion_status text,
  success_status text,
  score numeric(8,3),
  total_time_seconds integer NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),
  last_commit_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, block_id),
  UNIQUE(runtime_token)
);

CREATE INDEX IF NOT EXISTS ix_scorm_runtime_token
  ON public.scorm_runtime_sessions(runtime_token, expires_at);
CREATE INDEX IF NOT EXISTS ix_scorm_runtime_learner
  ON public.scorm_runtime_sessions(user_id, course_id, lesson_id);

ALTER TABLE public.scorm_runtime_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scorm_runtime_sessions FROM anon, authenticated;

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS scorm_progress_percent numeric(6,2) NOT NULL DEFAULT 0
    CHECK (scorm_progress_percent >= 0 AND scorm_progress_percent <= 100),
  ADD COLUMN IF NOT EXISTS scorm_completed boolean NOT NULL DEFAULT false;

-- Politique moderne : pas d'évaluation imposée à chaque leçon/module par défaut.
-- Le final peut être explicitement requis et le serveur l'impose de toute façon
-- lorsqu'une certification ou un parcours CPD le nécessite.
UPDATE public.courses
SET assessment_policy = COALESCE(assessment_policy, '{}'::jsonb)
  || jsonb_build_object(
    'lesson_assessment_required', COALESCE((assessment_policy->>'lesson_assessment_required')::boolean, false),
    'module_assessment_required', COALESCE((assessment_policy->>'module_assessment_required')::boolean, false),
    'final_assessment_required', COALESCE((assessment_policy->>'final_assessment_required')::boolean, false)
  )
WHERE assessment_policy IS NULL
   OR NOT (assessment_policy ? 'lesson_assessment_required')
   OR NOT (assessment_policy ? 'module_assessment_required')
   OR NOT (assessment_policy ? 'final_assessment_required');

COMMIT;
