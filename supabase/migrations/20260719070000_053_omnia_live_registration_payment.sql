-- ============================================================
-- 053 — OMNIA LIVE REGISTRATION / PAYMENT / WAITLIST / INVOICE / REFUND
-- ============================================================

create extension if not exists pgcrypto;

-- Orders / payments
create table if not exists public.live_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.users(id) on delete restrict,
  event_id uuid not null references public.live_events(id) on delete restrict,
  registration_id uuid references public.live_registrations(id) on delete set null,

  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'XOF',
  payment_status text not null default 'pending'
    check (payment_status in ('pending','authorized','paid','failed','cancelled','partially_refunded','refunded')),

  payment_provider text,
  provider_reference text,
  payment_metadata jsonb not null default '{}'::jsonb,

  access_granted_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_orders_user_idx
  on public.live_orders(user_id, created_at desc);

create index if not exists live_orders_event_idx
  on public.live_orders(event_id, payment_status);

create unique index if not exists live_orders_provider_reference_uidx
  on public.live_orders(provider_reference)
  where provider_reference is not null;

-- Waiting list
create table if not exists public.live_waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  position integer,
  status text not null default 'waiting'
    check (status in ('waiting','invited','converted','expired','cancelled')),
  invited_at timestamptz,
  invitation_expires_at timestamptz,
  converted_registration_id uuid references public.live_registrations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create index if not exists live_waitlist_event_status_idx
  on public.live_waitlist(event_id, status, created_at);

-- Refund requests
create table if not exists public.live_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.live_orders(id) on delete restrict,
  event_id uuid not null references public.live_events(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,

  requested_amount numeric(14,2) not null check (requested_amount >= 0),
  approved_amount numeric(14,2) check (approved_amount is null or approved_amount >= 0),

  reason_code text not null,
  reason_details text,

  status text not null default 'pending'
    check (status in ('pending','under_review','approved','partially_approved','rejected','processed','cancelled')),

  policy_snapshot jsonb not null default '{}'::jsonb,
  decision_reason text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  processed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_refund_requests_status_idx
  on public.live_refund_requests(status, created_at);

-- Immutable invoices
create table if not exists public.live_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null unique references public.live_orders(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  event_id uuid not null references public.live_events(id) on delete restrict,

  issued_at timestamptz not null default now(),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null,

  seller_name text not null default 'Omnia Global Academy',
  buyer_name text,
  buyer_email text,
  event_title text not null,

  invoice_snapshot jsonb not null,
  pdf_storage_key text,
  checksum_sha256 text,

  created_at timestamptz not null default now()
);

create index if not exists live_invoices_user_idx
  on public.live_invoices(user_id, issued_at desc);

-- Prevent accidental updates to immutable invoice business fields.
create or replace function public.prevent_live_invoice_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.invoice_number is distinct from new.invoice_number
     or old.order_id is distinct from new.order_id
     or old.user_id is distinct from new.user_id
     or old.event_id is distinct from new.event_id
     or old.amount is distinct from new.amount
     or old.currency is distinct from new.currency
     or old.seller_name is distinct from new.seller_name
     or old.buyer_name is distinct from new.buyer_name
     or old.buyer_email is distinct from new.buyer_email
     or old.event_title is distinct from new.event_title
     or old.invoice_snapshot is distinct from new.invoice_snapshot
  then
    raise exception 'LIVE_INVOICE_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_live_invoice_mutation on public.live_invoices;

create trigger trg_prevent_live_invoice_mutation
before update on public.live_invoices
for each row execute function public.prevent_live_invoice_mutation();

alter table public.live_orders enable row level security;
alter table public.live_waitlist enable row level security;
alter table public.live_refund_requests enable row level security;
alter table public.live_invoices enable row level security;

-- Edge Function service-role remains authoritative for writes.
