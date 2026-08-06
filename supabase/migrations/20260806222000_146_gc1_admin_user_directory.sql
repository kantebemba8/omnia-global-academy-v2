-- 146 — GC1 : annuaire administratif des utilisateurs et audit des actions de compte
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_user_account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('account_suspended','account_reactivated','sessions_revoked','password_change_required','invitation_resent','account_deleted')),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_user_account_audit_not_self CHECK (actor_user_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS admin_user_account_audit_target_idx
  ON public.admin_user_account_audit(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_user_account_audit_actor_idx
  ON public.admin_user_account_audit(actor_user_id, created_at DESC);

ALTER TABLE public.admin_user_account_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_user_account_audit FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_user_account_audit TO service_role;

COMMENT ON TABLE public.admin_user_account_audit IS
  'Journal privé, réservé au service, des suspensions, réactivations, révocations de sessions et changements de mot de passe imposés par l Administration Omnia.';

COMMIT;
