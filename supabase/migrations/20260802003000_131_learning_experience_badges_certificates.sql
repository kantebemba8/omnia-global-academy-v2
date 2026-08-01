-- Omnia Global Academy
-- Étape 3.1 — Expérience apprenant, Lives, badges et certificats fiables
-- Cette migration ne modifie ni FedaPay, ni les Cron Jobs, ni les abonnements.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $preflight$
BEGIN
  IF to_regclass('public.certification_organizations') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.certification_organizations';
  END IF;
  IF to_regclass('public.course_certifications') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.course_certifications';
  END IF;
  IF to_regclass('public.certificate_accreditations') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.certificate_accreditations';
  END IF;
  IF to_regclass('public.certificates') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.certificates';
  END IF;
  IF to_regclass('public.certificate_settings') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.certificate_settings';
  END IF;
  IF to_regclass('public.certificate_template_assignments') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.certificate_template_assignments';
  END IF;
  IF to_regclass('public.certificate_templates') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLE_MANQUANTE: public.certificate_templates';
  END IF;
  IF to_regclass('public.badge_templates') IS NULL OR to_regclass('public.badge_awards') IS NULL THEN
    RAISE EXCEPTION 'OGA_131_TABLES_BADGES_MANQUANTES';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. Les organismes de certification peuvent être reliés au registre officiel.
-- ---------------------------------------------------------------------------
ALTER TABLE public.certification_organizations
  ADD COLUMN IF NOT EXISTS recognition_partner_id uuid,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS logo_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS course_display_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_display_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS authorization_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.recognition_partners') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'certification_organizations_recognition_partner_id_fkey'
         AND conrelid = 'public.certification_organizations'::regclass
     ) THEN
    ALTER TABLE public.certification_organizations
      ADD CONSTRAINT certification_organizations_recognition_partner_id_fkey
      FOREIGN KEY (recognition_partner_id)
      REFERENCES public.recognition_partners(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certification_organizations_recognition_partner
  ON public.certification_organizations(recognition_partner_id)
  WHERE recognition_partner_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Une demande de certification conserve la source, les autorisations et
--    les choix d'affichage validés par le Super-admin.
-- ---------------------------------------------------------------------------
ALTER TABLE public.course_certifications
  ADD COLUMN IF NOT EXISTS recognition_partner_id uuid,
  ADD COLUMN IF NOT EXISTS recognition_program_id uuid,
  ADD COLUMN IF NOT EXISTS logo_permission_id uuid,
  ADD COLUMN IF NOT EXISTS partner_website_url text,
  ADD COLUMN IF NOT EXISTS partner_description text,
  ADD COLUMN IF NOT EXISTS display_on_course boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_on_certificate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS immutable_asset_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.recognition_partners') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'course_certifications_recognition_partner_id_fkey'
         AND conrelid = 'public.course_certifications'::regclass
     ) THEN
    ALTER TABLE public.course_certifications
      ADD CONSTRAINT course_certifications_recognition_partner_id_fkey
      FOREIGN KEY (recognition_partner_id)
      REFERENCES public.recognition_partners(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.recognition_programs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'course_certifications_recognition_program_id_fkey'
         AND conrelid = 'public.course_certifications'::regclass
     ) THEN
    ALTER TABLE public.course_certifications
      ADD CONSTRAINT course_certifications_recognition_program_id_fkey
      FOREIGN KEY (recognition_program_id)
      REFERENCES public.recognition_programs(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.recognition_logo_permissions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'course_certifications_logo_permission_id_fkey'
         AND conrelid = 'public.course_certifications'::regclass
     ) THEN
    ALTER TABLE public.course_certifications
      ADD CONSTRAINT course_certifications_logo_permission_id_fkey
      FOREIGN KEY (logo_permission_id)
      REFERENCES public.recognition_logo_permissions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.course_certifications
SET immutable_asset_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'organization_name', organization_name,
  'certification_name', certification_name,
  'logo_url', COALESCE(logo_url, badge_url),
  'badge_url', badge_url,
  'signature_url', signature_url,
  'stamp_url', stamp_url,
  'verification_url', verification_url,
  'captured_at', COALESCE(validated_at, updated_at, created_at)
))
WHERE status = 'validated'
  AND COALESCE(immutable_asset_snapshot, '{}'::jsonb) = '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_course_certifications_public_display
  ON public.course_certifications(course_id, status, display_on_course, display_on_certificate);

