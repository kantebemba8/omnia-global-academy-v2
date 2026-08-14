-- 160 — Recrutement Structure : permission d'équipe uniquement, jamais un rôle Omnia.
-- Cette migration neutralise les résidus historiques `recruteur_structure` / `structure_recruiter`
-- sans retirer les capacités de recrutement des membres déjà rattachés à une Structure.

BEGIN;

-- 1. Les invitations historiques "structure_recruiter" deviennent de simples invitations
--    d'équipe Structure avec permissions de recrutement.
UPDATE public.platform_access_invitations
SET invitation_type = 'structure_team',
    permissions = COALESCE(permissions, '{}'::jsonb)
      || jsonb_build_object(
        'can_post_job', true,
        'can_search_talent', true,
        'can_contact_talent', true,
        'can_manage_jobs', true,
        'can_view_applications', true,
        'can_schedule_interview', true,
        'can_manage_team', COALESCE((permissions ->> 'can_manage_team') = 'true', false)
      ),
    updated_at = now()
WHERE invitation_type = 'structure_recruiter';

-- 2. Préserver les capacités des anciens "recruteurs Structure" sous forme de permissions.
--    On s'appuie uniquement sur un rattachement actif à une Structure.
WITH legacy_structure_recruiters AS (
  SELECT DISTINCT pm.organization_id, pm.user_id,
    COALESCE((tsp.can_manage_team), false)
      OR COALESCE((pm.permissions ->> 'can_manage_team') = 'true', false) AS can_manage_team
  FROM public.partner_managers pm
  LEFT JOIN public.talent_structure_permissions tsp
    ON tsp.organization_id = pm.organization_id
   AND tsp.user_id = pm.user_id
  WHERE pm.status IN ('actif','active')
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = pm.user_id AND ur.role = 'recruteur_structure'
      )
      OR EXISTS (
        SELECT 1 FROM public.talent_recruiter_profiles trp
        WHERE trp.user_id = pm.user_id
          AND trp.recruiter_type = 'structure'
          AND trp.organization_id = pm.organization_id
      )
      OR lower(COALESCE(pm.role_in_org, '')) LIKE '%recrut%'
    )
)
INSERT INTO public.talent_structure_permissions (
  organization_id,
  user_id,
  can_post_job,
  can_search_talent,
  can_contact_talent,
  can_manage_jobs,
  can_view_applications,
  can_schedule_interview,
  can_manage_team,
  updated_at
)
SELECT
  organization_id,
  user_id,
  true,
  true,
  true,
  true,
  true,
  true,
  can_manage_team,
  now()
FROM legacy_structure_recruiters
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  can_post_job = true,
  can_search_talent = true,
  can_contact_talent = true,
  can_manage_jobs = true,
  can_view_applications = true,
  can_schedule_interview = true,
  can_manage_team = public.talent_structure_permissions.can_manage_team OR EXCLUDED.can_manage_team,
  updated_at = now();

-- 3. Un membre secondaire de Structure reste techniquement un membre d'équipe générique.
--    Le recrutement n'est plus encodé dans user_roles.
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT DISTINCT pm.user_id, 'gestionnaire_structure', now()
FROM public.partner_managers pm
JOIN public.user_roles ur
  ON ur.user_id = pm.user_id
 AND ur.role = 'recruteur_structure'
WHERE pm.is_primary IS NOT TRUE
  AND pm.status IN ('actif','active')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'recruteur_structure';

-- Empêcher toute réintroduction future de ce faux rôle.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_recruteur_structure_forbidden;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_recruteur_structure_forbidden
  CHECK (role <> 'recruteur_structure');

-- 4. Le profil Recruteur Talent est réservé aux recruteurs indépendants.
--    Les anciens profils Structure ne doivent pas laisser derrière eux un alias de rôle
--    de recruteur indépendant. Un membre pourra toujours déposer séparément une vraie
--    candidature Recruteur indépendant s'il souhaite cumuler les deux situations.
DELETE FROM public.user_roles ur
USING public.talent_recruiter_profiles trp
WHERE ur.user_id = trp.user_id
  AND trp.recruiter_type = 'structure'
  AND ur.role IN ('recruteur_independant','recruteur');

--    Les membres Structure tirent désormais leurs droits uniquement de leur rattachement
--    et de talent_structure_permissions.
DELETE FROM public.talent_recruiter_profiles
WHERE recruiter_type = 'structure';

ALTER TABLE public.talent_recruiter_profiles
  DROP CONSTRAINT IF EXISTS talent_recruiter_profiles_recruiter_type_check;
ALTER TABLE public.talent_recruiter_profiles
  ADD CONSTRAINT talent_recruiter_profiles_recruiter_type_check
  CHECK (recruiter_type = 'independent');

-- 5. Le type d'invitation spécial disparaît lui aussi : équipe Structure + permissions suffit.
ALTER TABLE public.platform_access_invitations
  DROP CONSTRAINT IF EXISTS platform_access_invitations_invitation_type_check;
ALTER TABLE public.platform_access_invitations
  ADD CONSTRAINT platform_access_invitations_invitation_type_check
  CHECK (invitation_type IN ('moderator','structure_team','coach_oga'));

-- 6. Retirer le libellé UI historique du registre de traduction actif.
DELETE FROM public.platform_ui_translations
WHERE source_text = 'Recruteur Structure';

COMMIT;
