-- ── EXTENSION TABLE COURSES ─────────────────────────────────────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS long_description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS preview_video_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisites TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS objectives JSONB DEFAULT '[]';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS subtitles_available BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS has_group_license BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS creator_type VARCHAR(30) DEFAULT 'professeur';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cpd_accredited BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cpd_provider_code VARCHAR(100);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS original_price_xof INTEGER;

-- Add FK on establishment_id only if constraint doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_establishment_id_fkey'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_establishment_id_fkey
      FOREIGN KEY (establishment_id) REFERENCES etablissement_profiles(id);
  END IF;
END $$;

-- ── TABLE COURSE_MODULES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_modules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      VARCHAR(500) NOT NULL,
  objective  TEXT NOT NULL,
  position   INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules(course_id, position);

ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_public_read" ON course_modules
  FOR SELECT TO anon, authenticated
  USING (course_id IN (SELECT id FROM courses WHERE is_published = true));

-- ── TABLE COURSE_LESSONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lessons (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id                  UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  course_id                  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title                      VARCHAR(500) NOT NULL,
  content_text               TEXT,
  video_url                  TEXT,
  audio_url                  TEXT,
  lesson_summary             TEXT,
  is_free_preview            BOOLEAN DEFAULT FALSE,
  is_external                BOOLEAN DEFAULT FALSE,
  external_url               TEXT,
  cpd_calculated_time_seconds INTEGER DEFAULT 0,
  position                   INTEGER NOT NULL,
  created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON course_lessons(module_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON course_lessons(course_id);

ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_public_read" ON course_lessons
  FOR SELECT TO anon, authenticated
  USING (course_id IN (SELECT id FROM courses WHERE is_published = true));

-- ── TABLE COURSE_QUESTIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id      UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractor_1   TEXT NOT NULL,
  distractor_2   TEXT NOT NULL,
  distractor_3   TEXT NOT NULL,
  position       INTEGER NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE course_questions ENABLE ROW LEVEL SECURITY;
-- Accessible uniquement via edge functions (service role)

-- ── TABLE COURSE_REVIEWS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON course_reviews(course_id);

ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON course_reviews
  FOR SELECT TO anon, authenticated
  USING (is_visible = true);

CREATE POLICY "reviews_own_insert" ON course_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── TABLE USER_ENROLLMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  course_id    UUID NOT NULL REFERENCES courses(id),
  enrolled_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_user   ON user_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON user_enrollments(course_id);

ALTER TABLE user_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_own_read" ON user_enrollments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
