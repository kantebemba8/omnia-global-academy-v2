-- 094 — Consolidation anti-régression V22 : permissions modérateur
BEGIN;

ALTER TABLE public.moderator_permissions
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS permission_version integer NOT NULL DEFAULT 2;

-- Importer les anciennes colonnes can_* existantes vers le JSON, sans supposer leur liste.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='moderator_permissions'
      AND data_type='boolean'
      AND column_name LIKE 'can_%'
  LOOP
    EXECUTE format(
      'UPDATE public.moderator_permissions
       SET permissions = COALESCE(permissions,''{}''::jsonb)
         || jsonb_build_object(%L, COALESCE(%I,false))',
      r.column_name, r.column_name
    );
  END LOOP;
END $$;

COMMIT;
