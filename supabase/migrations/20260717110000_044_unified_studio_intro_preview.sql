-- Studio unique Professeur / Structure / Super Admin.
-- L'introduction est obligatoirement l'aperçu gratuit avant achat.
ALTER TABLE public.courses
  ALTER COLUMN free_preview_mode SET DEFAULT 'introduction';

UPDATE public.courses
SET free_preview_mode = 'introduction'
WHERE free_preview_mode IS DISTINCT FROM 'introduction';

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_free_preview_mode_check;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_free_preview_mode_check
  CHECK (free_preview_mode = 'introduction');
