-- 141 — Gouvernance unifiée des suppressions de contenus
-- Les brouillons sans activité peuvent être supprimés par leur créateur.
-- Les contenus publiés, validés ou liés à une activité sont soumis à confirmation administrative.

begin;

create extension if not exists pgcrypto;

create table if not exists public.content_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('course','project','live_event','job_offer')),
  content_id text not null,
  content_title text not null default '',
  creator_user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid,
  requested_by uuid not null references public.users(id) on delete cascade,
  reason text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','executed')),
  requires_admin_confirmation boolean not null default true,
  importance_reason text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_deletion_requests_one_pending
  on public.content_deletion_requests(content_type, content_id)
  where status = 'pending';

create index if not exists content_deletion_requests_status_created
  on public.content_deletion_requests(status, created_at desc);

create index if not exists content_deletion_requests_creator
  on public.content_deletion_requests(creator_user_id, created_at desc);

create or replace function public.omnia_content_deletion_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_content_deletion_requests_updated_at
  on public.content_deletion_requests;
create trigger trg_content_deletion_requests_updated_at
before update on public.content_deletion_requests
for each row execute function public.omnia_content_deletion_set_updated_at();

alter table public.content_deletion_requests enable row level security;
revoke all on table public.content_deletion_requests from anon, authenticated;

-- Le compte d’administration ne possède jamais de profil public.
update public.user_profiles p
set
  visibility = 'private',
  show_email = false,
  show_phone = false,
  show_location = false,
  show_roles = false,
  show_achievements = false,
  allow_messages = false,
  updated_at = now()
where exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.user_id
    and ur.role = 'super_admin'
);

delete from public.career_public_profiles cp
where exists (
  select 1
  from public.user_roles ur
  where ur.user_id = cp.user_id
    and ur.role = 'super_admin'
);

comment on table public.content_deletion_requests is
  'Demandes de suppression créées lorsque le contenu possède une importance métier, une publication ou un historique à préserver.';

commit;
