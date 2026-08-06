BEGIN;

-- Neutralité géographique : aucun pays ne doit être attribué sans choix explicite.
ALTER TABLE IF EXISTS public.users ALTER COLUMN country_code DROP DEFAULT;
ALTER TABLE IF EXISTS public.forum_posts ALTER COLUMN country_code DROP DEFAULT;

-- Neutraliser uniquement les anciens textes système régionaux connus, sans écraser
-- les contenus déjà personnalisés par l'Administration.
UPDATE public.site_settings
SET value = to_jsonb('La plateforme internationale de formation en ligne arrive bientôt'::text),
    updated_at = now()
WHERE key = 'coming_soon_title_fr'
  AND value #>> '{}' = 'La plateforme africaine de formation en ligne arrive bientôt';

UPDATE public.site_settings
SET value = to_jsonb('Des formations certifiées internationalement, adaptées aux réalités professionnelles de chaque pays.'::text),
    updated_at = now()
WHERE key = 'coming_soon_subtitle_fr'
  AND value #>> '{}' = 'Des formations certifiées internationalement, adaptées aux réalités professionnelles africaines.';

UPDATE public.site_settings
SET value = to_jsonb('Des formations accessibles dans différents pays, avec des moyens de paiement et des parcours adaptés à chaque contexte.'::text),
    updated_at = now()
WHERE key = 'landing_hero_subtitle_fr'
  AND (value #>> '{}') ILIKE '%Afrique de l''Ouest%';

UPDATE public.site_settings
SET value = jsonb_build_array(
      jsonb_build_object('icon','Award','title','Certifications et compétences vérifiables','desc','Valorisez des acquis reconnus et partageables dans votre parcours professionnel'),
      jsonb_build_object('icon','Monitor','title','Expérience accessible','desc','Apprenez avec une interface optimisée pour les connexions et appareils variés'),
      jsonb_build_object('icon','Globe','title','Accès international','desc','Retrouvez des formations, opportunités et services adaptés à plusieurs pays'),
      jsonb_build_object('icon','Users','title','Communauté mondiale','desc','Échangez avec des apprenants, formateurs, Structures et partenaires de différents horizons')
    ),
    updated_at = now()
WHERE key = 'landing_piliers'
  AND value::text ILIKE '%Afrique de l''Ouest%';

UPDATE public.site_settings
SET value = to_jsonb('Partagez votre savoir avec le monde'::text),
    updated_at = now()
WHERE key = 'landing_devenir_formateur_title_fr'
  AND value #>> '{}' = 'Partagez votre savoir avec l''Afrique';

UPDATE public.site_settings
SET value = to_jsonb('Omnia Global Academy est une plateforme internationale de formation, de compétences et d''opportunités. Elle connecte des apprenants, des formateurs, des Structures et des partenaires dans différents pays, avec une expérience accessible, flexible et reconnue.'::text),
    updated_at = now()
WHERE key = 'a_propos_content_fr'
  AND (value #>> '{}') ILIKE '%fondée au Mali%';

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  locale text NOT NULL DEFAULT 'fr',
  source text NOT NULL DEFAULT 'public_footer',
  consent_version text NOT NULL DEFAULT '2026-08',
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  provider_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_lower_uidx
  ON public.newsletter_subscribers (lower(email));
CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_user_idx
  ON public.newsletter_subscribers (user_id) WHERE user_id IS NOT NULL;

-- Reprendre les consentements déjà enregistrés dans users sans créer de doublon.
INSERT INTO public.newsletter_subscribers (
  email, user_id, status, locale, source, consent_version, consented_at, created_at, updated_at
)
SELECT lower(u.email), u.id, 'active', 'fr', 'migration_backfill', '2026-08', COALESCE(u.created_at, now()), now(), now()
FROM public.users u
WHERE u.subscribe_newsletter IS TRUE
  AND u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.newsletter_subscribers ns WHERE lower(ns.email) = lower(u.email)
  );

CREATE TABLE IF NOT EXISTS public.newsletter_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES public.newsletter_subscribers(id) ON DELETE SET NULL,
  email text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('subscribe', 'unsubscribe', 'resubscribe', 'profile_opt_in', 'profile_opt_out', 'registration_opt_in')),
  source text NOT NULL,
  locale text NOT NULL DEFAULT 'fr',
  consent_version text NOT NULL DEFAULT '2026-08',
  ip_hash text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_consent_events_email_idx
  ON public.newsletter_consent_events (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_consent_events_subscriber_idx
  ON public.newsletter_consent_events (subscriber_id, created_at DESC);

ALTER TABLE public.newsletter_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'brevo',
  ADD COLUMN IF NOT EXISTS provider_campaign_id text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_consent_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.newsletter_subscribers FROM anon, authenticated;
REVOKE ALL ON TABLE public.newsletter_consent_events FROM anon, authenticated;

COMMENT ON TABLE public.newsletter_subscribers IS 'Consentements newsletter gérés uniquement via les Edge Functions Omnia.';
COMMENT ON TABLE public.newsletter_consent_events IS 'Journal append-only des consentements et retraits newsletter.';
COMMENT ON COLUMN public.newsletter_subscribers.email IS 'Adresse normalisée en minuscules ; unicité assurée par index lower(email).';

COMMIT;
