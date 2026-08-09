BEGIN;

-- Distingue définitivement la confirmation d’adresse e-mail de la validation
-- administrative d’un rôle professionnel. Aucun OTP ni secret n’est stocké ici.
UPDATE public.users AS u
SET email_status = 'a_verifier',
    status = 'verification_email',
    updated_at = now()
WHERE COALESCE(u.email_status, 'valide') <> 'invalide'
  AND u.status NOT IN ('supprime', 'suspendu')
  AND EXISTS (
    SELECT 1
    FROM public.otp_codes AS o
    WHERE lower(o.email) = lower(u.email)
      AND o.purpose = 'inscription'
      AND o.used = false
  );

COMMENT ON COLUMN public.users.email_status IS
  'État de l’adresse e-mail du compte : a_verifier, valide ou invalide. La validation administrative du rôle reste portée par users.status et les profils métier.';

COMMIT;
