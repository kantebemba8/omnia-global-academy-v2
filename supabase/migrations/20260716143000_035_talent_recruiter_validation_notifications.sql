-- Talent Omnia — validation recruteurs, invitations Structure, notifications et supervision

create table if not exists public.talent_recruiter_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  recruiter_type text not null default 'independent' check (recruiter_type in ('independent','structure')),
  organization_id uuid,
  company_name text,
  job_title text,
  professional_email text,
  phone text,
  country text,
  linkedin_url text,
  website_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  visibility text not null default 'private' check (visibility in ('public','private')),
  notifications_enabled boolean not null default true,
  rejection_reason text,
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists talent_recruiter_profiles_status_idx on public.talent_recruiter_profiles(status, created_at desc);
create index if not exists talent_recruiter_profiles_org_idx on public.talent_recruiter_profiles(organization_id);

create table if not exists public.talent_recruitment_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null unique,
  email text,
  role_label text not null default 'Recruteur',
  permissions jsonb not null default '{"can_post_job":true,"can_search_talent":true,"can_contact_talent":true,"can_manage_jobs":true,"can_view_applications":true,"can_schedule_interview":true,"can_manage_team":false}'::jsonb,
  max_uses integer not null default 1 check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists talent_recruitment_invites_org_idx on public.talent_recruitment_invites(organization_id, created_at desc);

create table if not exists public.talent_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text,
  action_url text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists talent_notifications_user_idx on public.talent_notifications(user_id, read_at, created_at desc);

alter table public.talent_recruiter_profiles enable row level security;
alter table public.talent_recruitment_invites enable row level security;
alter table public.talent_notifications enable row level security;

do $$
declare t text;
begin
  foreach t in array array['talent_recruiter_profiles','talent_recruitment_invites','talent_notifications'] loop
    execute format('drop policy if exists %I on public.%I', t || '_deny_direct', t);
    execute format('create policy %I on public.%I for all using (false) with check (false)', t || '_deny_direct', t);
  end loop;
end $$;
