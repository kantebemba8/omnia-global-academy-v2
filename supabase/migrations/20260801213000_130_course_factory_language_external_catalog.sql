-- 130 — Fabrique de formations, seuils globaux et catalogue externe gouverné.
-- Aucun plan Premium n'est créé ou activé automatiquement.

BEGIN;

-- Compatibilité avec la publication directe des offres créées par le Super-admin.
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.courses
SET instructor_id = creator_id
WHERE instructor_id IS NULL AND creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses(instructor_id);

CREATE OR REPLACE FUNCTION public.sync_course_creator_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creator_id := COALESCE(NEW.creator_id, NEW.instructor_id);
    NEW.instructor_id := COALESCE(NEW.instructor_id, NEW.creator_id);
  ELSE
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
       AND NEW.instructor_id IS NOT DISTINCT FROM OLD.instructor_id THEN
      NEW.instructor_id := NEW.creator_id;
    ELSIF NEW.instructor_id IS DISTINCT FROM OLD.instructor_id
       AND NEW.creator_id IS NOT DISTINCT FROM OLD.creator_id THEN
      NEW.creator_id := NEW.instructor_id;
    ELSIF NEW.creator_id IS DISTINCT FROM NEW.instructor_id THEN
      NEW.instructor_id := NEW.creator_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_creator_identity ON public.courses;
CREATE TRIGGER trg_sync_course_creator_identity
BEFORE INSERT OR UPDATE OF creator_id, instructor_id ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.sync_course_creator_identity();

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS learning_design_settings jsonb NOT NULL DEFAULT '{
    "delivery_mode":"self_paced",
    "drip_enabled":false,
    "drip_interval_days":7,
    "cohort_start_at":null,
    "estimated_effort_hours":0,
    "completion_policy":"all_required",
    "require_sequential_progress":true,
    "require_video_completion":false,
    "accessibility":{"captions":false,"transcript":false,"keyboard_checked":false,"contrast_checked":false,"alt_text_checked":false},
    "learner_persona":"",
    "success_outcome":""
  }'::jsonb;

INSERT INTO public.site_settings(key, value)
VALUES (
  'assessment_threshold_defaults',
  '{
    "lesson_passing_score":80,
    "module_passing_score":80,
    "final_passing_score":70,
    "competency_mastery_score":80,
    "default_retry_cooldown_hours":24,
    "default_remediation_after_attempts":3
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.external_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 500),
  short_description text,
  provider_name text NOT NULL CHECK (length(trim(provider_name)) BETWEEN 2 AND 240),
  external_url text NOT NULL CHECK (external_url ~ '^https://'),
  cover_image_url text,
  category text,
  level text,
  language text NOT NULL DEFAULT 'fr',
  duration_label text,
  total_duration_seconds integer NOT NULL DEFAULT 0 CHECK (total_duration_seconds >= 0),
  certificate_available boolean NOT NULL DEFAULT false,
  is_free boolean NOT NULL DEFAULT true,
  access_mode text NOT NULL DEFAULT 'public' CHECK (access_mode IN ('public','registered','premium')),
  premium_benefit_key text NOT NULL DEFAULT 'external_course_premium_access',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  admin_notes text,
  content_usage_confirmed boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  last_verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  click_count bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- Renforcement idempotent si une version partielle de la table existe déjà.
ALTER TABLE public.external_courses
  ADD COLUMN IF NOT EXISTS content_usage_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS premium_benefit_key text NOT NULL DEFAULT 'external_course_premium_access',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS click_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.external_course_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_course_id uuid NOT NULL REFERENCES public.external_courses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  session_fingerprint text,
  access_mode text NOT NULL,
  provider_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_courses_catalogue
  ON public.external_courses(status, display_order, is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_courses_provider
  ON public.external_courses(provider_name, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_courses_unique_active_url
  ON public.external_courses((lower(external_url)))
  WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS idx_external_course_clicks_course
  ON public.external_course_clicks(external_course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_course_clicks_user
  ON public.external_course_clicks(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_external_course_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_external_courses_updated_at ON public.external_courses;
CREATE TRIGGER trg_external_courses_updated_at
BEFORE UPDATE ON public.external_courses
FOR EACH ROW EXECUTE FUNCTION public.touch_external_course_updated_at();

ALTER TABLE public.external_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_course_clicks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.external_courses FROM anon, authenticated;
REVOKE ALL ON public.external_course_clicks FROM anon, authenticated;

INSERT INTO public.commerce_benefit_definitions(
  benefit_key, module_key, name, description, value_type, unit_label,
  reset_period, allowed_audiences, configuration_schema, is_active, is_system
)
VALUES (
  'external_course_premium_access',
  'formations',
  'Accès aux formations externes Premium',
  'Autorise l’accès aux liens de formations externes réservés aux offres Premium Omnia.',
  'boolean',
  'accès',
  'subscription_period',
  ARRAY['learner','global'],
  '{"scope":["all_external_courses","selected_external_courses"]}'::jsonb,
  true,
  true
)
ON CONFLICT (benefit_key) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  unit_label = EXCLUDED.unit_label,
  allowed_audiences = EXCLUDED.allowed_audiences,
  configuration_schema = EXCLUDED.configuration_schema,
  is_system = true;


CREATE OR REPLACE FUNCTION public.increment_external_course_click(p_course_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.external_courses
  SET click_count = click_count + 1, updated_at = updated_at
  WHERE id = p_course_id AND status = 'published';
$$;
REVOKE ALL ON FUNCTION public.increment_external_course_click(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_external_course_click(uuid) TO service_role;

COMMENT ON TABLE public.external_courses IS
  'Catalogue administré de formations hébergées par des fournisseurs externes. Aucun fournisseur fictif et aucune URL publique avant contrôle d’accès.';
COMMENT ON TABLE public.external_course_clicks IS
  'Journal minimal des redirections vers les fournisseurs externes pour mesurer l’usage et la qualité des partenariats.';

COMMIT;

-- Vérification finale : toutes les colonnes booléennes doivent être vraies.
SELECT
  to_regclass('public.external_courses') IS NOT NULL AS external_catalogue_ready,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='courses' AND column_name='instructor_id'
  ) AS instructor_identity_ready,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='courses' AND column_name='learning_design_settings'
  ) AS learning_design_ready,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_offers' AND column_name='published_at'
  ) AS superadmin_jobs_ready,
  EXISTS (
    SELECT 1 FROM public.site_settings WHERE key='assessment_threshold_defaults'
  ) AS threshold_defaults_ready,
  EXISTS (
    SELECT 1 FROM public.commerce_benefit_definitions
    WHERE benefit_key='external_course_premium_access'
  ) AS external_premium_rule_ready,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='external_courses' AND column_name='content_usage_confirmed'
  ) AS external_governance_ready;

