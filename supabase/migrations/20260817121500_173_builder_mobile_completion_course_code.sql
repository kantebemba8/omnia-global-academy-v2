BEGIN;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_code text;

UPDATE public.courses
SET course_code = upper(trim(course_code))
WHERE course_code IS NOT NULL;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_course_code_format_check;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_course_code_format_check
  CHECK (
    course_code IS NULL
    OR course_code ~ '^[A-Z0-9][A-Z0-9._-]{1,31}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS courses_course_code_unique_idx
  ON public.courses (course_code)
  WHERE course_code IS NOT NULL;

COMMENT ON COLUMN public.courses.course_code IS
  'Code métier unique de la formation, par exemple NEG-101. Renseigné par le créateur et validé avant soumission.';

COMMIT;
