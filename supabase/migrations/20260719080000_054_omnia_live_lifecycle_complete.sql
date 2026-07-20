-- ============================================================
-- 054 — OMNIA LIVE LIFECYCLE: CANCELLATION, CERTIFICATES,
-- REVIEWS, NOTIFICATIONS, ORGANIZER BALANCES, REPLAY ENTITLEMENTS
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete restrict,
  requested_by uuid not null references public.users(id) on delete restrict,
  request_type text not null default 'cancel'
    check (request_type in ('cancel','reschedule')),
  reason_code text not null,
  reason_details text,
  proposed_new_start_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','rejected','processed')),
  admin_decision_reason text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  processed_at timestamptz,
  penalty_applied boolean not null default false,
  penalty_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_cancellation_requests_status_idx
  on public.live_cancellation_requests(status, created_at);

create table if not exists public.live_certificate_eligibility (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  attendance_seconds integer not null default 0,
  attendance_percent numeric(5,2) not null default 0,
  evaluation_passed boolean,
  eligible boolean not null default false,
  eligibility_reason text,
  document_type text
    check (document_type in ('participation','success','cpd')),
  certificate_id uuid,
  calculated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create index if not exists live_certificate_eligibility_event_idx
  on public.live_certificate_eligibility(event_id, eligible);

create table if not exists public.live_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'published'
    check (status in ('published','hidden','flagged','removed')),
  verified_participant boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create index if not exists live_reviews_event_status_idx
  on public.live_reviews(event_id, status, created_at desc);

create table if not exists public.live_notifications_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  event_id uuid references public.live_events(id) on delete cascade,
  notification_type text not null,
  channel text not null default 'in_app'
    check (channel in ('in_app','email','sms')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','sent','failed','cancelled')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists live_notifications_queue_status_idx
  on public.live_notifications_queue(status, scheduled_at);

create table if not exists public.live_organizer_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete restrict,
  organizer_user_id uuid references public.users(id) on delete set null,
  order_id uuid references public.live_orders(id) on delete set null,
  entry_type text not null
    check (entry_type in ('sale','refund','adjustment','payout','subscription_compensation')),
  gross_amount numeric(14,2) not null default 0,
  oga_amount numeric(14,2) not null default 0,
  organizer_amount numeric(14,2) not null default 0,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending','available','paid','reversed','cancelled')),
  available_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_organizer_ledger_organizer_idx
  on public.live_organizer_ledger(organizer_user_id, status, created_at desc);

create table if not exists public.live_replay_entitlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null
    check (source in ('live_purchase','replay_purchase','free_live','training','structure','subscription','admin')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id, media_id, user_id, source)
);

create index if not exists live_replay_entitlements_user_idx
  on public.live_replay_entitlements(user_id, expires_at);

alter table public.live_cancellation_requests enable row level security;
alter table public.live_certificate_eligibility enable row level security;
alter table public.live_reviews enable row level security;
alter table public.live_notifications_queue enable row level security;
alter table public.live_organizer_ledger enable row level security;
alter table public.live_replay_entitlements enable row level security;

-- Writes remain mediated by the omnia-live Edge Function.
