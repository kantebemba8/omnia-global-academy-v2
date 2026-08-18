BEGIN;

-- Builder Formation : les actions update_module/update_lesson et la synchronisation
-- vidéo utilisent updated_at. Ces colonnes existaient dans le code mais pas dans
-- le schéma historique course_modules/course_lessons, ce qui pouvait faire échouer
-- silencieusement le renommage puis réafficher le titre par défaut au rechargement.
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.course_modules
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

UPDATE public.course_lessons
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- La présentation d’un module est explicitement facultative dans le Builder.
-- Les anciennes lignes avaient hérité du DEFAULT true lors de l’ajout de is_required.
UPDATE public.course_lessons
SET is_required = false,
    updated_at = now()
WHERE is_module_intro = true
  AND is_required IS DISTINCT FROM false;

COMMIT;
