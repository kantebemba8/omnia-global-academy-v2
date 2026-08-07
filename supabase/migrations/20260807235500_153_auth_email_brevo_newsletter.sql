BEGIN;

-- GC1 / Auth & communications finalisation:
-- OTP d’authentification par e-mail, gouvernance Brevo et newsletter opérationnelle.

ALTER TABLE public.otp_codes
  ALTER COLUMN phone_number DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_otp_email_active_lookup
  ON public.otp_codes (lower(email), purpose, used, created_at DESC)
  WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.verify_omnia_email_otp(
  p_email text,
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
  IF p_email IS NULL OR btrim(p_email) = '' OR p_purpose IS NULL OR p_code IS NULL OR p_code_hash IS NULL THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, 0;
    RETURN;
  END IF;

  SELECT *
    INTO v_otp
    FROM public.otp_codes
   WHERE lower(email) = lower(btrim(p_email))
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

  UPDATE public.otp_codes SET used = true WHERE id = v_otp.id;
  RETURN QUERY SELECT 'verified'::text, v_otp.id, p_max_attempts - v_otp.failed_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_omnia_email_otp(text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_omnia_email_otp(text, text, text, text, integer) TO service_role;

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS provider_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provider_last_error text;

ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_provider_sync_status_check;
ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_provider_sync_status_check
  CHECK (provider_sync_status IN ('pending', 'synced', 'error', 'suppressed'));

ALTER TABLE public.newsletter_consent_events
  DROP CONSTRAINT IF EXISTS newsletter_consent_events_action_check;
ALTER TABLE public.newsletter_consent_events
  ADD CONSTRAINT newsletter_consent_events_action_check
  CHECK (action IN (
    'subscribe','unsubscribe','resubscribe','profile_opt_in','profile_opt_out','registration_opt_in',
    'provider_unsubscribe','bounce_suppression','admin_resync'
  ));

CREATE TABLE IF NOT EXISTS public.email_template_registry (
  template_key text PRIMARY KEY,
  template_name text NOT NULL,
  provider text NOT NULL DEFAULT 'brevo',
  provider_template_id bigint,
  provider_synced_at timestamptz,
  provider_last_error text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_template_registry FROM anon, authenticated;

INSERT INTO public.email_template_registry(template_key, template_name)
VALUES
  ('auth_verification_otp','OGA — Vérification e-mail'),
  ('auth_login_otp','OGA — Connexion OTP'),
  ('auth_password_reset','OGA — Réinitialisation mot de passe'),
  ('account_welcome','OGA — Bienvenue'),
  ('account_pending_validation','OGA — Inscription en validation'),
  ('platform_invitation','OGA — Invitation'),
  ('status_update','OGA — Statut et notification'),
  ('professor_approved','OGA — Professeur validé'),
  ('structure_approved','OGA — Structure validée'),
  ('transaction_update','OGA — Transaction'),
  ('certificate_ready','OGA — Certificat'),
  ('learning_reminder','OGA — Reprise formation')
ON CONFLICT (template_key) DO UPDATE
SET template_name = EXCLUDED.template_name,
    updated_at = now();

COMMENT ON TABLE public.email_template_registry IS 'Registre Omnia des templates transactionnels synchronisés avec Brevo.';
COMMENT ON COLUMN public.otp_codes.email IS 'Identifiant OTP e-mail pour les nouveaux flux d’authentification. phone_number reste uniquement pour compatibilité historique.';

COMMIT;
