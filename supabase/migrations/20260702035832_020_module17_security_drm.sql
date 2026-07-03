-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  ip_address VARCHAR(50),
  user_agent TEXT,
  endpoint VARCHAR(255),
  details JSONB,
  severity VARCHAR(20) DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_event ON security_audit_log(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON security_audit_log(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_log(user_id, created_at);

-- IP blocklist
CREATE TABLE IF NOT EXISTS ip_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(50) UNIQUE NOT NULL,
  reason VARCHAR(255),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocklist_ip ON ip_blocklist(ip_address);

-- Rate limit log (sliding window)
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_log(rate_key, created_at);

-- RLS
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_select" ON security_audit_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "audit_log_service_insert" ON security_audit_log FOR INSERT
  TO authenticated, anon WITH CHECK (true);

CREATE POLICY "ip_blocklist_admin_all" ON ip_blocklist FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "rate_limit_service_insert" ON rate_limit_log FOR INSERT
  TO authenticated, anon WITH CHECK (true);

CREATE POLICY "rate_limit_service_select" ON rate_limit_log FOR SELECT
  TO authenticated, anon USING (true);

-- Cleanup old rate limit entries (keep only last hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_log()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '2 hours';
END;
$$;
