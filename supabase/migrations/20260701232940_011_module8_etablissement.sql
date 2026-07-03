-- school_teachers
CREATE TABLE IF NOT EXISTS school_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES etablissement_profiles(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'actif',
  created_by_director_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(establishment_id, teacher_user_id)
);

-- group_licenses
CREATE TABLE IF NOT EXISTS group_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  code VARCHAR(50) UNIQUE NOT NULL,
  max_seats INTEGER NOT NULL,
  used_seats INTEGER DEFAULT 0,
  price_per_seat_xof INTEGER DEFAULT 0,
  teacher_compensatory_xof INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- license_usages
CREATE TABLE IF NOT EXISTS license_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES group_licenses(id),
  user_id UUID NOT NULL REFERENCES users(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(license_id, user_id)
);

-- job_offers
CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by_id UUID NOT NULL REFERENCES users(id),
  establishment_id UUID REFERENCES etablissement_profiles(id),
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255),
  contract_type VARCHAR(50),
  category VARCHAR(100),
  deadline DATE,
  status VARCHAR(30) DEFAULT 'pending_moderation',
  moderated_by UUID REFERENCES users(id),
  moderated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ALTER courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pending_school_validation BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES etablissement_profiles(id);

-- RLS
ALTER TABLE school_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_director_read" ON school_teachers FOR SELECT
  TO authenticated USING (
    establishment_id IN (SELECT id FROM etablissement_profiles WHERE user_id = auth.uid())
    OR teacher_user_id = auth.uid()
  );

CREATE POLICY "teachers_director_insert" ON school_teachers FOR INSERT
  TO authenticated WITH CHECK (
    establishment_id IN (SELECT id FROM etablissement_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "teachers_director_update" ON school_teachers FOR UPDATE
  TO authenticated USING (
    establishment_id IN (SELECT id FROM etablissement_profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    establishment_id IN (SELECT id FROM etablissement_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "teachers_director_delete" ON school_teachers FOR DELETE
  TO authenticated USING (
    establishment_id IN (SELECT id FROM etablissement_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "licenses_select" ON group_licenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "licenses_insert" ON group_licenses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "licenses_update" ON group_licenses FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "licenses_delete" ON group_licenses FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "license_usages_select" ON license_usages FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "license_usages_insert" ON license_usages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "license_usages_update" ON license_usages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "license_usages_delete" ON license_usages FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "job_offers_public_read" ON job_offers FOR SELECT TO anon, authenticated USING (status = 'approved');

CREATE POLICY "job_offers_insert" ON job_offers FOR INSERT TO authenticated WITH CHECK (posted_by_id = auth.uid());

CREATE POLICY "job_offers_update" ON job_offers FOR UPDATE TO authenticated
  USING (posted_by_id = auth.uid() OR moderated_by = auth.uid())
  WITH CHECK (posted_by_id = auth.uid() OR moderated_by = auth.uid());

CREATE POLICY "job_offers_delete" ON job_offers FOR DELETE TO authenticated USING (posted_by_id = auth.uid());
