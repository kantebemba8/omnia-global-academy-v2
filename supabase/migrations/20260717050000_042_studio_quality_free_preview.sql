-- Étape 4A — Contrôle qualité, aperçu gratuit et versionnage initial
alter table if exists public.courses
  add column if not exists free_preview_mode text not null default 'introduction',
  add column if not exists quality_status text not null default 'incomplete',
  add column if not exists quality_report jsonb not null default '{"valid":false,"errors":[],"warnings":[]}'::jsonb,
  add column if not exists quality_checked_at timestamptz,
  add column if not exists ready_to_submit boolean not null default false,
  add column if not exists current_version text not null default '1.0';

alter table if exists public.courses
  drop constraint if exists courses_free_preview_mode_check;
alter table if exists public.courses
  add constraint courses_free_preview_mode_check
  check (free_preview_mode in ('none','introduction'));

create table if not exists public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  version_label text not null,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(course_id, version_label)
);

create index if not exists idx_course_versions_course on public.course_versions(course_id, created_at desc);

alter table public.course_versions enable row level security;

drop policy if exists "course_versions_read_owners_admin" on public.course_versions;
create policy "course_versions_read_owners_admin" on public.course_versions
for select using (
  exists (
    select 1 from public.courses c
    where c.id = course_versions.course_id
      and (
        c.creator_id = auth.uid()
        or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'super_admin')
      )
  )
);
