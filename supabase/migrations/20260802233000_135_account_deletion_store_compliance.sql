-- ============================================================
-- 135 — Account deletion and mobile store compliance
-- Provides immediate account closure, revokes all sessions and
-- removes/anonymises personal data while retaining only records
-- required for accounting, fraud prevention and credential audit.
-- No Cron Job is created or enabled.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_reference uuid,
  add column if not exists deletion_reason text;

create unique index if not exists users_deletion_reference_uidx
  on public.users(deletion_reference)
  where deletion_reference is not null;

create table if not exists public.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  former_user_id uuid not null,
  deletion_reference uuid not null unique,
  request_source text not null default 'app'
    check (request_source in ('app','web','support','admin')),
  reason text,
  retained_categories jsonb not null default '[]'::jsonb,
  deletion_summary jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

alter table public.account_deletion_audit enable row level security;
comment on table public.account_deletion_audit is
  'Service-role-only audit of completed account deletion. Contains no email, phone, name or authentication secret.';

-- Global user blocking for community safety. Direct client access is denied;
-- custom-authenticated actions are mediated by auth-update-profile.
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_user_id <> blocked_user_id),
  constraint user_blocks_unique unique (blocker_user_id, blocked_user_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_user_id);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from public, anon, authenticated;
comment on table public.user_blocks is
  'Service-role-managed global safety blocks used to hide community content and prevent unwanted interaction.';


