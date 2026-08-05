-- ============================================================
-- 138 — Voluntary account suspension, secure reactivation and
-- privacy-safe exit feedback. Completes migration 135 without
-- creating a parallel deletion engine. No Cron Job is created.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.users
  add column if not exists self_suspended_at timestamptz,
  add column if not exists self_suspension_until timestamptz,
  add column if not exists self_suspension_reason_code text,
  add column if not exists self_suspension_reference uuid,
  add column if not exists suspension_source text,
  add column if not exists last_reactivated_at timestamptz;

create unique index if not exists users_self_suspension_reference_uidx
  on public.users(self_suspension_reference)
  where self_suspension_reference is not null;


create or replace function public.omnia_normalize_account_suspension_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'suspendu' then
    new.self_suspended_at := null;
    new.self_suspension_until := null;
    new.self_suspension_reason_code := null;
    new.self_suspension_reference := null;
    new.suspension_source := null;
    return new;
  end if;

  -- A genuine voluntary suspension changes its reference and timestamp in the
  -- same statement. Any other status update is administrative and must never
  -- inherit a stale self-suspension marker that would allow self-reactivation.
  if new.suspension_source = 'self'
     and new.self_suspended_at is distinct from old.self_suspended_at
     and new.self_suspension_reference is distinct from old.self_suspension_reference then
    return new;
  end if;

  new.self_suspended_at := null;
  new.self_suspension_until := null;
  new.self_suspension_reason_code := null;
  new.self_suspension_reference := null;
  new.suspension_source := 'administrative';
  return new;
end;
$$;

drop trigger if exists users_normalize_account_suspension_state on public.users;
create trigger users_normalize_account_suspension_state
before update of status, self_suspended_at, self_suspension_until,
  self_suspension_reason_code, self_suspension_reference, suspension_source
on public.users
for each row execute function public.omnia_normalize_account_suspension_state();

comment on function public.omnia_normalize_account_suspension_state() is
  'Prevents administrative suspensions from inheriting a stale voluntary-suspension marker and clears self-reactivation data when an account leaves suspended status.';

