-- 096 — Synchronisation ciblée Omnia Career Studio + Omnia Talent
BEGIN;

-- 1) Supprimer uniquement les documents Career de comptes Super-admin.
-- Ils correspondent aux essais administrateur et ne doivent jamais entrer dans les statistiques apprenant.
DO $$
BEGIN
  IF to_regclass('public.career_documents') IS NOT NULL THEN
    DELETE FROM public.career_documents d
    USING public.user_roles r
    WHERE d.user_id = r.user_id
      AND r.role = 'super_admin';
  END IF;
END $$;

-- 2) Index de reporting, uniquement si les tables existent.
DO $$
BEGIN
  IF to_regclass('public.career_documents') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_career_documents_reporting ON public.career_documents(doc_type,user_id,updated_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_career_documents_template_usage ON public.career_documents(template_key,user_id)';
  END IF;
  IF to_regclass('public.career_token_transactions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_career_token_transactions_reporting ON public.career_token_transactions(user_id,created_at DESC)';
  END IF;
  IF to_regclass('public.career_export_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_career_export_logs_reporting ON public.career_export_logs(created_at DESC)';
  END IF;
END $$;

-- 3) Bucket public pour les miniatures des modèles personnalisés.
-- Les fichiers sont téléversés exclusivement par l'Edge Function avec la clé service-role.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    VALUES(
      'career-templates',
      'career-templates',
      true,
      5242880,
      ARRAY['image/png','image/jpeg','image/webp']
    )
    ON CONFLICT(id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

COMMIT;
