-- moderator_permissions
CREATE TABLE IF NOT EXISTS moderator_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_see_pending_courses BOOLEAN DEFAULT FALSE,
  can_validate_course_price BOOLEAN DEFAULT FALSE,
  can_reject_course BOOLEAN DEFAULT FALSE,
  can_request_course_modification BOOLEAN DEFAULT FALSE,
  can_approve_transmit_course BOOLEAN DEFAULT FALSE,
  can_create_assisted_course BOOLEAN DEFAULT FALSE,
  can_see_learners_list BOOLEAN DEFAULT FALSE,
  can_see_professors_list BOOLEAN DEFAULT FALSE,
  can_suspend_account BOOLEAN DEFAULT FALSE,
  can_validate_professor_kyc BOOLEAN DEFAULT FALSE,
  can_validate_establishment_kyc BOOLEAN DEFAULT FALSE,
  can_moderate_forum BOOLEAN DEFAULT FALSE,
  can_moderate_jobs BOOLEAN DEFAULT FALSE,
  can_manage_support BOOLEAN DEFAULT FALSE,
  can_view_ai_conversations BOOLEAN DEFAULT FALSE,
  can_view_analytics BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- moderation_log
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'open',
  assigned_to UUID REFERENCES users(id),
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- forum_posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  space VARCHAR(30) NOT NULL,
  course_id UUID REFERENCES courses(id),
  parent_id UUID REFERENCES forum_posts(id),
  title VARCHAR(500),
  content TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  country_code VARCHAR(10) DEFAULT 'ML',
  is_flagged BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KYC tracking columns for professeur_profiles
ALTER TABLE professeur_profiles ADD COLUMN IF NOT EXISTS kyc_validated_by UUID REFERENCES users(id);
ALTER TABLE professeur_profiles ADD COLUMN IF NOT EXISTS kyc_validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE professeur_profiles ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;

-- KYC tracking columns for etablissement_profiles
ALTER TABLE etablissement_profiles ADD COLUMN IF NOT EXISTS kyc_validated_by UUID REFERENCES users(id);
ALTER TABLE etablissement_profiles ADD COLUMN IF NOT EXISTS kyc_validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE etablissement_profiles ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;

-- courses: track which moderator validated
ALTER TABLE courses ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE;

-- RLS
ALTER TABLE moderator_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mod_perms_select" ON moderator_permissions FOR SELECT
  TO authenticated USING (moderator_user_id = auth.uid());

CREATE POLICY "mod_perms_insert" ON moderator_permissions FOR INSERT
  TO authenticated WITH CHECK (moderator_user_id = auth.uid());

CREATE POLICY "mod_perms_update" ON moderator_permissions FOR UPDATE
  TO authenticated USING (moderator_user_id = auth.uid()) WITH CHECK (moderator_user_id = auth.uid());

CREATE POLICY "mod_perms_delete" ON moderator_permissions FOR DELETE
  TO authenticated USING (moderator_user_id = auth.uid());

CREATE POLICY "mod_log_select" ON moderation_log FOR SELECT
  TO authenticated USING (moderator_id = auth.uid());

CREATE POLICY "mod_log_insert" ON moderation_log FOR INSERT
  TO authenticated WITH CHECK (moderator_id = auth.uid());

CREATE POLICY "mod_log_update" ON moderation_log FOR UPDATE
  TO authenticated USING (moderator_id = auth.uid()) WITH CHECK (moderator_id = auth.uid());

CREATE POLICY "mod_log_delete" ON moderation_log FOR DELETE
  TO authenticated USING (moderator_id = auth.uid());

CREATE POLICY "support_select" ON support_tickets FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "support_insert" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "support_update" ON support_tickets FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "support_delete" ON support_tickets FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "forum_public_select" ON forum_posts FOR SELECT
  TO anon, authenticated USING (is_visible = true);

CREATE POLICY "forum_insert" ON forum_posts FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "forum_update" ON forum_posts FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "forum_delete" ON forum_posts FOR DELETE
  TO authenticated USING (user_id = auth.uid());
