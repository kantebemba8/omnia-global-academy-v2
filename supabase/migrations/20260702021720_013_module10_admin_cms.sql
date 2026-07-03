-- Module 10: Super-admin Dashboard + CMS

-- Paliers de prix
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_min DECIMAL(6,2) NOT NULL,
  score_max DECIMAL(6,2),
  price_xof INTEGER NOT NULL,
  label VARCHAR(100),
  is_base_tier BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO pricing_tiers (score_min, score_max, price_xof, label, is_base_tier)
VALUES
  (0, 15, 5000, 'Palier Essentiel', true),
  (16, 30, 15000, 'Palier Standard', true),
  (31, 50, 25000, 'Palier Professionnel', true),
  (51, NULL, 35000, 'Palier Expert (sur devis)', true)
ON CONFLICT DO NOTHING;

-- Historique modifications multiplicateurs
CREATE TABLE IF NOT EXISTS multiplier_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(255) NOT NULL,
  old_value DECIMAL(4,2) NOT NULL,
  new_value DECIMAL(4,2) NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons promotionnels
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL,
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  applicable_to VARCHAR(30) DEFAULT 'all',
  applicable_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compte démo
CREATE TABLE IF NOT EXISTS demo_account_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  password_plain VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active_session_token VARCHAR(255),
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  configured_by UUID REFERENCES users(id),
  configured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Répartitions financières école
CREATE TABLE IF NOT EXISTS school_revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID UNIQUE NOT NULL REFERENCES courses(id),
  school_percent INTEGER NOT NULL,
  platform_percent INTEGER NOT NULL,
  school_amount_xof INTEGER NOT NULL,
  platform_amount_xof INTEGER NOT NULL,
  accepted_by_director BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add is_published to courses if missing
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- RLS
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_account_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_revenue_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE multiplier_audit_log ENABLE ROW LEVEL SECURITY;

-- pricing_tiers: public read
CREATE POLICY "pricing_public_read" ON pricing_tiers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "pricing_admin_write" ON pricing_tiers
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- coupons: admin only
CREATE POLICY "coupons_admin_select" ON coupons
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "coupons_admin_insert" ON coupons
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "coupons_admin_update" ON coupons
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "coupons_admin_delete" ON coupons
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- demo_account_config: admin only
CREATE POLICY "demo_admin_select" ON demo_account_config
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "demo_admin_insert" ON demo_account_config
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "demo_admin_update" ON demo_account_config
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "demo_admin_delete" ON demo_account_config
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- school_revenue_splits: admin + directeur can read own
CREATE POLICY "splits_admin_select" ON school_revenue_splits
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'etablissement_directeur'))
  );

CREATE POLICY "splits_admin_insert" ON school_revenue_splits
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "splits_admin_update" ON school_revenue_splits
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'etablissement_directeur'))
  );

CREATE POLICY "splits_admin_delete" ON school_revenue_splits
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- multiplier_audit_log: admin only
CREATE POLICY "mul_audit_admin_select" ON multiplier_audit_log
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "mul_audit_admin_insert" ON multiplier_audit_log
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
