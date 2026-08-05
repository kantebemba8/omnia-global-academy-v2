-- Omnia Global Academy — Lot 3A V2
-- Catalogue unique: 12 CV + 6 LM réellement distincts.
-- Supprime les anciens renderers 20 CV / 32 LM après migration des références.
-- Cette migration remplace la tentative V1 et ne dépend d'aucune table temporaire.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.career_templates') IS NULL THEN
    RAISE EXCEPTION 'OGA_LOT3A_V2_TABLE_ABSENTE: public.career_templates';
  END IF;
  IF to_regclass('public.career_documents') IS NULL THEN
    RAISE EXCEPTION 'OGA_LOT3A_V2_TABLE_ABSENTE: public.career_documents';
  END IF;
END
$$;

ALTER TABLE public.career_templates
  ADD COLUMN IF NOT EXISTS catalog_status text,
  ADD COLUMN IF NOT EXISTS canonical_template_key text;

ALTER TABLE public.career_templates
  DROP CONSTRAINT IF EXISTS career_templates_catalog_status_check;

UPDATE public.career_templates
SET catalog_status = CASE
      WHEN template_key IN (
        'cv_horizon',
    'cv_sahara',
    'cv_atlas',
    'cv_kora',
    'cv_nile',
    'cv_executive',
    'cv_baobab',
    'cv_digital',
    'cv_academia',
    'cv_hospitality',
    'cv_qhse',
    'cv_impact',
    'lm_horizon',
    'lm_sahara',
    'lm_atlas',
    'lm_kora',
    'lm_digital',
    'lm_executive'
      ) THEN 'official'
      ELSE 'custom'
    END,
    canonical_template_key = template_key
WHERE catalog_status IS NULL
   OR catalog_status NOT IN ('official', 'custom')
   OR canonical_template_key IS NULL
   OR canonical_template_key = '';

ALTER TABLE public.career_templates
  ALTER COLUMN catalog_status SET DEFAULT 'custom',
  ALTER COLUMN catalog_status SET NOT NULL;

ALTER TABLE public.career_templates
  ADD CONSTRAINT career_templates_catalog_status_check
  CHECK (catalog_status IN ('official', 'custom'));

