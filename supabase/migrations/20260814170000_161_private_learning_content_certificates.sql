-- OGA 161 V2 — Sécurité des contenus pédagogiques et certificats
-- Correction de robustesse : répare d'abord les colonnes Storage historiques
-- éventuellement absentes du schéma distant avant de privatiser les contenus.

BEGIN;

-- 0) Auto-réparation du schéma historique.
-- Ces colonnes existent dans les migrations de référence, mais peuvent manquer
-- sur une base ayant connu d'anciens écarts de déploiement.
ALTER TABLE public.lesson_blocks
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS bucket_name text;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1) Buckets pédagogiques protégés : course-images reste volontairement public.
UPDATE storage.buckets
SET public = false
WHERE id IN (
  'course-videos',
  'course-audios',
  'course-documents',
  'course-excel',
  'course-scorm',
  'course-resources'
);

-- Le bucket certificates contient les PDF délivrés et les instantanés d'émission.
UPDATE storage.buckets
SET public = false
WHERE id = 'certificates';

-- 2) Plus de lecture directe publique des contenus de leçon.
-- Le catalogue et les aperçus passent par les Edge Functions prévues à cet effet.
DROP POLICY IF EXISTS lesson_blocks_public_read ON public.lesson_blocks;
DROP POLICY IF EXISTS "lessons_public_read" ON public.course_lessons;

-- 3) La table certificates ne doit plus être lisible directement par anon/authenticated.
-- La vérification publique passe exclusivement par certificate-verify.
DROP POLICY IF EXISTS "cert_public_verify" ON public.certificates;

-- 4) Supprime l'ancienne lecture publique Storage des certificats.
DROP POLICY IF EXISTS "certs_public_read" ON storage.objects;

-- 5) Normalise les anciens blocs qui stockaient encore une URL publique.
WITH parsed AS (
  SELECT
    id,
    COALESCE(
      NULLIF(bucket_name, ''),
      (regexp_match(file_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[1]
    ) AS parsed_bucket,
    COALESCE(
      NULLIF(storage_path, ''),
      (regexp_match(file_url, '/storage/v1/object/public/([^/]+)/(.+)$'))[2]
    ) AS parsed_path
  FROM public.lesson_blocks
  WHERE file_url IS NOT NULL
)
UPDATE public.lesson_blocks b
SET
  bucket_name = p.parsed_bucket,
  storage_path = p.parsed_path,
  file_url = p.parsed_path,
  content_json = CASE
    WHEN jsonb_typeof(COALESCE(b.content_json, '{}'::jsonb)) = 'object'
      THEN jsonb_set(COALESCE(b.content_json, '{}'::jsonb), '{url}', to_jsonb(p.parsed_path), true)
    ELSE b.content_json
  END,
  updated_at = now()
FROM parsed p
WHERE b.id = p.id
  AND p.parsed_bucket IN (
    'course-videos','course-audios','course-documents',
    'course-excel','course-scorm','course-resources'
  )
  AND p.parsed_path IS NOT NULL;

-- 6) Récupère le chemin Storage des anciens PDF avant de supprimer leur URL publique.
UPDATE public.certificates
SET pdf_storage_path = COALESCE(
  NULLIF(pdf_storage_path, ''),
  (regexp_match(pdf_url, '/storage/v1/object/public/certificates/(.+)$'))[1]
)
WHERE pdf_url ~ '/storage/v1/object/public/certificates/';

UPDATE public.certificates
SET pdf_url = NULL,
    updated_at = now()
WHERE pdf_storage_path IS NOT NULL
  AND pdf_url ~ '/storage/v1/object/public/certificates/';

COMMIT;