create or replace function public.omnia_delete_user_account(
  p_user_id uuid,
  p_reason text default null,
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
  v_fk record;
  v_deleted_tables jsonb := '[]'::jsonb;
  v_nullified_tables jsonb := '[]'::jsonb;
  v_retained_tables jsonb := '[]'::jsonb;
  v_affected bigint := 0;
  v_active_super_admins integer := 0;
  v_retention_tables constant text[] := array[
    'orders','coupon_usages','payment_reconciliations','wallets','wallet_transactions','payout_requests',
    'live_orders','live_refund_requests','live_invoices','live_payout_allocations','live_payout_batches','live_payout_requests',
    'commerce_orders','commerce_payment_events','commerce_creator_ledger','commerce_payout_requests','commerce_audit_log',
    'mobile_store_purchase_sessions','mobile_store_transactions','b2b_contracts','b2b_quotes','b2b_invoices','b2b_payment_proofs',
    'security_audit_log','certificate_generation_audit','badge_audit_logs','clr_audit_logs','skills_passport_audit_logs',
    'live_audit_log','live_document_audit_log','live_communication_audit','omnia_project_audit_log','quality_review_history',
    'recognition_audit_log','talent_activity_log','employability_audit_log','course_audit_log'
  ];
  v_subject_columns constant text[] := array['user_id','learner_id','student_id','applicant_id','blocker_user_id','blocked_user_id'];
  v_attribution_columns constant text[] := array[
    'created_by','updated_by','actor_id','actor_user_id','requested_by','submitted_by','reviewed_by','decided_by',
    'assigned_to','invited_by','reported_by','validated_by','issued_by','revoked_by','granted_by','owner_id',
    'organizer_user_id','coach_id','professor_id','recruiter_id','detected_by','resolved_by','closed_by'
  ];
begin
  if p_source not in ('app','web','support','admin') then
    raise exception 'INVALID_SOURCE';
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
    return jsonb_build_object(
      'success', true,
      'already_deleted', true,
      'deletion_reference', v_user.deletion_reference,
      'deleted_at', v_user.deleted_at
    );
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

  -- Remove contact-bound authentication traces which do not reference users(id).
  if to_regclass('public.otp_codes') is not null then
    execute 'delete from public.otp_codes where phone_number = $1' using v_user.phone_number;
  end if;
  if to_regclass('public.sms_rate_limits') is not null then
    execute 'delete from public.sms_rate_limits where phone_number = $1' using v_user.phone_number;
  end if;

  -- Process every direct foreign key to users. Personal subject rows are erased,
  -- attribution is nullified when possible, and regulated ledgers are retained
  -- against the anonymised UUID anchor.
  for v_fk in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      a.attname as column_name,
      a.attnotnull as is_not_null
    from pg_constraint fk
    join pg_class c on c.oid = fk.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = fk.conkey[1]
    where fk.contype = 'f'
      and fk.confrelid = 'public.users'::regclass
      and cardinality(fk.conkey) = 1
      and n.nspname = 'public'
      and c.relname not in ('users','account_deletion_audit')
    order by c.relname, a.attname
  loop
    if v_fk.table_name = any(v_retention_tables) then
      v_retained_tables := v_retained_tables || jsonb_build_array(v_fk.table_name || '.' || v_fk.column_name);
      continue;
    end if;

    if v_fk.column_name = any(v_subject_columns) then
      begin
        execute format('delete from %I.%I where %I = $1', v_fk.schema_name, v_fk.table_name, v_fk.column_name)
          using p_user_id;
        get diagnostics v_affected = row_count;
        if v_affected > 0 then
          v_deleted_tables := v_deleted_tables || jsonb_build_array(
            jsonb_build_object('table', v_fk.table_name, 'column', v_fk.column_name, 'rows', v_affected)
          );
        end if;
      exception when foreign_key_violation then
        -- Keep a pseudonymous UUID anchor when another regulated record prevents
        -- deletion. Direct identifiers are still removed from users below.
        v_retained_tables := v_retained_tables || jsonb_build_array(v_fk.table_name || '.' || v_fk.column_name);
      end;
      continue;
    end if;

    if not v_fk.is_not_null then
      execute format('update %I.%I set %I = null where %I = $1', v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name)
        using p_user_id;
      get diagnostics v_affected = row_count;
      if v_affected > 0 then
        v_nullified_tables := v_nullified_tables || jsonb_build_array(
          jsonb_build_object('table', v_fk.table_name, 'column', v_fk.column_name, 'rows', v_affected)
        );
      end if;
      continue;
    end if;

    -- A non-null ownership/audit reference is retained only as a pseudonymous UUID.
    v_retained_tables := v_retained_tables || jsonb_build_array(v_fk.table_name || '.' || v_fk.column_name);
  end loop;

  -- Remove contact-only rows not linked by a foreign key.
  if to_regclass('public.waitlist') is not null then
    execute 'delete from public.waitlist where lower(email) = lower($1)' using v_user.email;
  end if;
  if to_regclass('public.talent_recruitment_invites') is not null then
    execute 'delete from public.talent_recruitment_invites where lower(email) = lower($1)' using v_user.email;
  end if;

  -- Revoke remaining access rights which can be retained by financial tables.
  if to_regclass('public.commerce_subscriptions') is not null then
    execute $q$update public.commerce_subscriptions
      set status = 'cancelled', auto_renew = false, cancel_at_period_end = false, cancellation_reason = coalesce(cancellation_reason, 'account_deleted'), cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
      where user_id = $1 and status not in ('cancelled','expired')$q$ using p_user_id;
  end if;
  if to_regclass('public.commerce_entitlements') is not null then
    execute $q$update public.commerce_entitlements
      set status = 'revoked', valid_until = least(coalesce(valid_until, now()), now()), updated_at = now()
      where user_id = $1 and status = 'active'$q$ using p_user_id;
  end if;

  -- The UUID remains only as a pseudonymous accounting/audit anchor. All login
  -- material and direct identifiers are irreversibly replaced.
  update public.users
  set
    email = 'deleted+' || replace(id::text, '-', '') || '@deleted.omniaglobalacademy.invalid',
    phone_number = 'deleted-' || id::text,
    password_hash = encode(gen_random_bytes(48), 'hex'),
    full_name = 'Compte supprimé',
    birth_date = date '1900-01-01',
    country_code = 'ZZ',
    avatar_url = null,
    email_status = 'supprime',
    allow_email = false,
    allow_sms = false,
    allow_push = false,
    subscribe_newsletter = false,
    status = 'supprime',
    force_password_change = false,
    last_login_at = null,
    deleted_at = now(),
    deletion_reference = v_reference,
    deletion_reason = nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    updated_at = now()
  where id = p_user_id;

  insert into public.account_deletion_audit (
    former_user_id,
    deletion_reference,
    request_source,
    reason,
    retained_categories,
    deletion_summary
  ) values (
    p_user_id,
    v_reference,
    p_source,
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    jsonb_build_array('facturation','paiements','lutte_contre_fraude','audit_reglementaire'),
    jsonb_build_object(
      'deleted_rows', v_deleted_tables,
      'nullified_attribution', v_nullified_tables,
      'retained_pseudonymous_references', v_retained_tables
    )
  );

  return jsonb_build_object(
    'success', true,
    'deletion_reference', v_reference,
    'deleted_at', now(),
    'retained_categories', jsonb_build_array('facturation','paiements','lutte_contre_fraude','audit_reglementaire')
  );
end;
$$;

revoke all on function public.omnia_delete_user_account(uuid,text,text) from public, anon, authenticated;
grant execute on function public.omnia_delete_user_account(uuid,text,text) to service_role;

comment on function public.omnia_delete_user_account(uuid,text,text) is
  'Immediately closes and anonymises an Omnia account, erases direct personal rows, revokes access and retains only pseudonymous regulated records.';
