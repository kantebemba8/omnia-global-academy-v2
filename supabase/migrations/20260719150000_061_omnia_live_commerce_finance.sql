-- ============================================================
-- 061 — OMNIA LIVE MODULE F: COMMERCE / FEDAPAY / FINANCE COMPLETE
-- Unified commerce for Live, Replay, recorded video, structure packs
-- and future subscription-compatible entitlements.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.live_orders
  add column if not exists purchase_type text not null default 'live'
    check (purchase_type in ('live','replay','recorded_video','structure_pack','subscription')),
  add column if not exists media_id uuid references public.live_media(id) on delete set null,
  add column if not exists structure_pack_id uuid references public.live_structure_packs(id) on delete set null,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists fee_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists net_amount numeric(14,2),
  add column if not exists expires_at timestamptz;

create index if not exists live_orders_purchase_type_idx
  on public.live_orders(purchase_type,payment_status,created_at desc);

create table if not exists public.live_commerce_products (
  id uuid primary key default gen_random_uuid(),
  product_type text not null
    check (product_type in ('live','replay','recorded_video','structure_pack','subscription')),
  event_id uuid references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  structure_pack_id uuid references public.live_structure_packs(id) on delete cascade,

  title text not null,
  description text,
  price_amount numeric(14,2) not null default 0 check (price_amount >= 0),
  currency text not null default 'XOF',
  status text not null default 'draft'
    check (status in ('draft','active','inactive','archived')),

  access_duration_days integer,
  max_uses integer,
  settings jsonb not null default '{}'::jsonb,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_commerce_products_type_status_idx
  on public.live_commerce_products(product_type,status,created_at desc);

create unique index if not exists live_commerce_product_unique_event_type
  on public.live_commerce_products(event_id,product_type)
  where event_id is not null and media_id is null and structure_pack_id is null;

create unique index if not exists live_commerce_product_unique_media
  on public.live_commerce_products(media_id,product_type)
  where media_id is not null;

create table if not exists public.live_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid references public.live_commerce_products(id) on delete set null,
  order_id uuid references public.live_orders(id) on delete set null,

  entitlement_type text not null
    check (entitlement_type in ('live_access','replay_access','video_access','structure_pack','subscription')),
  event_id uuid references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  structure_pack_id uuid references public.live_structure_packs(id) on delete cascade,

  source text not null default 'purchase'
    check (source in ('purchase','free','structure','subscription','admin','promotion')),

  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_entitlements_user_idx
  on public.live_entitlements(user_id,entitlement_type,expires_at);

create unique index if not exists live_entitlements_unique_order_type
  on public.live_entitlements(order_id,entitlement_type)
  where order_id is not null;

create table if not exists public.live_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null
    check (discount_type in ('percent','fixed')),
  discount_value numeric(14,2) not null check (discount_value >= 0),
  currency text,
  product_type text,
  event_id uuid references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active','disabled','expired')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_discount_codes_status_idx
  on public.live_discount_codes(status,starts_at,ends_at);

create table if not exists public.live_order_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.live_orders(id) on delete cascade,
  adjustment_type text not null
    check (adjustment_type in ('discount','refund','fee','tax','manual')),
  amount numeric(14,2) not null,
  currency text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_order_adjustments_order_idx
  on public.live_order_adjustments(order_id,created_at);

create table if not exists public.live_payout_requests (
  id uuid primary key default gen_random_uuid(),
  organizer_user_id uuid not null references public.users(id) on delete restrict,
  currency text not null,
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','rejected','paid','cancelled')),
  payout_batch_id uuid references public.live_payout_batches(id) on delete set null,
  payout_method text,
  payout_details jsonb not null default '{}'::jsonb,
  request_note text,
  decision_note text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_payout_requests_status_idx
  on public.live_payout_requests(status,created_at);

create table if not exists public.live_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  name text not null,
  audience text not null
    check (audience in ('learner','organizer','structure')),
  status text not null default 'draft'
    check (status in ('draft','active','inactive')),
  price_amount numeric(14,2) not null default 0,
  currency text not null default 'XOF',
  billing_period text not null default 'monthly'
    check (billing_period in ('monthly','quarterly','yearly','custom')),
  features jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.live_subscription_plans(plan_key,name,audience,status,price_amount,currency,billing_period,features,permissions)
values
  ('omnia_live_pass','Omnia Live Pass','learner','draft',0,'XOF','monthly','{}'::jsonb,'{}'::jsonb),
  ('oga_premium_live','OGA Premium + Live','learner','draft',0,'XOF','monthly','{}'::jsonb,'{}'::jsonb)
on conflict (plan_key) do nothing;

alter table public.live_commerce_products enable row level security;
alter table public.live_entitlements enable row level security;
alter table public.live_discount_codes enable row level security;
alter table public.live_order_adjustments enable row level security;
alter table public.live_payout_requests enable row level security;
alter table public.live_subscription_plans enable row level security;
