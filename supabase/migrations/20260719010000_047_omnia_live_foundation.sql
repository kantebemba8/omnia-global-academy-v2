-- ============================================================
-- 047 — OMNIA LIVE FOUNDATION
-- Omnia Global Academy
-- Non-destructive foundation for Lives, synchronous training,
-- recorded videos, registrations, commercial terms and media.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. ROOT PRODUCT / EVENT
-- delivery_type:
--   single_live | synchronous_training | recorded_video
-- event_type:
--   class_live | masterclass | workshop | webinar |
--   conference | event
-- ------------------------------------------------------------
create table if not exists public.live_events (
  id uuid primary key default gen_random_uuid(),

  owner_user_id uuid references public.users(id) on delete set null,
  owner_structure_id uuid null,

  organizer_display_name text,
  organizer_kind text not null default 'user'
    check (organizer_kind in ('user','structure','omnia')),

  title text not null,
  slug text unique,
  short_description text,
  long_description text,

  event_type text not null default 'masterclass'
    check (event_type in ('class_live','masterclass','workshop','webinar','conference','event')),

  delivery_type text not null default 'single_live'
    check (delivery_type in ('single_live','synchronous_training','recorded_video')),

  visibility text not null default 'public'
    check (visibility in ('public','private','structure','invitation','training_only')),

  status text not null default 'draft'
    check (status in (
      'draft','submitted','under_review','changes_requested','approved',
      'published','live','completed','cancellation_requested','cancelled',
      'suspended','archived','rejected'
    )),

  language text not null default 'fr',
  level text not null default 'all'
    check (level in ('beginner','intermediate','advanced','all')),

  category_id uuid null,

  starts_at timestamptz,
  timezone text not null default 'UTC',
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),

  max_participants integer check (max_participants is null or max_participants > 0),
  minimum_participants integer check (minimum_participants is null or minimum_participants >= 0),

  price_amount bigint not null default 0 check (price_amount >= 0),
  currency text not null default 'XOF',

  replay_enabled boolean not null default false,
  replay_access_policy text,

  cover_url text,
  cover_source text check (cover_source is null or cover_source in ('upload','ai','template')),

  prerequisites text,
  learning_outcomes jsonb not null default '[]'::jsonb,
  program jsonb not null default '[]'::jsonb,

  refund_policy_snapshot jsonb,
  cancellation_policy_snapshot jsonb,

  commercial_terms_version integer,
  featured boolean not null default false,

  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. INDIVIDUAL SESSIONS
-- One event can contain one or many sessions.
-- Required for synchronous multi-session training.
-- ------------------------------------------------------------
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,

  title text,
  description text,
  sequence_no integer not null default 1 check (sequence_no > 0),

  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'UTC',

  status text not null default 'scheduled'
    check (status in ('scheduled','waiting_room','live','completed','postponed','cancelled','technical_incident')),

  video_provider text,
  provider_room_id text,

  recording_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(event_id, sequence_no)
);

-- ------------------------------------------------------------
-- 3. REGISTRATIONS / PARTICIPANT ACCESS
-- access_source records WHY access exists.
-- ------------------------------------------------------------
create table if not exists public.live_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,

  access_source text not null default 'free_registration'
    check (access_source in (
      'purchase','free_registration','training_enrollment','structure_sponsorship',
      'invitation','subscription','promo','admin'
    )),

  payment_id uuid null,

  status text not null default 'confirmed'
    check (status in ('pending','confirmed','waitlisted','cancelled','refunded','expelled')),

  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,

  unique(event_id, user_id)
);

-- ------------------------------------------------------------
-- 4. VERSIONED COMMERCIAL TERMS
-- Organizer proposes; Super Admin validates/adjusts;
-- organizer accepts before publication.
-- ------------------------------------------------------------
create table if not exists public.live_commercial_terms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,

  version integer not null check (version > 0),

  live_price_amount bigint not null default 0 check (live_price_amount >= 0),
  replay_price_amount bigint check (replay_price_amount is null or replay_price_amount >= 0),
  currency text not null default 'XOF',

  oga_commission_percent numeric(5,2)
    check (oga_commission_percent is null or (oga_commission_percent >= 0 and oga_commission_percent <= 100)),

  organizer_share_percent numeric(5,2)
    check (organizer_share_percent is null or (organizer_share_percent >= 0 and organizer_share_percent <= 100)),

  payout_delay_hours integer check (payout_delay_hours is null or payout_delay_hours >= 0),

  refund_policy jsonb,
  cancellation_policy jsonb,
  subscription_compensation jsonb,

  proposed_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,

  organizer_accepted_at timestamptz,
  approved_at timestamptz,

  created_at timestamptz not null default now(),

  unique(event_id, version)
);

