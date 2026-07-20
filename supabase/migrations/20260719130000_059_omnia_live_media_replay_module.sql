-- ============================================================
-- 059 — OMNIA LIVE MODULE D: MEDIA / VIDEO / REPLAY COMPLETE
-- Versioning, processing profiles, replay jobs, retention,
-- secure playback audit and media re-validation.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.live_media
  add column if not exists parent_media_id uuid references public.live_media(id) on delete set null,
  add column if not exists revision_number integer not null default 1,
  add column if not exists review_required boolean not null default true,
  add column if not exists approved_version integer,
  add column if not exists source_kind text
    check (source_kind in ('upload','recording','generated_replay','external_import')),
  add column if not exists retention_policy text not null default 'standard'
    check (retention_policy in ('temporary','standard','training','institutional','permanent')),
  add column if not exists retention_until timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists live_media_parent_revision_idx
  on public.live_media(parent_media_id, revision_number desc);

create table if not exists public.live_media_stream_profiles (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.live_media(id) on delete cascade,
  profile_key text not null,
  label text not null,
  width integer,
  height integer,
  video_bitrate_kbps integer,
  audio_bitrate_kbps integer,
  manifest_key text,
  file_key text,
  status text not null default 'pending'
    check (status in ('pending','processing','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(media_id, profile_key)
);

create index if not exists live_media_stream_profiles_media_idx
  on public.live_media_stream_profiles(media_id,status);

create table if not exists public.live_replay_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  room_id uuid references public.live_rooms(id) on delete set null,
  session_id uuid references public.live_sessions(id) on delete set null,
  source_recording_key text,
  media_id uuid references public.live_media(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','recording_wait','processing','ready','failed','cancelled')),
  provider text not null default 'internal',
  provider_job_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists live_replay_jobs_event_idx
  on public.live_replay_jobs(event_id,status,created_at desc);

create table if not exists public.live_playback_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  media_id uuid not null references public.live_media(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  playback_session_id uuid references public.live_playback_sessions(id) on delete set null,
  action text not null
    check (action in ('authorized','started','heartbeat','completed','denied','revoked')),
  watermark_payload text,
  ip_hash text,
  device_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_playback_audit_media_idx
  on public.live_playback_audit(media_id,created_at desc);

create table if not exists public.live_media_retention_jobs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.live_media(id) on delete cascade,
  action text not null
    check (action in ('archive','delete_original','delete_all')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','processing','completed','failed','cancelled')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists live_media_retention_jobs_status_idx
  on public.live_media_retention_jobs(status,scheduled_at);

alter table public.live_media_stream_profiles enable row level security;
alter table public.live_replay_jobs enable row level security;
alter table public.live_playback_audit enable row level security;
alter table public.live_media_retention_jobs enable row level security;
