-- 145 — Grande correction 1 : prérequis Utilisateurs, Équipe & Structures
-- Invitations sans mot de passe, délégations Structure actives, rôle système unique
-- et retrait de l'ancien système d'avantages Structure.
BEGIN;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_roles WHERE role = 'super_admin';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGA_SUPER_ADMIN_CARDINALITY_INVALID: expected 1, found %', v_count;
  END IF;
END $$;

-- Le compte système ne porte aucun rôle métier supplémentaire.
DELETE FROM public.user_roles ordinary
USING public.user_roles protected
WHERE protected.role = 'super_admin'
  AND ordinary.user_id = protected.user_id
  AND ordinary.role <> 'super_admin';

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_single_super_admin
  ON public.user_roles (role)
  WHERE role = 'super_admin';

CREATE OR REPLACE FUNCTION public.oga_protect_single_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.oga_super_admin_maintenance', true) = 'enabled'
     AND session_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF (TG_OP IN ('UPDATE','DELETE') AND OLD.role = 'super_admin')
     OR (TG_OP IN ('INSERT','UPDATE') AND NEW.role = 'super_admin') THEN
    RAISE EXCEPTION 'OGA_SUPER_ADMIN_ROLE_PROTECTED';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE')
     AND NEW.role <> 'super_admin'
     AND EXISTS (
       SELECT 1 FROM public.user_roles protected
       WHERE protected.user_id = NEW.user_id AND protected.role = 'super_admin'
     ) THEN
    RAISE EXCEPTION 'OGA_SUPER_ADMIN_ADDITIONAL_ROLE_FORBIDDEN';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oga_protect_single_super_admin ON public.user_roles;
CREATE TRIGGER trg_oga_protect_single_super_admin
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.oga_protect_single_super_admin();

CREATE TABLE IF NOT EXISTS public.platform_access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_type text NOT NULL CHECK (invitation_type IN ('moderator','structure_team','structure_recruiter')),
  email text NOT NULL CHECK (email = lower(trim(email))),
  full_name text,
  organization_id uuid REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  internal_role text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','revoked','expired')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_access_invitations_email_status
  ON public.platform_access_invitations (email, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_access_invitations_org
  ON public.platform_access_invitations (organization_id, invitation_type, status);
ALTER TABLE public.platform_access_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_access_invitations FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_access_invitations TO service_role;

-- Les gestionnaires non principaux sont des délégations techniques, jamais un rôle public.
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT DISTINCT pm.user_id, 'gestionnaire_structure', now()
FROM public.partner_managers pm
WHERE pm.is_primary IS NOT TRUE
  AND pm.status IN ('actif','active')
  AND lower(COALESCE(pm.role_in_org, '')) NOT LIKE '%recrut%'
  AND NOT EXISTS (
    SELECT 1 FROM public.talent_structure_permissions tsp
    WHERE tsp.organization_id = pm.organization_id AND tsp.user_id = pm.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = pm.user_id AND ur.role IN ('gestionnaire_structure','recruteur_structure')
  )
ON CONFLICT (user_id, role) DO NOTHING;


-- Les anciens alias de gestion interne deviennent une délégation cachée.
-- L'insertion distincte évite un conflit si un même compte possède les deux anciens alias.
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT DISTINCT legacy.user_id, 'gestionnaire_structure', now()
FROM public.user_roles legacy
WHERE legacy.role IN ('gestionnaire_partenaire','structure_admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles existing
    WHERE existing.user_id = legacy.user_id
      AND existing.role = 'recruteur_structure'
  )
ON CONFLICT (user_id, role) DO NOTHING;
DELETE FROM public.user_roles WHERE role IN ('gestionnaire_partenaire','structure_admin');

-- Retrait des données tests de l'ancien système d'avantages stocké dans partner_codes.
DELETE FROM public.partner_codes
WHERE COALESCE(advantages->>'__omnia_kind','') = 'structure_benefit';

-- Retrait de la permission historique sans toucher aux avantages commerciaux modernes.
UPDATE public.moderator_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) - 'can_review_structure_benefits',
    permission_version = GREATEST(COALESCE(permission_version, 0), 3),
    updated_at = now();

UPDATE public.partner_managers
SET permissions = COALESCE(permissions, '{}'::jsonb) - 'can_request_structure_benefits'
WHERE COALESCE(permissions, '{}'::jsonb) ? 'can_request_structure_benefits';

-- L'ancien système d'invitations par code de recrutement est remplacé par
-- platform_access_invitations (lien personnel, e-mail, expiration et révocation).
DROP TABLE IF EXISTS public.talent_recruitment_invites CASCADE;

COMMIT;