create table if not exists public.account_lifecycle_audit (
  id uuid primary key default gen_random_uuid(),
  former_user_id uuid not null,
  account_reference uuid not null,
  action text not null check (action in ('self_suspended','self_reactivated')),
  request_source text not null default 'app'
    check (request_source in ('app','web','password_login','support','admin')),
  reason_code text,
  planned_reactivation_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_lifecycle_audit_created_idx
  on public.account_lifecycle_audit(created_at desc);
create index if not exists account_lifecycle_audit_user_idx
  on public.account_lifecycle_audit(former_user_id, created_at desc);

alter table public.account_lifecycle_audit enable row level security;
revoke all on table public.account_lifecycle_audit from public, anon, authenticated;
grant select, insert, update, delete on table public.account_lifecycle_audit to service_role;
comment on table public.account_lifecycle_audit is
  'Service-role-only pseudonymous audit of voluntary account suspension and reactivation. Contains no name, email, phone or authentication secret.';

create table if not exists public.account_exit_feedback (
  id uuid primary key default gen_random_uuid(),
  account_reference uuid not null,
  action text not null check (action in ('suspension','deletion')),
  reason_code text not null,
  improvement_feedback text,
  missing_feature text,
  return_condition text,
  created_at timestamptz not null default now(),
  constraint account_exit_feedback_unique unique (account_reference, action)
);

alter table public.account_exit_feedback enable row level security;
revoke all on table public.account_exit_feedback from public, anon, authenticated;
grant select, insert, update, delete on table public.account_exit_feedback to service_role;
comment on table public.account_exit_feedback is
  'Optional product-improvement feedback with direct identifiers redacted by the service before storage. Never exposed in user-facing or administrative activity logs.';

alter table public.account_deletion_audit
  add column if not exists reason_code text,
  add column if not exists feedback_reference uuid;

create or replace function public.omnia_suspend_user_account(
  p_user_id uuid,
  p_reason_code text,
  p_suspended_until timestamptz default null,
  p_source text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.users%rowtype;
  v_reference uuid := gen_random_uuid();
  v_active_super_admins integer := 0;
  v_roles jsonb := '[]'::jsonb;
  v_allowed_reasons constant text[] := array[
    'pause','too_many_notifications','low_usage','technical_issue',
    'security_break','missing_features','other'
  ];
begin
  if p_source not in ('app','web','support','admin') then
    raise exception 'INVALID_SOURCE';
  end if;
  if p_reason_code is null or not (p_reason_code = any(v_allowed_reasons)) then
    raise exception 'INVALID_SUSPENSION_REASON';
  end if;
  if p_suspended_until is not null and (
    p_suspended_until <= now() or p_suspended_until > now() + interval '366 days'
  ) then
    raise exception 'INVALID_SUSPENSION_UNTIL';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if lower(v_user.email) = 'test@omniaglobalacademy.com' then
    raise exception 'DEMO_ACCOUNT_PROTECTED';
  end if;
  if v_user.status = 'supprime' then
    raise exception 'ACCOUNT_DELETED';
  end if;
  if v_user.status = 'suspendu' and v_user.suspension_source = 'self' then
    return jsonb_build_object(
      'success', true,
      'already_suspended', true,
      'suspension_reference', v_user.self_suspension_reference,
      'suspended_at', v_user.self_suspended_at,
      'suspended_until', v_user.self_suspension_until
    );
  end if;
  if v_user.status <> 'actif' then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'super_admin'
  ) then
    select count(*) into v_active_super_admins
    from public.users u
    join public.user_roles ur on ur.user_id = u.id and ur.role = 'super_admin'
    where u.status = 'actif';

    if v_active_super_admins <= 1 then
      raise exception 'LAST_SUPER_ADMIN_PROTECTED';
    end if;
  end if;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
  into v_roles
  from public.user_roles
  where user_id = p_user_id;

  update public.users
  set
    status = 'suspendu',
    self_suspended_at = now(),
    self_suspension_until = p_suspended_until,
    self_suspension_reason_code = p_reason_code,
    self_suspension_reference = v_reference,
    suspension_source = 'self',
    updated_at = now()
  where id = p_user_id;

  delete from public.user_sessions where user_id = p_user_id;

  insert into public.account_lifecycle_audit (
    former_user_id,
    account_reference,
    action,
    request_source,
    reason_code,
    planned_reactivation_at,
    metadata
  ) values (
    p_user_id,
    v_reference,
    'self_suspended',
    p_source,
    p_reason_code,
    p_suspended_until,
    jsonb_build_object('roles', v_roles)
  );

  return jsonb_build_object(
    'success', true,
    'account_suspended', true,
    'suspension_reference', v_reference,
    'suspended_at', now(),
    'suspended_until', p_suspended_until
  );
end;
$$;

revoke all on function public.omnia_suspend_user_account(uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.omnia_suspend_user_account(uuid,text,timestamptz,text) to service_role;

comment on function public.omnia_suspend_user_account(uuid,text,timestamptz,text) is
  'Voluntarily suspends an active Omnia account, revokes every session, protects the last active Super-admin and records a pseudonymous audit event.';

create or replace function public.omnia_reactivate_user_account(
  p_user_id uuid,
  p_source text default 'password_login'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.users%rowtype;
  v_reference uuid;
  v_roles jsonb := '[]'::jsonb;
begin
  if p_source not in ('password_login','support','admin') then
    raise exception 'INVALID_SOURCE';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_user.status = 'supprime' then
    raise exception 'ACCOUNT_DELETED';
  end if;
  if v_user.status = 'actif' then
    return jsonb_build_object('success', true, 'already_active', true, 'reactivated_at', v_user.last_reactivated_at);
  end if;
  if v_user.status <> 'suspendu' or coalesce(v_user.suspension_source, '') <> 'self' then
    raise exception 'SELF_REACTIVATION_NOT_ALLOWED';
  end if;

  v_reference := coalesce(v_user.self_suspension_reference, gen_random_uuid());
  select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
  into v_roles
  from public.user_roles
  where user_id = p_user_id;

  update public.users
  set
    status = 'actif',
    self_suspended_at = null,
    self_suspension_until = null,
    self_suspension_reason_code = null,
    self_suspension_reference = null,
    suspension_source = null,
    last_reactivated_at = now(),
    updated_at = now()
  where id = p_user_id;

  delete from public.user_sessions where user_id = p_user_id;

  insert into public.account_lifecycle_audit (
    former_user_id,
    account_reference,
    action,
    request_source,
    metadata
  ) values (
    p_user_id,
    v_reference,
    'self_reactivated',
    p_source,
    jsonb_build_object('roles', v_roles)
  );

  return jsonb_build_object(
    'success', true,
    'account_reactivated', true,
    'reactivated_at', now(),
    'suspension_reference', v_reference
  );
end;
$$;

revoke all on function public.omnia_reactivate_user_account(uuid,text) from public, anon, authenticated;
grant execute on function public.omnia_reactivate_user_account(uuid,text) to service_role;

comment on function public.omnia_reactivate_user_account(uuid,text) is
  'Reactivates only a voluntarily self-suspended account after a strong authentication flow. Administrative suspensions cannot be bypassed.';
