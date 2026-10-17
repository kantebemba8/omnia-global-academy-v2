-- OGA V4: idempotent historical introduction metadata reconciliation.
-- Review the state of migration 190/191 before applying; existing assessments are never deleted.
DO $$
BEGIN
  IF to_regclass('public.course_lessons') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='stage_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='is_intro') THEN
    UPDATE public.course_lessons
    SET stage_type = 'introduction'
    WHERE is_intro IS TRUE AND (stage_type IS NULL OR stage_type <> 'introduction');
  END IF;
END $$;
