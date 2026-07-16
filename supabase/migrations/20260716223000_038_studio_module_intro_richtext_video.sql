-- Studio ergonomie finale : présentation facultative des modules
ALTER TABLE course_lessons
  ADD COLUMN IF NOT EXISTS is_module_intro boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_course_lessons_module_intro
  ON course_lessons(module_id, is_module_intro, position);

-- Une seule présentation facultative par module.
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_lessons_module_intro
  ON course_lessons(module_id)
  WHERE is_module_intro = true;

-- Crée une présentation facultative pour les modules existants qui n'en ont pas.
INSERT INTO course_lessons (course_id, module_id, title, position, is_intro, is_module_intro)
SELECT m.course_id, m.id, 'Présentation du module', -1, false, true
FROM course_modules m
WHERE COALESCE(m.is_intro, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM course_lessons l
    WHERE l.module_id = m.id AND l.is_module_intro = true
  );
