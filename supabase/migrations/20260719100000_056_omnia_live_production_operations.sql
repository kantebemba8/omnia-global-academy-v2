-- ============================================================
-- 056 — OMNIA LIVE PRODUCTION OPERATIONS:
-- FEDAPAY EVENTS, ISSUED DOCUMENTS, NOTIFICATION DELIVERY, IDEMPOTENCY
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  provider_reference text,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists live_payment_events_provider_event_uidx
  on public.live_payment_events(provider, provider_event_id)
  where provider_event_id is not null;

create index if not exists live_payment_events_reference_idx
  on public.live_payment_events(provider_reference, processed);

create table if not exists public.live_documents_issued (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  event_id uuid not null references public.live_events(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  eligibility_id uuid references public.live_certificate_eligibility(id) on delete set null,

  document_type text not null
    check (document_type in ('participation','success','cpd')),

  title text not null,
  issued_at timestamptz not null default now(),
  issuer_name text not null default 'Omnia Global Academy',
  issuer_logo_key text,

  snapshot jsonb not null,
  pdf_storage_key text,
  checksum_sha256 text,

  verification_code text not null unique,
  revoked_at timestamptz,
  revocation_reason text,

  created_at timestamptz not null default now()
);

create index if not exists live_documents_issued_user_idx
  on public.live_documents_issued(user_id, issued_at desc);

create index if not exists live_documents_issued_event_idx
  on public.live_documents_issued(event_id, document_type);

create table if not exists public.live_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.live_notifications_queue(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  channel text not null,
  recipient text,
  provider text,
  provider_reference text,
  status text not null
    check (status in ('sent','failed','skipped')),
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_notification_deliveries_queue_idx
  on public.live_notification_deliveries(queue_id, status);

alter table public.live_payment_events enable row level security;
alter table public.live_documents_issued enable row level security;
alter table public.live_notification_deliveries enable row level security;

-- Writes remain mediated by omnia-live.
