-- Module 14 — Forum Communautaire + Espace Carrière

-- Extend forum_posts (already created in Module 9)
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS is_solved BOOLEAN DEFAULT FALSE;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS solved_reply_id UUID REFERENCES forum_posts(id);

-- Likes on posts
CREATE TABLE IF NOT EXISTS forum_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS forum_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id),
  reported_by UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, reported_by)
);

-- Extend job_offers (already created in Module 8)
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS salary_range VARCHAR(100);
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS required_level VARCHAR(50);
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS skills_required TEXT[];
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS is_external_recruiter BOOLEAN DEFAULT FALSE;
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS recruiter_name VARCHAR(255);
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS recruiter_email VARCHAR(255);
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS recruiter_company VARCHAR(255);
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS applications_count INTEGER DEFAULT 0;

-- Job applications
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES users(id),
  cover_letter TEXT,
  cv_url TEXT,
  status VARCHAR(30) DEFAULT 'submitted',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, applicant_id)
);

-- External recruiters
CREATE TABLE IF NOT EXISTS external_recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE forum_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_recruiters ENABLE ROW LEVEL SECURITY;

-- forum_likes: own CRUD
CREATE POLICY "forum_likes_select" ON forum_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "forum_likes_insert" ON forum_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "forum_likes_delete" ON forum_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- forum_reports: insert own
CREATE POLICY "forum_reports_insert" ON forum_reports FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "forum_reports_select" ON forum_reports FOR SELECT TO authenticated USING (reported_by = auth.uid());

-- job_applications: own
CREATE POLICY "job_applications_select" ON job_applications FOR SELECT TO authenticated USING (applicant_id = auth.uid());
CREATE POLICY "job_applications_insert" ON job_applications FOR INSERT TO authenticated WITH CHECK (applicant_id = auth.uid());
CREATE POLICY "job_applications_update" ON job_applications FOR UPDATE TO authenticated USING (applicant_id = auth.uid()) WITH CHECK (applicant_id = auth.uid());

-- job_offers: approved public
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_offers' AND policyname = 'job_offers_approved_public'
  ) THEN
    CREATE POLICY "job_offers_approved_public" ON job_offers FOR SELECT TO anon, authenticated USING (status = 'approved');
  END IF;
END $$;

-- external_recruiters: insert only (public)
CREATE POLICY "ext_recruiters_insert" ON external_recruiters FOR INSERT TO anon, authenticated WITH CHECK (true);
