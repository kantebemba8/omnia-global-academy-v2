-- Talent Omnia — synchronisation recrutement, favoris, contacts, entretiens et messages

create table if not exists public.talent_favorites (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid,
  talent_user_id uuid not null,
  created_at timestamptz not null default now()
);
create unique index if not exists talent_favorites_recruiter_unique
  on public.talent_favorites(actor_user_id, talent_user_id) where organization_id is null;
create unique index if not exists talent_favorites_structure_unique
  on public.talent_favorites(organization_id, talent_user_id) where organization_id is not null;
create index if not exists talent_favorites_actor_idx on public.talent_favorites(actor_user_id, created_at desc);
create index if not exists talent_favorites_org_idx on public.talent_favorites(organization_id, created_at desc);

create table if not exists public.talent_contacts (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid,
  talent_user_id uuid not null,
  subject text,
  message text not null,
  status text not null default 'sent' check (status in ('draft','sent','read','replied','closed')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  replied_at timestamptz
);
create index if not exists talent_contacts_actor_idx on public.talent_contacts(actor_user_id, created_at desc);
create index if not exists talent_contacts_talent_idx on public.talent_contacts(talent_user_id, created_at desc);
create index if not exists talent_contacts_org_idx on public.talent_contacts(organization_id, created_at desc);

create table if not exists public.talent_interviews (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.users(id) on delete cascade,
  organization_id uuid,
  talent_user_id uuid not null,
  job_id uuid,
  title text not null default 'Entretien de recrutement',
  interview_mode text not null default 'video' check (interview_mode in ('video','audio','phone','in_person')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 240),
  meeting_url text,
  location text,
  notes text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists talent_interviews_requester_idx on public.talent_interviews(requested_by, scheduled_at desc);
create index if not exists talent_interviews_talent_idx on public.talent_interviews(talent_user_id, scheduled_at desc);
create index if not exists talent_interviews_org_idx on public.talent_interviews(organization_id, scheduled_at desc);

create table if not exists public.talent_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete cascade,
  organization_id uuid,
  talent_user_id uuid not null,
  subject text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists talent_conversations_recruiter_unique
  on public.talent_conversations(created_by, talent_user_id) where organization_id is null and closed_at is null;
create unique index if not exists talent_conversations_structure_unique
  on public.talent_conversations(organization_id, talent_user_id) where organization_id is not null and closed_at is null;

create table if not exists public.talent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.talent_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  recipient_user_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists talent_messages_conversation_idx on public.talent_messages(conversation_id, created_at asc);
create index if not exists talent_messages_recipient_idx on public.talent_messages(recipient_user_id, read_at, created_at desc);

create table if not exists public.talent_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  organization_id uuid,
  talent_user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists talent_activity_actor_idx on public.talent_activity_log(actor_user_id, created_at desc);
create index if not exists talent_activity_org_idx on public.talent_activity_log(organization_id, created_at desc);
create index if not exists talent_activity_talent_idx on public.talent_activity_log(talent_user_id, created_at desc);

create table if not exists public.talent_structure_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  can_post_job boolean not null default false,
  can_search_talent boolean not null default true,
  can_contact_talent boolean not null default false,
  can_manage_jobs boolean not null default false,
  can_view_applications boolean not null default false,
  can_schedule_interview boolean not null default false,
  can_manage_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, user_id)
);
create index if not exists talent_structure_permissions_org_idx on public.talent_structure_permissions(organization_id);

-- Les accès passent par l'Edge Function, compatible avec le système de sessions Omnia.
alter table public.talent_favorites enable row level security;
alter table public.talent_contacts enable row level security;
alter table public.talent_interviews enable row level security;
alter table public.talent_conversations enable row level security;
alter table public.talent_messages enable row level security;
alter table public.talent_activity_log enable row level security;
alter table public.talent_structure_permissions enable row level security;

-- Refuser l'accès direct client : la Service Role de l'Edge Function contourne les RLS.
do $$
declare t text;
begin
  foreach t in array array['talent_favorites','talent_contacts','talent_interviews','talent_conversations','talent_messages','talent_activity_log','talent_structure_permissions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_deny_direct', t);
    execute format('create policy %I on public.%I for all using (false) with check (false)', t || '_deny_direct', t);
  end loop;
end $$;
