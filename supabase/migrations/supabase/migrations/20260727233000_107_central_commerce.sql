-- Programme 1 / Grand module 5
-- Moteur central unique : plans, packs, avantages, offres créateurs, commissions,
-- commandes, souscriptions, droits, quotas, soldes et payouts.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.commerce_benefit_definitions (
  id uuid primary key default gen_random_uuid(),
  benefit_key text not null unique,
  module_key text not null,
  name text not null,
  description text,
  value_type text not null check (value_type in ('boolean','quantity','percentage','amount','duration_days','capacity','credit','content_access','priority')),
  unit_label text,
  reset_period text check (reset_period is null or reset_period in ('day','week','month','quarter','semester','year','subscription_period','never')),
  allowed_audiences text[] not null default '{}',
  configuration_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_system boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  subtitle text,
  description text,
  audience text not null check (audience in ('learner','coach','organizer','recruiter','structure','professor','global')),
  commercial_type text not null default 'subscription' check (commercial_type in ('subscription','pack','one_time','trial')),
  billing_interval text not null default 'month' check (billing_interval in ('none','week','month','quarter','semester','year','custom','lifetime')),
  interval_count integer not null default 1 check (interval_count > 0),
  custom_duration_days integer check (custom_duration_days is null or custom_duration_days > 0),
  price_xof integer not null default 0 check (price_xof >= 0),
  currency text not null default 'XOF',
  trial_days integer not null default 0 check (trial_days >= 0),
  auto_renew boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public','private','code','structure_only')),
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','retired','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  max_subscribers integer check (max_subscribers is null or max_subscribers > 0),
  country_codes text[] not null default '{}',
  eligibility jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  badge_label text,
  terms_text text,
  version integer not null default 1,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.commerce_plans(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(plan_id,version)
);

create table if not exists public.commerce_plan_benefits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.commerce_plans(id) on delete cascade,
  benefit_definition_id uuid not null references public.commerce_benefit_definitions(id) on delete restrict,
  value_json jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  display_label text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id,benefit_definition_id)
);

create table if not exists public.commerce_commission_rules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null check (module_key in ('courses','coaching','omnia_live','talent','career','projects','global')),
  creator_user_id uuid references public.users(id) on delete cascade,
  creator_level text,
  offer_type text,
  platform_percent numeric(5,2) not null check (platform_percent >= 0 and platform_percent <= 100),
  fixed_fee_xof integer not null default 0 check (fixed_fee_xof >= 0),
  minimum_amount_xof integer not null default 0 check (minimum_amount_xof >= 0),
  priority integer not null default 100,
  justification text not null,
  supporting_documents jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_creator_offers (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.users(id) on delete cascade,
  module_key text not null check (module_key in ('coaching','omnia_live')),
  offer_kind text not null check (offer_kind in ('one_time','pack','subscription')),
  title text not null,
  description text not null default '',
  billing_interval text not null default 'none' check (billing_interval in ('none','month','quarter','semester','year','custom')),
  interval_count integer not null default 1 check (interval_count > 0),
  custom_duration_days integer,
  price_xof integer not null check (price_xof >= 0),
  currency text not null default 'XOF',
  benefits_json jsonb not null default '[]'::jsonb,
  capacity integer,
  justification text not null,
  supporting_documents jsonb not null default '[]'::jsonb,
  proposed_platform_percent numeric(5,2) check (proposed_platform_percent is null or (proposed_platform_percent >= 0 and proposed_platform_percent <= 100)),
  approved_price_xof integer,
  approved_platform_percent numeric(5,2) check (approved_platform_percent is null or (approved_platform_percent >= 0 and approved_platform_percent <= 100)),
  admin_reason text,
  creator_response text,
  creator_accepted_at timestamptz,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','changes_requested','counterproposal','approved','published','rejected','paused','archived')),
  submitted_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_promotions (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  discount_type text not null check (discount_type in ('percentage','fixed','credit')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  applicable_plan_ids uuid[] not null default '{}',
  audience text[] not null default '{}',
  country_codes text[] not null default '{}',
  first_purchase_only boolean not null default false,
  max_uses integer,
  max_uses_per_user integer not null default 1,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  buyer_user_id uuid not null references public.users(id) on delete restrict,
  plan_id uuid references public.commerce_plans(id) on delete set null,
  creator_offer_id uuid references public.commerce_creator_offers(id) on delete set null,
  order_type text not null check (order_type in ('plan','creator_offer','renewal','manual_grant')),
  original_amount_xof integer not null default 0 check (original_amount_xof >= 0),
  discount_xof integer not null default 0 check (discount_xof >= 0),
  final_amount_xof integer not null default 0 check (final_amount_xof >= 0),
  currency text not null default 'XOF',
  payment_provider text not null default 'fedapay',
  payment_status text not null default 'pending' check (payment_status in ('pending','processing','completed','failed','cancelled','refunded','partially_refunded')),
  provider_transaction_id text,
  provider_reference text,
  payment_url text,
  idempotency_key text not null unique,
  promotion_id uuid references public.commerce_promotions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan_id is not null)::int + (creator_offer_id is not null)::int = 1)
);

