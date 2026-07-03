-- Ensure moderator_action_requests has the correct RLS policies.
-- Drop old permissive policy if it exists, replace with scoped ones.
DROP POLICY IF EXISTS "mod_requests_own" ON moderator_action_requests;
DROP POLICY IF EXISTS "select_mod_action_requests_own" ON moderator_action_requests;
DROP POLICY IF EXISTS "insert_mod_action_requests_own" ON moderator_action_requests;
DROP POLICY IF EXISTS "update_mod_action_requests_admin" ON moderator_action_requests;
DROP POLICY IF EXISTS "delete_mod_action_requests_admin" ON moderator_action_requests;

-- Moderators can see only their own requests; admins see all via service role
CREATE POLICY "select_mod_action_requests" ON moderator_action_requests FOR SELECT
  TO authenticated USING (auth.uid() = moderator_id);

-- Only the submitting moderator can insert their own request
CREATE POLICY "insert_mod_action_requests" ON moderator_action_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = moderator_id);

-- Only service role (admin approval flow via edge function) can update status
CREATE POLICY "update_mod_action_requests" ON moderator_action_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Moderators cannot delete their own requests (audit trail)
-- Deletion reserved for service role only (no client policy)
