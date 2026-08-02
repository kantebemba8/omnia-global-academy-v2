-- ============================================================
-- 134 — Mobile store billing (Google Play / Apple App Store)
-- No product, price, partner, user or statistic is seeded.
-- FedaPay web checkout remains unchanged and sandbox-only.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.mobile_store_products (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('android','ios')),
  store_product_id text not null,
  product_type text not null check (product_type in ('consumable','non_consumable','subscription')),
  target_kind text not null check (target_kind in ('price_tier','commerce_plan','creator_offer')),
  module_key text not null default 'global' check (module_key in ('global','formations','commerce','omnia_live','coaching')),
  price_xof integer check (price_xof is null or price_xof > 0),
  commerce_plan_id uuid references public.commerce_plans(id) on delete cascade,
  commerce_creator_offer_id uuid references public.commerce_creator_offers(id) on delete cascade,
  display_name text not null,
  notes text,
  status text not null default 'draft' check (status in ('draft','active','paused','retired')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, store_product_id),
  check (
    (target_kind = 'price_tier' and price_xof is not null and commerce_plan_id is null and commerce_creator_offer_id is null and product_type = 'consumable')
    or
    (target_kind = 'commerce_plan' and commerce_plan_id is not null and commerce_creator_offer_id is null and price_xof is null and product_type = 'subscription')
    or
    (target_kind = 'creator_offer' and commerce_creator_offer_id is not null and commerce_plan_id is null and price_xof is null)
  )
);

create unique index if not exists mobile_store_products_price_tier_uidx
  on public.mobile_store_products(platform, module_key, price_xof)
  where target_kind = 'price_tier' and status <> 'retired';

create unique index if not exists mobile_store_products_plan_uidx
  on public.mobile_store_products(platform, commerce_plan_id)
  where target_kind = 'commerce_plan' and status <> 'retired';

create unique index if not exists mobile_store_products_creator_offer_uidx
  on public.mobile_store_products(platform, commerce_creator_offer_id)
  where target_kind = 'creator_offer' and status <> 'retired';

create table if not exists public.mobile_store_purchase_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('android','ios')),
  target_type text not null check (target_type in ('course','commerce','omnia_live','coaching','coaching_advanced')),
  target_id uuid not null,
  store_product_id uuid not null references public.mobile_store_products(id) on delete restrict,
  expected_amount_xof integer not null check (expected_amount_xof > 0),
  nonce text not null unique,
  status text not null default 'prepared' check (status in ('prepared','verifying','completed','failed','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  completed_at timestamptz,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_store_purchase_sessions_user_idx
  on public.mobile_store_purchase_sessions(user_id, created_at desc);
create index if not exists mobile_store_purchase_sessions_target_idx
  on public.mobile_store_purchase_sessions(target_type, target_id);

create table if not exists public.mobile_store_transactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mobile_store_purchase_sessions(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  platform text not null check (platform in ('android','ios')),
  store_product_id text not null,
  provider_transaction_id text,
  purchase_token_hash text not null,
  purchase_state text not null,
  acknowledgement_state text,
  consumption_state text,
  provider_payload jsonb not null default '{}'::jsonb,
  verification_status text not null default 'received' check (verification_status in ('received','verified','granted','rejected','failed')),
  rejection_reason text,
  verified_at timestamptz,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, purchase_token_hash)
);

create index if not exists mobile_store_transactions_user_idx
  on public.mobile_store_transactions(user_id, created_at desc);
create index if not exists mobile_store_transactions_session_idx
  on public.mobile_store_transactions(session_id);

alter table public.mobile_store_products enable row level security;
alter table public.mobile_store_purchase_sessions enable row level security;
alter table public.mobile_store_transactions enable row level security;

drop policy if exists mobile_store_products_admin_select on public.mobile_store_products;
create policy mobile_store_products_admin_select
  on public.mobile_store_products for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'super_admin'
  ));

drop policy if exists mobile_store_purchase_sessions_own_select on public.mobile_store_purchase_sessions;
create policy mobile_store_purchase_sessions_own_select
  on public.mobile_store_purchase_sessions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists mobile_store_transactions_own_select on public.mobile_store_transactions;
create policy mobile_store_transactions_own_select
  on public.mobile_store_transactions for select to authenticated
  using (user_id = auth.uid());

comment on table public.mobile_store_products is
  'Real Google Play and App Store product identifiers configured by Super Admin. No fictitious rows are seeded.';
comment on table public.mobile_store_purchase_sessions is
  'Short-lived server-authorised link between an Omnia pending order and a store product.';
comment on table public.mobile_store_transactions is
  'Immutable verification ledger for mobile store purchase tokens; raw tokens are never stored.';
