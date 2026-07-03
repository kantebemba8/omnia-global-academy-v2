-- ── COURSES TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              VARCHAR(500) NOT NULL,
  short_description  TEXT,
  cover_image_url    TEXT,
  category           VARCHAR(100),
  level              VARCHAR(30) DEFAULT 'Débutant',
  price_xof          INTEGER DEFAULT 0,
  is_free            BOOLEAN DEFAULT FALSE,
  is_published       BOOLEAN DEFAULT FALSE,
  cpd_hours          DECIMAL(5,2) DEFAULT 0,
  average_rating     DECIMAL(3,2) DEFAULT 0,
  total_reviews      INTEGER DEFAULT 0,
  total_students     INTEGER DEFAULT 0,
  creator_id         UUID REFERENCES users(id),
  establishment_id   UUID,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_public_read" ON courses
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- ── LANDING PAGE + STATIC PAGE SETTINGS ─────────────────────────────────────
INSERT INTO site_settings (key, value) VALUES
  ('landing_hero_title_fr',
   '"Formez-vous, certifiez-vous, transformez votre avenir"'),
  ('landing_hero_subtitle_fr',
   '"Des formations certifiées CPD, accessibles partout en Afrique de l''Ouest, payables par Mobile Money."'),
  ('landing_stats',
   '{"formations":"500+","apprenants":"10 000+","pays":"15+","formateurs":"200+"}'),
  ('landing_piliers',
   '[{"icon":"Award","title":"Certifications CPD internationales","desc":"Reconnues mondialement, valorisables sur LinkedIn en un clic"},{"icon":"Monitor","title":"Mode éco-data","desc":"Apprenez même avec une connexion limitée — optimisé pour l''Afrique de l''Ouest"},{"icon":"Globe","title":"Paiement Mobile Money","desc":"Wave, Orange Money, MTN, Moov et toutes les solutions locales africaines"},{"icon":"Users","title":"Communauté africaine","desc":"Rejoignez des milliers d''apprenants et formateurs à travers le continent"}]'),
  ('landing_devenir_formateur_title_fr',
   '"Partagez votre savoir avec l''Afrique"'),
  ('landing_devenir_formateur_desc_fr',
   '"Créez des formations certifiées, touchez des milliers d''apprenants et générez des revenus depuis chez vous."'),
  ('fintech_logos', '[]'),
  ('landing_testimonials', '[]'),
  ('a_propos_content_fr',
   '"Omnia Global Academy est une plateforme de formation en ligne fondée au Mali, avec l''ambition de connecter les meilleurs formateurs et les apprenants les plus motivés, partout en Afrique de l''Ouest puis sur tout le continent. Notre mission est de rendre l''éducation de qualité accessible, flexible et reconnue, en combinant une pédagogie rigoureuse, des technologies adaptées aux réalités locales et un accompagnement humain à chaque étape."'),
  ('confidentialite_content_fr',
   '"Omnia Global Academy s''engage à protéger vos données personnelles. Les informations collectées lors de votre inscription (nom, email, téléphone) sont utilisées uniquement pour la gestion de votre compte et la communication pédagogique. Elles ne sont jamais revendues à des tiers. Vous pouvez à tout moment demander la modification ou la suppression de vos données en nous contactant."')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
