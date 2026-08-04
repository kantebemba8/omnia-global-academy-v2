-- 137 — Profil utilisateur unifié multi-rôles
-- Une source commune pour l'identité publique, la confidentialité et les préférences,
-- sans fusionner les données administratives ou sensibles propres aux rôles.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text,
  headline text,
  bio text,
  city text,
  languages text[] not null default '{}'::text[],
  skills text[] not null default '{}'::text[],
  interests text[] not null default '{}'::text[],
  website_url text,
  linkedin_url text,
  portfolio_url text,
  github_url text,
  availability_text text,
  public_email text,
  public_phone text,
  visibility text not null default 'members'
    check (visibility in ('public','members','private')),
  show_email boolean not null default false,
  show_phone boolean not null default false,
  show_location boolean not null default true,
  show_roles boolean not null default true,
  show_achievements boolean not null default true,
  allow_messages boolean not null default true,
  role_details jsonb not null default '{}'::jsonb,
  avatar_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.user_profiles(user_id, display_name)
select u.id, nullif(trim(u.full_name), '')
from public.users u
where u.status is distinct from 'supprime'
on conflict (user_id) do nothing;

-- Réutilise les informations professionnelles déjà autorisées lorsque disponibles.
update public.user_profiles p
set
  headline = coalesce(p.headline, nullif(trim(c.professional_title), '')),
  bio = coalesce(p.bio, nullif(trim(c.bio), '')),
  city = coalesce(p.city, nullif(trim(c.location), '')),
  languages = case when cardinality(p.languages)=0 then coalesce(c.languages, '{}'::text[]) else p.languages end,
  skills = case when cardinality(p.skills)=0 then coalesce(c.skills, '{}'::text[]) else p.skills end,
  linkedin_url = coalesce(p.linkedin_url, nullif(trim(c.linkedin), '')),
  public_email = coalesce(p.public_email, nullif(trim(c.email), '')),
  public_phone = coalesce(p.public_phone, nullif(trim(c.phone), '')),
  visibility = case c.visibility when 'public' then 'public' when 'recruiters' then 'members' else p.visibility end,
  updated_at = now()
from public.career_public_profiles c
where c.user_id = p.user_id;

create index if not exists user_profiles_visibility_idx
  on public.user_profiles(visibility, updated_at desc);
create index if not exists user_profiles_languages_gin
  on public.user_profiles using gin(languages);
create index if not exists user_profiles_skills_gin
  on public.user_profiles using gin(skills);

create or replace function public.omnia_user_profile_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.omnia_user_profile_set_updated_at();

alter table public.user_profiles enable row level security;
revoke all on table public.user_profiles from anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  3145728,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.user_profiles is
  'Profil unifié multi-rôles. Les données sensibles du compte et les permissions administratives restent dans leurs tables dédiées.';
comment on column public.user_profiles.visibility is
  'public: visible sans connexion; members: visible aux membres connectés; private: visible uniquement au titulaire et au Super-admin.';
comment on column public.user_profiles.role_details is
  'Champs professionnels non sensibles validés par l’Edge Function auth-update-profile selon les rôles du titulaire.';
