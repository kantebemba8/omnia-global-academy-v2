-- Omnia Career — catalogue officiel 12 CV + 6 LM
-- Désactive les anciens templates intégrés, conserve les futurs templates personnalisés du Super Admin.

alter table if exists public.career_templates
  add column if not exists thumbnail_url text,
  add column if not exists layout_config jsonb not null default '{}'::jsonb,
  add column if not exists default_colors jsonb not null default '{}'::jsonb,
  add column if not exists is_custom boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update public.career_templates
set is_active = false, updated_at = now()
where coalesce(is_custom, false) = false
  and template_key not in ('cv_horizon', 'cv_sahara', 'cv_atlas', 'cv_kora', 'cv_nile', 'cv_executive', 'cv_baobab', 'cv_digital', 'cv_academia', 'cv_hospitality', 'cv_qhse', 'cv_impact', 'lm_horizon', 'lm_sahara', 'lm_atlas', 'lm_kora', 'lm_digital', 'lm_executive');

create unique index if not exists uq_career_templates_template_key on public.career_templates(template_key);

insert into public.career_templates
(template_key, template_type, name_fr, description_fr, category, is_free, is_ats_compatible, display_order, thumbnail_url, layout_config, default_colors, is_active, is_custom, updated_at)
values
('cv_horizon','cv','Horizon Pro','Deux colonnes élégantes, lisibles et professionnelles.','professional',true,true,1,'/career-templates/generated/cv_horizon.svg','{"variant": "split", "primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8"}'::jsonb,'{"primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_sahara','cv','Sahara Élégant','Style chaleureux et premium aux accents dorés.','africa_premium',false,true,2,'/career-templates/generated/cv_sahara.svg','{"variant": "band", "primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8"}'::jsonb,'{"primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_atlas','cv','Atlas ATS','Modèle sans photo, optimisé pour les recruteurs et ATS.','professional',true,true,3,'/career-templates/generated/cv_atlas.svg','{"variant": "minimal", "primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa"}'::jsonb,'{"primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_kora','cv','Kora Créatif','Présentation moderne avec chronologie et identité forte.','creative',false,false,4,'/career-templates/generated/cv_kora.svg','{"variant": "timeline", "primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff"}'::jsonb,'{"primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_nile','cv','Nile Impact','Blocs dynamiques pour profils polyvalents et projets.','professional',true,true,5,'/career-templates/generated/cv_nile.svg','{"variant": "cards", "primary": "#064e3b", "accent": "#22c55e", "sidebar": "#ecfdf5"}'::jsonb,'{"primary": "#064e3b", "accent": "#22c55e", "sidebar": "#ecfdf5", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_executive','cv','Executive Noir & Or','Une page premium pour cadres et fonctions de direction.','professional',false,true,6,'/career-templates/generated/cv_executive.svg','{"variant": "executive", "primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6"}'::jsonb,'{"primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_baobab','cv','Baobab Créatif','Design visuel pour communication, marketing et création.','creative',false,false,7,'/career-templates/generated/cv_baobab.svg','{"variant": "creative", "primary": "#7c2d12", "accent": "#f59e0b", "sidebar": "#fff7ed"}'::jsonb,'{"primary": "#7c2d12", "accent": "#f59e0b", "sidebar": "#fff7ed", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_digital','cv','Digital Tech','Interface sombre et moderne pour tech, data et cybersécurité.','tech',false,true,8,'/career-templates/generated/cv_digital.svg','{"variant": "tech", "primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944"}'::jsonb,'{"primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_academia','cv','Academia','Structure détaillée pour enseignement, recherche et publications.','specialized',true,true,9,'/career-templates/generated/cv_academia.svg','{"variant": "academic", "primary": "#334155", "accent": "#64748b", "sidebar": "#f8fafc"}'::jsonb,'{"primary": "#334155", "accent": "#64748b", "sidebar": "#f8fafc", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_hospitality','cv','Hospitality Signature','Élégant et orienté service, hôtellerie et restauration.','specialized',false,true,10,'/career-templates/generated/cv_hospitality.svg','{"variant": "hospitality", "primary": "#123b55", "accent": "#c6a15b", "sidebar": "#edf4f7"}'::jsonb,'{"primary": "#123b55", "accent": "#c6a15b", "sidebar": "#edf4f7", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_qhse','cv','QHSE Green','Conçu pour QSE, HSE, RSE, conformité et audit.','specialized',false,true,11,'/career-templates/generated/cv_qhse.svg','{"variant": "qhse", "primary": "#0f4c3a", "accent": "#84cc16", "sidebar": "#f1f8f4"}'::jsonb,'{"primary": "#0f4c3a", "accent": "#84cc16", "sidebar": "#f1f8f4", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('cv_impact','cv','Impact One Page','Compact et percutant pour candidature rapide.','professional',true,true,12,'/career-templates/generated/cv_impact.svg','{"variant": "compact", "primary": "#1e3a8a", "accent": "#f59e0b", "sidebar": "#eff6ff"}'::jsonb,'{"primary": "#1e3a8a", "accent": "#f59e0b", "sidebar": "#eff6ff", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_horizon','lm','Horizon Pro','Lettre assortie au CV Horizon Pro.','classic_lm',true,true,1,'/career-templates/generated/lm_horizon.svg','{"variant": "split", "primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8"}'::jsonb,'{"primary": "#002050", "accent": "#bf8813", "sidebar": "#eef3f8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_sahara','lm','Sahara Élégant','Lettre premium aux accents chauds et dorés.','classic_lm',false,true,2,'/career-templates/generated/lm_sahara.svg','{"variant": "band", "primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8"}'::jsonb,'{"primary": "#7a3e16", "accent": "#d7a64a", "sidebar": "#fbf4e8", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_atlas','lm','Atlas ATS','Lettre simple, claire et très lisible.','classic_lm',true,true,3,'/career-templates/generated/lm_atlas.svg','{"variant": "minimal", "primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa"}'::jsonb,'{"primary": "#16213e", "accent": "#4b79a1", "sidebar": "#f5f7fa", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_kora','lm','Kora Créative','Lettre moderne pour communication et métiers créatifs.','classic_lm',false,false,4,'/career-templates/generated/lm_kora.svg','{"variant": "creative", "primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff"}'::jsonb,'{"primary": "#3b235f", "accent": "#d2a8ff", "sidebar": "#f6f0ff", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_digital','lm','Digital Tech','Lettre pour tech, data, produit et cybersécurité.','classic_lm',false,true,5,'/career-templates/generated/lm_digital.svg','{"variant": "tech", "primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944"}'::jsonb,'{"primary": "#071a2f", "accent": "#00b8d9", "sidebar": "#0d2944", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now()),
('lm_executive','lm','Executive Noir & Or','Lettre premium pour profils expérimentés.','classic_lm',false,true,6,'/career-templates/generated/lm_executive.svg','{"variant": "executive", "primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6"}'::jsonb,'{"primary": "#111827", "accent": "#b88746", "sidebar": "#f3f4f6", "text": "#374151", "background": "#FFFFFF"}'::jsonb,true,false,now())
on conflict (template_key) do update set
  template_type=excluded.template_type, name_fr=excluded.name_fr, description_fr=excluded.description_fr,
  category=excluded.category, is_free=excluded.is_free, is_ats_compatible=excluded.is_ats_compatible,
  display_order=excluded.display_order, thumbnail_url=excluded.thumbnail_url, layout_config=excluded.layout_config,
  default_colors=excluded.default_colors, is_active=true, is_custom=false, updated_at=now();

create index if not exists idx_career_templates_active_catalog on public.career_templates(template_type,is_active,display_order);
