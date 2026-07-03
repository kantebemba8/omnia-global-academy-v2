-- Module 13 — Notifications

-- Journal de toutes les notifications envoyées
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  channel VARCHAR(20) NOT NULL,
  template_id VARCHAR(50),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(30) DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anti-abandon : tracking dernier accès cours
CREATE TABLE IF NOT EXISTS course_last_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  anti_abandon_sent BOOLEAN DEFAULT FALSE,
  anti_abandon_sent_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, course_id)
);

-- File d'attente des notifications asynchrones
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  payload JSONB NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuration newsletter Super-admin
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject VARCHAR(500) NOT NULL,
  content_html TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(30) DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES users(id),
  recipients_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_last_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_campaigns ENABLE ROW LEVEL SECURITY;

-- notification_log: own read only
CREATE POLICY "notif_log_select_own" ON notification_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_log_insert_service" ON notification_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- course_last_access: own CRUD
CREATE POLICY "last_access_select_own" ON course_last_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "last_access_insert_own" ON course_last_access
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "last_access_update_own" ON course_last_access
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "last_access_delete_own" ON course_last_access
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- notification_queue: service role only via anon insert, no user reads
CREATE POLICY "notif_queue_insert" ON notification_queue
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- newsletter_campaigns: no direct user access (service role only)
CREATE POLICY "newsletter_no_direct_access" ON newsletter_campaigns
  FOR SELECT TO authenticated
  USING (false);
