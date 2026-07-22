-- 090 — Rôles de test + centre Certificats & Attestations
BEGIN;

-- =========================================================
-- A. Corriger les rôles des comptes de démonstration
-- =========================================================

-- Les comptes tests spécialisés ne doivent pas aussi être apprenants.
DELETE FROM public.user_roles ur
USING public.users u
WHERE ur.user_id = u.id
  AND lower(u.email) IN (
    'mod.test@omniaglobalacademy.com',
    'prof.test@omniaglobalacademy.com'
  )
  AND ur.role = 'apprenant';

-- Le compte super-admin ne doit jamais être exposé comme apprenant.
DELETE FROM public.user_roles ur
USING public.users u
WHERE ur.user_id = u.id
  AND lower(u.email) = 'kantebemba8@gmail.com'
  AND ur.role <> 'super_admin';

-- Normaliser les comptes tests existants à un seul rôle.
DELETE FROM public.user_roles ur
USING public.users u
WHERE ur.user_id=u.id
  AND lower(u.email)='apprenant.test@omniaglobalacademy.com'
  AND ur.role <> 'apprenant';

DELETE FROM public.user_roles ur
USING public.users u
WHERE ur.user_id=u.id
  AND lower(u.email)='mod.test@omniaglobalacademy.com'
  AND ur.role NOT IN ('moderateur','moderator');

DELETE FROM public.user_roles ur
USING public.users u
WHERE ur.user_id=u.id
  AND lower(u.email)='prof.test@omniaglobalacademy.com'
  AND ur.role <> 'professeur';

INSERT INTO public.user_roles(user_id,role)
SELECT id,'apprenant' FROM public.users
WHERE lower(email)='apprenant.test@omniaglobalacademy.com'
ON CONFLICT(user_id,role) DO NOTHING;

INSERT INTO public.user_roles(user_id,role)
SELECT id,'moderateur' FROM public.users
WHERE lower(email)='mod.test@omniaglobalacademy.com'
ON CONFLICT(user_id,role) DO NOTHING;

INSERT INTO public.user_roles(user_id,role)
SELECT id,'professeur' FROM public.users
WHERE lower(email)='prof.test@omniaglobalacademy.com'
ON CONFLICT(user_id,role) DO NOTHING;

-- Créer les comptes Structure / Organisateur de test uniquement s'ils n'existent pas.
-- Le mot de passe n'est jamais écrit en clair : le hash est copié depuis apprenant.test.
DO $$
DECLARE
  src public.users%ROWTYPE;
  structure_id uuid;
  organizer_id uuid;
BEGIN
  SELECT * INTO src
  FROM public.users
  WHERE lower(email)='apprenant.test@omniaglobalacademy.com'
  LIMIT 1;

  IF src.id IS NOT NULL THEN
    SELECT id INTO structure_id FROM public.users
    WHERE lower(email)='structure.test@omniaglobalacademy.com';

    IF structure_id IS NULL THEN
      INSERT INTO public.users(
        email, phone_number, password_hash, full_name, birth_date, country_code,
        email_status, allow_email, allow_sms, allow_push, subscribe_newsletter,
        status, force_password_change
      ) VALUES (
        'structure.test@omniaglobalacademy.com',
        '+22300009001',
        src.password_hash,
        'Structure Test',
        src.birth_date,
        COALESCE(src.country_code,'ML'),
        'valide', false, false, false, false, 'actif', false
      ) RETURNING id INTO structure_id;
    END IF;

    DELETE FROM public.user_roles WHERE user_id=structure_id;
    INSERT INTO public.user_roles(user_id,role)
    VALUES(structure_id,'responsable_structure')
    ON CONFLICT(user_id,role) DO NOTHING;

    SELECT id INTO organizer_id FROM public.users
    WHERE lower(email)='organisateur.test@omniaglobalacademy.com';

    IF organizer_id IS NULL THEN
      INSERT INTO public.users(
        email, phone_number, password_hash, full_name, birth_date, country_code,
        email_status, allow_email, allow_sms, allow_push, subscribe_newsletter,
        status, force_password_change
      ) VALUES (
        'organisateur.test@omniaglobalacademy.com',
        '+22300009002',
        src.password_hash,
        'Organisateur Test',
        src.birth_date,
        COALESCE(src.country_code,'ML'),
        'valide', false, false, false, false, 'actif', false
      ) RETURNING id INTO organizer_id;
    END IF;

    DELETE FROM public.user_roles WHERE user_id=organizer_id;
    INSERT INTO public.user_roles(user_id,role)
    VALUES(organizer_id,'organisateur')
    ON CONFLICT(user_id,role) DO NOTHING;
  END IF;
END $$;

-- =========================================================
-- B. Signatures et identité institutionnelle
-- =========================================================
ALTER TABLE public.professeur_profiles
  ADD COLUMN IF NOT EXISTS signature_url text;

-- Paramètres clé/valeur pour les certificats.
CREATE TABLE IF NOT EXISTS public.certificate_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Modèles illimités et versionnés.
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  document_type text NOT NULL DEFAULT 'completion_certificate',
  source_type text NOT NULL DEFAULT 'course',
  issuer_scope text NOT NULL DEFAULT 'platform',
  language_code text NOT NULL DEFAULT 'fr',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.certificate_template_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.certificate_templates(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  creator_role text,
  structure_id uuid,
  live_document_type text,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conserver un snapshot immuable de ce qui a été émis.
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'completion_certificate',
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'course',
  ADD COLUMN IF NOT EXISTS language_code text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS issuance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Modèles de base.
INSERT INTO public.certificate_templates(name,code,document_type,source_type,issuer_scope,language_code,is_default,layout_json)
VALUES
('OGA Classique','oga-classic','completion_certificate','course','platform','fr',true,'{"style":"classic"}'),
('Professeur','professor-signature','completion_certificate','course','professeur','fr',false,'{"style":"professor"}'),
('Structure','structure-partner','completion_certificate','course','structure','fr',false,'{"style":"structure"}'),
('Omnia Live — Participation','live-participation','participation_attestation','omnia_live','platform','fr',false,'{"style":"live"}'),
('Omnia Live — Présence','live-attendance','attendance_certificate','omnia_live','platform','fr',false,'{"style":"live"}'),
('Omnia Live — Réussite','live-completion','completion_certificate','omnia_live','platform','fr',false,'{"style":"live"}'),
('Open CPD','open-cpd','cpd_certificate','course','platform','fr',false,'{"style":"cpd"}')
ON CONFLICT(code) DO NOTHING;

-- Valeurs administrables sans code.
INSERT INTO public.certificate_settings(key,value)
VALUES
('certificate_logo_url','/IMG_0349.png'),
('institution_name','Omnia Global Academy'),
('institution_signature_url',''),
('institution_signature_label','Direction académique'),
('certificate_text_fr','pour avoir complété avec succès la formation'),
('certificate_text_en','for successfully completing the course'),
('certificate_text_es','por haber completado con éxito la formación'),
('verification_title_fr','Vérifier un certificat Omnia'),
('verification_title_en','Verify an Omnia certificate'),
('verification_valid_fr','Certificat valide et vérifié'),
('verification_revoked_fr','Certificat révoqué'),
('verification_not_found_fr','Certificat introuvable'),
('show_verification_beneficiary','true'),
('show_verification_course','true'),
('show_verification_issuer','true'),
('show_verification_date','true'),
('show_verification_badges','true')
ON CONFLICT(key) DO NOTHING;

COMMIT;
