-- Omnia Global Academy — Étape 2 complément
-- Gouvernance avancée des modèles Premium et des jetons Career.
--
-- Principes :
-- 1) Tous les modèles CV/LM existants repartent accessibles.
-- 2) Le Super-admin peut marquer n'importe quel modèle actuel ou futur comme Premium.
-- 3) Tous les soldes et toutes les anciennes règles automatiques repartent à zéro.
-- 4) Les gains et dépenses sont pilotés par un catalogue unique, désactivé et à zéro par défaut.
-- 5) Les débits sont atomiques et les gains respectent fréquence, plafonds, validation et idempotence.
-- 6) Aucune vente de packs de jetons n'est activée.

BEGIN;


SET lock_timeout = '15s';
SET statement_timeout = '0';

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    v_missing := array_append(v_missing, 'public.users');
  END IF;
  IF to_regclass('public.user_roles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_roles');
  END IF;
  IF to_regclass('public.user_sessions') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_sessions');
  END IF;
  IF to_regclass('public.career_templates') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_templates');
  END IF;
  IF to_regclass('public.career_admin_rules') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_admin_rules');
  END IF;
  IF to_regclass('public.career_token_config') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_token_config');
  END IF;
  IF to_regclass('public.career_token_transactions') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_token_transactions');
  END IF;
  IF to_regclass('public.career_token_packs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_token_packs');
  END IF;
  IF to_regclass('public.career_documents') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_documents');
  END IF;
  IF to_regclass('public.career_export_logs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.career_export_logs');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'OGA_MIGRATION_129_TABLES_MANQUANTES: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='cv_tokens'
  ) THEN
    RAISE EXCEPTION 'OGA_MIGRATION_129_COLONNE_MANQUANTE: public.users.cv_tokens';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='career_templates' AND column_name='is_free'
  ) THEN
    RAISE EXCEPTION 'OGA_MIGRATION_129_COLONNE_MANQUANTE: public.career_templates.is_free';
  END IF;
END
$preflight$;


-- ---------------------------------------------------------------------------
-- 1. Catalogue avancé des règles de jetons
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.career_token_config
  ADD COLUMN IF NOT EXISTS label_fr text,
  ADD COLUMN IF NOT EXISTS rule_type text NOT NULL DEFAULT 'spend',
  ADD COLUMN IF NOT EXISTS repeat_policy text NOT NULL DEFAULT 'unlimited',
  ADD COLUMN IF NOT EXISTS max_per_day integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_per_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_per_lifetime integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cooldown_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_uses_per_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_validation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligible_role text NOT NULL DEFAULT 'apprenant',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.career_token_config
  DROP CONSTRAINT IF EXISTS career_token_config_rule_type_check,
  DROP CONSTRAINT IF EXISTS career_token_config_repeat_policy_check;

ALTER TABLE IF EXISTS public.career_token_config
  ADD CONSTRAINT career_token_config_rule_type_check
    CHECK (rule_type IN ('earn', 'spend')),
  ADD CONSTRAINT career_token_config_repeat_policy_check
    CHECK (repeat_policy IN ('once', 'per_reference', 'unlimited', 'daily', 'weekly', 'monthly'));

CREATE INDEX IF NOT EXISTS idx_career_token_config_type_active
  ON public.career_token_config(rule_type, is_active, display_order);

ALTER TABLE IF EXISTS public.career_token_transactions
  ADD COLUMN IF NOT EXISTS rule_key text,
  ADD COLUMN IF NOT EXISTS reference_key text,
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_career_token_transactions_request
  ON public.career_token_transactions(user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_career_token_transactions_rule
  ON public.career_token_transactions(user_id, rule_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_career_token_transactions_reference
  ON public.career_token_transactions(user_id, rule_key, reference_key)
  WHERE reference_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Archivage puis remise à zéro du système existant
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.career_token_reset_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_key text UNIQUE NOT NULL,
  reset_reason text NOT NULL,
  previous_total_balance numeric NOT NULL DEFAULT 0,
  affected_users integer NOT NULL DEFAULT 0,
  archived_transactions integer NOT NULL DEFAULT 0,
  transaction_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_token_reset_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.career_token_reset_archives FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.career_token_reset_archives TO service_role;

DO $$
DECLARE
  v_balance numeric := 0;
  v_users integer := 0;
  v_transactions integer := 0;
  v_snapshot jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.career_token_reset_archives
    WHERE reset_key = 'career_tokens_reset_20260801'
  ) THEN
    SELECT COALESCE(SUM(COALESCE(cv_tokens, 0)), 0), COUNT(*)
    INTO v_balance, v_users
    FROM public.users;

    IF to_regclass('public.career_token_transactions') IS NOT NULL THEN
      SELECT COUNT(*)
      INTO v_transactions
      FROM public.career_token_transactions;

      -- L'historique détaillé reste dans les sauvegardes Supabase.
      -- On évite de regrouper toutes les écritures dans une seule valeur JSONB.
      v_snapshot := '[]'::jsonb;
    END IF;

    INSERT INTO public.career_token_reset_archives(
      reset_key,
      reset_reason,
      previous_total_balance,
      affected_users,
      archived_transactions,
      transaction_snapshot
    )
    VALUES (
      'career_tokens_reset_20260801',
      'Réinitialisation demandée avant activation des règles avancées Career.',
      v_balance,
      v_users,
      v_transactions,
      v_snapshot
    );
  END IF;
END $$;

UPDATE public.users
SET cv_tokens = 0,
    updated_at = now()
WHERE COALESCE(cv_tokens, 0) <> 0;

DELETE FROM public.career_token_transactions;
DELETE FROM public.career_token_packs;
DELETE FROM public.career_token_config;

-- Retire les anciens avantages de jetons intégrés aux codes Structure/Partenaire.
-- Ces tables peuvent être absentes sur une installation plus ancienne : la migration reste sûre.
DO $$
BEGIN
  IF to_regclass('public.partner_codes') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'partner_codes' AND column_name = 'advantages'
     ) THEN
    EXECUTE $sql$
      UPDATE public.partner_codes
      SET advantages = COALESCE(advantages, '{}'::jsonb) - 'cv_tokens'
      WHERE COALESCE(advantages, '{}'::jsonb) ? 'cv_tokens'
    $sql$;
  END IF;

  IF to_regclass('public.partner_code_users') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'partner_code_users' AND column_name = 'advantages_remaining'
     ) THEN
    EXECUTE $sql$
      UPDATE public.partner_code_users
      SET advantages_remaining = COALESCE(advantages_remaining, '{}'::jsonb) - 'cv_tokens'
      WHERE COALESCE(advantages_remaining, '{}'::jsonb) ? 'cv_tokens'
    $sql$;
  END IF;
