-- 147 — GC1 : gouvernance Équipe & Modérateurs
-- Fiche interne, missions, délégations temporaires, conflits d'intérêts,
-- audit immuable et durcissement des anciennes politiques RLS de modération.
BEGIN;

-- 1) Fiche interne du membre de l'équipe. Le rôle système reste "moderateur".
CREATE TABLE IF NOT EXISTS public.moderator_team_profiles (
  moderator_user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  internal_title text NOT NULL DEFAULT 'Modérateur',
  team_area text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','ended')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  primary_mission text,
  admin_notes text,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.moderator_team_profiles (moderator_user_id, internal_title, status, joined_at)
SELECT ur.user_id, 'Modérateur', 'active', COALESCE(ur.granted_at, now())
FROM public.user_roles ur
WHERE ur.role = 'moderateur'
ON CONFLICT (moderator_user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_moderator_team_profiles_status
  ON public.moderator_team_profiles(status, joined_at DESC);

-- 2) Missions concrètes attribuées par l'Administration Omnia.
CREATE TABLE IF NOT EXISTS public.moderator_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  description text,
  domain text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','completed','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  completed_at timestamptz,
  assigned_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderator_missions_dates CHECK (due_at IS NULL OR due_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_moderator_missions_member
  ON public.moderator_missions(moderator_user_id, status, due_at, created_at DESC);

-- 3) Délégations : permissions supplémentaires bornées dans le temps.
CREATE TABLE IF NOT EXISTS public.moderator_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderator_delegations_dates CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_moderator_delegations_active
  ON public.moderator_delegations(moderator_user_id, status, starts_at, expires_at);

-- 4) Conflits d'intérêts. target_id est text pour accepter les UUID et identifiants métiers.
CREATE TABLE IF NOT EXISTS public.moderator_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
  declared_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moderator_conflicts_active
  ON public.moderator_conflicts(moderator_user_id, status, target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_moderator_conflicts_one_active
  ON public.moderator_conflicts(moderator_user_id, target_type, target_id)
  WHERE status = 'active';

-- 5) Audit d'administration de l'équipe : append-only côté application.
CREATE TABLE IF NOT EXISTS public.moderator_team_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  moderator_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moderator_team_audit_member
  ON public.moderator_team_audit(moderator_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderator_team_audit_actor
  ON public.moderator_team_audit(actor_user_id, created_at DESC);

-- 6) Recommandations préparatoires sur les dossiers dont la décision finale reste administrative.
CREATE TABLE IF NOT EXISTS public.moderator_review_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  recommendation text NOT NULL CHECK (recommendation IN ('approve','reject','changes_requested','reviewed','escalate')),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moderator_review_recommendations_queue
  ON public.moderator_review_recommendations(status, target_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderator_review_recommendations_member
  ON public.moderator_review_recommendations(moderator_user_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_moderator_review_recommendation_pending
  ON public.moderator_review_recommendations(moderator_user_id, target_type, target_id)
  WHERE status = 'pending';

-- Toutes les tables de gouvernance sont réservées au service_role.
ALTER TABLE public.moderator_team_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_team_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_review_recommendations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.moderator_team_profiles FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.moderator_missions FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.moderator_delegations FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.moderator_conflicts FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.moderator_team_audit FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.moderator_review_recommendations FROM public, anon, authenticated;
GRANT ALL ON TABLE public.moderator_team_profiles TO service_role;
GRANT ALL ON TABLE public.moderator_missions TO service_role;
GRANT ALL ON TABLE public.moderator_delegations TO service_role;
GRANT ALL ON TABLE public.moderator_conflicts TO service_role;
GRANT ALL ON TABLE public.moderator_team_audit TO service_role;
GRANT ALL ON TABLE public.moderator_review_recommendations TO service_role;

-- 7) Durcissement des anciennes tables : aucune auto-attribution de permission,
-- aucun UPDATE/DELETE du journal, aucune approbation directe depuis le client.
DROP POLICY IF EXISTS "mod_perms_select" ON public.moderator_permissions;
DROP POLICY IF EXISTS "mod_perms_insert" ON public.moderator_permissions;
DROP POLICY IF EXISTS "mod_perms_update" ON public.moderator_permissions;
DROP POLICY IF EXISTS "mod_perms_delete" ON public.moderator_permissions;
REVOKE ALL ON TABLE public.moderator_permissions FROM anon, authenticated;
GRANT ALL ON TABLE public.moderator_permissions TO service_role;

DROP POLICY IF EXISTS "mod_log_select" ON public.moderation_log;
DROP POLICY IF EXISTS "mod_log_insert" ON public.moderation_log;
DROP POLICY IF EXISTS "mod_log_update" ON public.moderation_log;
DROP POLICY IF EXISTS "mod_log_delete" ON public.moderation_log;
REVOKE ALL ON TABLE public.moderation_log FROM anon, authenticated;
GRANT ALL ON TABLE public.moderation_log TO service_role;

DROP POLICY IF EXISTS "mod_requests_own" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "select_mod_action_requests_own" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "insert_mod_action_requests_own" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "update_mod_action_requests_admin" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "delete_mod_action_requests_admin" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "select_mod_action_requests" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "insert_mod_action_requests" ON public.moderator_action_requests;
DROP POLICY IF EXISTS "update_mod_action_requests" ON public.moderator_action_requests;
REVOKE ALL ON TABLE public.moderator_action_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.moderator_action_requests TO service_role;

-- Version de matrice GC1 Équipe.
UPDATE public.moderator_permissions
SET permission_version = GREATEST(COALESCE(permission_version, 0), 4),
    permissions = COALESCE(permissions, '{}'::jsonb) - 'can_review_structure_benefits',
    updated_at = now();

COMMENT ON TABLE public.moderator_team_profiles IS 'Fiche interne privée d un membre de l équipe Omnia portant le rôle système moderateur.';
COMMENT ON TABLE public.moderator_missions IS 'Missions opérationnelles attribuées aux membres de l équipe Omnia.';
COMMENT ON TABLE public.moderator_delegations IS 'Permissions temporaires calculées à la volée, sans Cron Job.';
COMMENT ON TABLE public.moderator_conflicts IS 'Conflits d intérêts déclarés ou administratifs bloquant le traitement d un dossier.';
COMMENT ON TABLE public.moderator_team_audit IS 'Journal append-only des changements d accès, fonctions, missions et délégations.';
COMMENT ON TABLE public.moderator_review_recommendations IS 'Recommandations préparatoires des modérateurs sur les dossiers dont la décision finale relève de l Administration Omnia.';

COMMIT;