CREATE OR REPLACE FUNCTION public.career_canonical_template_key(
  p_doc_type text,
  p_template_key text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key text := lower(trim(COALESCE(p_template_key, '')));
  v_mapped text;
BEGIN
  IF p_doc_type NOT IN ('cv', 'lm') THEN
    RAISE EXCEPTION 'INVALID_TEMPLATE_TYPE';
  END IF;

  v_mapped := CASE v_key
      WHEN 'classic_pro' THEN 'cv_horizon'
      WHEN 'modern_student' THEN 'cv_nile'
      WHEN 'corporate_blue' THEN 'cv_horizon'
      WHEN 'minimal_luxe' THEN 'cv_impact'
      WHEN 'africa_gold' THEN 'cv_sahara'
      WHEN 'tech_future' THEN 'cv_digital'
      WHEN 'cyber_security' THEN 'cv_digital'
      WHEN 'data_analyst' THEN 'cv_digital'
      WHEN 'creative_digital' THEN 'cv_baobab'
      WHEN 'no_photo_ats' THEN 'cv_atlas'
      WHEN 'photo_elegant' THEN 'cv_horizon'
      WHEN 'young_graduate' THEN 'cv_nile'
      WHEN 'internship_ready' THEN 'cv_nile'
      WHEN 'international_cv' THEN 'cv_atlas'
      WHEN 'qhse_professional' THEN 'cv_qhse'
      WHEN 'business_manager' THEN 'cv_executive'
      WHEN 'hospitality' THEN 'cv_hospitality'
      WHEN 'hospitality_premium' THEN 'cv_hospitality'
      WHEN 'academic_cv' THEN 'cv_academia'
      WHEN 'academic' THEN 'cv_academia'
      WHEN 'freelancer' THEN 'cv_kora'
      WHEN 'freelancer_portfolio' THEN 'cv_kora'
      WHEN 'executive_one_page' THEN 'cv_executive'
      WHEN 'cyber_security_cv' THEN 'cv_digital'
      WHEN 'data_analyst_cv' THEN 'cv_digital'
      WHEN 'modern' THEN 'cv_horizon'
      WHEN 'professional' THEN 'cv_horizon'
      WHEN 'classic' THEN 'cv_horizon'
      WHEN 'creative' THEN 'cv_baobab'
      WHEN 'simple' THEN 'cv_atlas'
      WHEN 'student' THEN 'cv_nile'
      WHEN 'qhse' THEN 'cv_qhse'
      WHEN 'lm_classic_pro' THEN 'lm_horizon'
      WHEN 'lm_modern_student' THEN 'lm_atlas'
      WHEN 'lm_corporate_blue' THEN 'lm_horizon'
      WHEN 'lm_minimal_luxe' THEN 'lm_atlas'
      WHEN 'lm_africa_gold' THEN 'lm_sahara'
      WHEN 'lm_tech_future' THEN 'lm_digital'
      WHEN 'lm_cyber_security' THEN 'lm_digital'
      WHEN 'lm_data_analyst' THEN 'lm_digital'
      WHEN 'lm_creative_digital' THEN 'lm_kora'
      WHEN 'lm_no_photo_ats' THEN 'lm_atlas'
      WHEN 'lm_photo_elegant' THEN 'lm_horizon'
      WHEN 'lm_young_graduate' THEN 'lm_atlas'
      WHEN 'lm_internship_ready' THEN 'lm_atlas'
      WHEN 'lm_international' THEN 'lm_horizon'
      WHEN 'lm_qhse' THEN 'lm_horizon'
      WHEN 'lm_business_manager' THEN 'lm_executive'
      WHEN 'lm_hospitality' THEN 'lm_sahara'
      WHEN 'lm_academic' THEN 'lm_atlas'
      WHEN 'lm_freelancer' THEN 'lm_kora'
      WHEN 'lm_stage_simple' THEN 'lm_atlas'
      WHEN 'lm_premier_emploi' THEN 'lm_atlas'
      WHEN 'lm_alternance' THEN 'lm_atlas'
      WHEN 'lm_spontanee' THEN 'lm_horizon'
      WHEN 'lm_qhse_rse' THEN 'lm_horizon'
      WHEN 'lm_tech_data' THEN 'lm_digital'
      WHEN 'lm_hotellerie' THEN 'lm_sahara'
      WHEN 'lm_administration' THEN 'lm_horizon'
      WHEN 'lm_finance_banque' THEN 'lm_executive'
      WHEN 'lm_internationale' THEN 'lm_horizon'
      WHEN 'lm_courte_premium' THEN 'lm_executive'
      WHEN 'lm_pro_classique' THEN 'lm_horizon'
      WHEN 'classic_lm' THEN 'lm_horizon'
      WHEN 'dynamic_lm' THEN 'lm_kora'
      WHEN 'academic_lm' THEN 'lm_atlas'
      WHEN 'modern_lm' THEN 'lm_horizon'
      WHEN 'professional_lm' THEN 'lm_horizon'
      WHEN 'creative_lm' THEN 'lm_kora'
      WHEN 'simple_lm' THEN 'lm_atlas'
      ELSE v_key
    END;

  IF v_mapped = '' THEN
    RETURN CASE WHEN p_doc_type = 'lm' THEN 'lm_horizon' ELSE 'cv_horizon' END;
  END IF;

  -- Les clés inconnues sont conservées: elles peuvent appartenir à un vrai
  -- modèle personnalisé. Le type sera validé par les Edge Functions au moment
  -- de l'utilisation du document.
  RETURN v_mapped;
END;
$$;

REVOKE ALL ON FUNCTION public.career_canonical_template_key(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.career_canonical_template_key(text, text)
  TO service_role;

-- Réinstalle uniquement les 12 CV et les 6 LM sélectionnés.
insert into public.career_templates
(template_key, template_type, name_fr, description_fr, category, is_free, is_ats_compatible, display_order, thumbnail_url, layout_config, default_colors, is_active, is_custom, updated_at)
values
('cv_horizon','cv','Horizon Pro','Deux colonnes élégantes, lisibles et professionnelles.','professional',true,true,1,'/career-templates/generated/cv_horizon.svg','{"variant": "split", "primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8"}'::jsonb,'{"primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_sahara','cv','Sahara Élégant','Style chaleureux et premium aux accents dorés.','africa_premium',true,true,2,'/career-templates/generated/cv_sahara.svg','{"variant": "band", "primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8"}'::jsonb,'{"primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_atlas','cv','Atlas ATS','Modèle sans photo, optimisé pour les recruteurs et ATS.','professional',true,true,3,'/career-templates/generated/cv_atlas.svg','{"variant": "minimal", "primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa"}'::jsonb,'{"primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_kora','cv','Kora Créatif','Présentation moderne avec chronologie et identité forte.','creative',true,false,4,'/career-templates/generated/cv_kora.svg','{"variant": "timeline", "primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff"}'::jsonb,'{"primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_nile','cv','Nile Impact','Blocs dynamiques pour profils polyvalents et projets.','professional',true,true,5,'/career-templates/generated/cv_nile.svg','{"variant": "cards", "primary": "#064e3b", "accent": "#22c55e", "sidebar": "#ecfdf5"}'::jsonb,'{"primary": "#064e3b", "accent": "#22c55e", "sidebar": "#ecfdf5", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_executive','cv','Executive Noir & Or','Une page premium pour cadres et fonctions de direction.','professional',true,true,6,'/career-templates/generated/cv_executive.svg','{"variant": "executive", "primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6"}'::jsonb,'{"primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_baobab','cv','Baobab Créatif','Design visuel pour communication, marketing et création.','creative',true,false,7,'/career-templates/generated/cv_baobab.svg','{"variant": "creative", "primary": "#7c2d12", "accent": "#f59e0b", "sidebar": "#fff7ed"}'::jsonb,'{"primary": "#7c2d12", "accent": "#f59e0b", "sidebar": "#fff7ed", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_digital','cv','Digital Tech','Interface sombre et moderne pour tech, data et cybersécurité.','tech',true,true,8,'/career-templates/generated/cv_digital.svg','{"variant": "tech", "primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944"}'::jsonb,'{"primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_academia','cv','Academia','Structure détaillée pour enseignement, recherche et publications.','specialized',true,true,9,'/career-templates/generated/cv_academia.svg','{"variant": "academic", "primary": "#334155", "accent": "#64748b", "sidebar": "#f8fafc"}'::jsonb,'{"primary": "#334155", "accent": "#64748b", "sidebar": "#f8fafc", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_hospitality','cv','Hospitality Signature','Élégant et orienté service, hôtellerie et restauration.','specialized',true,true,10,'/career-templates/generated/cv_hospitality.svg','{"variant": "hospitality", "primary": "#123b55", "accent": "#c6a15b", "sidebar": "#edf4f7"}'::jsonb,'{"primary": "#123b55", "accent": "#c6a15b", "sidebar": "#edf4f7", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_qhse','cv','QHSE Green','Conçu pour QSE, HSE, RSE, conformité et audit.','specialized',true,true,11,'/career-templates/generated/cv_qhse.svg','{"variant": "qhse", "primary": "#0f4c3a", "accent": "#84cc16", "sidebar": "#f1f8f4"}'::jsonb,'{"primary": "#0f4c3a", "accent": "#84cc16", "sidebar": "#f1f8f4", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_impact','cv','Impact One Page','Compact et percutant pour candidature rapide.','professional',true,true,12,'/career-templates/generated/cv_impact.svg','{"variant": "compact", "primary": "#1e3a8a", "accent": "#f59e0b", "sidebar": "#eff6ff"}'::jsonb,'{"primary": "#1e3a8a", "accent": "#f59e0b", "sidebar": "#eff6ff", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_horizon','lm','Horizon Pro','Lettre assortie au CV Horizon Pro.','classic_lm',true,true,1,'/career-templates/generated/lm_horizon.svg','{"variant": "split", "primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8"}'::jsonb,'{"primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_sahara','lm','Sahara Élégant','Lettre premium aux accents chauds et dorés.','classic_lm',true,true,2,'/career-templates/generated/lm_sahara.svg','{"variant": "band", "primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8"}'::jsonb,'{"primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_atlas','lm','Atlas ATS','Lettre simple, claire et très lisible.','classic_lm',true,true,3,'/career-templates/generated/lm_atlas.svg','{"variant": "minimal", "primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa"}'::jsonb,'{"primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_kora','lm','Kora Créative','Lettre moderne pour communication et métiers créatifs.','classic_lm',true,false,4,'/career-templates/generated/lm_kora.svg','{"variant": "creative", "primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff"}'::jsonb,'{"primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_digital','lm','Digital Tech','Lettre pour tech, data, produit et cybersécurité.','classic_lm',true,true,5,'/career-templates/generated/lm_digital.svg','{"variant": "tech", "primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944"}'::jsonb,'{"primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_executive','lm','Executive Noir & Or','Lettre premium pour profils expérimentés.','classic_lm',true,true,6,'/career-templates/generated/lm_executive.svg','{"variant": "executive", "primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6"}'::jsonb,'{"primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now())
on conflict (template_key) do update set
  template_type=excluded.template_type, name_fr=excluded.name_fr, description_fr=excluded.description_fr,
  category=excluded.category, is_free=excluded.is_free, is_ats_compatible=excluded.is_ats_compatible,
  display_order=excluded.display_order, thumbnail_url=excluded.thumbnail_url, layout_config=excluded.layout_config,
  default_colors=excluded.default_colors, is_active=true, is_custom=false, updated_at=now();

UPDATE public.career_templates
SET is_active = true,
    is_free = true,
    is_custom = false,
    catalog_status = 'official',
    canonical_template_key = template_key,
    updated_at = now()
WHERE template_key IN (
    'cv_horizon',
    'cv_sahara',
    'cv_atlas',
    'cv_kora',
    'cv_nile',
    'cv_executive',
    'cv_baobab',
    'cv_digital',
    'cv_academia',
    'cv_hospitality',
    'cv_qhse',
    'cv_impact',
    'lm_horizon',
    'lm_sahara',
    'lm_atlas',
    'lm_kora',
    'lm_digital',
    'lm_executive'
);

-- Les vrais modèles personnalisés sont conservés, activés et gratuits par défaut.
UPDATE public.career_templates
SET is_active = true,
    is_free = true,
    is_custom = true,
    catalog_status = 'custom',
    canonical_template_key = template_key,
    updated_at = now()
WHERE template_key NOT IN (
    'cv_horizon',
    'cv_sahara',
    'cv_atlas',
    'cv_kora',
    'cv_nile',
    'cv_executive',
    'cv_baobab',
    'cv_digital',
    'cv_academia',
    'cv_hospitality',
    'cv_qhse',
    'cv_impact',
    'lm_horizon',
    'lm_sahara',
    'lm_atlas',
    'lm_kora',
    'lm_digital',
    'lm_executive'
)
  AND template_key NOT IN (
    'academic',
    'academic_cv',
    'academic_lm',
    'africa_gold',
    'business_manager',
    'classic',
    'classic_lm',
    'classic_pro',
    'corporate_blue',
    'creative',
    'creative_digital',
    'creative_lm',
    'cyber_security',
    'cyber_security_cv',
    'data_analyst',
    'data_analyst_cv',
    'dynamic_lm',
    'executive_one_page',
    'freelancer',
    'freelancer_portfolio',
    'hospitality',
    'hospitality_premium',
    'international_cv',
    'internship_ready',
    'lm_academic',
    'lm_administration',
    'lm_africa_gold',
    'lm_alternance',
    'lm_business_manager',
    'lm_classic_pro',
    'lm_corporate_blue',
    'lm_courte_premium',
    'lm_creative_digital',
    'lm_cyber_security',
    'lm_data_analyst',
    'lm_finance_banque',
    'lm_freelancer',
    'lm_hospitality',
    'lm_hotellerie',
    'lm_international',
    'lm_internationale',
    'lm_internship_ready',
    'lm_minimal_luxe',
    'lm_modern_student',
    'lm_no_photo_ats',
    'lm_photo_elegant',
    'lm_premier_emploi',
    'lm_pro_classique',
    'lm_qhse',
    'lm_qhse_rse',
    'lm_spontanee',
    'lm_stage_simple',
    'lm_tech_data',
    'lm_tech_future',
    'lm_young_graduate',
    'minimal_luxe',
    'modern',
    'modern_lm',
    'modern_student',
    'no_photo_ats',
    'photo_elegant',
    'professional',
    'professional_lm',
    'qhse',
    'qhse_professional',
    'simple',
    'simple_lm',
    'student',
    'tech_future',
    'young_graduate'
);

-- Convertit tous les documents vers les 12/6 clés canoniques avant suppression.
UPDATE public.career_documents
SET template_key = public.career_canonical_template_key(
      doc_type,
      COALESCE(template_key, CASE WHEN doc_type = 'lm' THEN 'lm_horizon' ELSE 'cv_horizon' END)
    ),
    updated_at = now()
WHERE template_key IS NULL
   OR template_key IS DISTINCT FROM public.career_canonical_template_key(
        doc_type,
        COALESCE(template_key, CASE WHEN doc_type = 'lm' THEN 'lm_horizon' ELSE 'cv_horizon' END)
      );

-- Les journaux d'export conservent l'historique, mais avec la clé canonique.
DO $$
BEGIN
  IF to_regclass('public.career_export_logs') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'career_export_logs'
         AND column_name = 'template_key'
     ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'career_export_logs'
        AND column_name = 'doc_type'
    ) THEN
      EXECUTE $sql$
        UPDATE public.career_export_logs
        SET template_key = public.career_canonical_template_key(
          doc_type,
          COALESCE(template_key, CASE WHEN doc_type = 'lm' THEN 'lm_horizon' ELSE 'cv_horizon' END)
        )
        WHERE template_key IS NULL
           OR template_key IS DISTINCT FROM public.career_canonical_template_key(
             doc_type,
             COALESCE(template_key, CASE WHEN doc_type = 'lm' THEN 'lm_horizon' ELSE 'cv_horizon' END)
           )
      $sql$;
    ELSE
      EXECUTE $sql$
        UPDATE public.career_export_logs AS export_log
        SET template_key = public.career_canonical_template_key(
          COALESCE(
            (
              SELECT template.template_type
              FROM public.career_templates AS template
              WHERE template.template_key = export_log.template_key
              LIMIT 1
            ),
            CASE WHEN left(COALESCE(export_log.template_key, ''), 3) = 'lm_' THEN 'lm' ELSE 'cv' END
          ),
          COALESCE(export_log.template_key, 'cv_horizon')
        )
        WHERE export_log.template_key IS NULL
           OR export_log.template_key IS DISTINCT FROM public.career_canonical_template_key(
             COALESCE(
               (
                 SELECT template.template_type
                 FROM public.career_templates AS template
                 WHERE template.template_key = export_log.template_key
                 LIMIT 1
               ),
               CASE WHEN left(COALESCE(export_log.template_key, ''), 3) = 'lm_' THEN 'lm' ELSE 'cv' END
             ),
             COALESCE(export_log.template_key, 'cv_horizon')
           )
      $sql$;
    END IF;
  END IF;
END
$$;

-- Suppression définitive des anciennes lignes intégrées. Les modèles personnalisés non
-- concernés restent présents.
DELETE FROM public.career_templates
WHERE template_key IN (
    'academic',
    'academic_cv',
    'academic_lm',
    'africa_gold',
    'business_manager',
    'classic',
    'classic_lm',
    'classic_pro',
    'corporate_blue',
    'creative',
    'creative_digital',
    'creative_lm',
    'cyber_security',
    'cyber_security_cv',
    'data_analyst',
    'data_analyst_cv',
    'dynamic_lm',
    'executive_one_page',
    'freelancer',
    'freelancer_portfolio',
    'hospitality',
    'hospitality_premium',
    'international_cv',
    'internship_ready',
    'lm_academic',
    'lm_administration',
    'lm_africa_gold',
    'lm_alternance',
    'lm_business_manager',
    'lm_classic_pro',
    'lm_corporate_blue',
    'lm_courte_premium',
    'lm_creative_digital',
    'lm_cyber_security',
    'lm_data_analyst',
    'lm_finance_banque',
    'lm_freelancer',
    'lm_hospitality',
    'lm_hotellerie',
    'lm_international',
    'lm_internationale',
    'lm_internship_ready',
    'lm_minimal_luxe',
    'lm_modern_student',
    'lm_no_photo_ats',
    'lm_photo_elegant',
    'lm_premier_emploi',
    'lm_pro_classique',
    'lm_qhse',
    'lm_qhse_rse',
    'lm_spontanee',
    'lm_stage_simple',
    'lm_tech_data',
    'lm_tech_future',
    'lm_young_graduate',
    'minimal_luxe',
    'modern',
    'modern_lm',
    'modern_student',
    'no_photo_ats',
    'photo_elegant',
    'professional',
    'professional_lm',
    'qhse',
    'qhse_professional',
    'simple',
    'simple_lm',
    'student',
    'tech_future',
    'young_graduate'
);

CREATE OR REPLACE FUNCTION public.career_normalize_template_order(p_template_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_template_type NOT IN ('cv', 'lm') THEN
    RAISE EXCEPTION 'INVALID_TEMPLATE_TYPE';
  END IF;

  WITH ranked AS (
    SELECT template_key,
           row_number() OVER (
             ORDER BY
               CASE WHEN catalog_status = 'official' THEN 0 ELSE 1 END,
               CASE
                 WHEN catalog_status = 'official' THEN display_order
                 ELSE 1000 + display_order
               END,
               lower(name_fr),
               template_key
           )::integer AS normalized_order
    FROM public.career_templates
    WHERE template_type = p_template_type
      AND catalog_status IN ('official', 'custom')
      AND is_active = true
  )
  UPDATE public.career_templates AS template
  SET display_order = ranked.normalized_order,
      updated_at = now()
  FROM ranked
  WHERE template.template_key = ranked.template_key
    AND template.display_order IS DISTINCT FROM ranked.normalized_order;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.career_normalize_template_order(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.career_normalize_template_order(text)
  TO service_role;

SELECT public.career_normalize_template_order('cv');
SELECT public.career_normalize_template_order('lm');

CREATE UNIQUE INDEX IF NOT EXISTS uq_career_templates_template_key
  ON public.career_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_career_templates_active_catalog
  ON public.career_templates(template_type, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_career_templates_catalog_integrity
  ON public.career_templates(template_type, catalog_status, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_career_templates_canonical_key
  ON public.career_templates(canonical_template_key);

DO $$
DECLARE
  v_cv integer;
  v_lm integer;
  v_legacy integer;
  v_legacy_documents integer;
BEGIN
  SELECT count(*) INTO v_cv
  FROM public.career_templates
  WHERE template_type = 'cv'
    AND catalog_status = 'official'
    AND is_active = true
    AND is_custom = false;

  SELECT count(*) INTO v_lm
  FROM public.career_templates
  WHERE template_type = 'lm'
    AND catalog_status = 'official'
    AND is_active = true
    AND is_custom = false;

  SELECT count(*) INTO v_legacy
  FROM public.career_templates
  WHERE template_key IN (
      'academic',
    'academic_cv',
    'academic_lm',
    'africa_gold',
    'business_manager',
    'classic',
    'classic_lm',
    'classic_pro',
    'corporate_blue',
    'creative',
    'creative_digital',
    'creative_lm',
    'cyber_security',
    'cyber_security_cv',
    'data_analyst',
    'data_analyst_cv',
    'dynamic_lm',
    'executive_one_page',
    'freelancer',
    'freelancer_portfolio',
    'hospitality',
    'hospitality_premium',
    'international_cv',
    'internship_ready',
    'lm_academic',
    'lm_administration',
    'lm_africa_gold',
    'lm_alternance',
    'lm_business_manager',
    'lm_classic_pro',
    'lm_corporate_blue',
    'lm_courte_premium',
    'lm_creative_digital',
    'lm_cyber_security',
    'lm_data_analyst',
    'lm_finance_banque',
    'lm_freelancer',
    'lm_hospitality',
    'lm_hotellerie',
    'lm_international',
    'lm_internationale',
    'lm_internship_ready',
    'lm_minimal_luxe',
    'lm_modern_student',
    'lm_no_photo_ats',
    'lm_photo_elegant',
    'lm_premier_emploi',
    'lm_pro_classique',
    'lm_qhse',
    'lm_qhse_rse',
    'lm_spontanee',
    'lm_stage_simple',
    'lm_tech_data',
    'lm_tech_future',
    'lm_young_graduate',
    'minimal_luxe',
    'modern',
    'modern_lm',
    'modern_student',
    'no_photo_ats',
    'photo_elegant',
    'professional',
    'professional_lm',
    'qhse',
    'qhse_professional',
    'simple',
    'simple_lm',
    'student',
    'tech_future',
    'young_graduate'
  );

  SELECT count(*) INTO v_legacy_documents
  FROM public.career_documents
  WHERE template_key IN (
      'academic',
    'academic_cv',
    'academic_lm',
    'africa_gold',
    'business_manager',
    'classic',
    'classic_lm',
    'classic_pro',
    'corporate_blue',
    'creative',
    'creative_digital',
    'creative_lm',
    'cyber_security',
    'cyber_security_cv',
    'data_analyst',
    'data_analyst_cv',
    'dynamic_lm',
    'executive_one_page',
    'freelancer',
    'freelancer_portfolio',
    'hospitality',
    'hospitality_premium',
    'international_cv',
    'internship_ready',
    'lm_academic',
    'lm_administration',
    'lm_africa_gold',
    'lm_alternance',
    'lm_business_manager',
    'lm_classic_pro',
    'lm_corporate_blue',
    'lm_courte_premium',
    'lm_creative_digital',
    'lm_cyber_security',
    'lm_data_analyst',
    'lm_finance_banque',
    'lm_freelancer',
    'lm_hospitality',
    'lm_hotellerie',
    'lm_international',
    'lm_internationale',
    'lm_internship_ready',
    'lm_minimal_luxe',
    'lm_modern_student',
    'lm_no_photo_ats',
    'lm_photo_elegant',
    'lm_premier_emploi',
    'lm_pro_classique',
    'lm_qhse',
    'lm_qhse_rse',
    'lm_spontanee',
    'lm_stage_simple',
    'lm_tech_data',
    'lm_tech_future',
    'lm_young_graduate',
    'minimal_luxe',
    'modern',
    'modern_lm',
    'modern_student',
    'no_photo_ats',
    'photo_elegant',
    'professional',
    'professional_lm',
    'qhse',
    'qhse_professional',
    'simple',
    'simple_lm',
    'student',
    'tech_future',
    'young_graduate'
  );

  IF v_cv <> 12 THEN
    RAISE EXCEPTION 'OGA_LOT3A_V2_CV_COUNT_INVALID: %', v_cv;
  END IF;
  IF v_lm <> 6 THEN
    RAISE EXCEPTION 'OGA_LOT3A_V2_LM_COUNT_INVALID: %', v_lm;
  END IF;
  IF v_legacy <> 0 THEN
    RAISE EXCEPTION 'OGA_LOT3A_V2_LEGACY_TEMPLATES_REMAIN: %', v_legacy;
  END IF;
  IF v_legacy_documents <> 0 THEN
    RAISE EXCEPTION 'OGA_LOT3A_V2_LEGACY_DOCUMENTS_REMAIN: %', v_legacy_documents;
  END IF;
END
$$;

COMMENT ON COLUMN public.career_templates.catalog_status IS
  'official: un des 12 CV ou 6 LM natifs; custom: modèle configurable créé par le Super-admin.';
COMMENT ON COLUMN public.career_templates.canonical_template_key IS
  'Clé unique réellement utilisée par le Builder, les aperçus et les exports.';

COMMIT;
