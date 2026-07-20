-- ============================================================
-- 050 — OMNIA LIVE MEDIA / PLAYBACK / ROOM FOUNDATION
-- ============================================================

create extension if not exists pgcrypto;

-- Extend live_media for Omnia-managed storage and secure playback.
alter table public.live_media
  add column if not exists storage_provider text not null default 'r2',
  add column if not exists storage_key text,
  add column if not exists original_storage_key text,
  add column if not exists streaming_manifest_key text,
  add column if not exists audio_track_key text,
  add column if not exists checksum_sha256 text,
  add column if not exists processing_status text not null default 'pending'
    check (processing_status in ('pending','uploaded','processing','ready','failed','expired')),
  add column if not exists processing_error text,
  add column if not exists watermark_mode text not null default 'dynamic'
    check (watermark_mode in ('none','static','dynamic')),
  add column if not exists download_allowed boolean not null default false,
  add column if not exists is_primary boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists live_media_event_type_status_idx
  on public.live_media(event_id, media_type, status, processing_status);

create unique index if not exists live_media_one_primary_per_type_idx
  on public.live_media(event_id, media_type)
  where is_primary = true and status <> 'deleted';

-- Live room abstraction: keeps Omnia independent from a specific video provider.
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  session_id uuid references public.live_sessions(id) on delete cascade,

  provider text not null default 'unconfigured',
  provider_room_id text,
  provider_metadata jsonb not null default '{}'::jsonb,

  status text not null default 'pending'
    check (status in ('pending','ready','open','live','ended','failed','cancelled')),

  starts_at timestamptz,
  ends_at timestamptz,

  recording_enabled boolean not null default false,
  recording_media_id uuid references public.live_media(id) on delete set null,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(event_id, session_id)
);

create index if not exists live_rooms_status_idx
  on public.live_rooms(status, starts_at);

-- Short-lived playback authorizations and individualized watermark payloads.
create table if not exists public.live_playback_sessions (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.live_media(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,

  session_token_hash text not null unique,
  watermark_payload text,
  device_fingerprint text,
  ip_hash text,

  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists live_playback_sessions_user_idx
  on public.live_playback_sessions(user_id, expires_at desc);

create index if not exists live_playback_sessions_media_idx
  on public.live_playback_sessions(media_id, expires_at desc);

-- Track viewing progress without writing every second.
create table if not exists public.live_media_progress (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.live_media(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,

  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completion_percent numeric(5,2) not null default 0
    check (completion_percent >= 0 and completion_percent <= 100),

  first_started_at timestamptz,
  last_seen_at timestamptz,
  completed_at timestamptz,

  unique(media_id, user_id)
);

alter table public.live_rooms enable row level security;
alter table public.live_playback_sessions enable row level security;
alter table public.live_media_progress enable row level security;

-- No direct public write policies: access goes through secured Edge Functions.
