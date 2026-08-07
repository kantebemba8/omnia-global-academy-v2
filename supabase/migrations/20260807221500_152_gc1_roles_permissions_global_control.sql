-- GC1 — Contrôle global des rôles et permissions
-- 2026-08-07
--
-- Objectif : rendre explicites les délégations Structure sensibles qui étaient
-- historiquement implicites dans le simple rattachement d'un gestionnaire.
-- Le responsable principal conserve tous les pouvoirs de sa Structure.
-- Les membres délégués doivent recevoir explicitement les nouveaux droits.

begin;

-- Les nouvelles permissions restent dans le JSONB canonique partner_managers.permissions.
-- On les matérialise pour éviter toute ambiguïté entre « absent » et « autorisé ».
update public.partner_managers
set permissions = coalesce(permissions, '{}'::jsonb)
  || jsonb_build_object(
    'can_manage_b2b_contracts', case when is_primary then true else coalesce((permissions ->> 'can_manage_b2b_contracts') = 'true', false) end,
    'can_manage_omnia_live', case when is_primary then true else coalesce((permissions ->> 'can_manage_omnia_live') = 'true', false) end,
    'can_manage_projects', case when is_primary then true else coalesce((permissions ->> 'can_manage_projects') = 'true', false) end
  )
where coalesce(status, '') in ('actif', 'active', 'invite', 'invited');

-- Journalisation de la bascule de gouvernance par Structure, sans dupliquer les
-- événements si la migration doit être réparée dans l'historique Supabase.
insert into public.structure_governance_audit (
  organization_id,
  actor_user_id,
  actor_scope,
  event_type,
  metadata
)
select
  po.id,
  null,
  'system',
  'global_role_permissions_hardened',
  jsonb_build_object(
    'migration', '152',
    'permissions', jsonb_build_array(
      'can_manage_b2b_contracts',
      'can_manage_omnia_live',
      'can_manage_projects'
    )
  )
from public.partner_organizations po
where not exists (
  select 1
  from public.structure_governance_audit sga
  where sga.organization_id = po.id
    and sga.event_type = 'global_role_permissions_hardened'
    and coalesce(sga.metadata ->> 'migration', '') = '152'
);

commit;
