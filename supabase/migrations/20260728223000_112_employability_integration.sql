-- Programme 2 GM5 — Employabilité intégrée
create table if not exists public.employability_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  talent_visibility text not null default 'private' check (talent_visibility in ('private','recruiters','public')),
  use_project_evidence boolean not null default false,
  use_skills_passport boolean not null default false,
  use_learning_record boolean not null default false,
  use_career_documents boolean not null default false,
  allow_opportunity_matching boolean not null default false,
  allow_recruiter_contact boolean not null default false,
  target_roles text[] not null default '{}',
  target_sectors text[] not null default '{}',
  target_countries text[] not null default '{}',
  contract_preferences text[] not null default '{}',
  excluded_organizations uuid[] not null default '{}',
  consent_version text not null default '1.0',
  consented_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employability_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.job_offers(id) on delete cascade,
  match_score numeric(5,2) not null default 0 check (match_score between 0 and 100),
  matched_skills text[] not null default '{}',
  missing_skills text[] not null default '{}',
  explanation text,
  status text not null default 'suggested' check (status in ('suggested','viewed','saved','dismissed','applied','expired')),
  generated_at timestamptz not null default now(),
  viewed_at timestamptz,
  dismissed_at timestamptz,
  unique(user_id, job_id)
);

create table if not exists public.employability_recruiter_access_log (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references auth.users(id) on delete cascade,
  talent_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  action text not null check (action in ('search_result','profile_view','portfolio_view','passport_view','contact_request')),
  purpose text,
  job_id uuid references public.job_offers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.employability_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employability_profiles_visibility_idx on public.employability_profiles(status,talent_visibility);
create index if not exists employability_matches_user_idx on public.employability_opportunity_matches(user_id,status,match_score desc);
create index if not exists employability_access_talent_idx on public.employability_recruiter_access_log(talent_user_id,created_at desc);

alter table public.employability_profiles enable row level security;
alter table public.employability_opportunity_matches enable row level security;
alter table public.employability_recruiter_access_log enable row level security;
alter table public.employability_audit_log enable row level security;

drop policy if exists "users manage own employability profile" on public.employability_profiles;
create policy "users manage own employability profile" on public.employability_profiles for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users read own opportunity matches" on public.employability_opportunity_matches;
create policy "users read own opportunity matches" on public.employability_opportunity_matches for select to authenticated using (auth.uid()=user_id);
drop policy if exists "users update own opportunity matches" on public.employability_opportunity_matches;
create policy "users update own opportunity matches" on public.employability_opportunity_matches for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.set_employability_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_employability_profiles_updated_at on public.employability_profiles;
create trigger trg_employability_profiles_updated_at before update on public.employability_profiles for each row execute function public.set_employability_updated_at();
