-- 127 — Fondation CMS de la nouvelle page d'accueil
-- Sections administrables, brouillon/publication, réseaux dynamiques,
-- applications conditionnelles et gouvernance des partenaires publics.

ALTER TABLE public.public_partners
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS logo_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_homepage boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_footer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alt_text text;

UPDATE public.public_partners
SET
  status = CASE WHEN is_active THEN 'active' ELSE 'draft' END,
  logo_authorized = CASE
    WHEN is_active AND NULLIF(BTRIM(COALESCE(logo_url, '')), '') IS NOT NULL THEN true
    ELSE false
  END,
  show_homepage = true
WHERE status = 'draft';

ALTER TABLE public.public_partners
  DROP CONSTRAINT IF EXISTS public_partners_status_check;
ALTER TABLE public.public_partners
  ADD CONSTRAINT public_partners_status_check
  CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE public.public_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_partners_read_active" ON public.public_partners;
DROP POLICY IF EXISTS "public_partners_read_authorized" ON public.public_partners;

CREATE POLICY "public_partners_read_authorized"
ON public.public_partners
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND status = 'active'
  AND logo_authorized = true
  AND NULLIF(BTRIM(COALESCE(logo_url, '')), '') IS NOT NULL
  AND (show_homepage = true OR show_footer = true)
);

CREATE INDEX IF NOT EXISTS idx_public_partners_public_display
ON public.public_partners(status, is_active, logo_authorized, show_homepage, show_footer, display_order);

CREATE TABLE IF NOT EXISTS public.landing_page_cms_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  draft jsonb NOT NULL,
  previous_published jsonb,
  social_networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  mobile_apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.landing_page_cms_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "landing_page_cms_state_admin_read" ON public.landing_page_cms_state;
CREATE POLICY "landing_page_cms_state_admin_read"
ON public.landing_page_cms_state
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

CREATE TABLE IF NOT EXISTS public.landing_page_publication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('save_draft', 'publish', 'restore_draft', 'rollback')),
  draft_snapshot jsonb,
  published_snapshot jsonb,
  previous_published_snapshot jsonb,
  admin_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_page_publication_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "landing_page_publication_log_admin_read" ON public.landing_page_publication_log;
CREATE POLICY "landing_page_publication_log_admin_read"
ON public.landing_page_publication_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

DO $$
DECLARE
  hero_title text;
  hero_subtitle text;
  landing_config jsonb;
  legacy_socials jsonb;
  social_items jsonb := '[]'::jsonb;
  legacy_apps jsonb;
  app_items jsonb;
  social_key text;
  social_label text;
  social_icon text;
  social_url text;
