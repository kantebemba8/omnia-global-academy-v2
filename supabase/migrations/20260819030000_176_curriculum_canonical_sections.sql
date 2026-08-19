-- OGA Formation Curriculum Canonical Sections V1
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS section_type text;

UPDATE public.course_modules
SET section_type = CASE
  WHEN is_intro THEN 'introduction'
  WHEN is_conclusion THEN 'conclusion'
  WHEN is_final_exam THEN 'final_exam'
  ELSE 'module'
END
WHERE section_type IS NULL;

ALTER TABLE public.course_modules ALTER COLUMN section_type SET DEFAULT 'module';
ALTER TABLE public.course_modules ALTER COLUMN section_type SET NOT NULL;
ALTER TABLE public.course_modules DROP CONSTRAINT IF EXISTS course_modules_section_type_check;
ALTER TABLE public.course_modules ADD CONSTRAINT course_modules_section_type_check
  CHECK (section_type IN ('introduction','module','conclusion','final_exam'));

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS stage_type text;

UPDATE public.course_lessons
SET stage_type = CASE
  WHEN is_intro THEN 'introduction'
  WHEN is_module_intro THEN 'module_presentation'
  WHEN is_conclusion THEN 'conclusion'
  WHEN is_final_exam THEN 'final_exam'
  ELSE 'lesson'
END
WHERE stage_type IS NULL;

ALTER TABLE public.course_lessons ALTER COLUMN stage_type SET DEFAULT 'lesson';
ALTER TABLE public.course_lessons ALTER COLUMN stage_type SET NOT NULL;
ALTER TABLE public.course_lessons DROP CONSTRAINT IF EXISTS course_lessons_stage_type_check;
ALTER TABLE public.course_lessons ADD CONSTRAINT course_lessons_stage_type_check
  CHECK (stage_type IN ('introduction','module_presentation','lesson','module_summary','conclusion','final_exam'));

CREATE INDEX IF NOT EXISTS idx_course_modules_course_section_position
  ON public.course_modules(course_id, section_type, position);
CREATE INDEX IF NOT EXISTS idx_course_lessons_module_stage_position
  ON public.course_lessons(module_id, stage_type, position);