-- ---------------------------------------------------------------------------
-- 3. Chaque certificat conserve une copie immuable des logos, autorisations,
--    signatures et fichiers PDF utilisés au moment de l'émission.
-- ---------------------------------------------------------------------------
ALTER TABLE public.certificate_accreditations
  ADD COLUMN IF NOT EXISTS partner_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_permission_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_mime_type text DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS legacy_html_url text,
  ADD COLUMN IF NOT EXISTS issuer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS accreditation_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS badge_awards_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_certificates_template_version
  ON public.certificates(template_id, template_version, issued_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Les modèles de certificats sont réellement versionnés.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omnia_certificate_template_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    NEW.name, NEW.document_type, NEW.source_type, NEW.issuer_scope,
    NEW.language_code, NEW.layout_json, NEW.is_active, NEW.is_default
  ) IS DISTINCT FROM ROW(
    OLD.name, OLD.document_type, OLD.source_type, OLD.issuer_scope,
    OLD.language_code, OLD.layout_json, OLD.is_active, OLD.is_default
  ) THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_certificate_template_version
  ON public.certificate_templates;

CREATE TRIGGER trg_certificate_template_version
BEFORE UPDATE ON public.certificate_templates
FOR EACH ROW
EXECUTE FUNCTION public.omnia_certificate_template_version();

-- ---------------------------------------------------------------------------
-- 5. Empêche la double attribution d'un badge automatique pour un même
--    certificat, tout en conservant les attributions manuelles.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY template_id, recipient_user_id, source_type, source_id
           ORDER BY issued_at DESC, created_at DESC, id DESC
         ) AS row_rank
  FROM public.badge_awards
  WHERE source_type = 'course_certificate'
    AND source_id IS NOT NULL
    AND status <> 'revoked'
)
UPDATE public.badge_awards award
SET status = 'revoked',
    revoked_at = COALESCE(award.revoked_at, now()),
    revocation_reason = COALESCE(award.revocation_reason, 'Doublon automatique neutralisé par la migration 131'),
    updated_at = now()
FROM ranked
WHERE award.id = ranked.id
  AND ranked.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_badge_awards_course_certificate_auto
  ON public.badge_awards(template_id, recipient_user_id, source_type, source_id)
  WHERE source_type = 'course_certificate'
    AND source_id IS NOT NULL
    AND status <> 'revoked';

-- Réglages globaux, désactivables par le Super-admin si nécessaire.
INSERT INTO public.certificate_settings(key, value)
VALUES
  ('certificate_pdf_enabled', 'true'),
  ('certificate_snapshot_assets', 'true'),
  ('certificate_auto_badges_enabled', 'true'),
  ('certificate_show_download_button', 'true')
ON CONFLICT(key) DO NOTHING;

-- Le lot est exécuté manuellement dans SQL Editor. Enregistrer la version dans
-- l'historique évite un second script et aligne immédiatement LOCAL / REMOTE.
DO $oga_migration_history$
DECLARE
  v_version constant text := '20260802003000';
  v_name constant text := '131_learning_experience_badges_certificates';
  v_has_name boolean;
  v_has_statements boolean;
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'OGA_MIGRATION_HISTORY_TABLE_MISSING';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='supabase_migrations'
      AND table_name='schema_migrations'
      AND column_name='name'
  ) INTO v_has_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='supabase_migrations'
      AND table_name='schema_migrations'
      AND column_name='statements'
  ) INTO v_has_statements;

  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version=v_version
  ) THEN
    IF v_has_name THEN
      EXECUTE 'UPDATE supabase_migrations.schema_migrations SET name=$1 WHERE version=$2'
      USING v_name,v_version;
    END IF;
  ELSIF v_has_name AND v_has_statements THEN
    BEGIN
      EXECUTE 'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ($1,$2,ARRAY[]::text[])'
      USING v_version,v_name;
    EXCEPTION WHEN datatype_mismatch OR invalid_text_representation THEN
      EXECUTE 'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ($1,$2,NULL)'
      USING v_version,v_name;
    END;
  ELSIF v_has_name THEN
    EXECUTE 'INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)'
    USING v_version,v_name;
  ELSE
    EXECUTE 'INSERT INTO supabase_migrations.schema_migrations(version) VALUES ($1)'
    USING v_version;
  END IF;
END
$oga_migration_history$;

COMMIT;

SELECT
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='course_certifications'
      AND column_name='immutable_asset_snapshot'
  ) AS certification_snapshots_ready,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='certificates'
      AND column_name='pdf_sha256'
  ) AS real_pdf_registry_ready,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='certificates'
      AND column_name='badge_awards_snapshot'
  ) AS automatic_badges_snapshot_ready,
  EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_certificate_template_version'
  ) AS certificate_template_versioning_ready,
  EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND indexname='uq_badge_awards_course_certificate_auto'
  ) AS automatic_badge_deduplication_ready,
  EXISTS(
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20260802003000'
  ) AS migration_history_aligned;
