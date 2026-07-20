-- ============================================================
-- 052 — OMNIA LIVE ROOM / ATTENDANCE / WAITING ROOM
-- Complete integrated live-room workflow foundation.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  session_id uuid references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,

  room_role text not null default 'attendee'
    check (room_role in ('host','co_host','speaker','moderator','attendee','admin_supervisor')),

  access_status text not null default 'waiting'
    check (access_status in ('waiting','admitted','left','removed','blocked')),

  joined_at timestamptz,
  last_seen_at timestamptz,
  left_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references public.users(id) on delete set null,

  provider_participant_id text,
  provider_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(room_id, user_id)
);

create index if not exists live_room_members_room_status_idx
  on public.live_room_members(room_id, access_status);

create index if not exists live_room_members_user_idx
  on public.live_room_members(user_id, created_at desc);

create table if not exists public.live_attendance_segments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  session_id uuid references public.live_sessions(id) on delete cascade,
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,

  joined_at timestamptz not null,
  left_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),

  source text not null default 'live_room'
    check (source in ('live_room','manual_adjustment','import')),

  created_at timestamptz not null default now()
);

create index if not exists live_attendance_segments_event_user_idx
  on public.live_attendance_segments(event_id, user_id, joined_at);

create table if not exists public.live_room_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,

  action text not null
    check (action in (
      'room_opened',
      'room_started',
      'room_ended',
      'participant_admitted',
      'participant_removed',
      'participant_blocked',
      'microphone_disabled',
      'camera_disabled',
      'recording_started',
      'recording_stopped',
      'admin_supervision_entered'
    )),

  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists live_room_actions_room_idx
  on public.live_room_actions(room_id, created_at desc);

-- Provider-neutral access fields.
alter table public.live_rooms
  add column if not exists room_slug text,
  add column if not exists join_secret_hash text,
  add column if not exists waiting_room_enabled boolean not null default true,
  add column if not exists max_participants integer,
  add column if not exists provider_join_url text,
  add column if not exists provider_host_url text,
  add column if not exists last_error text;

create unique index if not exists live_rooms_room_slug_uidx
  on public.live_rooms(room_slug)
  where room_slug is not null;

alter table public.live_room_members enable row level security;
alter table public.live_attendance_segments enable row level security;
alter table public.live_room_actions enable row level security;

-- No public write policies. Access is mediated by the secured omnia-live Edge Function.
