-- Module 15: AI/RAG — pgvector, rag_chunks, ai_conversations, subtitle_jobs

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG chunks (course content indexed for semantic search)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lesson_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_course ON rag_chunks(course_id);

-- AI conversation journal (one per user per course)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Subtitle translation jobs
CREATE TABLE IF NOT EXISTS subtitle_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID UNIQUE NOT NULL REFERENCES course_lessons(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status VARCHAR(30) DEFAULT 'pending',
  source_language VARCHAR(10) DEFAULT 'fr',
  target_language VARCHAR(10) DEFAULT 'en',
  srt_url TEXT,
  vtt_url TEXT,
  error_message TEXT,
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- RLS
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtitle_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rag_chunks_enrolled" ON rag_chunks
  FOR SELECT TO authenticated USING (
    course_id IN (
      SELECT course_id FROM user_enrollments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_conv_select" ON ai_conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ai_conv_insert" ON ai_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_conv_update" ON ai_conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ai_conv_delete" ON ai_conversations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "subtitle_jobs_creator" ON subtitle_jobs FOR SELECT
  TO authenticated USING (
    course_id IN (
      SELECT id FROM courses WHERE creator_id = auth.uid()
    )
  );

-- pgvector semantic search function
CREATE OR REPLACE FUNCTION search_rag_chunks(
  query_embedding vector(1536),
  course_id_filter uuid,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.75
) RETURNS TABLE (
  id uuid, lesson_id uuid, content text, similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.lesson_id, r.content,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_chunks r
  WHERE r.course_id = course_id_filter
    AND 1 - (r.embedding <=> query_embedding) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- AI configuration in site_settings
INSERT INTO site_settings (key, value) VALUES
  ('ai_conversations_log_enabled', '"false"'),
  ('ai_max_tokens_per_response', '"1000"'),
  ('ai_model', '"claude-sonnet-4-6"'),
  ('dall_e_model', '"dall-e-3"'),
  ('subtitle_pipeline_enabled', '"false"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
