-- ============================================================
-- 051 — OMNIA LIVE VIDEO PROCESSING JOBS
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.live_media(id) on delete cascade,
  event_id uuid not null references public.live_events(id) on delete cascade,

  job_type text not null
    check (job_type in ('video_transcode','replay_transcode','audio_extract','subtitle_prepare')),

  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed','cancelled')),

  provider text not null default 'internal',
  provider_job_id text,
  progress_percent numeric(5,2) not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),

  input_key text,
  output_manifest_key text,
  output_audio_key text,

  error_message text,
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_media_processing_jobs_status_idx
  on public.live_media_processing_jobs(status, created_at);

create index if not exists live_media_processing_jobs_media_idx
  on public.live_media_processing_jobs(media_id, created_at desc);

alter table public.live_media_processing_jobs enable row level security;

-- No direct public policies. Jobs are controlled by secured Edge Functions.
