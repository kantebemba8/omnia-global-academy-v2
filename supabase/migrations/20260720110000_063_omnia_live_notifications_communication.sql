-- ============================================================
-- 063 — OMNIA LIVE MODULE H
-- NOTIFICATIONS / COMMUNICATION / AUTOMATIONS COMPLETE
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. Notification templates
-- ============================================================
create table if not exists public.live_notification_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null check (category in (
    'registration',
    'payment',
    'live_reminder',
    'live_started',
    'live_changed',
    'live_cancelled',
    'waitlist',
    'replay',
    'document',
    'refund',
    'organizer',
    'system'
  )),
  channel text not null check (channel in ('in_app','email','sms','push')),
  subject_template text,
  body_template text not null,
  variables jsonb not null default '[]'::jsonb,
  status text not null default 'active'
    check (status in ('active','inactive','archived')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_notification_templates_category_idx
  on public.live_notification_templates(category,channel,status);

-- ============================================================
-- 2. Participant notification preferences
-- ============================================================
create table if not exists public.live_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,

  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default true,

  reminders_enabled boolean not null default true,
  reminder_24h boolean not null default true,
  reminder_1h boolean not null default true,
  reminder_15m boolean not null default false,

  payment_notifications boolean not null default true,
  replay_notifications boolean not null default true,
  document_notifications boolean not null default true,
  marketing_notifications boolean not null default false,

  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text,

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Communication campaigns
-- ============================================================
create table if not exists public.live_communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  organizer_user_id uuid references public.users(id) on delete set null,

  name text not null,
  audience_type text not null check (audience_type in (
    'all_registered',
    'confirmed',
    'waitlist',
    'attended',
    'absent',
    'replay_eligible',
    'custom'
  )),
  audience_filter jsonb not null default '{}'::jsonb,

  channel text not null check (channel in ('in_app','email','sms','push','multi')),
  subject text,
  message text not null,

  status text not null default 'draft'
    check (status in ('draft','scheduled','sending','sent','cancelled','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,

  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_communication_campaigns_event_idx
  on public.live_communication_campaigns(event_id,status,scheduled_at);

-- ============================================================
-- 4. Campaign recipients / delivery
-- ============================================================
create table if not exists public.live_communication_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.live_communication_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  recipient_email text,
  recipient_phone text,
  channel text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','failed','skipped')),
  provider text,
  provider_reference text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists live_communication_recipients_campaign_idx
  on public.live_communication_recipients(campaign_id,status);

-- ============================================================
-- 5. Automation rules
-- ============================================================
create table if not exists public.live_automation_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  rule_key text not null,
  trigger_type text not null check (trigger_type in (
    'registration_confirmed',
    'payment_confirmed',
    'before_live',
    'live_started',
    'live_ended',
    'event_changed',
    'event_cancelled',
    'waitlist_promoted',
    'replay_published',
    'document_issued',
    'refund_updated'
  )),
  trigger_offset_minutes integer,
  channel text not null default 'multi'
    check (channel in ('in_app','email','sms','push','multi')),
  template_key text,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,rule_key)
);

create index if not exists live_automation_rules_trigger_idx
  on public.live_automation_rules(trigger_type,enabled);

-- ============================================================
-- 6. Notification jobs
-- ============================================================
create table if not exists public.live_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  campaign_id uuid references public.live_communication_campaigns(id) on delete cascade,
  automation_rule_id uuid references public.live_automation_rules(id) on delete set null,

  notification_type text not null,
  channel text not null,
  template_key text,
  payload jsonb not null default '{}'::jsonb,

  scheduled_at timestamptz not null default now(),
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_notification_jobs_schedule_idx
  on public.live_notification_jobs(status,scheduled_at);

-- ============================================================
-- 7. In-app inbox
-- ============================================================
create table if not exists public.live_notification_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid references public.live_events(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  action_url text,
  payload jsonb not null default '{}'::jsonb,

  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),

  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists live_notification_inbox_user_idx
  on public.live_notification_inbox(user_id,read_at,created_at desc);

-- ============================================================
-- 8. Communication audit
-- ============================================================
create table if not exists public.live_communication_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.live_events(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. Default templates
-- ============================================================
insert into public.live_notification_templates
(template_key,name,category,channel,subject_template,body_template,variables,status)
values
('live_registration_confirmed_email','Inscription Live confirmée','registration','email',
 'Inscription confirmée — {{event_title}}',
 'Votre inscription à {{event_title}} est confirmée. Date : {{event_date}}.',
 '["event_title","event_date","participant_name"]'::jsonb,'active'),

('live_reminder_24h_email','Rappel Live 24h','live_reminder','email',
 'Rappel — {{event_title}} commence demain',
 '{{event_title}} commence le {{event_date}}. Préparez-vous à rejoindre Omnia Live.',
 '["event_title","event_date","join_url"]'::jsonb,'active'),

('live_reminder_1h_inapp','Rappel Live 1h','live_reminder','in_app',
 null,
 '{{event_title}} commence dans environ 1 heure.',
 '["event_title","join_url"]'::jsonb,'active'),

('live_started_inapp','Live démarré','live_started','in_app',
 null,
 '{{event_title}} est maintenant en direct.',
 '["event_title","join_url"]'::jsonb,'active'),

('live_replay_published_email','Replay disponible','replay','email',
 'Replay disponible — {{event_title}}',
 'Le Replay de {{event_title}} est maintenant disponible dans votre espace Omnia Live.',
 '["event_title","replay_url"]'::jsonb,'active'),

('live_document_issued_email','Document disponible','document','email',
 'Votre document Omnia Live est disponible',
 'Votre document {{document_type}} pour {{event_title}} est disponible.',
 '["document_type","event_title","document_url"]'::jsonb,'active'),

('live_cancelled_email','Événement annulé','live_cancelled','email',
 'Annulation — {{event_title}}',
 '{{event_title}} a été annulé. Consultez Omnia Live pour les informations de remboursement.',
 '["event_title","refund_url"]'::jsonb,'active')
on conflict (template_key) do nothing;

-- ============================================================
-- 10. RLS
-- ============================================================
alter table public.live_notification_templates enable row level security;
alter table public.live_notification_preferences enable row level security;
alter table public.live_communication_campaigns enable row level security;
alter table public.live_communication_recipients enable row level security;
alter table public.live_automation_rules enable row level security;
alter table public.live_notification_jobs enable row level security;
alter table public.live_notification_inbox enable row level security;
alter table public.live_communication_audit enable row level security;
