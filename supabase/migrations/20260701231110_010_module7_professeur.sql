
-- ══════════════════════════════════════════════════════════════════
-- MODULE 7 — Tableau de bord Professeur
-- ══════════════════════════════════════════════════════════════════

-- 1. WALLETS
CREATE TABLE IF NOT EXISTS wallets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_xof         INTEGER DEFAULT 0,
  total_earned_xof    INTEGER DEFAULT 0,
  total_withdrawn_xof INTEGER DEFAULT 0,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_own" ON wallets;
CREATE POLICY "wallet_own" ON wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. WALLET_TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL,
  amount_xof  INTEGER NOT NULL,
  description TEXT,
  course_id   UUID REFERENCES courses(id),
  order_id    UUID,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_own" ON wallet_transactions;
CREATE POLICY "transactions_own" ON wallet_transactions FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- 3. PAYOUT_REQUESTS
CREATE TABLE IF NOT EXISTS payout_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID NOT NULL REFERENCES wallets(id),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_xof       INTEGER NOT NULL,
  channel          VARCHAR(30) NOT NULL,
  mm_operator      VARCHAR(30),
  mm_phone         VARCHAR(50),
  bank_name        VARCHAR(255),
  account_holder   VARCHAR(255),
  bank_code        VARCHAR(20),
  branch_code      VARCHAR(20),
  account_number   VARCHAR(50),
  rib_key          VARCHAR(10),
  iban             VARCHAR(50),
  swift            VARCHAR(20),
  status           VARCHAR(30) DEFAULT 'pending',
  admin_note       TEXT,
  requested_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at     TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payouts_user ON payout_requests(user_id);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payouts_own" ON payout_requests;
CREATE POLICY "payouts_own" ON payout_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. CATEGORY_MULTIPLIERS
CREATE TABLE IF NOT EXISTS category_multipliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(255) UNIQUE NOT NULL,
  multiplier    DECIMAL(4,2) NOT NULL,
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE category_multipliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "multipliers_public_read" ON category_multipliers;
CREATE POLICY "multipliers_public_read" ON category_multipliers FOR SELECT TO anon, authenticated USING (true);

INSERT INTO category_multipliers (category_name, multiplier) VALUES
('Data & Intelligence Artificielle', 1.5),
('Informatique & Développement', 1.4),
('Cybersécurité & Réseaux', 1.4),
('Business & Entrepreneuriat', 1.3),
('Finance & Comptabilité', 1.3),
('Droit & Juridique', 1.3),
('Marketing & Communication', 1.2),
('Santé & Médecine', 1.2),
('Architecture & BTP', 1.2),
('Éducation & Pédagogie', 1.1),
('Langues & Linguistique', 1.0),
('Agriculture & Agro-business', 1.0),
('Tourisme & Hôtellerie', 1.0),
('Environnement & Développement durable', 1.0),
('Bien-être & Développement personnel', 0.9),
('Artisanat & Métiers manuels', 0.9),
('Cuisine & Gastronomie', 0.9),
('Mode & Stylisme', 0.9),
('Élevage & Pêche', 0.9),
('Arts & Créativité', 0.8),
('Musique & Audio', 0.8),
('Loisirs & Hobbies', 0.8)
ON CONFLICT (category_name) DO UPDATE SET multiplier = EXCLUDED.multiplier;

-- 5. LESSON_RESOURCES
CREATE TABLE IF NOT EXISTS lesson_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  url           TEXT,
  file_url      TEXT,
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE lesson_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resources_public_read" ON lesson_resources;
CREATE POLICY "resources_public_read" ON lesson_resources FOR SELECT TO anon, authenticated USING (true);

-- 6. ALTER courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'brouillon';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS score_calcule DECIMAL(6,2) DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prix_provisoire_xof INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS admin_comment TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS requested_cpd BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_assisted BOOLEAN DEFAULT FALSE;

-- 7. ALTER user_final_validation for project evaluation
ALTER TABLE user_final_validation ADD COLUMN IF NOT EXISTS corrector_notes TEXT;
ALTER TABLE user_final_validation ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP WITH TIME ZONE;

-- 8. SITE SETTINGS
INSERT INTO site_settings (key, value) VALUES
('commission_normal_sans_cpd',    '{"professeur":70,"plateforme":30}'),
('commission_normal_avec_cpd',    '{"professeur":50,"plateforme":50}'),
('commission_assistee_sans_cpd',  '{"professeur":50,"plateforme":50}'),
('commission_assistee_avec_cpd',  '{"professeur":30,"plateforme":70}'),
('payout_minimum_xof',            '5000'),
('cpd_premium_price_xof',         '50000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
