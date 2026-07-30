-- Omnia Global Academy — Cycle 6 / Lot 1
-- Durcissement de l'authentification personnalisée, des OTP et des jetons de réinitialisation.

BEGIN;

-- Les nouveaux OTP ne sont plus stockés en clair. La colonne historique `code`
-- reste nullable uniquement pour permettre la vérification des OTP déjà émis.
ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE public.otp_codes
  ALTER COLUMN code DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_active_lookup
  ON public.otp_codes(phone_number, purpose, used, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_cleanup
  ON public.otp_codes(expires_at, used);

-- Les jetons transmis dans les liens de réinitialisation ne sont plus conservés
-- en clair. `reset_token` reste nullable pour compatibilité avec les liens déjà émis.
ALTER TABLE public.password_reset_tokens
  ADD COLUMN IF NOT EXISTS token_hash text;

ALTER TABLE public.password_reset_tokens
  ALTER COLUMN reset_token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token_hash
  ON public.password_reset_tokens(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_cleanup
  ON public.password_reset_tokens(expires_at, used);

-- Ces tables sont exclusivement manipulées par les Edge Functions avec la clé
-- service_role. Le frontend anonyme ne doit ni lire ni alimenter les journaux de
-- sécurité, les OTP ou les limites de débit.
DROP POLICY IF EXISTS "otp_public_insert" ON public.otp_codes;
DROP POLICY IF EXISTS "audit_log_service_insert" ON public.security_audit_log;
DROP POLICY IF EXISTS "rate_limit_service_insert" ON public.rate_limit_log;
DROP POLICY IF EXISTS "rate_limit_service_select" ON public.rate_limit_log;
DROP POLICY IF EXISTS "notif_log_insert_service" ON public.notification_log;

REVOKE ALL ON TABLE public.otp_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.password_reset_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_audit_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.rate_limit_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.sms_rate_limits FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notification_log FROM anon, authenticated;

-- Limiteur atomique : le verrou transactionnel empêche plusieurs requêtes
-- concurrentes de dépasser la limite dans la même fenêtre.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_oldest timestamptz;
  v_retry integer := 0;
  v_window interval;
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' OR p_max_requests < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_PARAMETERS';
  END IF;

  v_window := make_interval(secs => p_window_seconds);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key, 0));

  DELETE FROM public.rate_limit_log
   WHERE rate_key = p_key
     AND created_at < now() - v_window;

  SELECT count(*), min(created_at)
    INTO v_count, v_oldest
    FROM public.rate_limit_log
   WHERE rate_key = p_key
     AND created_at >= now() - v_window;

  IF v_count >= p_max_requests THEN
    v_retry := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM ((v_oldest + v_window) - now())))::integer
    );
    RETURN QUERY SELECT false, v_retry;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_log(rate_key, created_at)
  VALUES (p_key, now());

  RETURN QUERY SELECT true, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

-- Vérification OTP atomique avec verrouillage après cinq codes incorrects.
CREATE OR REPLACE FUNCTION public.verify_omnia_otp(
  p_phone_number text,
  p_purpose text,
  p_code text,
  p_code_hash text,
  p_max_attempts integer DEFAULT 5
)
RETURNS TABLE(status text, otp_id uuid, remaining_attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp public.otp_codes%ROWTYPE;
  v_matches boolean := false;
  v_attempts integer;
BEGIN
  IF p_phone_number IS NULL OR p_purpose IS NULL OR p_code IS NULL OR p_code_hash IS NULL THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, 0;
    RETURN;
  END IF;

  SELECT *
    INTO v_otp
    FROM public.otp_codes
   WHERE phone_number = btrim(p_phone_number)
     AND purpose = p_purpose
     AND used = false
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, 0;
    RETURN;
  END IF;

  IF v_otp.locked_at IS NOT NULL OR v_otp.failed_attempts >= p_max_attempts THEN
    UPDATE public.otp_codes
       SET used = true,
           locked_at = COALESCE(locked_at, now())
     WHERE id = v_otp.id;
    RETURN QUERY SELECT 'locked'::text, v_otp.id, 0;
    RETURN;
  END IF;

  IF v_otp.expires_at <= now() THEN
    UPDATE public.otp_codes SET used = true WHERE id = v_otp.id;
    RETURN QUERY SELECT 'expired'::text, v_otp.id, 0;
    RETURN;
  END IF;

  v_matches := CASE
    WHEN v_otp.code_hash IS NOT NULL THEN v_otp.code_hash = p_code_hash
    ELSE v_otp.code = p_code
  END;

  IF NOT v_matches THEN
    v_attempts := v_otp.failed_attempts + 1;
    UPDATE public.otp_codes
       SET failed_attempts = v_attempts,
           locked_at = CASE WHEN v_attempts >= p_max_attempts THEN now() ELSE locked_at END,
           used = CASE WHEN v_attempts >= p_max_attempts THEN true ELSE used END
     WHERE id = v_otp.id;

    RETURN QUERY SELECT
      CASE WHEN v_attempts >= p_max_attempts THEN 'locked' ELSE 'incorrect' END::text,
      v_otp.id,
      GREATEST(0, p_max_attempts - v_attempts);
    RETURN;
  END IF;

  UPDATE public.otp_codes
     SET used = true
   WHERE id = v_otp.id;

  RETURN QUERY SELECT 'verified'::text, v_otp.id, p_max_attempts - v_otp.failed_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_omnia_otp(text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_omnia_otp(text, text, text, text, integer) TO service_role;

-- Consommation atomique du jeton et changement du mot de passe dans la même
-- transaction afin qu'un jeton ne puisse pas être utilisé deux fois.
CREATE OR REPLACE FUNCTION public.reset_password_with_token(
  p_token_hash text,
  p_legacy_token text,
  p_password_hash text
)
RETURNS TABLE(status text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.password_reset_tokens%ROWTYPE;
BEGIN
  SELECT prt.*
    INTO v_token
    FROM public.password_reset_tokens AS prt
   WHERE prt.used = false
     AND (
       (prt.token_hash IS NOT NULL AND prt.token_hash = p_token_hash)
       OR
       (prt.token_hash IS NULL AND prt.reset_token = p_legacy_token)
     )
   ORDER BY prt.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_token.expires_at <= now() THEN
    UPDATE public.password_reset_tokens AS prt
       SET used = true
     WHERE prt.id = v_token.id;
    RETURN QUERY SELECT 'expired'::text, v_token.user_id;
    RETURN;
  END IF;

  UPDATE public.users
     SET password_hash = p_password_hash,
         updated_at = now()
   WHERE id = v_token.user_id;

  UPDATE public.password_reset_tokens AS prt
     SET used = true
   WHERE prt.user_id = v_token.user_id
     AND prt.used = false;

  DELETE FROM public.user_sessions AS us
   WHERE us.user_id = v_token.user_id;

  RETURN QUERY SELECT 'success'::text, v_token.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_password_with_token(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(text, text, text) TO service_role;

COMMIT;
