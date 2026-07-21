-- 071 — Omnia Live : rôle global Organisateur
-- Le rôle donne accès uniquement à Omnia Live. Professeur et Structure gardent leurs capacités existantes.

create table if not exists public.live_organizer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  organizer_type text not null default 'independent'
    check (organizer_type in ('independent','company','association','media','expert','other')),
  professional_title text,
  organization_name text,
  website_url text,
  bio text,
  experience_summary text,
  event_topics text[] not null default '{}',
  supporting_document_url text,
  status text not null default 'pending'
    check (status in ('pending','approved','changes_requested','rejected','suspended')),
  admin_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_organizer_applications_status_idx
  on public.live_organizer_applications(status, created_at desc);

alter table public.live_organizer_applications enable row level security;

-- Ensure existing live organizer profiles can carry the same lifecycle.
alter table public.live_organizer_profiles
  add column if not exists application_id uuid references public.live_organizer_applications(id) on delete set null;

-- user_roles.role is text in the current project; organizer is therefore a new global role value.
-- Existing professors/structures are NOT converted: they retain live.create through capability logic.

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

  select * into a from public.live_organizer_applications where id=p_application_id for update;
  if not found then raise exception 'ORGANIZER_APPLICATION_NOT_FOUND'; end if;

  update public.live_organizer_applications
  set status=normalized, admin_note=p_note, reviewed_by=p_admin_id, reviewed_at=now(), updated_at=now()
  where id=p_application_id;

  if normalized='approved' then
    insert into public.user_roles(user_id,role)
    select a.user_id,'organizer'
    where not exists(select 1 from public.user_roles where user_id=a.user_id and role='organizer');

    update public.users set status='actif' where id=a.user_id;

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
  elsif normalized='suspended' then
    update public.live_organizer_profiles set verification_status='suspended', updated_at=now()
    where user_id=a.user_id;
  elsif normalized='rejected' then
    delete from public.user_roles where user_id=a.user_id and role='organizer';
    update public.live_organizer_profiles set verification_status='rejected', updated_at=now()
    where user_id=a.user_id;
  end if;

  return jsonb_build_object('success',true,'status',normalized,'user_id',a.user_id);
end;
$$;

grant execute on function public.omnia_live_approve_organizer(uuid,uuid,text,text) to service_role;