END $$;

-- Les anciennes commandes de packs non finalisées sont neutralisées.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET payment_status = 'cancelled'
      WHERE order_type = 'cv_tokens'
        AND LOWER(COALESCE(payment_status, 'pending')) NOT IN ('completed', 'paid', 'success')
    $sql$;
  END IF;
END $$;

DELETE FROM public.career_admin_rules
WHERE rule_key IN (
  'certificate_token_reward',
  'token_sales_enabled',
  'pdf_export_cost'
);

INSERT INTO public.career_admin_rules(
  rule_key,
  group_key,
  label_fr,
  description_fr,
  value_type,
  value_json,
  is_active,
  display_order,
  updated_at
)
VALUES
  (
    'career_token_earning_enabled',
    'tokens',
    'Gains de jetons activés',
    'Interrupteur général des crédits automatiques. Chaque méthode doit aussi être activée individuellement.',
    'boolean',
    '{"value":false}'::jsonb,
    true,
    10,
    now()
  ),
  (
    'career_token_spending_enabled',
    'tokens',
    'Dépenses de jetons activées',
    'Interrupteur général des coûts. Chaque action doit aussi être activée individuellement.',
    'boolean',
    '{"value":false}'::jsonb,
    true,
    20,
    now()
  ),
  (
    'career_premium_templates_enabled',
    'premium',
    'Accès Premium aux modèles activé',
    'Lorsqu’il est désactivé, tous les modèles restent accessibles même s’ils sont préparés comme Premium.',
    'boolean',
    '{"value":false}'::jsonb,
    true,
    10,
    now()
  )
ON CONFLICT (rule_key) DO UPDATE SET
  label_fr = EXCLUDED.label_fr,
  description_fr = EXCLUDED.description_fr,
  value_type = EXCLUDED.value_type,
  value_json = EXCLUDED.value_json,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Méthodes de gain : toutes désactivées et à zéro
-- ---------------------------------------------------------------------------

