-- Programme 3 / GM5 — Accès résilient sécurisé et économie de données.
-- Aucun téléchargement libre de formation ou de vidéo n'est autorisé.

create table if not exists public.course_resilient_access_settings (
  course_id uuid primary key references public.courses(id) on delete cascade,
  enabled boolean not null default true,
  max_offline_days integer not null default 7 check (max_offline_days between 1 and 30),
  max_devices integer not null default 2 check (max_devices between 1 and 5),
  allow_text_cache boolean not null default true,
  allow_transcript_cache boolean not null default true,
  allow_audio_stream boolean not null default true,
  allow_low_resolution boolean not null default true,
  allow_video_cache boolean not null default false check (allow_video_cache = false),
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_resilient_access_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  device_id text not null,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  authorized_at timestamptz not null default now(),
  last_validated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,course_id,device_id)
);

create table if not exists public.resilient_access_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.course_lessons(id) on delete set null,
  device_id text not null,
  event_type text not null check (event_type in ('authorized','progress_sync','rights_check','revoked','expired')),
  seconds_reported integer not null default 0,
  seconds_accepted integer not null default 0,
  accepted boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_resilient_devices_user_course on public.user_resilient_access_devices(user_id,course_id,status,expires_at desc);
create index if not exists idx_resilient_sync_user_course on public.resilient_access_sync_logs(user_id,course_id,created_at desc);

alter table public.course_resilient_access_settings enable row level security;
alter table public.user_resilient_access_devices enable row level security;
alter table public.resilient_access_sync_logs enable row level security;

-- L'accès applicatif passe exclusivement par les Edge Functions avec la clé service_role.
revoke all on public.course_resilient_access_settings from anon, authenticated;
revoke all on public.user_resilient_access_devices from anon, authenticated;
revoke all on public.resilient_access_sync_logs from anon, authenticated;

insert into public.course_resilient_access_settings(course_id)
select id from public.courses where is_published = true
on conflict (course_id) do nothing;

create or replace function public.expire_resilient_access_rights()
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.user_resilient_access_devices
     set status='expired', updated_at=now()
   where status='active' and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end $$;

comment on table public.course_resilient_access_settings is 'Règles de l’accès résilient. Les vidéos ne sont jamais mises en cache librement.';
comment on table public.user_resilient_access_devices is 'Autorisations temporaires par utilisateur, formation et appareil.';
comment on table public.resilient_access_sync_logs is 'Journal des autorisations et synchronisations hors connexion.';
