-- Studio de formation — fiche publique, couverture IA et introduction avant modules
ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_prompt text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_candidates jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_intro_title text NOT NULL DEFAULT 'Bienvenue dans cette formation';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_intro_summary text;

ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS is_intro boolean NOT NULL DEFAULT false;
ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS is_intro boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_course_modules_intro ON course_modules(course_id, is_intro, position);
CREATE INDEX IF NOT EXISTS idx_course_lessons_intro ON course_lessons(course_id, is_intro, position);

-- Une seule introduction logique par formation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_intro_module
ON course_modules(course_id)
WHERE is_intro = true;

-- Les anciens modules restent des modules normaux.
UPDATE course_modules SET is_intro = false WHERE is_intro IS NULL;
UPDATE course_lessons SET is_intro = false WHERE is_intro IS NULL;
