-- Programme 3 GM4 — Assistant IA pédagogique gouverné

CREATE TABLE IF NOT EXISTS ai_pedagogical_governance (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'claude-sonnet-4-6',
  max_tokens integer NOT NULL DEFAULT 1000 CHECK (max_tokens BETWEEN 200 AND 4000),
  hourly_limit integer NOT NULL DEFAULT 20 CHECK (hourly_limit BETWEEN 1 AND 200),
  max_chunks integer NOT NULL DEFAULT 6 CHECK (max_chunks BETWEEN 1 AND 12),
  similarity_threshold numeric(4,3) NOT NULL DEFAULT 0.720 CHECK (similarity_threshold BETWEEN 0.300 AND 0.950),
  allowed_modes text[] NOT NULL DEFAULT ARRAY['question','explanation','reformulation','exercise','revision_plan','recommendation'],
  log_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_pedagogical_governance (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_pedagogical_course_settings (
  course_id uuid PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  allowed_modes text[] NOT NULL DEFAULT ARRAY['question','explanation','reformulation','exercise','revision_plan','recommendation'],
  model text,
  max_tokens integer CHECK (max_tokens IS NULL OR max_tokens BETWEEN 200 AND 4000),
  hourly_limit integer CHECK (hourly_limit IS NULL OR hourly_limit BETWEEN 1 AND 200),
  quality_notes text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_pedagogical_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  mode text NOT NULL,
  question text NOT NULL,
  response_excerpt text,
  status text NOT NULL DEFAULT 'answered' CHECK (status IN ('answered','no_context','blocked','error')),
  chunks_used integer NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_pedagogical_logs_user_created ON ai_pedagogical_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pedagogical_logs_course_created ON ai_pedagogical_usage_logs(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pedagogical_logs_status ON ai_pedagogical_usage_logs(status, created_at DESC);

ALTER TABLE ai_pedagogical_governance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pedagogical_course_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pedagogical_usage_logs ENABLE ROW LEVEL SECURITY;

-- L'accès est centralisé dans les Edge Functions au rôle service.
REVOKE ALL ON ai_pedagogical_governance FROM anon, authenticated;
REVOKE ALL ON ai_pedagogical_course_settings FROM anon, authenticated;
REVOKE ALL ON ai_pedagogical_usage_logs FROM anon, authenticated;
