-- 157 — Multi-rôle : l'identité Omnia reste active indépendamment des candidatures professionnelles.
-- Nettoyage compatible des anciens comptes en attente : seuls les rôles non validés sont retirés.

-- Professeur : le rôle n'existe que lorsque le KYC est validé.
delete from public.user_roles ur
using public.professeur_profiles pp, public.users u
where ur.user_id = pp.user_id
  and u.id = ur.user_id
  and u.status = 'en_attente_validation'
  and ur.role in ('professeur','formateur')
  and coalesce(pp.kyc_status,'') <> 'valide';

-- Recruteur indépendant : le rôle n'existe que lorsque le profil est approuvé.
delete from public.user_roles ur
using public.talent_recruiter_profiles trp, public.users u
where ur.user_id = trp.user_id
  and u.id = ur.user_id
  and u.status = 'en_attente_validation'
  and ur.role in ('recruteur_independant','recruteur')
  and coalesce(trp.status,'') <> 'approved';

-- Structure : le rôle principal n'existe que lorsque l'organisation est validée.
delete from public.user_roles ur
using public.partner_managers pm, public.partner_organizations po, public.users u
where ur.user_id = pm.user_id
  and u.id = ur.user_id
  and u.status = 'en_attente_validation'
  and pm.organization_id = po.id
  and pm.is_primary = true
  and ur.role in ('responsable_structure','structure','etablissement_directeur','etablissement_enseignant')
  and coalesce(po.status,'') <> 'validated';

-- Les comptes historiques bloqués uniquement par l'examen d'un rôle redeviennent utilisables.
-- Le statut du rôle reste porté par sa table métier et l'Administration conserve sa décision.
update public.users u
set status = 'actif', updated_at = now()
where u.status = 'en_attente_validation'
  and coalesce(u.email_status,'') = 'valide'
  and (
    exists (
      select 1 from public.professeur_profiles pp
      where pp.user_id = u.id and coalesce(pp.kyc_status,'') <> 'valide'
    )
    or exists (
      select 1 from public.talent_recruiter_profiles trp
      where trp.user_id = u.id and coalesce(trp.status,'') <> 'approved'
    )
    or exists (
      select 1
      from public.partner_managers pm
      join public.partner_organizations po on po.id = pm.organization_id
      where pm.user_id = u.id and pm.is_primary = true and coalesce(po.status,'') <> 'validated'
    )
  );

create or replace function public.omnia_live_approve_organizer(
  p_application_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.live_organizer_applications%rowtype;
  normalized text;
  profile_status text;
begin
  normalized := case p_decision
    when 'verified' then 'approved'
    when 'approve' then 'approved'
    when 'approved' then 'approved'
    when 'changes_requested' then 'changes_requested'
    when 'request_changes' then 'changes_requested'
    when 'rejected' then 'rejected'
    when 'reject' then 'rejected'
    when 'suspended' then 'suspended'
    when 'suspend' then 'suspended'
    when 'reactivate' then 'approved'
    else p_decision
  end;

  if normalized not in ('approved','changes_requested','rejected','suspended') then
    raise exception 'INVALID_ORGANIZER_DECISION';
  end if;

  select * into a
  from public.live_organizer_applications
  where id=p_application_id
  for update;
  if not found then raise exception 'ORGANIZER_APPLICATION_NOT_FOUND'; end if;

  update public.live_organizer_applications
  set status=normalized,
      admin_note=p_note,
      reviewed_by=p_admin_id,
      reviewed_at=now(),
      updated_at=now()
  where id=p_application_id;

  if normalized='approved' then
    insert into public.user_roles(user_id,role)
    values(a.user_id,'organizer')
    on conflict (user_id,role) do nothing;

    insert into public.live_organizer_profiles(
      user_id, display_name, bio, website_url, verification_status, application_id
    )
    values(
      a.user_id, a.display_name, a.bio, a.website_url, 'verified', a.id
    )
    on conflict (user_id) do update set
      display_name=excluded.display_name,
      bio=excluded.bio,
      website_url=excluded.website_url,
      verification_status='verified',
      application_id=a.id,
      updated_at=now();
  else
    -- La suspension/refus/demande de modification ne concerne que l'espace Live.
    delete from public.user_roles
    where user_id=a.user_id and role in ('organizer','organisateur');

    profile_status := case normalized
      when 'suspended' then 'suspended'
      when 'rejected' then 'rejected'
      else 'pending'
    end;

    update public.live_organizer_profiles
    set verification_status=profile_status, updated_at=now()
    where user_id=a.user_id;
  end if;

  return jsonb_build_object('success',true,'status',normalized,'user_id',a.user_id);
end;
$$;

grant execute on function public.omnia_live_approve_organizer(uuid,uuid,text,text) to service_role;
