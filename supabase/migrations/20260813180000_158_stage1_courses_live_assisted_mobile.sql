-- Étape 1 — stabilité mobile, saisie assistée, tarification contextualisée,
-- liaisons Formations <-> Omnia Live / Replays et droits d'accès.

-- 1) Workflow de saisie assistée : retour du brouillon au propriétaire avant clôture.
alter table public.assisted_course_requests
  add column if not exists owner_comment text,
  add column if not exists draft_ready_at timestamptz,
  add column if not exists owner_validated_at timestamptz,
  add column if not exists last_returned_at timestamptz,
  add column if not exists revision_count integer not null default 0;

alter table public.assisted_course_requests
  drop constraint if exists assisted_course_requests_status_check;

alter table public.assisted_course_requests
  add constraint assisted_course_requests_status_check
  check (status in (
    'pending','in_progress','draft_ready','changes_requested','owner_validated',
    'pricing_review','ready_to_publish','completed','rejected','cancelled'
  ));

drop index if exists public.ux_assisted_active_course;
create unique index if not exists ux_assisted_active_course
  on public.assisted_course_requests(course_id)
  where status in ('pending','in_progress','draft_ready','changes_requested','owner_validated','pricing_review','ready_to_publish');

-- 2) Omnia Live : le code utilise déjà pending_payment ; on aligne la contrainte SQL.
alter table public.live_registrations
  drop constraint if exists live_registrations_status_check;

alter table public.live_registrations
  add constraint live_registrations_status_check
  check (status in ('pending','pending_payment','payment_pending','confirmed','waitlisted','cancelled','refunded','expelled'));

-- 3) Une formation Omnia peut annoncer / inclure des Lives et Replays sans dupliquer les médias.
create table if not exists public.course_live_content_links (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  event_id uuid references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  title_override text,
  position integer not null default 0,
  required boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_live_content_links_one_target check (
    (event_id is not null and media_id is null) or
    (event_id is null and media_id is not null)
  )
);

create unique index if not exists ux_course_live_content_event
  on public.course_live_content_links(course_id,event_id)
  where event_id is not null;
create unique index if not exists ux_course_live_content_media
  on public.course_live_content_links(course_id,media_id)
  where media_id is not null;
create index if not exists ix_course_live_content_course
  on public.course_live_content_links(course_id,is_active,position);

alter table public.course_live_content_links enable row level security;

-- Les écritures passent par les Edge Functions avec service role.
-- Lecture publique limitée aux liaisons actives dont la formation est publiée.
drop policy if exists course_live_content_links_public_read on public.course_live_content_links;
create policy course_live_content_links_public_read
on public.course_live_content_links
for select
using (
  is_active = true and exists (
    select 1 from public.courses c
    where c.id = course_live_content_links.course_id
      and c.is_published = true
  )
);

-- 4) Ordre pédagogique des vidéos / Replays dans une formation vidéo Omnia Live.
alter table public.live_media
  add column if not exists sequence_no integer;

alter table public.live_media
  drop constraint if exists live_media_sequence_no_check;
alter table public.live_media
  add constraint live_media_sequence_no_check
  check (sequence_no is null or sequence_no > 0);

create index if not exists ix_live_media_event_sequence
  on public.live_media(event_id,sequence_no,created_at);

-- 5) Attribution automatique des droits Omnia Live à toute inscription à une formation.
create or replace function public.oga_grant_course_live_access(
  p_user_id uuid,
  p_course_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_event_id uuid;
begin
  for rec in
    select l.event_id,l.media_id
    from public.course_live_content_links l
    where l.course_id = p_course_id and l.is_active = true
    order by l.position,l.created_at
  loop
    if rec.event_id is not null then
      insert into public.live_registrations(event_id,user_id,access_source,status,registered_at)
      values(rec.event_id,p_user_id,'training_enrollment','confirmed',now())
      on conflict(event_id,user_id) do update set
        status = 'confirmed',
        access_source = case
          when public.live_registrations.status = 'confirmed' then public.live_registrations.access_source
          else 'training_enrollment'
        end;
    elsif rec.media_id is not null then
      select m.event_id into v_event_id
      from public.live_media m
      where m.id = rec.media_id;

      if v_event_id is not null then
        insert into public.live_replay_entitlements(event_id,media_id,user_id,source,starts_at,revoked_at)
        values(v_event_id,rec.media_id,p_user_id,'training',now(),null)
        on conflict(event_id,media_id,user_id,source) do update set
          revoked_at = null,
          starts_at = least(public.live_replay_entitlements.starts_at,excluded.starts_at);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.oga_user_enrollment_grant_live_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.oga_grant_course_live_access(new.user_id,new.course_id);
  return new;
end;
$$;

drop trigger if exists trg_user_enrollment_grant_live_access on public.user_enrollments;
create trigger trg_user_enrollment_grant_live_access
after insert on public.user_enrollments
for each row execute function public.oga_user_enrollment_grant_live_access();

-- Quand une liaison est ajoutée plus tard, les apprenants déjà inscrits obtiennent aussi le droit.
create or replace function public.oga_course_live_link_backfill_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enr record;
begin
  if new.is_active = true then
    for enr in select ue.user_id from public.user_enrollments ue where ue.course_id = new.course_id
    loop
      perform public.oga_grant_course_live_access(enr.user_id,new.course_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_course_live_link_backfill_access on public.course_live_content_links;
create trigger trg_course_live_link_backfill_access
after insert or update of is_active,event_id,media_id on public.course_live_content_links
for each row execute function public.oga_course_live_link_backfill_access();

-- Backfill des éventuelles liaisons déjà présentes après réexécution contrôlée.
do $$
declare
  enr record;
begin
  for enr in
    select distinct ue.user_id,ue.course_id
    from public.user_enrollments ue
    join public.course_live_content_links l on l.course_id = ue.course_id and l.is_active = true
  loop
    perform public.oga_grant_course_live_access(enr.user_id,enr.course_id);
  end loop;
end;
$$;
