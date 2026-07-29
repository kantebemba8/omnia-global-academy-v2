begin;

create table if not exists public.b2b_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  billing_cycle text not null default 'annual' check (billing_cycle in ('monthly','annual','custom')),
  currency text not null default 'XOF',
  base_price numeric(14,2) not null default 0 check (base_price >= 0),
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_plan_tiers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.b2b_plan_templates(id) on delete cascade,
  name text not null,
  min_members integer not null default 1 check (min_members >= 1),
  max_members integer check (max_members is null or max_members >= min_members),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  fixed_price numeric(14,2) not null default 0 check (fixed_price >= 0),
  benefits jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  plan_id uuid references public.b2b_plan_templates(id) on delete set null,
  tier_id uuid references public.b2b_plan_tiers(id) on delete set null,
  member_count integer not null default 1 check (member_count >= 1),
  billing_cycle text not null default 'annual' check (billing_cycle in ('monthly','annual','custom')),
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  currency text not null default 'XOF',
  valid_until date,
  notes text,
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','accepted','rejected','expired','converted')),
  created_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique,
  quote_id uuid not null unique references public.b2b_quotes(id) on delete restrict,
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  title text not null,
  terms text not null default '',
  starts_on date not null,
  ends_on date not null,
  total_amount numeric(14,2) not null default 0,
  currency text not null default 'XOF',
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer','mobile_money','card','other')),
  status text not null default 'draft' check (status in ('draft','sent','signed_by_structure','active','suspended','expired','terminated')),
  structure_signed_by uuid references public.users(id) on delete set null,
  structure_signed_at timestamptz,
  admin_signed_by uuid references public.users(id) on delete set null,
  admin_signed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.b2b_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.b2b_contracts(id) on delete cascade,
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'XOF',
  paid_on date not null,
  reference text,
  proof_url text not null,
  status text not null default 'submitted' check (status in ('submitted','verified','rejected')),
  submitted_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.b2b_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  contract_id uuid not null references public.b2b_contracts(id) on delete restrict,
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'XOF',
  issued_on date not null default current_date,
  due_on date,
  status text not null default 'issued' check (status in ('issued','partially_paid','paid','overdue','cancelled')),
  pdf_url text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_renewals (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.b2b_contracts(id) on delete cascade,
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  requested_start date not null,
  requested_end date not null,
  requested_member_count integer not null default 1 check (requested_member_count >= 1),
  notes text,
  status text not null default 'requested' check (status in ('requested','under_review','approved','rejected','completed')),
  requested_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_end >= requested_start)
);

create index if not exists idx_b2b_quotes_org_status on public.b2b_quotes(organization_id,status);
create index if not exists idx_b2b_contracts_org_status on public.b2b_contracts(organization_id,status);
create index if not exists idx_b2b_payment_proofs_contract on public.b2b_payment_proofs(contract_id,status);
create index if not exists idx_b2b_invoices_org_status on public.b2b_invoices(organization_id,status);
create index if not exists idx_b2b_renewals_org_status on public.b2b_renewals(organization_id,status);

alter table public.b2b_plan_templates enable row level security;
alter table public.b2b_plan_tiers enable row level security;
alter table public.b2b_quotes enable row level security;
alter table public.b2b_contracts enable row level security;
alter table public.b2b_payment_proofs enable row level security;
alter table public.b2b_invoices enable row level security;
alter table public.b2b_renewals enable row level security;

insert into public.b2b_plan_templates(name,description,billing_cycle,currency,base_price,is_active)
select 'Structure Essentielle','Gestion des membres, accès aux formations et suivi de base.','annual','XOF',0,true
where not exists (select 1 from public.b2b_plan_templates where name='Structure Essentielle');

commit;
