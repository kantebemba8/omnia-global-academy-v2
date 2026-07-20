-- ============================================================
-- 062 — OMNIA LIVE MODULE G
-- CERTIFICATES / CPD / ATTENDANCE DOCUMENTS / DOCUMENT ENGINE
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.live_document_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  document_type text not null check (document_type in (
    'attendance_certificate','completion_certificate','cpd_certificate',
    'participation_attestation','institutional_document'
  )),
  status text not null default 'draft' check (status in ('draft','active','inactive','archived')),
  design_config jsonb not null default '{}'::jsonb,
  eligibility_rules jsonb not null default '{}'::jsonb,
  logo_mode text not null default 'platform' check (logo_mode in ('platform','platform_and_organizer')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_event_document_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.live_events(id) on delete cascade,
  documents_enabled boolean not null default true,
  free_event_document_policy text not null default 'attendance_based'
    check (free_event_document_policy in ('none','attendance_based','manual_admin')),
  default_document_type text not null default 'attendance_certificate'
    check (default_document_type in (
      'attendance_certificate','completion_certificate','cpd_certificate','participation_attestation'
    )),
  minimum_attendance_percent numeric(5,2) not null default 80
    check (minimum_attendance_percent >= 0 and minimum_attendance_percent <= 100),
  minimum_sessions_attended integer,
  require_all_mandatory_sessions boolean not null default false,
  require_completion boolean not null default false,
  require_assessment boolean not null default false,
  minimum_assessment_score numeric(5,2),
  cpd_enabled boolean not null default false,
  cpd_hours numeric(8,2),
  cpd_points numeric(8,2),
  cpd_reference text,
  template_id uuid references public.live_document_templates(id) on delete set null,
  auto_issue boolean not null default false,
  organizer_can_request boolean not null default true,
  super_admin_validation_required boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_document_issuance_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  document_type text not null check (document_type in (
    'attendance_certificate','completion_certificate','cpd_certificate','participation_attestation'
  )),
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','eligible','ineligible','approved','rejected','issued','cancelled')),
  decision_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,user_id,document_type)
);

create table if not exists public.live_issued_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.live_document_issuance_requests(id) on delete set null,
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  template_id uuid references public.live_document_templates(id) on delete set null,
  document_type text not null,
  document_number text not null unique,
  verification_code text not null unique,
  verification_url text,
  participant_name text not null,
  event_title text not null,
  organizer_name text,
  issue_date date not null default current_date,
  attendance_percent numeric(5,2),
  sessions_attended integer,
  sessions_total integer,
  assessment_score numeric(5,2),
  cpd_hours numeric(8,2),
  cpd_points numeric(8,2),
  cpd_reference text,
  immutable_payload jsonb not null default '{}'::jsonb,
  pdf_storage_key text,
  pdf_sha256 text,
  status text not null default 'issued' check (status in ('issued','revoked')),
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revocation_reason text,
  issued_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists live_issued_documents_user_idx
  on public.live_issued_documents(user_id,created_at desc);
create index if not exists live_issued_documents_event_idx
  on public.live_issued_documents(event_id,created_at desc);
create index if not exists live_issued_documents_verify_idx
  on public.live_issued_documents(verification_code);

create table if not exists public.live_document_audit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.live_issued_documents(id) on delete cascade,
  request_id uuid references public.live_document_issuance_requests(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.live_document_templates
(template_key,name,document_type,status,design_config,eligibility_rules,logo_mode)
values
(
  'omnia_live_attendance_v1',
  'Omnia Live — Certificat de présence',
  'attendance_certificate',
  'active',
  '{"brand":"Omnia Global Academy","primary":"#002050","accent":"#BF8813","format":"A4_landscape","platform_logo":true,"qr_verification":true}'::jsonb,
  '{"attendance_based":true}'::jsonb,
  'platform'
),
(
  'omnia_live_cpd_v1',
  'Omnia Live — Certificat CPD',
  'cpd_certificate',
  'active',
  '{"brand":"Omnia Global Academy","primary":"#002050","accent":"#BF8813","format":"A4_landscape","platform_logo":true,"qr_verification":true}'::jsonb,
  '{"cpd_required":true}'::jsonb,
  'platform'
)
on conflict (template_key) do nothing;

alter table public.live_document_templates enable row level security;
alter table public.live_event_document_rules enable row level security;
alter table public.live_document_issuance_requests enable row level security;
alter table public.live_issued_documents enable row level security;
alter table public.live_document_audit_log enable row level security;
