-- ============================================================
-- 064 — OMNIA LIVE MODULE I
-- ANALYTICS / REPORTING / PILOTAGE AVANCE
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  organizer_user_id uuid references public.users(id) on delete set null,
  snapshot_type text not null check (snapshot_type in (
    'event_daily','event_final','organizer_daily','platform_daily','structure_daily'
  )),
  snapshot_date date not null default current_date,
  currency text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(event_id,organizer_user_id,snapshot_type,snapshot_date)
);

create index if not exists live_analytics_snapshots_lookup_idx
  on public.live_analytics_snapshots(snapshot_type,snapshot_date desc,event_id,organizer_user_id);

create table if not exists public.live_report_definitions (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  name text not null,
  audience text not null check (audience in ('super_admin','organizer','structure')),
  report_type text not null check (report_type in (
    'event_performance','attendance','financial','replay','video','engagement',
    'participant','structure','compliance','custom'
  )),
  columns jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_report_exports (
  id uuid primary key default gen_random_uuid(),
  report_definition_id uuid references public.live_report_definitions(id) on delete set null,
  requested_by uuid references public.users(id) on delete set null,
  event_id uuid references public.live_events(id) on delete cascade,
  organizer_user_id uuid references public.users(id) on delete set null,
  structure_id uuid,
  format text not null check (format in ('csv','xlsx','pdf')),
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','ready','failed','expired')),
  storage_key text,
  file_name text,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists live_report_exports_status_idx
  on public.live_report_exports(status,created_at desc);

create table if not exists public.live_event_kpis (
  event_id uuid primary key references public.live_events(id) on delete cascade,

  registrations_total integer not null default 0,
  registrations_confirmed integer not null default 0,
  waitlist_total integer not null default 0,

  attendance_unique integer not null default 0,
  attendance_rate numeric(7,2) not null default 0,
  average_attendance_seconds numeric(14,2) not null default 0,

  chat_messages integer not null default 0,
  questions_total integer not null default 0,
  questions_answered integer not null default 0,
  poll_votes integer not null default 0,

  live_revenue numeric(14,2) not null default 0,
  replay_revenue numeric(14,2) not null default 0,
  video_revenue numeric(14,2) not null default 0,
  refunds_total numeric(14,2) not null default 0,
  organizer_revenue numeric(14,2) not null default 0,
  oga_revenue numeric(14,2) not null default 0,

  replay_views integer not null default 0,
  replay_unique_viewers integer not null default 0,
  replay_average_watch_seconds numeric(14,2) not null default 0,

  certificates_issued integer not null default 0,
  certificates_revoked integer not null default 0,

  average_rating numeric(5,2) not null default 0,
  ratings_count integer not null default 0,

  conversion_rate numeric(7,2) not null default 0,
  completion_rate numeric(7,2) not null default 0,

  updated_at timestamptz not null default now()
);

create table if not exists public.live_structure_reports (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  generated_by uuid references public.users(id) on delete set null,
  pdf_storage_key text,
  xlsx_storage_key text,
  created_at timestamptz not null default now()
);

create index if not exists live_structure_reports_period_idx
  on public.live_structure_reports(structure_id,period_end desc);

create table if not exists public.live_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  media_id uuid references public.live_media(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  event_value numeric(14,4),
  dimensions jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists live_analytics_events_event_idx
  on public.live_analytics_events(event_id,event_name,occurred_at desc);

insert into public.live_report_definitions
(report_key,name,audience,report_type,columns,filters,status)
values
('event_performance_standard','Performance événement','organizer','event_performance',
 '["registrations","attendance_rate","revenue","engagement","rating","replay_views"]'::jsonb,
 '{}'::jsonb,'active'),
('attendance_standard','Rapport de présence','organizer','attendance',
 '["participant","email","sessions_attended","attendance_seconds","attendance_percent"]'::jsonb,
 '{}'::jsonb,'active'),
('financial_platform','Rapport financier Omnia Live','super_admin','financial',
 '["gross_revenue","refunds","oga_revenue","organizer_revenue","payouts"]'::jsonb,
 '{}'::jsonb,'active'),
('structure_activity','Rapport Structure Omnia Live','structure','structure',
 '["members","events","registrations","attendance","documents","revenue"]'::jsonb,
 '{}'::jsonb,'active')
on conflict (report_key) do nothing;

alter table public.live_analytics_snapshots enable row level security;
alter table public.live_report_definitions enable row level security;
alter table public.live_report_exports enable row level security;
alter table public.live_event_kpis enable row level security;
alter table public.live_structure_reports enable row level security;
alter table public.live_analytics_events enable row level security;
