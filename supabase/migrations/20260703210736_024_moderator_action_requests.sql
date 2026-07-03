CREATE TABLE IF NOT EXISTS moderator_action_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  target_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE moderator_action_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_mod_action_requests_own" ON moderator_action_requests FOR SELECT
  TO authenticated USING (auth.uid() = moderator_id OR auth.uid() = reviewed_by);

CREATE POLICY "insert_mod_action_requests_own" ON moderator_action_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = moderator_id);

CREATE POLICY "update_mod_action_requests_admin" ON moderator_action_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_mod_action_requests_admin" ON moderator_action_requests FOR DELETE
  TO authenticated USING (auth.uid() = moderator_id);

CREATE INDEX IF NOT EXISTS idx_mod_action_requests_status ON moderator_action_requests(status);
CREATE INDEX IF NOT EXISTS idx_mod_action_requests_moderator ON moderator_action_requests(moderator_id);
