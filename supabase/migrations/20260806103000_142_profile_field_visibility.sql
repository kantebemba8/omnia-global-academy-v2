-- 142 — Confidentialité champ par champ et profil public canonique
-- Ajoute une carte de visibilité explicite sans exposer directement user_profiles.
-- Les anciennes colonnes show_* restent synchronisées pour compatibilité.

begin;

alter table public.user_profiles
  add column if not exists field_visibility jsonb not null default
  '{
    "display_name": true,
    "avatar_url": true,
    "headline": true,
    "bio": true,
    "city": true,
    "country_code": true,
    "languages": true,
    "skills": true,
    "interests": true,
    "website_url": true,
    "linkedin_url": true,
    "portfolio_url": true,
    "github_url": true,
    "availability_text": true,
    "public_email": false,
    "public_phone": false,
    "roles": true,
    "achievements": true,
    "messages": true,
    "education_level": true,
    "field_of_study": true,
    "career_goal": true,
    "target_roles": true,
    "target_sectors": true,
    "contract_preferences": true,
    "years_experience": true,
    "expertise_domain": true,
    "teaching_languages": true,
    "qualifications": true,
    "teaching_formats": true,
    "experience_summary": true,
    "organizer_type": true,
    "organization_name": true,
    "event_topics": true,
    "moderation_domains": true,
    "recruitment_sectors": true,
    "recruitment_countries": true,
    "coaching_topics": true,
    "session_languages": true,
    "organizer_metrics": true,
    "coach_metrics": true,
    "structure": true
  }'::jsonb;

alter table public.user_profiles
  drop constraint if exists user_profiles_field_visibility_object;

alter table public.user_profiles
  add constraint user_profiles_field_visibility_object
  check (jsonb_typeof(field_visibility) = 'object');

update public.user_profiles
set field_visibility =
  '{
    "display_name": true,
    "avatar_url": true,
    "headline": true,
    "bio": true,
    "city": true,
    "country_code": true,
    "languages": true,
    "skills": true,
    "interests": true,
    "website_url": true,
    "linkedin_url": true,
    "portfolio_url": true,
    "github_url": true,
    "availability_text": true,
    "public_email": false,
    "public_phone": false,
    "roles": true,
    "achievements": true,
    "messages": true,
    "education_level": true,
    "field_of_study": true,
    "career_goal": true,
    "target_roles": true,
    "target_sectors": true,
    "contract_preferences": true,
    "years_experience": true,
    "expertise_domain": true,
    "teaching_languages": true,
    "qualifications": true,
    "teaching_formats": true,
    "experience_summary": true,
    "organizer_type": true,
    "organization_name": true,
    "event_topics": true,
    "moderation_domains": true,
    "recruitment_sectors": true,
    "recruitment_countries": true,
    "coaching_topics": true,
    "session_languages": true,
    "organizer_metrics": true,
    "coach_metrics": true,
    "structure": true
  }'::jsonb
  || coalesce(field_visibility, '{}'::jsonb)
  || jsonb_build_object(
    'public_email', show_email,
    'public_phone', show_phone,
    'city', show_location,
    'country_code', show_location,
    'roles', show_roles,
    'achievements', show_achievements,
    'messages', allow_messages
  );

-- Le compte interne d’administration reste totalement absent de l’espace public.
update public.user_profiles p
set
  visibility = 'private',
  show_email = false,
  show_phone = false,
  show_location = false,
  show_roles = false,
  show_achievements = false,
  allow_messages = false,
  field_visibility = (
    select jsonb_object_agg(k, false)
    from jsonb_object_keys(p.field_visibility) as keys(k)
  ),
  updated_at = now()
where exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.user_id
    and ur.role = 'super_admin'
);

-- Les index publics Career/Talent ne conservent que les informations autorisées.
update public.career_public_profiles cp
set
  full_name = case when coalesce((p.field_visibility ->> 'display_name')::boolean, true) then cp.full_name else 'Membre Omnia' end,
  professional_title = case when coalesce((p.field_visibility ->> 'headline')::boolean, true) then cp.professional_title else null end,
  email = case when coalesce((p.field_visibility ->> 'public_email')::boolean, false) then cp.email else null end,
  phone = case when coalesce((p.field_visibility ->> 'public_phone')::boolean, false) then cp.phone else null end,
  location = case
    when coalesce((p.field_visibility ->> 'city')::boolean, true)
      or coalesce((p.field_visibility ->> 'country_code')::boolean, true)
    then cp.location else null end,
  linkedin = case when coalesce((p.field_visibility ->> 'linkedin_url')::boolean, true) then cp.linkedin else null end,
  bio = case when coalesce((p.field_visibility ->> 'bio')::boolean, true) then cp.bio else null end,
  skills = case when coalesce((p.field_visibility ->> 'skills')::boolean, true) then cp.skills else '{}'::text[] end,
  languages = case when coalesce((p.field_visibility ->> 'languages')::boolean, true) then cp.languages else '{}'::text[] end,
  photo_url = case when coalesce((p.field_visibility ->> 'avatar_url')::boolean, true) then cp.photo_url else null end,
  updated_at = now()
from public.user_profiles p
where p.user_id = cp.user_id;


-- Toute modification du profil Talent passe par les Edge Functions, qui appliquent
-- la carte de visibilité. Les clients ne peuvent plus contourner le filtrage en
-- écrivant directement dans la table publique historique.
drop policy if exists "users manage own career profile" on public.career_public_profiles;
revoke insert, update, delete on table public.career_public_profiles from anon, authenticated;

-- user_profiles reste inaccessible directement aux clients.
alter table public.user_profiles enable row level security;
revoke all on table public.user_profiles from anon, authenticated;

comment on column public.user_profiles.field_visibility is
  'Carte de visibilité champ par champ. La lecture publique reste filtrée exclusivement par auth-update-profile; aucune lecture directe client de user_profiles.';

commit;
