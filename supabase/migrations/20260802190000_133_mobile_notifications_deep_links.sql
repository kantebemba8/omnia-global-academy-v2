-- Module mobile 4 — installations push, inbox mobile et journal de livraison.
create extension if not exists pgcrypto;

create table if not exists public.mobile_push_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  installation_id text not null,
  platform text not null check (platform in ('android','ios')),
  push_token text not null,
  token_hash text generated always as (encode(digest(push_token, 'sha256'), 'hex')) stored,
  app_version text,
  app_build text,
  device_model text,
  device_manufacturer text,
  os_version text,
  locale text,
  timezone text,
  permission_status text not null default 'granted',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  registered_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform, installation_id)
);
create index if not exists mobile_push_installations_user_idx on public.mobile_push_installations(user_id, active, updated_at desc);
create index if not exists mobile_push_installations_token_hash_idx on public.mobile_push_installations(token_hash);
create unique index if not exists mobile_push_installations_active_token_uidx
  on public.mobile_push_installations(platform, token_hash) where active;

create table if not exists public.mobile_notification_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null default '',
  action_url text,
  payload jsonb not null default '{}'::jsonb,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mobile_notification_inbox_user_idx on public.mobile_notification_inbox(user_id, read_at, created_at desc);

create table if not exists public.mobile_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  installation_id uuid references public.mobile_push_installations(id) on delete set null,
  notification_id uuid references public.mobile_notification_inbox(id) on delete set null,
  provider text not null check (provider in ('fcm','apns')),
  status text not null check (status in ('sent','failed','skipped')),
  provider_reference text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mobile_notification_deliveries_user_idx on public.mobile_notification_deliveries(user_id, created_at desc);

alter table public.mobile_push_installations enable row level security;
alter table public.mobile_notification_inbox enable row level security;
alter table public.mobile_notification_deliveries enable row level security;

-- Les sessions Omnia sont validées dans l'Edge Function. Aucun jeton push ne doit être exposé par PostgREST.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['mobile_push_installations','mobile_notification_inbox','mobile_notification_deliveries'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_deny_direct', table_name);
    execute format('create policy %I on public.%I for all using (false) with check (false)', table_name || '_deny_direct', table_name);
  end loop;
end $$;
