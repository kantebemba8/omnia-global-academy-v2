-- Étape 3 : saisie assistée, commercialisation et certifications multiples
create extension if not exists pgcrypto;

alter table public.courses add column if not exists sale_mode text not null default 'paid' check (sale_mode in ('free','paid'));
alter table public.courses add column if not exists desired_price_amount numeric(14,2) not null default 0;
alter table public.courses add column if not exists sale_currency text not null default 'XOF';
alter table public.courses add column if not exists promotion_price_amount numeric(14,2);
alter table public.courses add column if not exists structure_payment_mode text not null default 'free' check (structure_payment_mode in ('free','fixed_amount','revenue_share'));
alter table public.courses add column if not exists structure_fixed_amount numeric(14,2);
alter table public.courses add column if not exists certification_requested boolean not null default false;
alter table public.courses add column if not exists assisted_request_id uuid;
alter table public.courses add column if not exists assisted_status text;

create table if not exists public.assisted_course_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete cascade,
  requester_role text not null,
  structure_id uuid,
  service_type text not null check (service_type in ('with_certification','without_certification')),
  instructions text not null default '',
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','rejected','cancelled')),
  assigned_to uuid references public.users(id),
  admin_comment text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_assisted_active_course on public.assisted_course_requests(course_id) where status in ('pending','in_progress');
create index if not exists ix_assisted_requests_status on public.assisted_course_requests(status,requested_at desc);

create table if not exists public.certification_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null default 'other' check (organization_type in ('omnia','cpd','structure','professor','partner','other')),
  logo_url text,
  badge_url text,
  signature_url text,
  stamp_url text,
  verification_url text,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_cert_org_name_type on public.certification_organizations(lower(name),organization_type);

insert into public.certification_organizations(name,organization_type,is_active)
values ('Omnia Global Academy','omnia',true)
on conflict do nothing;

create table if not exists public.course_certifications (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  organization_id uuid references public.certification_organizations(id) on delete set null,
  certification_type text not null check (certification_type in ('omnia','cpd','structure','professor','partner','other')),
  organization_name text not null,
  certification_name text not null,
  certification_code text,
  credit_value numeric(10,2),
  credit_unit text,
  badge_url text,
  logo_url text,
  signature_url text,
  stamp_url text,
  verification_url text,
  evidence_url text,
  valid_from date,
  expires_at date,
  status text not null default 'pending' check (status in ('pending','validated','rejected','expired','revoked')),
  requested_by uuid references public.users(id),
  validated_by uuid references public.users(id),
  validated_at timestamptz,
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_course_certifications_course on public.course_certifications(course_id,status);

create table if not exists public.certificate_accreditations (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  course_certification_id uuid references public.course_certifications(id) on delete set null,
  organization_name text not null,
  certification_name text not null,
  certification_code text,
  credit_value numeric(10,2),
  credit_unit text,
  badge_url text,
  logo_url text,
  signature_url text,
  stamp_url text,
  verification_url text,
  valid_from date,
  expires_at date,
  status text not null default 'valid' check (status in ('valid','expired','revoked')),
  created_at timestamptz not null default now()
);
create index if not exists ix_certificate_accreditations_certificate on public.certificate_accreditations(certificate_id);

alter table public.assisted_course_requests enable row level security;
alter table public.certification_organizations enable row level security;
alter table public.course_certifications enable row level security;
alter table public.certificate_accreditations enable row level security;

drop policy if exists assisted_requester_read on public.assisted_course_requests;
create policy assisted_requester_read on public.assisted_course_requests for select to authenticated using (requester_id=auth.uid());
drop policy if exists cert_org_public_read on public.certification_organizations;
create policy cert_org_public_read on public.certification_organizations for select using (is_active=true);
drop policy if exists course_cert_owner_read on public.course_certifications;
create policy course_cert_owner_read on public.course_certifications for select to authenticated using (requested_by=auth.uid());
drop policy if exists certificate_accreditations_public_read on public.certificate_accreditations;
create policy certificate_accreditations_public_read on public.certificate_accreditations for select using (true);
