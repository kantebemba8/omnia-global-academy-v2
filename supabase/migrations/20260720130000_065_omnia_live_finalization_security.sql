-- ============================================================
-- 065 — OMNIA LIVE MODULE J
-- FINALISATION / SECURITY / PERMISSIONS / AUDIT / CLEANUP SUPPORT
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Centralized role permissions
create table if not exists public.live_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  permission_key text not null,
  enabled boolean not null default true,
  scope text not null default 'global'
    check (scope in ('global','own','structure','event')),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(role_key,permission_key)
);

-- 2. Security policy configuration
create table if not exists public.live_security_policies (
  policy_key text primary key,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.live_security_policies(policy_key,enabled,config)
values
('super_admin_global_visibility',true,'{"can_view_all_events":true,"can_join_without_registration":true,"can_supervise_rooms":true}'::jsonb),
('anti_piracy',true,'{"dynamic_watermark":true,"download_disabled":true,"signed_urls":true,"playback_audit":true}'::jsonb),
('media_validation',true,'{"revalidation_after_change":true,"super_admin_required":true}'::jsonb),
('document_immutability',true,'{"revocation_required_for_correction":true}'::jsonb),
('payment_safety',true,'{"webhook_idempotency":true,"server_confirmation_only":true}'::jsonb),
('rate_limits',true,'{"room_join_per_minute":20,"chat_per_minute":60,"api_write_per_minute":120}'::jsonb),
('retention',true,'{"default_days":365,"audit_days":730}'::jsonb)
on conflict (policy_key) do nothing;

-- 3. Global audit trail
create table if not exists public.live_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  event_id uuid references public.live_events(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  action text not null,
  result text not null default 'success'
    check (result in ('success','denied','failed')),
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_audit_log_event_idx
  on public.live_audit_log(event_id,created_at desc);
create index if not exists live_audit_log_actor_idx
  on public.live_audit_log(actor_user_id,created_at desc);
create index if not exists live_audit_log_action_idx
  on public.live_audit_log(action,created_at desc);

-- 4. System health / integrity checks
create table if not exists public.live_integrity_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null,
  scope text not null default 'platform',
  entity_id uuid,
  severity text not null default 'warning'
    check (severity in ('info','warning','error','critical')),
  status text not null default 'open'
    check (status in ('open','resolved','ignored')),
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create index if not exists live_integrity_checks_status_idx
  on public.live_integrity_checks(status,severity,detected_at desc);

-- 5. Feature flags for controlled production rollout
create table if not exists public.live_feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  audience jsonb not null default '{"roles":[],"countries":[],"structures":[]}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.live_feature_flags(flag_key,enabled,config)
values
('omnia_live_enabled',true,'{}'::jsonb),
('fedapay_live_payments',false,'{"environment":"sandbox"}'::jsonb),
('omnia_live_pass',false,'{}'::jsonb),
('oga_premium_live',false,'{}'::jsonb),
('sms_notifications',false,'{}'::jsonb),
('push_notifications',false,'{}'::jsonb),
('server_recording',false,'{}'::jsonb)
on conflict (flag_key) do nothing;

-- 6. Default permissions matrix
insert into public.live_role_permissions(role_key,permission_key,enabled,scope)
values
('learner','live.view_public',true,'global'),
('learner','live.register',true,'global'),
('learner','live.create',false,'global'),
('learner','live.join_registered',true,'own'),
('learner','live.purchase',true,'own'),
('learner','live.review',true,'own'),
('learner','live.documents',true,'own'),

('professor','live.create',true,'own'),
('professor','live.manage',true,'own'),
('professor','live.host',true,'own'),
('professor','live.media_manage',true,'own'),
('professor','live.participants_view',true,'own'),
('professor','live.analytics_view',true,'own'),
('professor','live.finance_view',true,'own'),

('structure','live.create',true,'structure'),
('structure','live.manage',true,'structure'),
('structure','live.host',true,'structure'),
('structure','live.members_manage',true,'structure'),
('structure','live.reports_view',true,'structure'),
('structure','live.pack_manage',true,'structure'),

('super_admin','live.view_all',true,'global'),
('super_admin','live.manage_all',true,'global'),
('super_admin','live.supervise_rooms',true,'global'),
('super_admin','live.moderate',true,'global'),
('super_admin','live.finance_manage',true,'global'),
('super_admin','live.documents_manage',true,'global'),
('super_admin','live.settings_manage',true,'global'),

('moderator','live.moderate',true,'global'),
('moderator','live.support_view',true,'global')
on conflict (role_key,permission_key) do nothing;

-- 7. RLS
alter table public.live_role_permissions enable row level security;
alter table public.live_security_policies enable row level security;
alter table public.live_audit_log enable row level security;
alter table public.live_integrity_checks enable row level security;
alter table public.live_feature_flags enable row level security;
