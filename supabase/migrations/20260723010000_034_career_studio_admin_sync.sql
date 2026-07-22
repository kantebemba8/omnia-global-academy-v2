-- Omnia Career Studio: configuration centralisée, vente de jetons, banque de questions et reporting.
create table if not exists public.career_admin_rules (
 id uuid primary key default gen_random_uuid(), rule_key text unique not null, group_key text not null default 'general', label_fr text not null,
 description_fr text, value_type text not null default 'boolean', value_json jsonb not null default '{"value":false}'::jsonb,
 options_json jsonb, min_value numeric, max_value numeric, unit text, is_active boolean not null default true, display_order int not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.career_token_config (
 id uuid primary key default gen_random_uuid(), config_key text unique not null, config_value numeric not null default 0, description_fr text,
 config_group text default 'costs', min_value numeric default 0, max_value numeric, value_unit text default 'jeton', display_order int default 0,
 is_active boolean not null default true, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.career_token_packs (
 id uuid primary key default gen_random_uuid(), pack_key text unique not null, name_fr text not null, description_fr text, tokens int not null check(tokens>0), bonus_tokens int not null default 0,
 price_xof int not null check(price_xof>=0), price_eur numeric, currency_code text default 'XOF', promo_label text, is_popular boolean default false, is_active boolean default true,
 display_order int default 0, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.career_ai_config (
 id uuid primary key default gen_random_uuid(), config_key text unique not null, config_value text not null default '', description_fr text, is_active boolean default true,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.career_interview_questions (
 id uuid primary key default gen_random_uuid(), category text not null default 'rh', sector text, level text, question text not null, expected_answer text, keywords text,
 is_active boolean not null default true, source text not null default 'super_admin', created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_career_questions_active on public.career_interview_questions(is_active,category);

insert into public.career_token_config(config_key,config_value,description_fr,config_group,value_unit,display_order) values
 ('ai_cv_suggestion',1,'Suggestion ou amélioration IA d’un CV','costs','jeton',10),('ai_lm_suggestion',1,'Suggestion ou génération IA d’une lettre','costs','jeton',20),
 ('pdf_cv_export',1,'Téléchargement PDF d’un CV','costs','jeton',30),('pdf_lm_export',1,'Téléchargement PDF d’une lettre','costs','jeton',40),
 ('ats_analysis',1,'Analyse ATS complète','costs','jeton',50),('translation',1,'Traduction assistée','costs','jeton',60)
on conflict(config_key) do nothing;
insert into public.career_token_packs(pack_key,name_fr,description_fr,tokens,bonus_tokens,price_xof,is_popular,is_active,display_order) values
 ('starter','Pack Starter','Pour quelques exports et actions IA',3,0,500,false,true,10),('plus','Pack Plus','Plus de liberté pour CV, LM et IA',7,1,1000,true,true,20),('pro','Pack Pro','Pour une recherche d’emploi intensive',15,3,2000,false,true,30)
on conflict(pack_key) do nothing;
insert into public.career_ai_config(config_key,config_value,description_fr,is_active) values
 ('cv_ai_enabled','true','Génération et amélioration de CV avec IA',true),('lm_ai_enabled','true','Génération de lettres de motivation avec IA',true),
 ('adapt_to_offer_enabled','true','Adaptation du CV à une offre',true),('ats_score_enabled','true','Analyse et score ATS',true),('translation_enabled','true','Traduction assistée FR/EN',true),
 ('reformulation_enabled','true','Reformulation professionnelle',true),('daily_limit_per_user','10','Limite quotidienne d’appels IA par utilisateur',true),
 ('monthly_limit_per_user','100','Limite mensuelle d’appels IA par utilisateur',true),('default_language','fr','Langue par défaut',true),('default_tone','professionnel','Ton rédactionnel par défaut',true),('max_tokens','800','Longueur maximale de réponse IA',true)
on conflict(config_key) do nothing;
insert into public.career_admin_rules(rule_key,group_key,label_fr,description_fr,value_type,value_json,min_value,max_value,unit,display_order) values
 ('career_enabled','general','Omnia Career Studio activé','Active ou désactive globalement l’espace carrière','boolean','{"value":true}'::jsonb,null,null,null,10),
 ('free_preview','general','Aperçu gratuit','Autorise la prévisualisation avant consommation de jetons','boolean','{"value":true}'::jsonb,null,null,null,20),
 ('pdf_export_cost','exports','Coût téléchargement PDF','Nombre de jetons consommés par export PDF','integer','{"value":1}'::jsonb,0,100,'jeton(s)',10),
 ('certificate_token_reward','tokens','Jetons par certificat obtenu','Jetons crédités lorsqu’un certificat éligible est obtenu','integer','{"value":1}'::jsonb,0,100,'jeton(s)',10),
 ('token_sales_enabled','tokens','Vente de jetons activée','Affiche les packs actifs aux apprenants et autorise le paiement','boolean','{"value":true}'::jsonb,null,null,null,20)
on conflict(rule_key) do nothing;
