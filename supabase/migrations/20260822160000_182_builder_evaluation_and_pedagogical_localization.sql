-- OGA — Builder evaluation parameters + pedagogical localization V1
begin;

-- Registre de configuration internationale réutilisant users.country_code.
-- Aucun taux de change : il s'agit d'une préférence d'affichage pédagogique stable.
create table if not exists public.country_localization_settings (
  country_code text primary key,
  default_currency_code text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint country_localization_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint country_localization_currency_check check (default_currency_code ~ '^[A-Z]{3}$')
);

insert into public.country_localization_settings(country_code,default_currency_code,is_active)
values
  ('ZA','ZAR',true),
  ('DZ','DZD',true),
  ('DE','EUR',true),
  ('AO','AOA',true),
  ('SA','SAR',true),
  ('AU','AUD',true),
  ('BE','EUR',true),
  ('BJ','XOF',true),
  ('BR','BRL',true),
  ('BF','XOF',true),
  ('CM','XAF',true),
  ('CA','CAD',true),
  ('CV','CVE',true),
  ('CF','XAF',true),
  ('CN','CNY',true),
  ('KM','KMF',true),
  ('CG','XAF',true),
  ('CI','XOF',true),
  ('EG','EGP',true),
  ('AE','AED',true),
  ('ES','EUR',true),
  ('US','USD',true),
  ('ET','ETB',true),
  ('FR','EUR',true),
  ('GA','XAF',true),
  ('GM','GMD',true),
  ('GH','GHS',true),
  ('GN','GNF',true),
  ('GW','XOF',true),
  ('IN','INR',true),
  ('IT','EUR',true),
  ('KE','KES',true),
  ('LR','LRD',true),
  ('LY','LYD',true),
  ('LU','EUR',true),
  ('MG','MGA',true),
  ('MW','MWK',true),
  ('ML','XOF',true),
  ('MA','MAD',true),
  ('MR','MRU',true),
  ('MZ','MZN',true),
  ('NA','NAD',true),
  ('NE','XOF',true),
  ('NG','NGN',true),
  ('UG','UGX',true),
  ('PT','EUR',true),
  ('CD','CDF',true),
  ('GB','GBP',true),
  ('RW','RWF',true),
  ('ST','STN',true),
  ('SN','XOF',true),
  ('SC','SCR',true),
  ('SL','SLE',true),
  ('SO','SOS',true),
  ('SD','SDG',true),
  ('SS','SSP',true),
  ('CH','CHF',true),
  ('TZ','TZS',true),
  ('TD','XAF',true),
  ('TG','XOF',true),
  ('TN','TND',true),
  ('ZM','ZMW',true),
  ('ZW','ZWG',true)
on conflict (country_code) do update
set default_currency_code=excluded.default_currency_code,
    is_active=excluded.is_active,
    updated_at=now();

alter table public.country_localization_settings enable row level security;
drop policy if exists country_localization_settings_read on public.country_localization_settings;
create policy country_localization_settings_read
  on public.country_localization_settings for select
  to anon, authenticated
  using (is_active=true);

-- Préférence explicite utilisateur. Elle reste séparée de la langue et du pays.
alter table public.user_profiles
  add column if not exists preferred_pedagogical_currency text;

alter table public.user_profiles
  drop constraint if exists user_profiles_preferred_pedagogical_currency_check;
alter table public.user_profiles
  add constraint user_profiles_preferred_pedagogical_currency_check
  check (
    preferred_pedagogical_currency is null
    or preferred_pedagogical_currency ~ '^[A-Z]{3}$'
  );

-- Snapshot de localisation de la question officielle / tentative.
alter table public.assessment_questions
  add column if not exists localization_json jsonb not null default '{}'::jsonb;

alter table public.assessment_attempts
  add column if not exists localization_snapshot jsonb not null default '{}'::jsonb;

comment on table public.country_localization_settings is
  'Correspondance pays ISO -> devise pédagogique suggérée. Aucun taux de change financier.';
comment on column public.user_profiles.preferred_pedagogical_currency is
  'Devise pédagogique choisie explicitement par l utilisateur; indépendante de preferred_language.';
comment on column public.assessment_questions.localization_json is
  'Variantes pédagogiques figées provenant du Builder. Ne doit jamais convertir automatiquement des montants réels.';
comment on column public.assessment_attempts.localization_snapshot is
  'Snapshot figé de la localisation utilisée au démarrage de la tentative afin de garantir la stabilité de l examen.';

commit;