INSERT INTO public.career_token_config(
  config_key,
  label_fr,
  config_value,
  description_fr,
  config_group,
  rule_type,
  repeat_policy,
  min_value,
  max_value,
  value_unit,
  display_order,
  max_per_day,
  max_per_month,
  max_per_lifetime,
  cooldown_hours,
  free_uses_per_month,
  requires_validation,
  eligible_role,
  metadata,
  is_active,
  updated_at
)
VALUES
  ('earn_account_created', 'Création du compte', 0, 'Crédit lors de la création d’un nouveau compte apprenant.', 'earn', 'earn', 'once', 0, 10000, 'jeton(s)', 10, 0, 0, 1, 0, 0, false, 'apprenant', '{"trigger":"users.insert"}'::jsonb, false, now()),
  ('earn_profile_completed', 'Profil Career complété', 0, 'Crédit unique lorsque le profil atteint le niveau de complétude exigé.', 'earn', 'earn', 'once', 0, 10000, 'jeton(s)', 20, 0, 0, 1, 0, 0, false, 'apprenant', '{"trigger":"users.profile_completion"}'::jsonb, false, now()),
  ('earn_first_cv_created', 'Premier CV créé', 0, 'Crédit unique lors de l’enregistrement du premier CV.', 'earn', 'earn', 'once', 0, 10000, 'jeton(s)', 30, 0, 0, 1, 0, 0, false, 'apprenant', '{"trigger":"career_documents.cv"}'::jsonb, false, now()),
  ('earn_first_lm_created', 'Première lettre créée', 0, 'Crédit unique lors de l’enregistrement de la première lettre de motivation.', 'earn', 'earn', 'once', 0, 10000, 'jeton(s)', 40, 0, 0, 1, 0, 0, false, 'apprenant', '{"trigger":"career_documents.lm"}'::jsonb, false, now()),
  ('earn_course_purchase_confirmed', 'Achat de formation confirmé', 0, 'Crédit par achat de formation effectivement payé.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 50, 0, 0, 0, 0, 0, false, 'apprenant', '{"trigger":"orders.paid"}'::jsonb, false, now()),
  ('earn_course_completed', 'Formation terminée', 0, 'Crédit par formation entièrement terminée.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 60, 0, 0, 0, 0, 0, false, 'apprenant', '{"trigger":"user_enrollments.completed"}'::jsonb, false, now()),
  ('earn_certificate_earned', 'Certificat obtenu', 0, 'Crédit par certificat valide émis sur la plateforme.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 70, 0, 0, 0, 0, 0, false, 'apprenant', '{"trigger":"certificates.insert"}'::jsonb, false, now()),
  ('earn_badge_earned', 'Badge vérifié obtenu', 0, 'Crédit par badge attribué et non révoqué.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 80, 0, 0, 0, 0, 0, false, 'apprenant', '{"trigger":"badge_awards.awarded"}'::jsonb, false, now()),
  ('earn_application_submitted', 'Candidature envoyée', 0, 'Crédit par candidature Omnia réellement soumise.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 90, 0, 0, 0, 0, 0, false, 'apprenant', '{"trigger":"job_applications.insert"}'::jsonb, false, now()),
  ('earn_referral_validated', 'Parrainage validé', 0, 'Crédit lorsque le parrainage est validé selon les règles de la plateforme.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 100, 0, 0, 0, 0, 0, true, 'apprenant', '{"trigger":"referrals.validated"}'::jsonb, false, now()),
  ('earn_project_completed', 'Projet ou challenge terminé', 0, 'Crédit après validation d’un projet, challenge ou mission.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 110, 0, 0, 0, 0, 0, true, 'apprenant', '{"trigger":"omnia_projects.completed"}'::jsonb, false, now()),
  ('earn_admin_bonus', 'Bonus manuel Super-admin', 0, 'Crédit manuel exceptionnel avec motif obligatoire et traçabilité.', 'earn', 'earn', 'unlimited', 0, 10000, 'jeton(s)', 120, 0, 0, 0, 0, 0, true, 'apprenant', '{"trigger":"admin.manual"}'::jsonb, false, now()),
  ('earn_structure_campaign', 'Campagne d’une structure', 0, 'Crédit attribué dans une campagne validée par le Super-admin.', 'earn', 'earn', 'per_reference', 0, 10000, 'jeton(s)', 130, 0, 0, 0, 0, 0, true, 'apprenant', '{"trigger":"structure.campaign"}'::jsonb, false, now());

-- ---------------------------------------------------------------------------
-- 4. Actions payantes : toutes désactivées et à zéro
-- ---------------------------------------------------------------------------

INSERT INTO public.career_token_config(
  config_key,
  label_fr,
  config_value,
  description_fr,
  config_group,
  rule_type,
  repeat_policy,
  min_value,
  max_value,
  value_unit,
  display_order,
  max_per_day,
  max_per_month,
  max_per_lifetime,
  cooldown_hours,
  free_uses_per_month,
  requires_validation,
  eligible_role,
  metadata,
  is_active,
  updated_at
)
VALUES
  ('spend_pdf_cv', 'Télécharger un CV en PDF', 0, 'Coût d’un export PDF de CV. Un réexport inchangé reste gratuit.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 210, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"pdf_cv"}'::jsonb, false, now()),
  ('spend_pdf_lm', 'Télécharger une LM en PDF', 0, 'Coût d’un export PDF de lettre de motivation. Un réexport inchangé reste gratuit.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 220, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"pdf_lm"}'::jsonb, false, now()),
  ('spend_docx_cv', 'Télécharger un CV en DOCX', 0, 'Coût d’un export Word de CV.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 230, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"docx_cv"}'::jsonb, false, now()),
  ('spend_docx_lm', 'Télécharger une LM en DOCX', 0, 'Coût d’un export Word de lettre de motivation.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 240, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"docx_lm"}'::jsonb, false, now()),
  ('spend_ai_cv', 'Amélioration IA du CV', 0, 'Coût d’une reformulation ou suggestion IA appliquée au CV.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 250, 0, 0, 0, 0, 0, false, 'apprenant', '{"actions":["improve_summary","fix_grammar","shorten_text","make_professional","rewrite_experience","improve_project","suggest_title","suggest_skills","generate_cv"]}'::jsonb, false, now()),
  ('spend_ai_lm', 'Génération ou amélioration IA de LM', 0, 'Coût d’une génération ou reformulation IA de lettre.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 260, 0, 0, 0, 0, 0, false, 'apprenant', '{"actions":["generate_lm","generate_cv_lm"]}'::jsonb, false, now()),
  ('spend_adapt_offer', 'Adapter à une offre', 0, 'Coût de l’analyse d’une offre et de l’adaptation du CV/LM.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 270, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"adapt_to_offer"}'::jsonb, false, now()),
  ('spend_ats_analysis', 'Analyse ATS complète', 0, 'Coût d’un diagnostic ATS complet.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 280, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"ats_score"}'::jsonb, false, now()),
  ('spend_translation', 'Traduction CV ou LM', 0, 'Coût d’une traduction assistée.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 290, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"translate"}'::jsonb, false, now()),
  ('spend_premium_template', 'Utiliser un modèle Premium', 0, 'Coût d’activation d’un modèle marqué Premium par le Super-admin.', 'spend', 'spend', 'per_reference', 0, 10000, 'jeton(s)', 300, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"premium_template"}'::jsonb, false, now()),
  ('spend_interview_simulation', 'Simulation d’entretien', 0, 'Coût d’une simulation complète avec analyse.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 310, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"interview_simulation"}'::jsonb, false, now()),
  ('spend_private_share', 'Créer un lien privé', 0, 'Coût de création d’un lien privé avec expiration.', 'spend', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 320, 0, 0, 0, 0, 0, false, 'apprenant', '{"action":"private_share"}'::jsonb, false, now());

-- Clés de compatibilité utilisées par l'ancienne Edge Function Career.
-- Elles restent cachées dans le CMS et valent zéro lorsque la règle moderne est inactive.
INSERT INTO public.career_token_config(
  config_key, label_fr, config_value, description_fr, config_group, rule_type,
  repeat_policy, min_value, max_value, value_unit, display_order, is_active, metadata, updated_at
)
VALUES
  ('cout_cv_ia', 'Compatibilité IA CV', 0, 'Alias interne de spend_ai_cv.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 900, true, '{"hidden":true,"source_rule":"spend_ai_cv"}'::jsonb, now()),
  ('cout_lm_ia', 'Compatibilité IA LM', 0, 'Alias interne de spend_ai_lm.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 901, true, '{"hidden":true,"source_rule":"spend_ai_lm"}'::jsonb, now()),
  ('cout_cv_lm_ia', 'Compatibilité IA CV + LM', 0, 'Alias interne de spend_ai_lm.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 902, true, '{"hidden":true,"source_rule":"spend_ai_lm"}'::jsonb, now()),
  ('cout_adapter_offre', 'Compatibilité adaptation offre', 0, 'Alias interne de spend_adapt_offer.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 903, true, '{"hidden":true,"source_rule":"spend_adapt_offer"}'::jsonb, now()),
  ('cout_pack_candidature', 'Compatibilité dossier candidature', 0, 'Alias interne désactivé.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 904, true, '{"hidden":true}'::jsonb, now()),
  ('cout_traduction', 'Compatibilité traduction', 0, 'Alias interne de spend_translation.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 905, true, '{"hidden":true,"source_rule":"spend_translation"}'::jsonb, now()),
  ('cout_ats_score', 'Compatibilité ATS', 0, 'Alias interne de spend_ats_analysis.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 906, true, '{"hidden":true,"source_rule":"spend_ats_analysis"}'::jsonb, now()),
  ('cout_pdf_cv', 'Compatibilité PDF CV', 0, 'Alias interne de spend_pdf_cv.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 907, true, '{"hidden":true,"source_rule":"spend_pdf_cv"}'::jsonb, now()),
  ('cout_pdf_lm', 'Compatibilité PDF LM', 0, 'Alias interne de spend_pdf_lm.', 'compatibility', 'spend', 'unlimited', 0, 10000, 'jeton(s)', 908, true, '{"hidden":true,"source_rule":"spend_pdf_lm"}'::jsonb, now());

CREATE OR REPLACE FUNCTION public.career_sync_legacy_token_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias text;
  v_value numeric;
  v_spending_enabled boolean := false;
BEGIN
  SELECT COALESCE((value_json->>'value')::boolean, false)
  INTO v_spending_enabled
  FROM public.career_admin_rules
  WHERE rule_key = 'career_token_spending_enabled'
  LIMIT 1;

  v_value := CASE
    WHEN COALESCE(v_spending_enabled, false) AND COALESCE(NEW.is_active, false)
      THEN GREATEST(0, COALESCE(NEW.config_value, 0))
    ELSE 0
  END;

  FOR v_alias IN
    SELECT alias_key
    FROM (
      VALUES
        ('spend_ai_cv', 'cout_cv_ia'),
        ('spend_ai_lm', 'cout_lm_ia'),
        ('spend_ai_lm', 'cout_cv_lm_ia'),
        ('spend_adapt_offer', 'cout_adapter_offre'),
        ('spend_translation', 'cout_traduction'),
        ('spend_ats_analysis', 'cout_ats_score'),
        ('spend_pdf_cv', 'cout_pdf_cv'),
        ('spend_pdf_lm', 'cout_pdf_lm')
    ) AS mapping(source_key, alias_key)
    WHERE source_key = NEW.config_key
  LOOP
    UPDATE public.career_token_config
    SET config_value = v_value,
        is_active = true,
        updated_at = now()
    WHERE config_key = v_alias;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_sync_legacy_token_aliases ON public.career_token_config;
CREATE TRIGGER trg_career_sync_legacy_token_aliases
AFTER INSERT OR UPDATE OF config_value, is_active
ON public.career_token_config
FOR EACH ROW
WHEN (NEW.rule_type = 'spend')
EXECUTE FUNCTION public.career_sync_legacy_token_aliases();

CREATE OR REPLACE FUNCTION public.career_resync_legacy_aliases_on_global_switch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rule_key = 'career_token_spending_enabled' THEN
    UPDATE public.career_token_config
    SET config_value = config_value
    WHERE config_key IN (
      'spend_ai_cv', 'spend_ai_lm', 'spend_adapt_offer', 'spend_translation',
      'spend_ats_analysis', 'spend_pdf_cv', 'spend_pdf_lm'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_resync_aliases_global ON public.career_admin_rules;
CREATE TRIGGER trg_career_resync_aliases_global
AFTER INSERT OR UPDATE OF value_json
ON public.career_admin_rules
FOR EACH ROW
WHEN (NEW.rule_key = 'career_token_spending_enabled')
EXECUTE FUNCTION public.career_resync_legacy_aliases_on_global_switch();

-- Synchronisation initiale des alias.
UPDATE public.career_token_config source
SET config_value = config_value
WHERE source.config_key IN (
  'spend_ai_cv', 'spend_ai_lm', 'spend_adapt_offer', 'spend_translation',
  'spend_ats_analysis', 'spend_pdf_cv', 'spend_pdf_lm'
);

-- ---------------------------------------------------------------------------
-- 5. Tous les modèles existants deviennent accessibles
-- ---------------------------------------------------------------------------

UPDATE public.career_templates
SET is_free = true,
    updated_at = now();

-- Le catalogue actif est lisible publiquement, sans exposer d'information utilisateur.
ALTER TABLE public.career_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_templates_public_active_read ON public.career_templates;
CREATE POLICY career_templates_public_active_read
  ON public.career_templates
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON public.career_templates TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Moteur atomique commun de gain/dépense
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.career_apply_token_rule(
  p_user_id uuid,
  p_rule_key text,
  p_reference_key text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.career_token_config%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_delta integer := 0;
  v_amount integer := 0;
  v_balance integer := 0;
  v_count integer := 0;
  v_period_start timestamptz;
  v_global_enabled boolean := false;
  v_premium_enabled boolean := false;
  v_existing public.career_token_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR NULLIF(trim(p_rule_key), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_FIELDS');
  END IF;

  -- Sérialise les appels concurrents pour un même utilisateur et une même règle.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws('|', p_user_id::text, p_rule_key, COALESCE(p_reference_key, ''), COALESCE(p_request_id::text, '')),
      0
    )
  );

  SELECT *
  INTO v_rule
  FROM public.career_token_config
  WHERE config_key = p_rule_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'RULE_NOT_FOUND');
  END IF;

  SELECT COALESCE((value_json->>'value')::boolean, false)
  INTO v_global_enabled
  FROM public.career_admin_rules
  WHERE rule_key = CASE
    WHEN v_rule.rule_type = 'earn' THEN 'career_token_earning_enabled'
    ELSE 'career_token_spending_enabled'
  END
  LIMIT 1;

  IF p_rule_key = 'spend_premium_template' THEN
    SELECT COALESCE((value_json->>'value')::boolean, false)
    INTO v_premium_enabled
    FROM public.career_admin_rules
    WHERE rule_key = 'career_premium_templates_enabled'
    LIMIT 1;
  ELSE
    v_premium_enabled := true;
  END IF;

  v_amount := GREATEST(0, FLOOR(COALESCE(v_rule.config_value, 0))::integer);

  IF NOT COALESCE(v_rule.is_active, false)
     OR v_amount = 0
     OR NOT COALESCE(v_global_enabled, false)
     OR NOT COALESCE(v_premium_enabled, false) THEN
    RETURN jsonb_build_object(
      'success', true,
      'applied', false,
      'rule_key', p_rule_key,
      'amount', 0,
      'message', 'Règle gratuite ou désactivée.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = COALESCE(NULLIF(v_rule.eligible_role, ''), 'apprenant')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_ELIGIBLE');
  END IF;

  IF p_request_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.career_token_transactions
    WHERE user_id = p_user_id
      AND request_id = p_request_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'applied', true,
        'idempotent', true,
        'rule_key', p_rule_key,
        'amount', ABS(COALESCE(v_existing.amount, 0)),
        'tokens_remaining', COALESCE(v_existing.balance_after, 0)
      );
    END IF;
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
    AND COALESCE(status, '') = 'actif'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_ACTIVE');
  END IF;

  IF v_rule.rule_type = 'earn' THEN
    IF COALESCE(v_rule.requires_validation, false)
       AND COALESCE((p_metadata->>'validated')::boolean, false) = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_REQUIRED');
    END IF;

    IF v_rule.repeat_policy = 'once' AND EXISTS (
      SELECT 1
      FROM public.career_token_transactions
      WHERE user_id = p_user_id
        AND rule_key = p_rule_key
        AND amount > 0
    ) THEN
      RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'ALREADY_GRANTED');
    END IF;

    IF v_rule.repeat_policy = 'per_reference' THEN
      IF NULLIF(trim(COALESCE(p_reference_key, '')), '') IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'REFERENCE_REQUIRED');
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.career_token_transactions
        WHERE user_id = p_user_id
          AND rule_key = p_rule_key
          AND reference_key = p_reference_key
          AND amount > 0
      ) THEN
        RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'REFERENCE_ALREADY_REWARDED');
      END IF;
    END IF;

    IF v_rule.repeat_policy IN ('daily', 'weekly', 'monthly') THEN
      v_period_start := CASE v_rule.repeat_policy
        WHEN 'daily' THEN date_trunc('day', now())
        WHEN 'weekly' THEN date_trunc('week', now())
        ELSE date_trunc('month', now())
      END;

      IF EXISTS (
        SELECT 1
        FROM public.career_token_transactions
        WHERE user_id = p_user_id
          AND rule_key = p_rule_key
          AND amount > 0
          AND created_at >= v_period_start
      ) THEN
        RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'PERIOD_LIMIT_REACHED');
      END IF;
    END IF;

    IF COALESCE(v_rule.cooldown_hours, 0) > 0 AND EXISTS (
      SELECT 1
      FROM public.career_token_transactions
      WHERE user_id = p_user_id
        AND rule_key = p_rule_key
        AND amount > 0
        AND created_at > now() - make_interval(hours => v_rule.cooldown_hours)
    ) THEN
      RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'COOLDOWN_ACTIVE');
    END IF;

    IF COALESCE(v_rule.max_per_day, 0) > 0 THEN
      SELECT COUNT(*)
      INTO v_count
      FROM public.career_token_transactions
      WHERE user_id = p_user_id
        AND rule_key = p_rule_key
        AND amount > 0
        AND created_at >= date_trunc('day', now());

      IF v_count >= v_rule.max_per_day THEN
        RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'DAILY_CAP_REACHED');
      END IF;
    END IF;

    IF COALESCE(v_rule.max_per_month, 0) > 0 THEN
      SELECT COUNT(*)
      INTO v_count
      FROM public.career_token_transactions
      WHERE user_id = p_user_id
        AND rule_key = p_rule_key
        AND amount > 0
        AND created_at >= date_trunc('month', now());

      IF v_count >= v_rule.max_per_month THEN
        RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'MONTHLY_CAP_REACHED');
      END IF;
    END IF;

    IF COALESCE(v_rule.max_per_lifetime, 0) > 0 THEN
      SELECT COUNT(*)
      INTO v_count
      FROM public.career_token_transactions
      WHERE user_id = p_user_id
        AND rule_key = p_rule_key
        AND amount > 0;

      IF v_count >= v_rule.max_per_lifetime THEN
        RETURN jsonb_build_object('success', true, 'applied', false, 'reason', 'LIFETIME_CAP_REACHED');
      END IF;
    END IF;

    v_delta := v_amount;
  ELSE
    IF v_rule.repeat_policy = 'per_reference'
       AND NULLIF(trim(COALESCE(p_reference_key, '')), '') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.career_token_transactions
         WHERE user_id = p_user_id
           AND rule_key = p_rule_key
           AND reference_key = p_reference_key
           AND transaction_type = 'debit'
       ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'applied', false,
        'already_unlocked', true,
        'amount', 0,
        'tokens_remaining', COALESCE(v_user.cv_tokens, 0)
      );
    END IF;

    IF COALESCE(v_rule.free_uses_per_month, 0) > 0 THEN
      SELECT COUNT(*)
      INTO v_count
      FROM public.career_token_transactions
      WHERE user_id = p_user_id
        AND rule_key = p_rule_key
        AND transaction_type = 'debit'
        AND created_at >= date_trunc('month', now());

      IF v_count < v_rule.free_uses_per_month THEN
        v_balance := COALESCE(v_user.cv_tokens, 0);

        INSERT INTO public.career_token_transactions(
          user_id,
          transaction_type,
          amount,
          balance_after,
          reason,
          rule_key,
          reference_key,
          reference_type,
          request_id,
          metadata
        )
        VALUES (
          p_user_id,
          'debit',
          0,
          v_balance,
          p_rule_key,
          p_rule_key,
          NULLIF(trim(COALESCE(p_reference_key, '')), ''),
          'career_free_use',
          p_request_id,
          COALESCE(p_metadata, '{}'::jsonb)
        );

        RETURN jsonb_build_object(
          'success', true,
          'applied', false,
          'free_use', true,
          'amount', 0,
          'tokens_remaining', v_balance,
          'remaining_free_uses', v_rule.free_uses_per_month - v_count - 1
        );
      END IF;
    END IF;

    IF COALESCE(v_user.cv_tokens, 0) < v_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_TOKENS',
        'tokens_required', v_amount,
        'tokens_available', COALESCE(v_user.cv_tokens, 0)
      );
    END IF;

    v_delta := -v_amount;
  END IF;

  v_balance := GREATEST(0, COALESCE(v_user.cv_tokens, 0) + v_delta);

  UPDATE public.users
  SET cv_tokens = v_balance,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.career_token_transactions(
    user_id,
    transaction_type,
    amount,
    balance_after,
    reason,
    rule_key,
    reference_key,
    reference_type,
    request_id,
    metadata
  )
  VALUES (
    p_user_id,
    CASE WHEN v_delta > 0 THEN 'credit' ELSE 'debit' END,
    v_delta,
    v_balance,
    p_rule_key,
    p_rule_key,
    NULLIF(trim(COALESCE(p_reference_key, '')), ''),
    CASE WHEN v_delta > 0 THEN 'career_reward_rule' ELSE 'career_spend_rule' END,
    p_request_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'applied', true,
    'rule_key', p_rule_key,
    'amount', ABS(v_delta),
    'delta', v_delta,
    'tokens_remaining', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.career_apply_token_rule(uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.career_apply_token_rule(uuid, text, text, uuid, jsonb)
  TO service_role;

-- Débit sécurisé appelé depuis le Frontend avec la session opaque Omnia.
CREATE OR REPLACE FUNCTION public.career_consume_token_action(
  p_session_token text,
  p_rule_key text,
  p_reference_key text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_rule_type text;
BEGIN
  SELECT s.user_id
  INTO v_user_id
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
    AND u.status = 'actif'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_INVALID');
  END IF;

  SELECT rule_type
  INTO v_rule_type
  FROM public.career_token_config
  WHERE config_key = p_rule_key
  LIMIT 1;

  IF v_rule_type IS DISTINCT FROM 'spend' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SPEND_RULE_REQUIRED');
  END IF;

  RETURN public.career_apply_token_rule(
    v_user_id,
    p_rule_key,
    p_reference_key,
    p_request_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.career_consume_token_action(text, text, text, uuid, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.career_consume_token_action(text, text, text, uuid, jsonb)
  TO anon, authenticated;

-- Catalogue public, sans données personnelles.
CREATE OR REPLACE FUNCTION public.career_public_token_policy()
RETURNS TABLE(
  config_key text,
  label_fr text,
  description_fr text,
  rule_type text,
  config_value numeric,
  repeat_policy text,
  free_uses_per_month integer,
  is_active boolean,
  global_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH switches AS (
    SELECT
      COALESCE(bool_or((value_json->>'value')::boolean) FILTER (WHERE rule_key = 'career_token_earning_enabled'), false) AS earning_enabled,
      COALESCE(bool_or((value_json->>'value')::boolean) FILTER (WHERE rule_key = 'career_token_spending_enabled'), false) AS spending_enabled,
      COALESCE(bool_or((value_json->>'value')::boolean) FILTER (WHERE rule_key = 'career_premium_templates_enabled'), false) AS premium_enabled
    FROM public.career_admin_rules
  )
  SELECT
    c.config_key,
    COALESCE(c.label_fr, c.description_fr, c.config_key),
    c.description_fr,
    c.rule_type,
    c.config_value,
    c.repeat_policy,
    c.free_uses_per_month,
    c.is_active,
    CASE
      WHEN c.rule_type = 'earn' THEN switches.earning_enabled
      WHEN c.config_key = 'spend_premium_template' THEN switches.spending_enabled AND switches.premium_enabled
      ELSE switches.spending_enabled
    END AS global_enabled
  FROM public.career_token_config c
  CROSS JOIN switches
  WHERE COALESCE((c.metadata->>'hidden')::boolean, false) = false
  ORDER BY c.rule_type, c.display_order, c.config_key;
$$;

REVOKE ALL ON FUNCTION public.career_public_token_policy()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.career_public_token_policy()
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Attribution automatique des méthodes activées
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.career_reward_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text := TG_ARGV[0];
  v_rule text := TG_ARGV[1];
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_user_id uuid;
  v_reference text;
  v_should_apply boolean := false;
BEGIN
  IF v_mode = 'account_created' THEN
    v_user_id := (v_new->>'user_id')::uuid;
    v_reference := v_new->>'user_id';
    v_should_apply := LOWER(COALESCE(v_new->>'role', '')) = 'apprenant';

  ELSIF v_mode = 'profile_completed' THEN
    v_user_id := (v_new->>'id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply :=
      COALESCE(NULLIF(v_new->>'profile_completion', '')::numeric, 0) >= 100
      AND COALESCE(NULLIF(v_old->>'profile_completion', '')::numeric, 0) < 100;

  ELSIF v_mode = 'document_created' THEN
    v_user_id := (v_new->>'user_id')::uuid;
    v_reference := v_new->>'id';
    v_rule := CASE WHEN v_new->>'doc_type' = 'lm' THEN 'earn_first_lm_created' ELSE 'earn_first_cv_created' END;
    v_should_apply := (v_new->>'doc_type') IN ('cv', 'lm');

  ELSIF v_mode = 'order_paid' THEN
    v_user_id := (v_new->>'user_id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply :=
      LOWER(COALESCE(v_new->>'payment_status', '')) IN ('paid', 'completed', 'success')
      AND LOWER(COALESCE(v_old->>'payment_status', '')) NOT IN ('paid', 'completed', 'success')
      AND COALESCE(v_new->>'course_id', '') <> '';

  ELSIF v_mode = 'course_completed' THEN
    v_user_id := (v_new->>'user_id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply :=
      COALESCE(v_new->>'completed_at', '') <> ''
      AND COALESCE(v_old->>'completed_at', '') = '';

  ELSIF v_mode = 'certificate_earned' THEN
    v_user_id := (v_new->>'user_id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply := LOWER(COALESCE(v_new->>'status', 'valide')) = 'valide';

  ELSIF v_mode = 'badge_earned' THEN
    v_user_id := (v_new->>'recipient_user_id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply :=
      LOWER(COALESCE(v_new->>'status', '')) = 'awarded'
      AND LOWER(COALESCE(v_old->>'status', '')) <> 'awarded';

  ELSIF v_mode = 'application_submitted' THEN
    v_user_id := (v_new->>'applicant_id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply := LOWER(COALESCE(v_new->>'status', 'submitted')) IN ('submitted', 'received');

  ELSIF v_mode = 'referral_validated' THEN
    v_user_id := (v_new->>'referrer_id')::uuid;
    v_reference := v_new->>'id';
    v_should_apply :=
      (
        COALESCE(v_new->>'rewarded_at', '') <> ''
        AND COALESCE(v_old->>'rewarded_at', '') = ''
      )
      OR (
        LOWER(COALESCE(v_new->>'status', '')) IN ('validated', 'completed', 'rewarded')
        AND LOWER(COALESCE(v_old->>'status', '')) NOT IN ('validated', 'completed', 'rewarded')
      );
  END IF;

  IF v_should_apply AND v_user_id IS NOT NULL THEN
    PERFORM public.career_apply_token_rule(
      v_user_id,
      v_rule,
      v_reference,
      gen_random_uuid(),
      jsonb_build_object('validated', true, 'source_table', TG_TABLE_NAME)
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_account_created ON public.user_roles';
    EXECUTE 'CREATE TRIGGER trg_career_reward_account_created AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''account_created'', ''earn_account_created'')';
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_profile_completed ON public.users';
    EXECUTE 'CREATE TRIGGER trg_career_reward_profile_completed AFTER UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''profile_completed'', ''earn_profile_completed'')';
  END IF;

  IF to_regclass('public.career_documents') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_document_created ON public.career_documents';
    EXECUTE 'CREATE TRIGGER trg_career_reward_document_created AFTER INSERT ON public.career_documents FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''document_created'', ''earn_first_cv_created'')';
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_order_paid ON public.orders';
    EXECUTE 'CREATE TRIGGER trg_career_reward_order_paid AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''order_paid'', ''earn_course_purchase_confirmed'')';
  END IF;

  IF to_regclass('public.user_enrollments') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_course_completed ON public.user_enrollments';
    EXECUTE 'CREATE TRIGGER trg_career_reward_course_completed AFTER INSERT OR UPDATE ON public.user_enrollments FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''course_completed'', ''earn_course_completed'')';
  END IF;

  IF to_regclass('public.certificates') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_certificate ON public.certificates';
    EXECUTE 'CREATE TRIGGER trg_career_reward_certificate AFTER INSERT OR UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''certificate_earned'', ''earn_certificate_earned'')';
  END IF;

  IF to_regclass('public.badge_awards') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_badge ON public.badge_awards';
    EXECUTE 'CREATE TRIGGER trg_career_reward_badge AFTER INSERT OR UPDATE ON public.badge_awards FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''badge_earned'', ''earn_badge_earned'')';
  END IF;

  IF to_regclass('public.job_applications') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_application ON public.job_applications';
    EXECUTE 'CREATE TRIGGER trg_career_reward_application AFTER INSERT ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''application_submitted'', ''earn_application_submitted'')';
  END IF;

  IF to_regclass('public.referrals') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_reward_referral ON public.referrals';
    EXECUTE 'CREATE TRIGGER trg_career_reward_referral AFTER UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.career_reward_event_trigger(''referral_validated'', ''earn_referral_validated'')';
  END IF;
END $$;

-- Normalise les anciens débits positifs en écritures négatives dans le journal.
CREATE OR REPLACE FUNCTION public.career_normalize_token_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF LOWER(COALESCE(NEW.transaction_type, '')) = 'debit' AND COALESCE(NEW.amount, 0) > 0 THEN
    NEW.amount := -NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_normalize_token_transaction ON public.career_token_transactions;
CREATE TRIGGER trg_career_normalize_token_transaction
BEFORE INSERT OR UPDATE OF amount, transaction_type
ON public.career_token_transactions
FOR EACH ROW EXECUTE FUNCTION public.career_normalize_token_transaction();

-- Empêche la réintroduction de gains directs dans les codes Structure/Partenaire.
CREATE OR REPLACE FUNCTION public.career_strip_legacy_code_tokens()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'partner_codes' THEN
    NEW.advantages := COALESCE(NEW.advantages, '{}'::jsonb) - 'cv_tokens';
  ELSE
    NEW.advantages_remaining := COALESCE(NEW.advantages_remaining, '{}'::jsonb) - 'cv_tokens';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_codes') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'partner_codes' AND column_name = 'advantages'
     ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_strip_partner_code_tokens ON public.partner_codes';
    EXECUTE 'CREATE TRIGGER trg_career_strip_partner_code_tokens BEFORE INSERT OR UPDATE OF advantages ON public.partner_codes FOR EACH ROW EXECUTE FUNCTION public.career_strip_legacy_code_tokens()';
  END IF;

  IF to_regclass('public.partner_code_users') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'partner_code_users' AND column_name = 'advantages_remaining'
     ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_career_strip_partner_user_tokens ON public.partner_code_users';
    EXECUTE 'CREATE TRIGGER trg_career_strip_partner_user_tokens BEFORE INSERT OR UPDATE OF advantages_remaining ON public.partner_code_users FOR EACH ROW EXECUTE FUNCTION public.career_strip_legacy_code_tokens()';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Export PDF : coût piloté par les nouvelles règles, zéro par défaut
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.career_prepare_pdf_export(
  p_user_id uuid,
  p_document_id uuid,
  p_doc_type text,
  p_title text,
  p_template_key text,
  p_request_id uuid,
  p_ip_address text,
  p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document public.career_documents%ROWTYPE;
  v_existing public.career_export_logs%ROWTYPE;
  v_export_id uuid;
  v_current_hash text;
  v_free_reexport boolean := false;
  v_rule_key text;
  v_charge jsonb;
  v_cost integer := 0;
  v_balance integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_document_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_FIELDS');
  END IF;

  IF p_doc_type NOT IN ('cv', 'lm') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DOC_TYPE');
  END IF;

  p_request_id := COALESCE(p_request_id, gen_random_uuid());

  SELECT *
  INTO v_existing
  FROM public.career_export_logs
  WHERE user_id = p_user_id
    AND request_id = p_request_id
  LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(cv_tokens, 0)
    INTO v_balance
    FROM public.users
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'export_id', v_existing.id,
      'tokens_consumed', COALESCE(v_existing.tokens_consumed, 0),
      'tokens_remaining', COALESCE(v_balance, 0),
      'free_reexport', COALESCE(v_existing.tokens_consumed, 0) = 0
    );
  END IF;

  SELECT *
  INTO v_document
  FROM public.career_documents
  WHERE id = p_document_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'DOCUMENT_NOT_FOUND');
  END IF;

  IF v_document.doc_type <> p_doc_type THEN
    RETURN jsonb_build_object('success', false, 'error', 'DOC_TYPE_MISMATCH');
  END IF;

  v_current_hash := COALESCE(
    NULLIF(v_document.content_hash, ''),
    md5(COALESCE(v_document.doc_data, '{}'::jsonb)::text)
  );

  v_free_reexport :=
    COALESCE(v_document.export_count, 0) > 0
    AND NULLIF(v_document.last_export_hash, '') = v_current_hash;

  IF NOT v_free_reexport THEN
    v_rule_key := CASE WHEN p_doc_type = 'cv' THEN 'spend_pdf_cv' ELSE 'spend_pdf_lm' END;

    v_charge := public.career_apply_token_rule(
      p_user_id,
      v_rule_key,
      p_document_id::text,
      p_request_id,
      jsonb_build_object('document_id', p_document_id, 'doc_type', p_doc_type)
    );

    IF COALESCE((v_charge->>'success')::boolean, false) = false THEN
      RETURN v_charge;
    END IF;

    v_cost := COALESCE((v_charge->>'amount')::integer, 0);
    v_balance := COALESCE((v_charge->>'tokens_remaining')::integer, 0);
  ELSE
    SELECT COALESCE(cv_tokens, 0)
    INTO v_balance
    FROM public.users
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.career_export_logs(
    user_id,
    document_id,
    doc_type,
    title,
    template_key,
    export_format,
    tokens_consumed,
    status,
    ip_address,
    user_agent,
    request_id
  )
  VALUES (
    p_user_id,
    p_document_id,
    p_doc_type,
    COALESCE(NULLIF(v_document.title, ''), NULLIF(p_title, '')),
    COALESCE(v_document.template_key, NULLIF(p_template_key, '')),
    'pdf',
    v_cost,
    'prepared',
    NULLIF(left(COALESCE(p_ip_address, ''), 255), ''),
    NULLIF(left(COALESCE(p_user_agent, ''), 500), ''),
    p_request_id
  )
  RETURNING id INTO v_export_id;

  UPDATE public.career_documents
  SET export_count = COALESCE(export_count, 0) + 1,
      last_exported_at = now(),
      last_export_hash = v_current_hash,
      updated_at = now()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'export_id', v_export_id,
    'tokens_consumed', v_cost,
    'tokens_remaining', v_balance,
    'free_reexport', v_free_reexport,
    'message', CASE
      WHEN v_free_reexport THEN 'PDF préparé sans nouveau débit : le document est inchangé.'
      WHEN v_cost > 0 THEN format('PDF préparé. %s jeton(s) consommé(s).', v_cost)
      ELSE 'PDF préparé gratuitement.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.career_prepare_pdf_export(
  uuid, uuid, text, text, text, uuid, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.career_prepare_pdf_export(
  uuid, uuid, text, text, text, uuid, text, text
) TO service_role;


-- L'ancien achat de packs ne doit plus créditer de jetons.
CREATE OR REPLACE FUNCTION public.payment_credit_cv_tokens_once(
  p_order_id uuid,
  p_user_id uuid,
  p_tokens integer,
  p_provider_transaction_id text,
  p_provider_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'CAREER_TOKEN_PACKS_DISABLED',
    'order_id', p_order_id,
    'tokens_credited', false,
    'message', 'Les anciens packs de jetons Career sont désactivés. Les jetons sont désormais gouvernés par les règles du Super-admin.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.payment_credit_cv_tokens_once(uuid, uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_credit_cv_tokens_once(uuid, uuid, integer, text, text)
  TO service_role;

COMMENT ON TABLE public.career_token_config IS
  'Catalogue unique des gains et dépenses de jetons Career, entièrement gouverné par le Super-admin.';

COMMENT ON FUNCTION public.career_apply_token_rule(uuid, text, text, uuid, jsonb) IS
  'Applique atomiquement une règle de gain ou de dépense avec idempotence, plafonds, fréquence et validation.';

COMMIT;

-- Résultat attendu après exécution :
-- soldes_non_zero = 0
-- anciennes_transactions = 0
-- anciens_packs = 0
-- regles_gain_actives = 0
-- regles_depense_actives = 0
-- modeles_premium_selectionnes = 0
-- interrupteurs_generaux_actifs = 0
SELECT
  (SELECT COUNT(*) FROM public.users WHERE COALESCE(cv_tokens, 0) <> 0) AS soldes_non_zero,
  (SELECT COUNT(*) FROM public.career_token_transactions) AS anciennes_transactions,
  (SELECT COUNT(*) FROM public.career_token_packs) AS anciens_packs,
  (
    SELECT COUNT(*) FROM public.career_token_config
    WHERE rule_type = 'earn' AND is_active = true AND COALESCE(config_value, 0) > 0
  ) AS regles_gain_actives,
  (
    SELECT COUNT(*) FROM public.career_token_config
    WHERE rule_type = 'spend'
      AND COALESCE((metadata->>'hidden')::boolean, false) = false
      AND is_active = true
      AND COALESCE(config_value, 0) > 0
  ) AS regles_depense_actives,
  (SELECT COUNT(*) FROM public.career_templates WHERE is_free = false) AS modeles_premium_selectionnes,
  (
    SELECT COUNT(*) FROM public.career_admin_rules
    WHERE rule_key IN (
      'career_token_earning_enabled',
      'career_token_spending_enabled',
      'career_premium_templates_enabled'
    )
    AND COALESCE((value_json->>'value')::boolean, false) = true
  ) AS interrupteurs_generaux_actifs,
  (SELECT COUNT(*) FROM public.career_token_config WHERE rule_type='earn') AS methodes_gain_disponibles,
  (
    SELECT COUNT(*) FROM public.career_token_config
    WHERE rule_type='spend' AND COALESCE((metadata->>'hidden')::boolean, false)=false
  ) AS methodes_depense_disponibles;

