-- Omnia Global Academy — Audit corrections Lot 2A
-- Fondation des sessions hachées et verrouillage de l'accès direct à user_sessions.
-- Transition sans déconnexion générale : session_token reste temporairement présent
-- jusqu'au Lot 2B, tandis que toutes les lignes disposent désormais d'un SHA-256.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS session_token_hash text;

UPDATE public.user_sessions
SET session_token_hash = encode(digest(session_token, 'sha256'), 'hex')
WHERE session_token IS NOT NULL
  AND (session_token_hash IS NULL OR session_token_hash = '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON public.user_sessions(session_token_hash)
  WHERE session_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.oga_sync_user_session_token_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.session_token IS NULL OR btrim(NEW.session_token) = '' THEN
    RAISE EXCEPTION 'SESSION_TOKEN_REQUIRED';
  END IF;

  NEW.session_token_hash := encode(digest(NEW.session_token, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.oga_sync_user_session_token_hash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_sync_user_session_token_hash() TO service_role;

DROP TRIGGER IF EXISTS trg_user_sessions_sync_token_hash ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_sync_token_hash
BEFORE INSERT OR UPDATE OF session_token ON public.user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.oga_sync_user_session_token_hash();

ALTER TABLE public.user_sessions
  ALTER COLUMN session_token_hash SET NOT NULL;

ALTER TABLE public.user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_token_hash_format_check;
ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_token_hash_format_check
  CHECK (session_token_hash ~ '^[0-9a-f]{64}$');

-- Omnia utilise ses propres sessions opaques et les Edge Functions avec service_role.
-- Les anciennes policies basées sur auth.uid() ne correspondent pas à ce modèle et
-- ne doivent pas permettre d'accès direct depuis anon/authenticated.
DROP POLICY IF EXISTS "sessions_own_select" ON public.user_sessions;
DROP POLICY IF EXISTS "sessions_own_insert" ON public.user_sessions;
DROP POLICY IF EXISTS "sessions_own_update" ON public.user_sessions;
DROP POLICY IF EXISTS "sessions_own_delete" ON public.user_sessions;

REVOKE ALL ON TABLE public.user_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_sessions TO service_role;

COMMIT;
