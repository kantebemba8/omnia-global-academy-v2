-- 132 — Accueil Omnia, écosystème frontal et terminologie de reconnaissance
--
-- Cette migration ne modifie ni les organismes réels ni les identifiants
-- techniques CPD. Elle généralise uniquement les formulations publiques
-- historiques trop centrées sur un seul standard.
--
-- Exécution : Supabase SQL Editor, après réussite du build Frontend.

BEGIN;

SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '0';

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.site_settings') IS NULL THEN
    v_missing := array_append(v_missing, 'public.site_settings');
  END IF;

  IF to_regclass('public.landing_page_cms_state') IS NULL THEN
    v_missing := array_append(v_missing, 'public.landing_page_cms_state');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'OGA_MIGRATION_132_TABLES_MISSING: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'key'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'value'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'OGA_MIGRATION_132_SITE_SETTINGS_COLUMNS_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_page_cms_state' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_page_cms_state' AND column_name = 'draft'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_page_cms_state' AND column_name = 'previous_published'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_page_cms_state' AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'OGA_MIGRATION_132_LANDING_CMS_COLUMNS_MISSING';
  END IF;

  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'OGA_MIGRATION_132_HISTORY_TABLE_MISSING';
  END IF;
END
$preflight$;

-- Remplacement contrôlé des formulations génériques.
-- Les noms propres tels que « Open CPD » ne figurent pas dans cette liste.
DO $generalize_copy$
DECLARE
  v_from text[] := ARRAY[
    'Formations certifiées CPD',
    'formations certifiées CPD',
    'Certifications CPD',
    'certifications CPD',
    'Certification CPD',
    'certification CPD',
    'Certificats CPD',
    'certificats CPD',
    'Certificat CPD',
    'certificat CPD',
    'Formations CPD',
    'formations CPD',
    'Formation CPD',
    'formation CPD',
    'Certifiées CPD',
    'certifiées CPD',
    'Crédits CPD',
    'crédits CPD',
    'Heures CPD',
    'heures CPD',
    'Badge CPD',
    'badge CPD',
    'Suivi CPD',
    'suivi CPD',
    'Conformité CPD',
    'conformité CPD',
    'CPD applicable à ce parcours',
    'Pertinent CPD',
    'Conforme CPD',
    'CPD et conformité',
    'CPD, accessibles',
    'CPD, accessible',
    'Partenaire CPD',
    'partenaire CPD'
  ];
  v_to text[] := ARRAY[
    'Formations certifiées ou reconnues',
    'formations certifiées ou reconnues',
    'Certifications et reconnaissances professionnelles',
    'certifications et reconnaissances professionnelles',
    'Certification professionnelle',
    'certification professionnelle',
    'Certificats et reconnaissances professionnelles',
    'certificats et reconnaissances professionnelles',
    'Certificat professionnel',
    'certificat professionnel',
    'Formations reconnues',
    'formations reconnues',
    'Formation reconnue',
    'formation reconnue',
    'Certifiées ou reconnues',
    'certifiées ou reconnues',
    'Crédits ou unités de développement professionnel',
    'crédits ou unités de développement professionnel',
    'Heures de développement professionnel',
    'heures de développement professionnel',
    'Badge professionnel',
    'badge professionnel',
    'Suivi des crédits et reconnaissances',
    'suivi des crédits et reconnaissances',
    'Conformité et reconnaissance',
    'conformité et reconnaissance',
    'Reconnaissance applicable à ce parcours',
    'Pertinent pour une reconnaissance externe',
    'Conforme aux exigences de reconnaissance',
    'reconnaissances et conformité',
    'reconnues par différents organismes, accessibles',
    'reconnue par différents organismes, accessible',
    'Organisme certificateur ou partenaire',
    'organisme certificateur ou partenaire'
  ];
  v_row record;
  v_text text;
  v_previous_text text;
  v_index integer;