-- ------------------------------------------------------------
-- 5. MEDIA METADATA
-- Binary media remains private in Omnia-managed storage (R2).
-- media_type:
-- replay | recorded_video | cover | document
-- ------------------------------------------------------------
create table if not exists public.live_media (
  id uuid primary key default gen_random_uuid(),

  event_id uuid references public.live_events(id) on delete cascade,
  session_id uuid references public.live_sessions(id) on delete cascade,

  media_type text not null
    check (media_type in ('replay','recorded_video','cover','document')),

  status text not null default 'processing'
    check (status in (
      'uploading','processing','pending_review','published','update_pending',
      'rejected','expired','archived','pending_deletion','deleted'
    )),

  storage_key text,
  source_storage_key text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),

  access_policy text,
  available_from timestamptz,
  available_until timestamptz,

  watermark_enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  parent_version_id uuid references public.live_media(id) on delete set null,

  submitted_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. INDEXES
-- ------------------------------------------------------------
create index if not exists live_events_status_starts_idx
  on public.live_events(status, starts_at);

create index if not exists live_events_owner_idx
  on public.live_events(owner_user_id);

create index if not exists live_events_delivery_idx
  on public.live_events(delivery_type, status);

create index if not exists live_sessions_event_idx
  on public.live_sessions(event_id, sequence_no);

create index if not exists live_sessions_status_starts_idx
  on public.live_sessions(status, starts_at);

create index if not exists live_registrations_user_idx
  on public.live_registrations(user_id, registered_at desc);

create index if not exists live_registrations_event_status_idx
  on public.live_registrations(event_id, status);

create index if not exists live_commercial_terms_event_idx
  on public.live_commercial_terms(event_id, version desc);

create index if not exists live_media_event_idx
  on public.live_media(event_id, status);

create index if not exists live_media_session_idx
  on public.live_media(session_id, status);

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- Public catalogue reads only published/public records.
-- Sensitive writes and private reads go through secured Edge Functions.
-- ------------------------------------------------------------
alter table public.live_events enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_registrations enable row level security;
alter table public.live_commercial_terms enable row level security;
alter table public.live_media enable row level security;

-- Public catalogue
DROP POLICY IF EXISTS live_events_public_read ON public.live_events;
CREATE POLICY live_events_public_read
ON public.live_events
FOR SELECT
USING (
  visibility = 'public'
  AND status IN ('published','live','completed')
);

-- Public session metadata only when parent event itself is public/published.
DROP POLICY IF EXISTS live_sessions_public_read ON public.live_sessions;
CREATE POLICY live_sessions_public_read
ON public.live_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.live_events e
    WHERE e.id = event_id
      AND e.visibility = 'public'
      AND e.status IN ('published','live','completed')
  )
);

-- Published public cover/media metadata can be discovered.
-- Actual binary media remains private and requires signed access.
DROP POLICY IF EXISTS live_media_public_metadata_read ON public.live_media;
CREATE POLICY live_media_public_metadata_read
ON public.live_media
FOR SELECT
USING (
  status = 'published'
  AND media_type IN ('cover')
  AND EXISTS (
    SELECT 1
    FROM public.live_events e
    WHERE e.id = event_id
      AND e.visibility = 'public'
      AND e.status IN ('published','live','completed')
  )
);

comment on table public.live_events is
  'Omnia Live root product: single live, synchronous training or recorded video.';

comment on table public.live_sessions is
  'Individual scheduled/live sessions; one event may contain multiple synchronous classes.';

comment on table public.live_registrations is
  'Participant registrations and access source for Omnia Live products.';

comment on table public.live_commercial_terms is
  'Immutable/versioned commercial terms negotiated between organizer and Omnia.';

comment on table public.live_media is
  'Versioned Omnia-managed media metadata. Binary content remains private in R2.';
