-- ============================================================
-- 070 — OMNIA LIVE — SUPPRESSION DÉFINITIVE FIABLE
-- Self-contained: does not depend on 067/068/069 being present in the repo.
-- ============================================================

create extension if not exists pgcrypto;

-- Detached immutable audit: survives physical deletion of live_events.
create table if not exists public.live_deleted_event_audit (
  id uuid primary key default gen_random_uuid(),
  original_event_id uuid not null,
  title text,
  previous_status text,
  organizer_snapshot jsonb not null default '{}'::jsonb,
  event_snapshot jsonb not null default '{}'::jsonb,
  validation_history jsonb not null default '[]'::jsonb,
  deleted_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);

create index if not exists live_deleted_event_audit_original_idx
  on public.live_deleted_event_audit(original_event_id, deleted_at desc);

alter table public.live_deleted_event_audit enable row level security;

-- Any FK pointing at live_events must not block a true physical deletion.
-- Rebuild every FK to live_events as ON DELETE CASCADE while preserving columns.
do $$
declare
  r record;
  child_cols text;
  parent_cols text;
begin
  for r in
    select
      c.conname,
      c.conrelid,
      c.confrelid,
      c.conrelid::regclass as child_table,
      c.confrelid::regclass as parent_table,
      c.conkey,
      c.confkey,
      c.confmatchtype,
      c.condeferrable,
      c.condeferred
    from pg_constraint c
    where c.contype='f'
      and c.confrelid='public.live_events'::regclass
      and c.confdeltype <> 'c'
  loop
    select string_agg(quote_ident(a.attname), ', ' order by u.ord)
    into child_cols
    from unnest(r.conkey) with ordinality u(attnum,ord)
    join pg_attribute a
      on a.attrelid=r.conrelid and a.attnum=u.attnum;

    select string_agg(quote_ident(a.attname), ', ' order by u.ord)
    into parent_cols
    from unnest(r.confkey) with ordinality u(attnum,ord)
    join pg_attribute a
      on a.attrelid=r.confrelid and a.attnum=u.attnum;

    execute format('alter table %s drop constraint %I', r.child_table, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%s) references %s (%s) on delete cascade%s%s',
      r.child_table,
      r.conname,
      child_cols,
      r.parent_table,
      parent_cols,
      case when r.condeferrable then ' deferrable' else '' end,
      case when r.condeferred then ' initially deferred' else '' end
    );
  end loop;
end $$;

-- Definitive RPC.
create or replace function public.omnia_live_delete_event_permanently(
  p_event_id uuid,
  p_deleted_by uuid
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_event public.live_events%rowtype;
  v_history jsonb := '[]'::jsonb;
begin
  select *
  into v_event
  from public.live_events
  where id=p_event_id
  for update;

  if not found then
    return true; -- idempotent: already gone = success
  end if;

  if v_event.status <> 'suspended' then
    raise exception using
      errcode='P0001',
      message='ONLY_SUSPENDED_EVENT_CAN_BE_DELETED',
      detail='Current status: '||coalesce(v_event.status,'NULL');
  end if;

  -- Read review history only when table exists.
  if to_regclass('public.live_review_history') is not null then
    execute
      'select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), ''[]''::jsonb)
       from public.live_review_history x
       where x.event_id=$1'
      into v_history
      using p_event_id;
  end if;

  insert into public.live_deleted_event_audit(
    original_event_id,
    title,
    previous_status,
    organizer_snapshot,
    event_snapshot,
    validation_history,
    deleted_by
  )
  values(
    v_event.id,
    v_event.title,
    v_event.status,
    jsonb_build_object(
      'owner_user_id',v_event.owner_user_id,
      'owner_structure_id',v_event.owner_structure_id,
      'organizer_kind',v_event.organizer_kind,
      'organizer_display_name',v_event.organizer_display_name
    ),
    to_jsonb(v_event),
    v_history,
    p_deleted_by
  );

  -- The FK cascade rules remove all child records including rooms.
  delete from public.live_events where id=p_event_id;

  if exists(select 1 from public.live_events where id=p_event_id) then
    raise exception using
      errcode='P0001',
      message='DELETE_FAILED_EVENT_STILL_EXISTS';
  end if;

  return true;
end;
$$;

revoke all on function public.omnia_live_delete_event_permanently(uuid,uuid) from public;
grant execute on function public.omnia_live_delete_event_permanently(uuid,uuid) to service_role;
