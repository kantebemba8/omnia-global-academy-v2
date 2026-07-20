-- ============================================================
-- 057 — OMNIA LIVE MODULE A: SUPER ADMIN CONTROL CENTER
-- Global settings, reports, media review and organizer payouts.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_global_settings (
  config_key text primary key,
  config_value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.live_global_settings(config_key, config_value, description, is_public)
values
  ('general', '{
    "live_enabled": true,
    "recorded_video_enabled": true,
    "replay_enabled": true,
    "private_live_enabled": true,
    "structure_live_enabled": true,
    "default_currency": "XOF",
    "default_commission_percent": 20,
    "default_payout_delay_hours": 48
  }'::jsonb, 'Paramètres généraux Omnia Live', false),
  ('limits', '{
    "default_max_participants": 500,
    "max_sessions_per_training": 100,
    "max_speakers_per_event": 50,
    "max_upload_bytes": 10737418240
  }'::jsonb, 'Limites opérationnelles', false),
  ('subscriptions', '{
    "omnia_live_pass_enabled": false,
    "oga_premium_live_enabled": false,
    "structure_packs_enabled": true
  }'::jsonb, 'Activation future des abonnements', false),
  ('moderation', '{
    "review_required_before_publish": true,
    "commercial_terms_required_for_paid": true,
    "media_review_required": true,
    "cancellation_admin_approval_required": true
  }'::jsonb, 'Règles de gouvernance', false)
on conflict (config_key) do nothing;

create table if not exists public.live_content_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  reporter_user_id uuid references public.users(id) on delete set null,
  report_type text not null
    check (report_type in ('content','copyright','fraud','harassment','quality','technical','other')),
  reason text,
  status text not null default 'open'
    check (status in ('open','under_review','resolved','dismissed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  assigned_to uuid references public.users(id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_content_reports_status_idx
  on public.live_content_reports(status, priority, created_at);

create table if not exists public.live_media_reviews (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.live_media(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  version integer not null default 1,
  decision text not null
    check (decision in ('pending','approved','changes_requested','rejected','suspended')),
  reason text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists live_media_reviews_queue_idx
  on public.live_media_reviews(decision, created_at);

create table if not exists public.live_payout_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  organizer_user_id uuid references public.users(id) on delete set null,
  currency text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  status text not null default 'draft'
    check (status in ('draft','approved','processing','paid','failed','cancelled')),
  payment_method text,
  provider_reference text,
  ledger_entry_ids uuid[] not null default '{}',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_payout_batches_status_idx
  on public.live_payout_batches(status, created_at);

create table if not exists public.live_admin_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('event','organizer','structure','media','refund','cancellation','payout')),
  entity_id uuid not null,
  note text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_admin_notes_entity_idx
  on public.live_admin_notes(entity_type, entity_id, created_at desc);

alter table public.live_global_settings enable row level security;
alter table public.live_content_reports enable row level security;
alter table public.live_media_reviews enable row level security;
alter table public.live_payout_batches enable row level security;
alter table public.live_admin_notes enable row level security;