BEGIN
  SELECT COALESCE(value #>> '{}', 'Apprenez. Prouvez vos compétences. Avancez.')
  INTO hero_title
  FROM public.site_settings
  WHERE key = 'landing_hero_title_fr';

  SELECT COALESCE(value #>> '{}', 'Omnia réunit formations, projets, certifications vérifiables, coaching, événements en direct et opportunités professionnelles dans un même parcours.')
  INTO hero_subtitle
  FROM public.site_settings
  WHERE key = 'landing_hero_subtitle_fr';

  hero_title := COALESCE(NULLIF(BTRIM(hero_title), ''), 'Apprenez. Prouvez vos compétences. Avancez.');
  hero_subtitle := COALESCE(NULLIF(BTRIM(hero_subtitle), ''), 'Omnia réunit formations, projets, certifications vérifiables, coaching, événements en direct et opportunités professionnelles dans un même parcours.');

  landing_config := jsonb_build_object(
    'version', 1,
    'updated_at', now(),
    'published_at', now(),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id','hero-main','type','hero','internal_name','Introduction principale','enabled',true,'order',1,
        'eyebrow','Formation, compétences et opportunités','title',hero_title,'subtitle',hero_subtitle,'body','',
        'primary_cta_label','Créer mon compte','primary_cta_url','/inscription',
        'secondary_cta_label','Explorer les formations','secondary_cta_url','/catalogue'
      ),
      jsonb_build_object(
        'id','goal-selector','type','goal_selector','internal_name','Choisir son objectif','enabled',true,'order',2,
        'eyebrow','','title','Que souhaitez-vous accomplir ?',
        'subtitle','Choisissez votre objectif pour découvrir les outils Omnia adaptés à votre parcours.','body','',
        'primary_cta_label','','primary_cta_url','','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','omnia-journey','type','omnia_journey','internal_name','Le parcours Omnia','enabled',true,'order',3,
        'eyebrow','Un parcours complet','title','De l’apprentissage aux opportunités',
        'subtitle','Formez-vous, pratiquez, faites vérifier vos compétences et construisez votre avenir professionnel.','body','',
        'primary_cta_label','','primary_cta_url','','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','featured-courses','type','featured_courses','internal_name','Formations disponibles','enabled',true,'order',4,
        'eyebrow','','title','Formations disponibles','subtitle','Découvrez les formations réellement publiées sur Omnia.','body','',
        'primary_cta_label','Voir le catalogue','primary_cta_url','/catalogue','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','omnia-ecosystem','type','ecosystem','internal_name','Écosystème Omnia','enabled',true,'order',5,
        'eyebrow','','title','Plus qu’une plateforme de cours',
        'subtitle','Apprenez en direct, réalisez des projets, bénéficiez d’un accompagnement et développez votre carrière.','body','',
        'primary_cta_label','Explorer Omnia','primary_cta_url','/accueil#ecosysteme','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','credentials','type','credentials','internal_name','Certificats et preuves','enabled',true,'order',6,
        'eyebrow','','title','Des compétences que vous pouvez prouver',
        'subtitle','Présentez vos certificats, badges et preuves professionnelles dans un environnement vérifiable.','body','',
        'primary_cta_label','Vérifier un certificat','primary_cta_url','/verify','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','career-recruitment','type','career_recruitment','internal_name','Carrière et recrutement','enabled',true,'order',7,
        'eyebrow','','title','Construisez votre carrière. Trouvez les bons talents.',
        'subtitle','Omnia relie profils, compétences vérifiées, candidatures et besoins de recrutement.','body','',
        'primary_cta_label','Découvrir Omnia Talent','primary_cta_url','/talent',
        'secondary_cta_label','Découvrir Omnia Career','secondary_cta_url','/emploi'
      ),
      jsonb_build_object(
        'id','structures','type','structures','internal_name','Solutions pour les structures','enabled',true,'order',8,
        'eyebrow','','title','Développez les compétences de votre organisation',
        'subtitle','Gérez vos membres, formations obligatoires, cohortes, compétences, conformité et rapports.','body','',
        'primary_cta_label','Découvrir les solutions','primary_cta_url','/inscription/structure','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','partners','type','partners','internal_name','Partenaires','enabled',false,'order',9,
        'eyebrow','','title','Ils accompagnent l’écosystème Omnia',
        'subtitle','Cette section apparaît uniquement lorsqu’au moins un partenaire validé est actif.','body','',
        'primary_cta_label','','primary_cta_url','','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','mobile-apps','type','mobile_apps','internal_name','Applications mobiles','enabled',false,'order',10,
        'eyebrow','','title','Retrouvez Omnia sur mobile',
        'subtitle','Cette section apparaîtra lorsque l’application Android ou iOS sera publiée et activée.','body','',
        'primary_cta_label','','primary_cta_url','','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','social-networks','type','social_networks','internal_name','Réseaux sociaux','enabled',false,'order',11,
        'eyebrow','','title','Suivez Omnia Global Academy',
        'subtitle','Cette section apparaît uniquement avec des comptes officiels activés.','body','',
        'primary_cta_label','','primary_cta_url','','secondary_cta_label','','secondary_cta_url',''
      ),
      jsonb_build_object(
        'id','final-cta','type','final_cta','internal_name','Inscription finale','enabled',true,'order',12,
        'eyebrow','','title','Votre prochain objectif commence ici.',
        'subtitle','Rejoignez Omnia selon votre projet professionnel ou organisationnel.','body','',
        'primary_cta_label','Créer un compte','primary_cta_url','/inscription',
        'secondary_cta_label','Découvrir les formations','secondary_cta_url','/catalogue'
      )
    )
  );

  INSERT INTO public.site_settings(key, value)
  VALUES
    ('landing_page_published', landing_config),
    ('landing_page_publication_meta', jsonb_build_object(
      'published_at', now(),
      'published_by', null,
      'previous_available', false
    ))
  ON CONFLICT (key) DO NOTHING;

  INSERT INTO public.landing_page_cms_state(
    id, draft, previous_published, published_at, published_by, updated_at, updated_by
  )
  VALUES (1, landing_config, null, now(), null, now(), null)
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(value, '{}'::jsonb)
  INTO legacy_socials
  FROM public.site_settings
  WHERE key = 'social_networks';
  legacy_socials := COALESCE(legacy_socials, '{}'::jsonb);

  FOR social_key, social_label, social_icon IN
    SELECT * FROM (VALUES
      ('facebook','Facebook','facebook'),
      ('instagram','Instagram','instagram'),
      ('youtube','YouTube','youtube'),
      ('linkedin','LinkedIn','linkedin'),
      ('whatsapp','WhatsApp','whatsapp'),
      ('indeed','Indeed','other')
    ) AS networks(key,label,icon)
  LOOP
    social_url := NULLIF(BTRIM(COALESCE(legacy_socials ->> social_key, '')), '');
    IF social_url IS NOT NULL THEN
      social_items := social_items || jsonb_build_array(jsonb_build_object(
        'id','legacy-' || social_key,
        'name',social_label,
        'url',social_url,
        'enabled',true,
        'display_order',jsonb_array_length(social_items) + 1,
        'show_homepage',false,
        'show_footer',true,
        'icon_key',social_icon,
        'logo_url','',
        'alt_text','Compte officiel ' || social_label || ' d’Omnia Global Academy'
      ));
    END IF;
  END LOOP;

  SELECT COALESCE(value, '{}'::jsonb)
  INTO legacy_apps
  FROM public.site_settings
  WHERE key = 'app_downloads';
  legacy_apps := COALESCE(legacy_apps, '{}'::jsonb);

  app_items := jsonb_build_array(
    jsonb_build_object(
      'id','ios-app-store','store','ios','name','App Store',
      'url',COALESCE(legacy_apps ->> 'app_store',''),
      'enabled',NULLIF(BTRIM(COALESCE(legacy_apps ->> 'app_store','')), '') IS NOT NULL,
      'display_order',1,'show_homepage',true,'show_footer',true
    ),
    jsonb_build_object(
      'id','android-google-play','store','android','name','Google Play',
      'url',COALESCE(legacy_apps ->> 'google_play',''),
      'enabled',NULLIF(BTRIM(COALESCE(legacy_apps ->> 'google_play','')), '') IS NOT NULL,
      'display_order',2,'show_homepage',true,'show_footer',true
    )
  );

  UPDATE public.landing_page_cms_state
  SET
    social_networks = social_items,
    mobile_apps = app_items,
    updated_at = now()
  WHERE id = 1;
END $$;
