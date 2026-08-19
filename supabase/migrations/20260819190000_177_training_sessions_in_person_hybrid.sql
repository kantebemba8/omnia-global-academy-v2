
-- OGA 177 — Formations présentielles & hybrides : sessions, inscriptions, présence, waitlist, communication.
alter table public.courses add column if not exists training_delivery_mode text not null default 'online';
alter table public.courses drop constraint if exists courses_training_delivery_mode_check;
alter table public.courses add constraint courses_training_delivery_mode_check
  check (training_delivery_mode in ('online','in_person','hybrid'));

create table if not exists public.course_training_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  delivery_mode text not null default 'in_person' check (delivery_mode in ('in_person','hybrid')),
  status text not null default 'draft' check (status in ('draft','published','registration_open','full','completed','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  registration_deadline timestamptz,
  country text,
  city text,
  venue text,
  address text,
  access_instructions text,
  capacity integer check (capacity is null or capacity > 0),
  price_xof numeric(14,2) not null default 0 check (price_xof >= 0),
  is_free boolean not null default true,
  certificate_enabled boolean not null default false,
  minimum_attendance_percent numeric(5,2) not null default 80 check (minimum_attendance_percent between 0 and 100),
  assessment_required boolean not null default false,
  organizer_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_training_sessions_dates_check check (ends_at > starts_at)
);
create index if not exists course_training_sessions_course_idx on public.course_training_sessions(course_id,starts_at);
create index if not exists course_training_sessions_status_idx on public.course_training_sessions(status,starts_at);

create table if not exists public.course_training_session_days (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_training_sessions(id) on delete cascade,
  day_no integer not null check (day_no > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text,
  created_at timestamptz not null default now(),
  unique(session_id,day_no),
  constraint course_training_session_days_dates_check check (ends_at > starts_at)
);

create table if not exists public.course_training_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_training_sessions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','payment_pending','paid','waitlisted','cancelled','attended','completed','no_show')),
  payment_status text not null default 'free' check (payment_status in ('free','pending','paid','failed','refunded')),
  order_id uuid,
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  promoted_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(session_id,user_id)
);
create index if not exists course_training_registrations_session_idx on public.course_training_registrations(session_id,status);
create index if not exists course_training_registrations_user_idx on public.course_training_registrations(user_id,registered_at desc);

create table if not exists public.course_training_attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.course_training_registrations(id) on delete cascade,
  session_day_id uuid not null references public.course_training_session_days(id) on delete cascade,
  status text not null default 'present' check (status in ('present','late','absent','excused')),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  method text not null default 'manual' check (method in ('manual','qr','import')),
  validated_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(registration_id,session_day_id)
);

create table if not exists public.course_training_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  session_day_id uuid not null references public.course_training_session_days(id) on delete cascade,
  token text not null unique,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.course_training_communications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_training_sessions(id) on delete cascade,
  communication_type text not null check (communication_type in ('promotion','confirmation','reminder','update','cancellation','post_session')),
  channel text not null check (channel in ('newsletter','email','push','in_app')),
  subject text,
  message text,
  status text not null default 'draft' check (status in ('draft','sent','failed')),
  sent_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.course_training_sessions enable row level security;
alter table public.course_training_session_days enable row level security;
alter table public.course_training_registrations enable row level security;
alter table public.course_training_attendance enable row level security;
alter table public.course_training_qr_tokens enable row level security;
alter table public.course_training_communications enable row level security;

drop policy if exists "public published training sessions" on public.course_training_sessions;
create policy "public published training sessions" on public.course_training_sessions
for select using (status in ('published','registration_open','full','completed'));

drop policy if exists "public training session days" on public.course_training_session_days;
create policy "public training session days" on public.course_training_session_days
for select using (exists (
  select 1 from public.course_training_sessions s
  where s.id=session_id and s.status in ('published','registration_open','full','completed')
));

alter table public.orders add column if not exists training_session_id uuid references public.course_training_sessions(id) on delete set null;
create index if not exists orders_training_session_idx on public.orders(training_session_id) where training_session_id is not null;

alter table public.course_training_registrations add column if not exists assessment_passed boolean;

create table if not exists public.course_training_credentials (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.course_training_registrations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  session_id uuid not null references public.course_training_sessions(id) on delete cascade,
  credential_type text not null default 'completion' check (credential_type in ('participation','completion')),
  credential_number text not null unique,
  verification_code text not null unique,
  attendance_percent numeric(5,2) not null default 0,
  pdf_storage_path text,
  issued_at timestamptz not null default now(),
  status text not null default 'valid' check (status in ('valid','revoked'))
);
alter table public.course_training_credentials enable row level security;
drop policy if exists "public verify training credentials" on public.course_training_credentials;
create policy "public verify training credentials" on public.course_training_credentials for select using (status='valid');
