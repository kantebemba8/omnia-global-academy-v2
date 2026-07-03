
-- ══════════════════════════════════════════════════════════════════
-- MODULE 6 — Tableau de bord Apprenant
-- ══════════════════════════════════════════════════════════════════

-- 1. Colonne ai_tokens sur users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_tokens INTEGER DEFAULT 1;

-- 2. TABLE REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                VARCHAR(20) DEFAULT 'pending',
  reward_referrer_xof   INTEGER DEFAULT 0,
  reward_referred_xof   INTEGER DEFAULT 0,
  rewarded_at           TIMESTAMP WITH TIME ZONE,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_own_read" ON referrals;
CREATE POLICY "referrals_own_read" ON referrals FOR SELECT
  TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- 3. TABLE COURSE_PRIVATE_FEEDBACK
CREATE TABLE IF NOT EXISTS course_private_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  quality_score     INTEGER NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
  would_recommend   BOOLEAN NOT NULL,
  suggestions       TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE course_private_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_own_read" ON course_private_feedback;
CREATE POLICY "feedback_own_read" ON course_private_feedback FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "feedback_own_insert" ON course_private_feedback;
CREATE POLICY "feedback_own_insert" ON course_private_feedback FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- 4. TABLE CV_BUILDER_DATA
CREATE TABLE IF NOT EXISTS cv_builder_data (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step1_data        JSONB,
  step2_data        JSONB,
  step3_data        JSONB,
  step4_template    VARCHAR(50) DEFAULT 'moderne',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cv_builder_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cv_own_read" ON cv_builder_data;
CREATE POLICY "cv_own_read" ON cv_builder_data FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cv_own_insert" ON cv_builder_data;
CREATE POLICY "cv_own_insert" ON cv_builder_data FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cv_own_update" ON cv_builder_data;
CREATE POLICY "cv_own_update" ON cv_builder_data FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. SITE SETTINGS inserts
INSERT INTO site_settings (key, value) VALUES
  ('referral_reward_referrer_xof', '2500'),
  ('referral_reward_referred_xof', '1000'),
  ('ai_token_per_registration', '1'),
  ('ai_token_per_purchase', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
