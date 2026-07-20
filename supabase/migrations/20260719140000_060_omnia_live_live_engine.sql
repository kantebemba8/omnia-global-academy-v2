-- ============================================================
-- 060 — OMNIA LIVE MODULE E: LIVE ENGINE COMPLETE
-- Chat, Q&A, polls, moderation state, recording lifecycle,
-- session engine and automatic replay handoff.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  message text not null,
  message_type text not null default 'chat'
    check (message_type in ('chat','system','announcement')),
  status text not null default 'visible'
    check (status in ('visible','hidden','deleted')),
  moderated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_chat_messages_room_idx
  on public.live_chat_messages(room_id, created_at);

create table if not exists public.live_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  question text not null,
  status text not null default 'open'
    check (status in ('open','answered','dismissed','hidden')),
  upvotes integer not null default 0,
  answer_text text,
  answered_by uuid references public.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists live_questions_room_status_idx
  on public.live_questions(room_id,status,created_at);

create table if not exists public.live_question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.live_questions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(question_id,user_id)
);

create table if not exists public.live_polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','open','closed')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists live_polls_room_status_idx
  on public.live_polls(room_id,status,created_at);

create table if not exists public.live_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.live_polls(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  unique(poll_id,user_id)
);

create table if not exists public.live_room_controls (
  room_id uuid primary key references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  chat_enabled boolean not null default true,
  qa_enabled boolean not null default true,
  polls_enabled boolean not null default true,
  participant_mic_mode text not null default 'on_request'
    check (participant_mic_mode in ('disabled','on_request','enabled')),
  participant_camera_enabled boolean not null default false,
  screen_share_enabled boolean not null default true,
  recording_status text not null default 'stopped'
    check (recording_status in ('stopped','starting','recording','stopping','failed')),
  recording_provider_id text,
  recording_started_at timestamptz,
  recording_stopped_at timestamptz,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_recordings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  session_id uuid references public.live_sessions(id) on delete set null,
  provider text not null,
  provider_recording_id text,
  storage_key text,
  status text not null default 'starting'
    check (status in ('starting','recording','processing','ready','failed','cancelled')),
  started_at timestamptz,
  stopped_at timestamptz,
  duration_seconds integer,
  replay_job_id uuid references public.live_replay_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_recordings_event_idx
  on public.live_recordings(event_id,status,created_at desc);

alter table public.live_chat_messages enable row level security;
alter table public.live_questions enable row level security;
alter table public.live_question_votes enable row level security;
alter table public.live_polls enable row level security;
alter table public.live_poll_votes enable row level security;
alter table public.live_room_controls enable row level security;
alter table public.live_recordings enable row level security;
