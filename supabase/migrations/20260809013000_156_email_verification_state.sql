BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

COMMENT ON COLUMN public.users.email_verified_at IS
  'Date de confirmation de l’adresse e-mail. Cet état est distinct du statut administratif du compte.';

-- Les comptes historiques, antérieurs au nouveau flux OTP e-mail, ne doivent pas
-- être bloqués rétroactivement.
UPDATE public.users
SET email_verified_at = COALESCE(updated_at, created_at, now())
WHERE email_verified_at IS NULL
  AND created_at < TIMESTAMPTZ '2026-08-07 23:55:00+00';

-- Tout compte déjà actif est considéré comme vérifié.
UPDATE public.users
SET email_verified_at = COALESCE(last_login_at, updated_at, created_at, now())
WHERE email_verified_at IS NULL
  AND status = 'actif';

-- Pour les rôles soumis à validation administrative, l'envoi réussi du mail
-- "dossier en attente" n'intervient qu'après validation de l'OTP d'inscription.
UPDATE public.users u
SET email_verified_at = COALESCE(
  (
    SELECT max(n.sent_at)
    FROM public.notification_log n
    WHERE n.user_id = u.id
      AND n.channel = 'email'
      AND n.template_id = 'account_pending_validation'
      AND n.status = 'sent'
  ),
  u.updated_at,
  u.created_at,
  now()
)
WHERE u.email_verified_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.notification_log n
    WHERE n.user_id = u.id
      AND n.channel = 'email'
      AND n.template_id = 'account_pending_validation'
      AND n.status = 'sent'
  );

CREATE INDEX IF NOT EXISTS users_email_verification_idx
  ON public.users (email_verified_at)
  WHERE email_verified_at IS NULL;

COMMIT;
