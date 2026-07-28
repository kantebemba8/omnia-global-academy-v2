-- GM3 Programme 2 — Hub des partenaires et reconnaissances
create extension if not exists pgcrypto;

create table if not exists recognition_partners (
  id uuid primary key default gen_random_uuid(),
  linked_organization_id uuid null,
  name text not null,
  slug text not null unique,
  partner_type text not null check (partner_type in ('academic','professional','cpd','institutional','certification','quality','technology','employment','financial','public','ngo','international','other')),
  description text,
  logo_url text,
  website text,
  country_code text,
  territories text[] not null default '{}',
  contact_name text,
  contact_title text,
  contact_email text,
  contact_phone text,
  status text not null default 'preparation' check (status in ('preparation','pending','active','suspended','expired','ended','rejected')),
  publication_status text not null default 'private' check (publication_status in ('private','listed')),
  start_date date,
  end_date date,
  renewal_date date,
  fee_amount numeric(14,2),
  fee_currency text default 'EUR',
  validation_process text,
  audit_process text,
  required_documents jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- La table partner_organizations appartient au socle Structure historique.
-- Certains exports du dépôt ne contiennent pas sa migration de création :
-- la contrainte est donc ajoutée uniquement lorsque la table existe déjà.
do $$
begin
  if to_regclass('public.partner_organizations') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'recognition_partners_linked_organization_id_fkey'
         and conrelid = 'public.recognition_partners'::regclass
     ) then
    alter table public.recognition_partners
      add constraint recognition_partners_linked_organization_id_fkey
      foreign key (linked_organization_id)
      references public.partner_organizations(id)
      on delete set null;
  end if;
end $$;

create table if not exists recognition_agreements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references recognition_partners(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('convention','contract','memorandum','authorization','data_processing','other')),
  reference text,
  title text not null,
  status text not null default 'draft' check (status in ('draft','review','signed','active','suspended','expired','terminated')),
  document_url text,
  signed_at date,
  start_date date,
  end_date date,
  renewal_terms text,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recognition_programs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references recognition_partners(id) on delete cascade,
  course_id uuid null references courses(id) on delete cascade,
  title text not null,
  recognition_type text not null check (recognition_type in ('recognized','co_certified','cpd','internal_structure','accredited','endorsed')),
  status text not null default 'preparation' check (status in ('preparation','submitted','under_review','changes_requested','approved','suspended','expired','rejected','ended')),
  certificate_label text,
  credit_value numeric(10,2),
  credit_unit text,
  validity_months integer,
  effective_from date,
  effective_until date,
  renewal_date date,
  validation_rules jsonb not null default '{}'::jsonb,
  required_evidence jsonb not null default '[]'::jsonb,
  decision_notes text,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recognition_logo_permissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references recognition_partners(id) on delete cascade,
  program_id uuid null references recognition_programs(id) on delete cascade,
  scope text not null check (scope in ('platform','course','certificate','marketing','website','social','other')),
  status text not null default 'pending' check (status in ('pending','authorized','restricted','revoked','expired')),
  permitted_uses text[] not null default '{}',
  prohibited_uses text[] not null default '{}',
  brand_guidelines_url text,
  valid_from date,
  valid_until date,
  conditions text,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recognition_submissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references recognition_partners(id) on delete cascade,
  program_id uuid null references recognition_programs(id) on delete cascade,
  submission_type text not null check (submission_type in ('initial','renewal','audit','evidence','change_request')),
  status text not null default 'draft' check (status in ('draft','submitted','under_review','changes_requested','accepted','rejected','withdrawn')),
  submitted_documents jsonb not null default '[]'::jsonb,
  message text,
  response_message text,
  submitted_by uuid references users(id) on delete set null,
  reviewed_by uuid references users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recognition_audit_log (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references recognition_partners(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid references users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_recognition_partners_type_status on recognition_partners(partner_type,status);
create index if not exists idx_recognition_agreements_partner on recognition_agreements(partner_id,status);
create index if not exists idx_recognition_programs_partner on recognition_programs(partner_id,status);
create index if not exists idx_recognition_programs_course on recognition_programs(course_id);
create index if not exists idx_recognition_submissions_partner on recognition_submissions(partner_id,status);

alter table recognition_partners enable row level security;
alter table recognition_agreements enable row level security;
alter table recognition_programs enable row level security;
alter table recognition_logo_permissions enable row level security;
alter table recognition_submissions enable row level security;
alter table recognition_audit_log enable row level security;

-- Les accès applicatifs sont centralisés dans l'Edge Function avec service role.
-- La lecture publique est limitée au registre explicitement publié.
create policy recognition_partners_public_read on recognition_partners for select using (publication_status='listed' and status='active');
create policy recognition_programs_public_read on recognition_programs for select using (
  status='approved' and exists(select 1 from recognition_partners p where p.id=partner_id and p.publication_status='listed' and p.status='active')
);

create or replace function recognition_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ declare t text; begin
  foreach t in array array['recognition_partners','recognition_agreements','recognition_programs','recognition_logo_permissions','recognition_submissions'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function recognition_touch_updated_at()', t, t);
  end loop;
end $$;
