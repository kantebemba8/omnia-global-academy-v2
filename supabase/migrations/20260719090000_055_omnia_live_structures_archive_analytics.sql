-- ============================================================
-- 055 — OMNIA LIVE STRUCTURES / PRIVATE ACCESS / PACKS /
-- ORGANIZER PROFILES / ARCHIVE / ANALYTICS
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_private_access_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  code text not null unique,
  access_type text not null
    check (access_type in ('private','structure','invitation')),
  structure_id uuid,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active','disabled','expired')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_private_access_codes_event_idx
  on public.live_private_access_codes(event_id,status);

create table if not exists public.live_private_access_grants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  access_code_id uuid references public.live_private_access_codes(id) on delete set null,
  source text not null
    check (source in ('code','structure','invitation','admin','pack')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique(event_id,user_id,source)
);

create table if not exists public.live_structure_packs (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid,
  pack_name text not null,
  status text not null default 'active'
    check (status in ('draft','active','suspended','expired','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_members integer,
  max_live_events integer,
  max_participants_per_event integer,
  storage_gb numeric(10,2),
  archive_enabled boolean not null default false,
  certificates_enabled boolean not null default false,
  reports_enabled boolean not null default false,
  support_level text,
  features jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_structure_packs_structure_idx
  on public.live_structure_packs(structure_id,status);

create table if not exists public.live_institutional_archive (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete restrict,
  structure_id uuid,
  media_id uuid references public.live_media(id) on delete set null,
  archive_type text not null
    check (archive_type in ('recording','document','report','attendance','certificate_export')),
  retention_until timestamptz,
  permanent boolean not null default false,
  status text not null default 'active'
    check (status in ('active','expired','deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_institutional_archive_event_idx
  on public.live_institutional_archive(event_id,status);

create table if not exists public.live_organizer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  structure_id uuid,
  display_name text not null,
  bio text,
  country text,
  website text,
  logo_url text,
  verified boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected','suspended')),
  public_rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  completed_events integer not null default 0,
  cancellation_count integer not null default 0,
  refund_count integer not null default 0,
  internal_score numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists live_organizer_profiles_user_uidx
  on public.live_organizer_profiles(user_id)
  where user_id is not null;

create table if not exists public.live_event_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  metric_date date not null,
  page_views integer not null default 0,
  registrations integer not null default 0,
  paid_orders integer not null default 0,
  gross_revenue numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  live_attendees integer not null default 0,
  replay_viewers integer not null default 0,
  average_watch_seconds numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,metric_date)
);

alter table public.live_private_access_codes enable row level security;
alter table public.live_private_access_grants enable row level security;
alter table public.live_structure_packs enable row level security;
alter table public.live_institutional_archive enable row level security;
alter table public.live_organizer_profiles enable row level security;
alter table public.live_event_analytics_daily enable row level security;
