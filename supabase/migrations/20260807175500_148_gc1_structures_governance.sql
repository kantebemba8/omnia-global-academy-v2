BEGIN;

-- GC1 — Structures : gouvernance, demandes de modification et audit.
-- Le moteur canonique reste supabase/functions/structure-manage.

CREATE TABLE IF NOT EXISTS public.structure_profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  requested_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','changes_requested','approved','rejected','cancelled')),
  admin_comment text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_structure_profile_change_open
  ON public.structure_profile_change_requests (organization_id)
  WHERE status IN ('pending','changes_requested');

CREATE INDEX IF NOT EXISTS idx_structure_profile_change_status
  ON public.structure_profile_change_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.structure_governance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_scope text NOT NULL DEFAULT 'system',
  event_type text NOT NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_structure_governance_audit_org
  ON public.structure_governance_audit (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_structure_governance_audit_event
  ON public.structure_governance_audit (event_type, created_at DESC);

ALTER TABLE public.structure_profile_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_governance_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.structure_profile_change_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.structure_governance_audit FROM anon, authenticated;
GRANT ALL ON TABLE public.structure_profile_change_requests TO service_role;
GRANT ALL ON TABLE public.structure_governance_audit TO service_role;

-- Les écrans actuels passent déjà par les Edge Functions ; on ferme les anciens accès directs.
REVOKE ALL ON TABLE public.partner_organizations FROM anon, authenticated;
REVOKE ALL ON TABLE public.partner_managers FROM anon, authenticated;
GRANT ALL ON TABLE public.partner_organizations TO service_role;
GRANT ALL ON TABLE public.partner_managers TO service_role;

COMMIT;
