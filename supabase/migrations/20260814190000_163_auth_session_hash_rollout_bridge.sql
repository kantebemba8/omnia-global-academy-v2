-- Omnia Global Academy — Audit corrections Lot 2B
-- Étape 1/2 : pont de déploiement sans interruption.
-- Permet aux anciennes Edge Functions (token brut) et aux nouvelles (hash uniquement)
-- de coexister pendant le redéploiement massif du Lot 2B.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Les nouvelles fonctions écrivent uniquement session_token_hash.
ALTER TABLE public.user_sessions
  ALTER COLUMN session_token DROP NOT NULL;

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS session_token_hash text;

UPDATE public.user_sessions
SET session_token_hash = encode(digest(session_token, 'sha256'), 'hex')
WHERE session_token IS NOT NULL
  AND (session_token_hash IS NULL OR session_token_hash = '');

ALTER TABLE public.user_sessions
  ALTER COLUMN session_token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON public.user_sessions(session_token_hash);

ALTER TABLE public.user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_token_hash_format_check;
ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_token_hash_format_check
  CHECK (session_token_hash ~ '^[0-9a-f]{64}$');

-- Trigger de transition :
-- - ancien code : envoie session_token -> le hash est calculé ;
-- - nouveau code : envoie session_token_hash -> aucun token brut n'est exigé.
CREATE OR REPLACE FUNCTION public.oga_sync_user_session_token_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  computed_hash text;
BEGIN
  IF NEW.session_token IS NOT NULL AND btrim(NEW.session_token) <> '' THEN
    computed_hash := encode(digest(NEW.session_token, 'sha256'), 'hex');

    IF NEW.session_token_hash IS NULL OR btrim(NEW.session_token_hash) = '' THEN
      NEW.session_token_hash := computed_hash;
    ELSIF NEW.session_token_hash <> computed_hash THEN
      RAISE EXCEPTION 'SESSION_TOKEN_HASH_MISMATCH';
    END IF;
  END IF;

  IF NEW.session_token_hash IS NULL OR NEW.session_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SESSION_TOKEN_HASH_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.oga_sync_user_session_token_hash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_sync_user_session_token_hash() TO service_role;

DROP TRIGGER IF EXISTS trg_user_sessions_sync_token_hash ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_sync_token_hash
BEFORE INSERT OR UPDATE ON public.user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.oga_sync_user_session_token_hash();

-- Les secrets du compte de démonstration ne doivent plus être conservés en clair.
ALTER TABLE public.demo_account_config
  ADD COLUMN IF NOT EXISTS active_session_token_hash text,
  ADD COLUMN IF NOT EXISTS heartbeat_token_hash text;

UPDATE public.demo_account_config
SET active_session_token_hash = encode(digest(active_session_token, 'sha256'), 'hex')
WHERE active_session_token IS NOT NULL
  AND btrim(active_session_token) <> ''
  AND (active_session_token_hash IS NULL OR active_session_token_hash = '');

UPDATE public.demo_account_config
SET heartbeat_token_hash = encode(digest(heartbeat_token, 'sha256'), 'hex')
WHERE heartbeat_token IS NOT NULL
  AND btrim(heartbeat_token) <> ''
  AND (heartbeat_token_hash IS NULL OR heartbeat_token_hash = '');

ALTER TABLE public.demo_account_config
  DROP CONSTRAINT IF EXISTS demo_account_active_session_token_hash_format_check;
ALTER TABLE public.demo_account_config
  ADD CONSTRAINT demo_account_active_session_token_hash_format_check
  CHECK (active_session_token_hash IS NULL OR active_session_token_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE public.demo_account_config
  DROP CONSTRAINT IF EXISTS demo_account_heartbeat_token_hash_format_check;
ALTER TABLE public.demo_account_config
  ADD CONSTRAINT demo_account_heartbeat_token_hash_format_check
  CHECK (heartbeat_token_hash IS NULL OR heartbeat_token_hash ~ '^[0-9a-f]{64}$');

COMMIT;
