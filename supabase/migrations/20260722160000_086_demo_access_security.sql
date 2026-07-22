-- 086 — Sécurisation Accès Démo
BEGIN;

ALTER TABLE public.demo_account_config
  ALTER COLUMN password_plain DROP NOT NULL;

UPDATE public.demo_account_config
SET password_plain = NULL
WHERE password_plain IS NOT NULL;

COMMIT;
