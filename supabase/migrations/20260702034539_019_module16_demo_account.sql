-- Module 16: Demo account universal configuration

-- Add columns to demo_account_config if not present
ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS demo_roles JSONB DEFAULT '["apprenant","professeur","etablissement_directeur","moderateur"]';

ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS demo_course_ids JSONB DEFAULT '[]';

ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS heartbeat_token VARCHAR(255);

ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS active_session_token VARCHAR(255);

ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE demo_account_config
  ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255);

-- Initialize demo user (all required fields provided)
INSERT INTO users (
  email,
  phone_number,
  full_name,
  birth_date,
  country_code,
  status,
  password_hash
) VALUES (
  'test@omniaglobalacademy.com',
  '+22300000000',
  'Compte Démo Omnia',
  '1990-01-01',
  'ML',
  'suspendu',
  '$2a$10$invalidhashlockeduntilconfiguredbytheadministratorXXXXX'
) ON CONFLICT (email) DO NOTHING;

-- Initialize demo_account_config if empty
INSERT INTO demo_account_config (
  password_plain,
  expires_at
)
SELECT
  'NON_CONFIGURE',
  NOW() - INTERVAL '1 second'
WHERE NOT EXISTS (SELECT 1 FROM demo_account_config);
