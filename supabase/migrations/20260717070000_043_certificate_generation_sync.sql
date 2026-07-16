-- Étape 4B — génération automatique et synchronisation des certificats
create extension if not exists pgcrypto;

alter table public.certificates add column if not exists validity_status text not null default 'valid';
alter table public.certificates add column if not exists expires_at timestamptz;
alter table public.certificates add column if not exists verification_url text;
alter table public.certificates add column if not exists qr_svg text;
alter table public.certificates add column if not exists duration_minutes integer not null default 0;
alter table public.certificates add column if not exists course_version text not null default '1.0';
alter table public.certificates add column if not exists issuer_type text not null default 'omnia';
alter table public.certificates add column if not exists issuer_name text not null default 'Omnia Global Academy';
alter table public.certificates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.certificates add column if not exists updated_at timestamptz not null default now();

update public.certificates set validity_status = case when status in ('revoque','revoked') then 'revoked' else 'valid' end where validity_status is null or validity_status='';

create table if not exists public.user_profile_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  issuer text not null default 'Omnia Global Academy',
  credential_id text not null,
  verification_url text,
  issued_at timestamptz not null,
  expires_at timestamptz,
  hours_or_credits jsonb not null default '[]'::jsonb,
  status text not null default 'valid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, certificate_id)
);
create index if not exists ix_user_profile_certifications_user on public.user_profile_certifications(user_id,issued_at desc);

create table if not exists public.certificate_generation_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_id uuid references public.certificates(id) on delete set null,
  result text not null,
  missing_conditions jsonb not null default '[]'::jsonb,
  source text not null default 'automatic',
  created_at timestamptz not null default now()
);

alter table public.user_profile_certifications enable row level security;
alter table public.certificate_generation_audit enable row level security;
drop policy if exists user_profile_certifications_own_read on public.user_profile_certifications;
create policy user_profile_certifications_own_read on public.user_profile_certifications for select to authenticated using (user_id=auth.uid());

create or replace function public.sync_certificate_to_career_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare labels text[]; label text;
begin
  label := new.course_title;
  select certifications into labels from public.career_public_profiles where user_id=new.user_id;
  if found and not (coalesce(labels,'{}'::text[]) @> array[label]) then
    update public.career_public_profiles set certifications=array_append(coalesce(certifications,'{}'::text[]),label),updated_at=now() where user_id=new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_certificate_to_career on public.certificates;
create trigger trg_sync_certificate_to_career after insert on public.certificates for each row execute function public.sync_certificate_to_career_profile();
