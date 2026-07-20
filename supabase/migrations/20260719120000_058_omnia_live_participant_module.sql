-- ============================================================
-- 058 — OMNIA LIVE MODULE C: PARTICIPANT EXPERIENCE
-- Notification state and participant library helpers.
-- ============================================================

alter table public.live_notifications_queue
  add column if not exists read_at timestamptz,
  add column if not exists dismissed_at timestamptz;

create index if not exists live_notifications_user_status_idx
  on public.live_notifications_queue(user_id, status, scheduled_at desc);

create table if not exists public.live_participant_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id,event_id)
);

create index if not exists live_participant_favorites_user_idx
  on public.live_participant_favorites(user_id, created_at desc);

alter table public.live_participant_favorites enable row level security;
