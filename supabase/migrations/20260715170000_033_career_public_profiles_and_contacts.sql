create table if not exists public.career_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  professional_title text,
  email text,
  phone text,
  location text,
  linkedin text,
  bio text,
  skills text[] not null default '{}',
  sectors text[] not null default '{}',
  languages text[] not null default '{}',
  certifications text[] not null default '{}',
  photo_url text,
  visibility text not null default 'private' check (visibility in ('public','recruiters','private')),
  documents_visibility text not null default 'private' check (documents_visibility in ('public','recruiters','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_recruiter_contacts (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  recruiter_name text,
  recruiter_email text,
  company_name text,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewed','forwarded','closed')),
  created_at timestamptz not null default now()
);

alter table public.career_public_profiles enable row level security;
alter table public.career_recruiter_contacts enable row level security;

drop policy if exists "public profiles readable" on public.career_public_profiles;
create policy "public profiles readable" on public.career_public_profiles for select using (visibility = 'public');
drop policy if exists "users manage own career profile" on public.career_public_profiles;
create policy "users manage own career profile" on public.career_public_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admins read recruiter contacts" on public.career_recruiter_contacts;
create policy "admins read recruiter contacts" on public.career_recruiter_contacts for select using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('super_admin','admin'))
);

create index if not exists career_public_profiles_visibility_idx on public.career_public_profiles(visibility);
create index if not exists career_recruiter_contacts_status_idx on public.career_recruiter_contacts(status, created_at desc);
