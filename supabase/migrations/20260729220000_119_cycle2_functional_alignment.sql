-- Cycle 2 — Alignement fonctionnel modération, offres d'emploi et suivi des candidatures
BEGIN;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS examen_oral_justification_moderateur text;

ALTER TABLE public.job_offers
  ALTER COLUMN posted_by_id DROP NOT NULL;

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.partner_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_mode varchar(30) NOT NULL DEFAULT 'omnia_managed',
  ADD COLUMN IF NOT EXISTS external_apply_url text,
  ADD COLUMN IF NOT EXISTS external_apply_email varchar(320),
  ADD COLUMN IF NOT EXISTS application_instructions text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS created_by_role varchar(60),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_offers_application_mode_check'
      AND conrelid = 'public.job_offers'::regclass
  ) THEN
    ALTER TABLE public.job_offers
      ADD CONSTRAINT job_offers_application_mode_check
      CHECK (application_mode IN ('omnia_managed','external_link','external_email'));
  END IF;
END $$;

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS tracking_status varchar(30) NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.job_offers
SET application_mode = 'omnia_managed'
WHERE application_mode IS NULL OR application_mode NOT IN ('omnia_managed','external_link','external_email');

UPDATE public.job_applications
SET tracking_status = CASE
  WHEN status IN ('received','viewed','under_review','shortlisted','interview','accepted','rejected','archived') THEN status
  WHEN status = 'submitted' THEN 'received'
  ELSE 'received'
END
WHERE tracking_status IS NULL OR tracking_status = '';

CREATE INDEX IF NOT EXISTS idx_job_offers_organization_status
  ON public.job_offers(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_offers_application_mode
  ON public.job_offers(application_mode, status);
CREATE INDEX IF NOT EXISTS idx_job_applications_tracking_status
  ON public.job_applications(job_id, tracking_status, submitted_at DESC);

COMMIT;
