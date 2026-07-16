-- Studio de Conception de Formation — backend complet
ALTER TABLE courses ADD COLUMN IF NOT EXISTS studio_status text NOT NULL DEFAULT 'draft';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS studio_mode text NOT NULL DEFAULT 'simple';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS template_used text NOT NULL DEFAULT 'simple_textual';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS estimated_read_min integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS last_autosave_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS validated_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES users(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS admin_comment text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_url text,
  file_name text,
  file_size bigint,
  file_mime text,
  storage_path text,
  bucket_name text,
  source_type text NOT NULL DEFAULT 'manual',
  ai_generated boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_lesson_position ON lesson_blocks(lesson_id, position);
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_course ON lesson_blocks(course_id);

CREATE TABLE IF NOT EXISTS course_studio_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_studio_logs_course_date ON course_studio_logs(course_id, created_at DESC);

CREATE TABLE IF NOT EXISTS course_studio_templates (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'simple',
  blueprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO course_studio_templates(key,label,description,mode,blueprint) VALUES
('simple_textual','Formation simple textuelle','Structure légère, optimisée pour les connexions limitées','simple',
 '{"modules":[{"title":"Module 1","objective":"Présenter les notions essentielles","lessons":[{"title":"Leçon 1","blocks":["heading","objective","text","example","remember","summary","qcm"]}]}]}'::jsonb),
('classic_lesson','Leçon classique','Objectifs, explication, exemple, évaluation et résumé','simple',
 '{"modules":[{"title":"Module 1","objective":"Atteindre les objectifs pédagogiques","lessons":[{"title":"Leçon 1","blocks":["heading","objective","text","image","example","qcm","summary"]}]}]}'::jsonb),
('case_study','Avec cas pratique','Leçon structurée autour d’une situation réelle','advanced',
 '{"modules":[{"title":"Module 1","objective":"Appliquer les acquis à une situation réelle","lessons":[{"title":"Leçon 1","blocks":["heading","objective","text","case_study","open_question","correction","summary"]}]}]}'::jsonb),
('pdf_word','Avec PDF / Word','Documents professionnels et questions','simple',
 '{"modules":[{"title":"Module 1","objective":"Analyser des documents","lessons":[{"title":"Leçon 1","blocks":["heading","objective","text","pdf","word","qcm","summary"]}]}]}'::jsonb),
('excel_template','Avec Excel','Tableaux, données et exercice d’application','advanced',
 '{"modules":[{"title":"Module 1","objective":"Manipuler et interpréter des données","lessons":[{"title":"Leçon 1","blocks":["heading","objective","text","excel","interactive_table","exercise","correction"]}]}]}'::jsonb),
('advanced_interactive','Interactive avancée','Accordéons, cartes, timeline et évaluation','advanced',
 '{"modules":[{"title":"Module 1","objective":"Apprendre par interaction","lessons":[{"title":"Leçon 1","blocks":["heading","objective","accordion","flashcards","timeline","checklist","qcm","summary"]}]}]}'::jsonb),
('scorm_template','Formation SCORM','Intégration d’un package SCORM avec ressources complémentaires','advanced',
 '{"modules":[{"title":"Module 1","objective":"Suivre un parcours SCORM","lessons":[{"title":"Leçon 1","blocks":["heading","objective","scorm","download","open_question"]}]}]}'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=excluded.label,description=excluded.description,mode=excluded.mode,blueprint=excluded.blueprint,updated_at=now();

ALTER TABLE lesson_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_studio_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_studio_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_blocks_public_read ON lesson_blocks;
CREATE POLICY lesson_blocks_public_read ON lesson_blocks FOR SELECT TO anon, authenticated
USING (course_id IN (SELECT id FROM courses WHERE is_published = true));
DROP POLICY IF EXISTS studio_templates_public_read ON course_studio_templates;
CREATE POLICY studio_templates_public_read ON course_studio_templates FOR SELECT TO anon, authenticated USING (is_active = true);

INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES
('course-images','course-images',true,10485760),
('course-videos','course-videos',true,524288000),
('course-audios','course-audios',true,104857600),
('course-documents','course-documents',true,52428800),
('course-excel','course-excel',true,52428800),
('course-scorm','course-scorm',true,524288000),
('course-resources','course-resources',true,104857600)
ON CONFLICT (id) DO UPDATE SET public=excluded.public,file_size_limit=excluded.file_size_limit;
