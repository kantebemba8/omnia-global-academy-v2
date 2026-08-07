-- 151 — GC1 Accès spéciaux : gouvernance centralisée sans nouveaux rôles globaux
BEGIN;

-- Historique explicite de révocation du compte de démonstration.
ALTER TABLE public.demo_account_config
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoke_reason text;

-- Les exceptions administratives ne créent jamais un rôle. Elles documentent une
-- prolongation/réactivation bornée d'un accès spécial déjà existant et identifié.
CREATE TABLE IF NOT EXISTS public.special_access_admin_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('professional_invitation','moderator_delegation','jury_external')),
  source_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('extend','reactivate')),
  previous_expires_at timestamptz,
  new_expires_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT special_access_exception_expiry CHECK (new_expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_special_access_exceptions_source
  ON public.special_access_admin_exceptions(source_type, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_access_exceptions_expiry
  ON public.special_access_admin_exceptions(new_expires_at DESC);

-- Journal transversal append-only. Il référence les moteurs existants : démo,
-- invitations professionnelles, délégations, jurys, Structure et B2B.
CREATE TABLE IF NOT EXISTS public.special_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.partner_organizations(id) ON DELETE SET NULL,
  access_type text NOT NULL,
  source_id text,
  action text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_special_access_audit_created
  ON public.special_access_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_access_audit_source
  ON public.special_access_audit(access_type, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_access_audit_target
  ON public.special_access_audit(target_user_id, created_at DESC);

-- Toutes les données de gouvernance restent service_role uniquement.
ALTER TABLE public.special_access_admin_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_account_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.special_access_admin_exceptions FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.special_access_audit FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.demo_account_config FROM public, anon, authenticated;

GRANT ALL ON TABLE public.special_access_admin_exceptions TO service_role;
GRANT ALL ON TABLE public.special_access_audit TO service_role;
GRANT ALL ON TABLE public.demo_account_config TO service_role;

-- Append-only côté application : aucun droit n'est accordé à anon/authenticated.

COMMENT ON TABLE public.special_access_admin_exceptions IS
  'Dérogations administratives bornées appliquées uniquement à un accès spécial existant ; aucun rôle global n est créé.';
COMMENT ON TABLE public.special_access_audit IS
  'Journal transversal append-only des accès spéciaux : démo, invitations, délégations, jurys, Structure et B2B.';

COMMIT;
