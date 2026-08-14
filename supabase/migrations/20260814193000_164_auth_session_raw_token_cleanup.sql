-- Omnia Global Academy — Audit corrections Lot 2B
-- Étape 2/2 : suppression définitive des secrets de session stockés en clair.
-- À exécuter UNIQUEMENT après le succès du déploiement automatique des Edge Functions Lot 2B.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Blocage explicite si une session n'a pas encore de hash.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_sessions
    WHERE session_token_hash IS NULL
       OR session_token_hash !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'LOT2B_SESSION_HASH_BACKFILL_INCOMPLETE';
  END IF;
END;
$$;

-- Le RPC Career reste compatible avec le Frontend qui transmet le token opaque,
-- mais la base compare désormais uniquement son SHA-256.
CREATE OR REPLACE FUNCTION public.career_consume_token_action(
  p_session_token text,
  p_rule_key text,
  p_reference_key text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_rule_type text;
BEGIN
  SELECT s.user_id
  INTO v_user_id
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.session_token_hash = encode(digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
    AND s.expires_at > now()
    AND u.status = 'actif'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_INVALID');
  END IF;

  SELECT rule_type
  INTO v_rule_type
  FROM public.career_token_config
  WHERE config_key = p_rule_key
  LIMIT 1;

  IF v_rule_type IS DISTINCT FROM 'spend' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SPEND_RULE_REQUIRED');
  END IF;

  RETURN public.career_apply_token_rule(
    v_user_id,
    p_rule_key,
    p_reference_key,
    p_request_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.career_consume_token_action(text, text, text, uuid, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.career_consume_token_action(text, text, text, uuid, jsonb)
  TO anon, authenticated;

-- Le pont de transition n'est plus nécessaire.
DROP TRIGGER IF EXISTS trg_user_sessions_sync_token_hash ON public.user_sessions;
DROP FUNCTION IF EXISTS public.oga_sync_user_session_token_hash();

-- Supprime index / contrainte historiques du token brut avant suppression de colonne.
DROP INDEX IF EXISTS public.idx_sessions_token;
ALTER TABLE public.user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_session_token_key;

ALTER TABLE public.user_sessions
  DROP COLUMN IF EXISTS session_token;

ALTER TABLE public.user_sessions
  ALTER COLUMN session_token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON public.user_sessions(session_token_hash);

-- Le compte démo ne conserve plus non plus ses secrets en clair.
ALTER TABLE public.demo_account_config
  DROP COLUMN IF EXISTS active_session_token,
  DROP COLUMN IF EXISTS heartbeat_token;

-- Verrouillage direct de la table de sessions maintenu.
REVOKE ALL ON TABLE public.user_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_sessions TO service_role;

COMMIT;
