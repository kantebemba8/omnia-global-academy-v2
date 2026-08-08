BEGIN;

-- Omnia Global Academy — Brevo manuel, catalogue transactionnel 1 à 13.
-- Les templates sont créés et maintenus dans Brevo. Supabase ne doit jamais
-- réécrire leur design, leur objet ou leur expéditeur.

INSERT INTO public.email_template_registry (
  template_key,
  template_name,
  provider,
  provider_template_id,
  provider_synced_at,
  provider_last_error,
  is_active,
  metadata,
  updated_at
)
VALUES
  ('platform_invitation',        'OGA - 01 - Invitation à rejoindre Omnia',              'brevo',  1, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('auth_password_reset',        'OGA - 02 - Réinitialisation du mot de passe',           'brevo',  2, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('status_update',              'OGA - 03 - Statut et notification',                      'brevo',  3, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('account_welcome',            'OGA - 04 - Bienvenue sur Omnia Global Academy',          'brevo',  4, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('structure_pricing_proposal', 'OGA - 05 - Proposition tarifaire Structure',             'brevo',  5, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('professor_approved',         'OGA - 06 - Validation compte Professeur',                'brevo',  6, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('structure_approved',         'OGA - 07 - Validation compte Structure',                 'brevo',  7, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('payment_invoice',            'OGA - 08 - Confirmation paiement et facture',            'brevo',  8, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('certificate_ready',          'OGA - 09 - Certificat disponible',                       'brevo',  9, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('learning_reminder',          'OGA - 10 - Reprise de formation',                        'brevo', 10, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('auth_verification_otp',      'OGA - 11 - Vérification adresse e-mail OTP',             'brevo', 11, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('auth_login_otp',             'OGA - 12 - Connexion sécurisée OTP',                     'brevo', 12, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now()),
  ('account_pending_validation', 'OGA - 13 - Compte en attente de validation',             'brevo', 13, NULL, NULL, true, '{"mode":"manual_brevo","fixed_id":true}'::jsonb, now())
ON CONFLICT (template_key) DO UPDATE
SET template_name = EXCLUDED.template_name,
    provider = EXCLUDED.provider,
    provider_template_id = EXCLUDED.provider_template_id,
    provider_synced_at = NULL,
    provider_last_error = NULL,
    is_active = true,
    metadata = COALESCE(public.email_template_registry.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

-- Ancienne clé qui mélangeait proposition Structure et transaction financière.
-- Conservée uniquement pour l'historique des anciens journaux.
UPDATE public.email_template_registry
SET is_active = false,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"superseded":true,"replaced_by":["structure_pricing_proposal","payment_invoice"]}'::jsonb,
    updated_at = now()
WHERE template_key = 'transaction_update';

COMMENT ON TABLE public.email_template_registry IS
  'Registre Omnia des templates transactionnels Brevo administrés manuellement. Les IDs 1 à 13 sont fixes; le code vérifie leur présence sans modifier leur contenu.';

COMMIT;
