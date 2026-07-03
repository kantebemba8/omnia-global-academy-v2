CREATE TABLE site_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by_admin_id UUID
);

-- Insert initial values
INSERT INTO site_settings (key, value) VALUES
('coming_soon_enabled', '"true"'),
('coming_soon_title_fr', '"La plateforme africaine de formation en ligne arrive bientôt"'),
('coming_soon_subtitle_fr', '"Des formations certifiées internationalement, adaptées aux réalités professionnelles africaines."'),
('launch_date', 'null'),
('social_networks', '{"facebook":null,"instagram":null,"youtube":null,"linkedin":null,"indeed":null,"whatsapp":null}'),
('app_downloads', '{"google_play":null,"app_store":null}'),
('collaborations_logos', '[]'),
('hero_media_url', 'null'),
('follow_us_label_fr', '"Suivez-nous"'),
('follow_us_label_en', '"Follow us"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Policies for site_settings (public read, authenticated write)
CREATE POLICY "site_settings_public_read" ON site_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "site_settings_authenticated_insert" ON site_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "site_settings_authenticated_update" ON site_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);