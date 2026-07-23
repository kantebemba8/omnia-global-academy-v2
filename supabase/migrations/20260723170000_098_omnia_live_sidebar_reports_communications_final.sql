-- 098 — Finalisation Gestion Omnia Live Super-admin
-- Communication bilingue modifiable, exports et nettoyage des erreurs de relations ambiguës.

alter table if exists public.live_notification_templates
  add column if not exists language text not null default 'fr';

alter table if exists public.live_report_exports
  add column if not exists mime_type text,
  add column if not exists content_text text;

-- Garantit que la clé utilisée par l'upsert des modèles est réellement unique.
create unique index if not exists live_notification_templates_template_key_uidx
  on public.live_notification_templates(template_key);

create index if not exists live_notification_templates_language_idx
  on public.live_notification_templates(language, category, channel, status);

-- Les anciens exports bloqués ne doivent plus encombrer l'interface.
update public.live_report_exports
set status='failed',
    error_message=coalesce(error_message,'Ancien export interrompu avant la finalisation du générateur.'),
    completed_at=coalesce(completed_at,now())
where status in ('queued','processing')
  and created_at < now() - interval '30 minutes';

-- Les modèles existants restent éditables. Les variantes anglaises sont créées
-- uniquement lorsqu'elles n'existent pas encore.
insert into public.live_notification_templates
(template_key,name,category,channel,subject_template,body_template,variables,status,language)
select
  t.template_key || '_en',
  t.name || ' — English',
  t.category,
  t.channel,
  case when coalesce(t.subject_template,'')='' then '' else '[EN] ' || t.subject_template end,
  t.body_template,
  coalesce(t.variables,'[]'::jsonb),
  t.status,
  'en'
from public.live_notification_templates t
where coalesce(t.language,'fr')='fr'
  and not exists (
    select 1 from public.live_notification_templates e
    where e.template_key=t.template_key || '_en'
  );
