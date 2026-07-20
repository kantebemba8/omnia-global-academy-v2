-- ============================================================
-- 048 — OMNIA LIVE STUDIO & REVIEW WORKFLOW
-- Omnia Global Academy
-- Extends migration 047 without destructive changes.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. EXTEND LIVE EVENTS FOR THE 7-STEP STUDIO
-- ------------------------------------------------------------
alter table public.live_events
  add column if not exists organizer_message_to_admin text,
  add column if not exists private_access_config jsonb not null default '{}'::jsonb,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists allow_late_registration boolean not null default false,
  add column if not exists waiting_room_minutes integer not null default 30
    check (waiting_room_minutes in (0, 15, 30, 45, 60)),
  add column if not exists cover_ai_prompt text,
  add column if not exists cover_template_key text,
  add column if not exists interaction_settings jsonb not null default '{
    "chat": true,
    "qa": true,
    "raise_hand": true,
    "polls": true,
    "participant_camera": false,
    "participant_microphone": "on_request",
    "audio_only": true
  }'::jsonb,
  add column if not exists certificate_requested boolean not null default false,
  add column if not exists cpd_requested boolean not null default false,
  add column if not exists certificate_request_config jsonb not null default '{}'::jsonb,
  add column if not exists admin_review_message text,
  add column if not exists last_reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists last_reviewed_at timestamptz;

-- ------------------------------------------------------------
-- 2. CONFIGURABLE LIVE CATEGORIES
-- ------------------------------------------------------------
create table if not exists public.live_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_categories_active_order_idx
  on public.live_categories(is_active, display_order, name);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_events_category_id_fkey'
      and conrelid = 'public.live_events'::regclass
  ) then
    alter table public.live_events
      add constraint live_events_category_id_fkey
      foreign key (category_id)
      references public.live_categories(id)
      on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. SPEAKERS / CO-ORGANIZERS / LIVE MODERATORS
-- These are session-specific responsibilities, not global OGA roles.
-- ------------------------------------------------------------
create table if not exists public.live_event_speakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,

  user_id uuid references public.users(id) on delete set null,
  external_name text,
  external_email text,
  title text,
  organization text,
  bio text,
  photo_url text,

  role text not null default 'speaker'
    check (role in ('organizer','co_organizer','speaker','moderator','trainer')),

  permissions jsonb not null default '{}'::jsonb,
  invitation_status text not null default 'not_required'
    check (invitation_status in ('not_required','pending','accepted','declined','expired')),

  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (user_id is not null or nullif(trim(external_name), '') is not null)
);

create index if not exists live_event_speakers_event_idx
  on public.live_event_speakers(event_id, display_order);

create index if not exists live_event_speakers_user_idx
  on public.live_event_speakers(user_id)
  where user_id is not null;

-- ------------------------------------------------------------
-- 4. REVIEW HISTORY
-- Keeps an immutable audit trail of submit/review/changes/rejection.
-- ------------------------------------------------------------
create table if not exists public.live_review_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,

  action text not null
    check (action in (
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'rejected',
      'suspended',
      'published',
      'terms_set',
      'terms_accepted'
    )),

  from_status text,
  to_status text,
  message text,
  snapshot jsonb,

  actor_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_review_history_event_idx
  on public.live_review_history(event_id, created_at desc);

-- ------------------------------------------------------------
-- 5. DOCUMENT / RESOURCE METADATA
-- Binary files remain in Omnia-managed private storage.
-- ------------------------------------------------------------
alter table public.live_media
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists mime_type text,
  add column if not exists file_name text,
  add column if not exists size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  add column if not exists availability_scope text not null default 'registered'
    check (availability_scope in (
      'public',
      'registered',
      'participants',
      'before_live',
      'during_live',
      'after_live',
      'training_members'
    ));

-- ------------------------------------------------------------
-- 6. BASIC VALIDATION INDEXES
-- ------------------------------------------------------------
create index if not exists live_events_review_idx
  on public.live_events(status, submitted_at desc);

create index if not exists live_events_category_status_idx
  on public.live_events(category_id, status);

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- Service-role Edge Functions remain authoritative for writes.
-- Public users may only read active categories.
-- ------------------------------------------------------------
alter table public.live_categories enable row level security;
alter table public.live_event_speakers enable row level security;
alter table public.live_review_history enable row level security;

drop policy if exists "Public can read active live categories"
  on public.live_categories;

create policy "Public can read active live categories"
  on public.live_categories
  for select
  using (is_active = true);

-- No direct public write policies are created for:
-- live_categories, live_event_speakers, live_review_history.
-- Writes go through secured Omnia Edge Functions using service role.

-- ------------------------------------------------------------
-- 8. OPTIONAL INITIAL CATEGORY CATALOG
-- Uses ON CONFLICT so it is safe to re-run.
-- These are configuration values, not fake marketplace content.
-- ------------------------------------------------------------
insert into public.live_categories (name, slug, display_order)
values
  ('Cybersécurité', 'cybersecurite', 10),
  ('Intelligence artificielle', 'intelligence-artificielle', 20),
  ('Comptabilité & Finance', 'comptabilite-finance', 30),
  ('Management', 'management', 40),
  ('QHSE', 'qhse', 50),
  ('Entrepreneuriat', 'entrepreneuriat', 60),
  ('Développement professionnel', 'developpement-professionnel', 70),
  ('Métiers du numérique', 'metiers-du-numerique', 80)
on conflict (slug) do nothing;
