-- OGA — Audit corrections Lot 3A — External AI modernization
BEGIN;

ALTER TABLE IF EXISTS public.ai_pedagogical_governance
  ALTER COLUMN model SET DEFAULT 'claude-sonnet-5';

UPDATE public.ai_pedagogical_governance
SET model = CASE
  WHEN model IN ('claude-3-5-haiku-latest', 'claude-3-5-haiku-20241022') THEN 'claude-haiku-4-5'
  WHEN model = 'claude-sonnet-4-6' THEN 'claude-sonnet-5'
  ELSE model
END,
updated_at = now()
WHERE model IN ('claude-3-5-haiku-latest', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-6');

UPDATE public.ai_pedagogical_course_settings
SET model = CASE
  WHEN model IN ('claude-3-5-haiku-latest', 'claude-3-5-haiku-20241022') THEN 'claude-haiku-4-5'
  WHEN model = 'claude-sonnet-4-6' THEN 'claude-sonnet-5'
  ELSE model
END,
updated_at = now()
WHERE model IN ('claude-3-5-haiku-latest', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-6');

-- These historical CMS keys were misleading: runtime model choice is server-side.
DELETE FROM public.site_settings WHERE key IN ('dall_e_model', 'ai_model');

COMMIT;
