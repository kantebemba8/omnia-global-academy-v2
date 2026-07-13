-- Omnia Career: templates compatibles ajoutables après déploiement
alter table if exists public.career_templates
  add column if not exists thumbnail_url text,
  add column if not exists layout_config jsonb not null default '{}'::jsonb,
  add column if not exists is_custom boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_career_templates_custom_active
  on public.career_templates(template_type, is_active, display_order);
