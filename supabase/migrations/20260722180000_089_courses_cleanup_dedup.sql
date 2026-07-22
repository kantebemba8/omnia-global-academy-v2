-- 089 — Formations : suppression tests résiduels + anti-doublon de création
BEGIN;

-- Supprime les tests Comptabilité SYSCOHADA uniquement s'ils n'ont aucune donnée métier.
DELETE FROM public.courses c
WHERE lower(trim(c.title)) = lower('Comptabilité SYSCOHADA')
  AND NOT EXISTS (SELECT 1 FROM public.user_enrollments e WHERE e.course_id=c.id)
  AND NOT EXISTS (SELECT 1 FROM public.certificates ce WHERE ce.course_id=c.id)
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.course_id=c.id);

-- Nettoie uniquement les doublons de brouillons sans historique métier.
WITH ranked AS (
  SELECT c.id,
         ROW_NUMBER() OVER (
           PARTITION BY c.creator_id, lower(trim(c.title)), COALESCE(c.creator_context,'')
           ORDER BY c.created_at ASC, c.id ASC
         ) AS rn
  FROM public.courses c
  WHERE COALESCE(c.studio_status,'draft') IN ('draft','brouillon')
    AND NOT EXISTS (SELECT 1 FROM public.user_enrollments e WHERE e.course_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.certificates ce WHERE ce.course_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.course_id=c.id)
)
DELETE FROM public.courses c
USING ranked r
WHERE c.id=r.id AND r.rn>1;

-- La clé de brouillon client devient idempotente au niveau base.
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_creator_context_draft_key
ON public.courses(creator_id, creator_context, client_draft_key)
WHERE client_draft_key IS NOT NULL;

COMMIT;