BEGIN
  IF array_length(v_from, 1) <> array_length(v_to, 1) THEN
    RAISE EXCEPTION 'OGA_MIGRATION_132_REPLACEMENT_ARRAY_MISMATCH';
  END IF;

  FOR v_row IN
    SELECT id, value
    FROM public.site_settings
    WHERE value IS NOT NULL
      AND value::text ~* '(certifications? CPD|certificats? CPD|formations? (certifiées )?CPD|certifiées CPD|crédits CPD|heures CPD|badge CPD|suivi CPD|conformité CPD|CPD applicable à ce parcours|Pertinent CPD|Conforme CPD|CPD et conformité|CPD, accessible|partenaire CPD)'
  LOOP
    v_text := v_row.value::text;

    FOR v_index IN 1..array_length(v_from, 1) LOOP
      v_text := replace(v_text, v_from[v_index], v_to[v_index]);
    END LOOP;

    UPDATE public.site_settings
    SET value = v_text::jsonb,
        updated_at = now()
    WHERE id = v_row.id;
  END LOOP;

  FOR v_row IN
    SELECT id, draft, previous_published
    FROM public.landing_page_cms_state
    WHERE COALESCE(draft::text, '') ~* '(certifications? CPD|certificats? CPD|formations? (certifiées )?CPD|certifiées CPD|crédits CPD|heures CPD|badge CPD|suivi CPD|conformité CPD|CPD applicable à ce parcours|Pertinent CPD|Conforme CPD|CPD et conformité|CPD, accessible|partenaire CPD)'
       OR COALESCE(previous_published::text, '') ~* '(certifications? CPD|certificats? CPD|formations? (certifiées )?CPD|certifiées CPD|crédits CPD|heures CPD|badge CPD|suivi CPD|conformité CPD|CPD applicable à ce parcours|Pertinent CPD|Conforme CPD|CPD et conformité|CPD, accessible|partenaire CPD)'
  LOOP
    v_text := v_row.draft::text;

    FOR v_index IN 1..array_length(v_from, 1) LOOP
      v_text := replace(v_text, v_from[v_index], v_to[v_index]);
    END LOOP;

    IF v_row.previous_published IS NULL THEN
      v_previous_text := NULL;
    ELSE
      v_previous_text := v_row.previous_published::text;

      FOR v_index IN 1..array_length(v_from, 1) LOOP
        v_previous_text := replace(v_previous_text, v_from[v_index], v_to[v_index]);
      END LOOP;
    END IF;

    UPDATE public.landing_page_cms_state
    SET draft = v_text::jsonb,
        previous_published = CASE
          WHEN v_previous_text IS NULL THEN NULL
          ELSE v_previous_text::jsonb
        END,
        updated_at = now()
    WHERE id = v_row.id;
  END LOOP;
END
$generalize_copy$;

INSERT INTO public.site_settings(key, value, updated_at)
VALUES (
  'landing_experience_version',
  jsonb_build_object(
    'version', '3.2',
    'ecosystem_layout', 'front_facing_interactive',
    'hero_layout', 'omnia_nexus',
    'recognition_terminology', 'multi_organization',
    'updated_at', now()
  ),
  now()
)
ON CONFLICT(key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;

-- Enregistrement idempotent dans l'historique des migrations.
-- Cette structure est identique à celle déjà validée pour la migration 131.
DO $oga_migration_history$
DECLARE
  v_version constant text := '20260802014500';
  v_name constant text := '132_landing_experience_recognition_language';
  v_has_name boolean;
  v_has_statements boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations'
      AND table_name = 'schema_migrations'
      AND column_name = 'name'
  ) INTO v_has_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations'
      AND table_name = 'schema_migrations'
      AND column_name = 'statements'
  ) INTO v_has_statements;

  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = v_version
  ) THEN
    IF v_has_name THEN
      EXECUTE
        'UPDATE supabase_migrations.schema_migrations SET name = $1 WHERE version = $2'
      USING v_name, v_version;
    END IF;
  ELSIF v_has_name AND v_has_statements THEN
    EXECUTE
      'INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES ($1, $2, ARRAY[]::text[])'
    USING v_version, v_name;
  ELSIF v_has_name THEN
    EXECUTE
      'INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES ($1, $2)'
    USING v_version, v_name;
  ELSE
    EXECUTE
      'INSERT INTO supabase_migrations.schema_migrations(version) VALUES ($1)'
    USING v_version;
  END IF;
END
$oga_migration_history$;

COMMIT;

-- Résultat attendu : les quatre colonnes ci-dessous doivent être true.
SELECT
  EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE key = 'landing_experience_version'
      AND value->>'version' = '3.2'
      AND value->>'ecosystem_layout' = 'front_facing_interactive'
      AND value->>'hero_layout' = 'omnia_nexus'
      AND value->>'recognition_terminology' = 'multi_organization'
  ) AS landing_experience_ready,
  NOT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE COALESCE(value::text, '') ~* '(certifications? CPD|certificats? CPD|formations? (certifiées )?CPD|certifiées CPD|crédits CPD|heures CPD|badge CPD|suivi CPD|conformité CPD|CPD applicable à ce parcours|Pertinent CPD|Conforme CPD|CPD et conformité|CPD, accessible|partenaire CPD)'
  ) AS published_copy_generalized,
  NOT EXISTS (
    SELECT 1 FROM public.landing_page_cms_state
    WHERE COALESCE(draft::text, '') ~* '(certifications? CPD|certificats? CPD|formations? (certifiées )?CPD|certifiées CPD|crédits CPD|heures CPD|badge CPD|suivi CPD|conformité CPD|CPD applicable à ce parcours|Pertinent CPD|Conforme CPD|CPD et conformité|CPD, accessible|partenaire CPD)'
       OR COALESCE(previous_published::text, '') ~* '(certifications? CPD|certificats? CPD|formations? (certifiées )?CPD|certifiées CPD|crédits CPD|heures CPD|badge CPD|suivi CPD|conformité CPD|CPD applicable à ce parcours|Pertinent CPD|Conforme CPD|CPD et conformité|CPD, accessible|partenaire CPD)'
  ) AS cms_copy_generalized,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20260802014500'
  ) AS migration_history_aligned;