create table if not exists public.commerce_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.commerce_promotions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  discount_xof integer not null default 0 check (discount_xof >= 0),
  redeemed_at timestamptz not null default now(),
  unique(promotion_id,order_id)
);

create table if not exists public.commerce_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid references public.commerce_plans(id) on delete restrict,
  creator_offer_id uuid references public.commerce_creator_offers(id) on delete restrict,
  source_order_id uuid references public.commerce_orders(id) on delete set null,
  status text not null default 'active' check (status in ('trial','active','grace','past_due','paused','cancelled','expired','refunded')),
  starts_at timestamptz not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  auto_renew boolean not null default false,
  provider_subscription_id text,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan_id is not null)::int + (creator_offer_id is not null)::int = 1)
);

create table if not exists public.commerce_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  benefit_definition_id uuid not null references public.commerce_benefit_definitions(id) on delete restrict,
  source_plan_id uuid references public.commerce_plans(id) on delete set null,
  source_creator_offer_id uuid references public.commerce_creator_offers(id) on delete set null,
  source_order_id uuid references public.commerce_orders(id) on delete set null,
  source_subscription_id uuid references public.commerce_subscriptions(id) on delete cascade,
  value_json jsonb not null default '{}'::jsonb,
  remaining_quantity numeric(14,2),
  reset_period text,
  reset_at timestamptz,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'active' check (status in ('active','exhausted','expired','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.commerce_entitlements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  quantity numeric(14,2) not null default 1 check (quantity > 0),
  module_key text not null,
  action_key text not null,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_creator_balances (
  creator_user_id uuid primary key references public.users(id) on delete cascade,
  pending_xof bigint not null default 0,
  available_xof bigint not null default 0,
  reserved_xof bigint not null default 0,
  lifetime_gross_xof bigint not null default 0,
  lifetime_platform_fee_xof bigint not null default 0,
  lifetime_paid_xof bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_creator_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.users(id) on delete cascade,
  order_id uuid references public.commerce_orders(id) on delete set null,
  entry_type text not null check (entry_type in ('sale_pending','sale_available','platform_fee','refund','adjustment','payout_reserved','payout_completed','payout_released')),
  gross_xof integer not null default 0,
  platform_fee_xof integer not null default 0,
  net_xof integer not null default 0,
  balance_bucket text not null default 'pending' check (balance_bucket in ('pending','available','reserved','paid','none')),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_payout_requests (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.users(id) on delete cascade,
  amount_xof integer not null check (amount_xof > 0),
  payout_method text not null check (payout_method in ('mobile_money','bank_uemoa','swift','manual')),
  payout_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','under_review','approved','processing','paid','rejected','cancelled','failed')),
  creator_note text,
  admin_reason text,
  provider_payout_id text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider text not null default 'fedapay',
  event_type text not null,
  provider_transaction_id text,
  order_id uuid references public.commerce_orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.commerce_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_commerce_plans_catalog on public.commerce_plans(status,audience,display_order);
create index if not exists idx_commerce_offers_creator on public.commerce_creator_offers(creator_user_id,module_key,status);
create index if not exists idx_commerce_orders_buyer on public.commerce_orders(buyer_user_id,created_at desc);
create index if not exists idx_commerce_orders_provider on public.commerce_orders(provider_transaction_id);
create index if not exists idx_commerce_redemptions_user on public.commerce_promotion_redemptions(user_id,promotion_id,redeemed_at desc);
create index if not exists idx_commerce_subscriptions_user on public.commerce_subscriptions(user_id,status,current_period_end);
create index if not exists idx_commerce_entitlements_user on public.commerce_entitlements(user_id,status,valid_until);
create index if not exists idx_commerce_usage_user on public.commerce_usage_ledger(user_id,created_at desc);
create index if not exists idx_commerce_ledger_creator on public.commerce_creator_ledger(creator_user_id,created_at desc);
create index if not exists idx_commerce_payout_creator on public.commerce_payout_requests(creator_user_id,status,requested_at desc);

-- Mise à jour automatique.
do $$ declare t text; begin
  foreach t in array array[
    'commerce_benefit_definitions','commerce_plans','commerce_plan_benefits','commerce_commission_rules',
    'commerce_creator_offers','commerce_promotions','commerce_orders','commerce_promotion_redemptions','commerce_subscriptions',
    'commerce_entitlements','commerce_creator_balances','commerce_payout_requests'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I',t,t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
  end loop;
end $$;

-- Catalogue central d'avantages. Aucun plan commercial n'est créé automatiquement.
insert into public.commerce_benefit_definitions(benefit_key,module_key,name,description,value_type,unit_label,reset_period,allowed_audiences,configuration_schema)
values
('training_discount_percent','formations','Réduction sur les formations','Pourcentage de réduction sur les formations autorisées.','percentage','%','subscription_period',array['learner','structure','global'],'{"scope":["all","categories","courses"]}'),
('training_discount_xof','formations','Réduction fixe sur les formations','Montant fixe de réduction sur les formations autorisées.','amount','XOF','subscription_period',array['learner','structure','global'],'{"scope":["all","categories","courses"]}'),
('training_access_count','formations','Formations incluses','Nombre de formations incluses par période.','quantity','formation','subscription_period',array['learner','structure','global'],'{"scope":["all","categories","courses"]}'),
('training_catalog_access','formations','Accès catalogue','Accès à tout ou partie du catalogue.','content_access',null,'subscription_period',array['learner','structure','global'],'{"scope":["all","categories","courses"]}'),
('training_offline_access','formations','Mode hors connexion','Autorise le téléchargement hors connexion lorsque le contenu le permet.','boolean',null,'never',array['learner','global'],'{}'),
('assessment_included_count','assessment','Évaluations incluses','Nombre d’évaluations officielles incluses.','quantity','évaluation','subscription_period',array['learner','structure','global'],'{}'),
('assessment_extra_attempts','assessment','Tentatives supplémentaires','Tentatives supplémentaires pendant la période.','quantity','tentative','subscription_period',array['learner','structure','global'],'{}'),
('assessment_review_requests','assessment','Révisions de note incluses','Nombre de demandes de révision incluses.','quantity','révision','subscription_period',array['learner','structure','global'],'{}'),
('assessment_jury_discount','assessment','Réduction jury','Réduction sur les évaluations nécessitant un jury.','percentage','%','subscription_period',array['learner','structure','global'],'{}'),
('certificate_included_count','credentials','Certificats premium inclus','Nombre de certificats premium ou rééditions inclus.','quantity','certificat','subscription_period',array['learner','structure','global'],'{}'),
('skills_passport_exports','credentials','Exports Skills Passport','Nombre d’exports ou preuves signées inclus.','quantity','export','subscription_period',array['learner','global'],'{}'),
('skills_passport_share_days','credentials','Durée des liens Skills Passport','Durée maximale d’un lien de partage.','duration_days','jour','subscription_period',array['learner','global'],'{}'),
('career_cv_exports','career','Exports CV','Nombre d’exports CV autorisés.','quantity','export','subscription_period',array['learner','global'],'{}'),
('career_letter_exports','career','Exports lettres','Nombre d’exports de lettres de motivation.','quantity','export','subscription_period',array['learner','global'],'{}'),
('career_ai_credits','career','Crédits IA Career','Crédits d’assistance IA pour Career Studio.','credit','crédit','subscription_period',array['learner','global'],'{}'),
('career_premium_templates','career','Modèles Career premium','Accès aux modèles premium autorisés.','boolean',null,'never',array['learner','global'],'{}'),
('coaching_discount_percent','coaching','Réduction coaching','Réduction sur les séances et offres autorisées.','percentage','%','subscription_period',array['learner','global'],'{}'),
('coaching_session_credits','coaching','Crédits de séances','Nombre de séances ou crédits coaching inclus.','credit','crédit','subscription_period',array['learner','global'],'{}'),
('coach_offer_limit','coaching','Limite d’offres coach','Nombre d’offres actives autorisées au coach.','capacity','offre','subscription_period',array['coach'],'{}'),
('coach_group_program_limit','coaching','Programmes collectifs coach','Nombre de programmes collectifs actifs.','capacity','programme','subscription_period',array['coach'],'{}'),
('coach_priority_visibility','coaching','Visibilité coach prioritaire','Priorité contrôlée dans le catalogue.','priority',null,'subscription_period',array['coach'],'{}'),
('live_access_count','omnia_live','Accès Omnia Live','Nombre d’événements inclus.','quantity','événement','subscription_period',array['learner','global'],'{}'),
('live_replay_access','omnia_live','Accès aux replays','Accès aux replays autorisés.','content_access',null,'subscription_period',array['learner','global'],'{}'),
('organizer_live_limit','omnia_live','Lives organisateur','Nombre de lives publiables par période.','capacity','live','subscription_period',array['organizer'],'{}'),
('organizer_participant_limit','omnia_live','Participants par live','Capacité maximale par événement.','capacity','participant','subscription_period',array['organizer'],'{}'),
('organizer_storage_gb','omnia_live','Stockage organisateur','Stockage média alloué.','capacity','Go','subscription_period',array['organizer'],'{}'),
('organizer_replay_days','omnia_live','Conservation des replays','Durée de conservation des replays.','duration_days','jour','subscription_period',array['organizer'],'{}'),
('organizer_coorganizer_limit','omnia_live','Coorganisateurs','Nombre de coorganisateurs autorisés.','capacity','coorganisateur','subscription_period',array['organizer'],'{}'),
('organizer_certificate_count','omnia_live','Certificats Live','Nombre de certificats de participation inclus.','quantity','certificat','subscription_period',array['organizer'],'{}'),
('recruiter_job_posts','talent','Offres d’emploi recruteur','Nombre d’offres publiables.','quantity','offre','subscription_period',array['recruiter','structure'],'{}'),
('recruiter_contact_credits','talent','Crédits de contact','Nombre de demandes de contact autorisées.','credit','contact','subscription_period',array['recruiter','structure'],'{}'),
('recruiter_advanced_search','talent','Recherche avancée','Accès aux filtres avancés Omnia Talent.','boolean',null,'never',array['recruiter','structure'],'{}'),
('recruiter_reports','talent','Rapports recruteur','Exports et rapports autorisés.','quantity','rapport','subscription_period',array['recruiter','structure'],'{}'),
('talent_profile_boost','talent','Mise en avant Talent','Visibilité professionnelle renforcée.','priority',null,'subscription_period',array['learner','global'],'{}'),
('structure_member_limit','structures','Membres Structure','Nombre maximal de membres actifs.','capacity','membre','subscription_period',array['structure'],'{}'),
('structure_manager_limit','structures','Gestionnaires Structure','Nombre de gestionnaires internes.','capacity','gestionnaire','subscription_period',array['structure'],'{}'),
('structure_cohort_limit','structures','Cohortes Structure','Nombre de cohortes actives.','capacity','cohorte','subscription_period',array['structure'],'{}'),
('structure_reports','structures','Rapports Structures','Nombre d’exports de rapports.','quantity','rapport','subscription_period',array['structure'],'{}'),
('structure_skill_mapping','structures','Cartographie des compétences','Accès à la cartographie des compétences.','boolean',null,'never',array['structure'],'{}'),
('support_priority','platform','Support prioritaire','Niveau de priorité du support.','priority',null,'subscription_period',array['learner','coach','organizer','recruiter','structure','professor','global'],'{}'),
('pedagogical_ai_access','platform','Assistant IA pédagogique','Accès à l’assistant pédagogique validé.','boolean',null,'never',array['learner','professor','structure','global'],'{}'),
('storage_gb','platform','Stockage supplémentaire','Stockage supplémentaire alloué.','capacity','Go','subscription_period',array['coach','organizer','structure','professor','global'],'{}')
on conflict (benefit_key) do update set
  module_key=excluded.module_key,name=excluded.name,description=excluded.description,value_type=excluded.value_type,
  unit_label=excluded.unit_label,reset_period=excluded.reset_period,allowed_audiences=excluded.allowed_audiences,
  configuration_schema=excluded.configuration_schema,is_active=true,updated_at=now();

-- Réinitialisation définitive des catalogues commerciaux historiques sans toucher aux écritures financières.
-- Les colonnes sont vérifiées dynamiquement afin de rester compatible avec les anciennes variantes de schéma.
do $$
declare
  v_table text;
  target_status text;
  has_is_active boolean;
  has_status boolean;
begin
  foreach v_table in array array[
    'coaching_subscription_plans','coaching_packages','live_subscription_plans','live_structure_packs','career_token_packs'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then continue; end if;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='is_active') into has_is_active;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='status') into has_status;
    if has_is_active then
      execute format('update public.%I set is_active=false where is_active is distinct from false', v_table);
    elsif has_status then
      target_status := case when v_table='live_subscription_plans' then 'inactive' when v_table='live_structure_packs' then 'cancelled' else null end;
      if target_status is not null then execute format('update public.%I set status=%L where status is distinct from %L', v_table, target_status, target_status); end if;
    end if;
  end loop;
end $$;

insert into public.site_settings(key,value,updated_at)
values
('central_commerce_enabled','true'::jsonb,now()),
('central_commerce_provider','"fedapay"'::jsonb,now()),
('central_commerce_payout_mode','"manual_approval"'::jsonb,now())
on conflict (key) do update set value=excluded.value,updated_at=excluded.updated_at;

-- Stockage privé des justificatifs commerciaux.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('commerce-documents','commerce-documents',false,20971520,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Toutes les écritures passent par les Edge Functions avec service role.
do $$ declare t text; begin
  foreach t in array array[
    'commerce_benefit_definitions','commerce_plans','commerce_plan_versions','commerce_plan_benefits',
    'commerce_commission_rules','commerce_creator_offers','commerce_promotions','commerce_orders','commerce_promotion_redemptions',
    'commerce_subscriptions','commerce_entitlements','commerce_usage_ledger','commerce_creator_balances',
    'commerce_creator_ledger','commerce_payout_requests','commerce_payment_events','commerce_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
end $$;

comment on table public.commerce_plans is 'Catalogue central des abonnements et packs créés uniquement par le Super Admin. Aucun plan imposé au lancement.';
comment on table public.commerce_creator_offers is 'Offres proposées par les coachs et organisateurs, publiables uniquement après validation et accord sur prix/commission.';
comment on table public.commerce_entitlements is 'Droits et quotas centralisés consommables par les modules Omnia.';
