-- 128 — Stabilisation finale du CMS de la page d'accueil et des données publiques.
-- Transactions de publication, désactivation explicite des anciens canaux publics.

CREATE OR REPLACE FUNCTION public.oga_landing_admin_allowed(p_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.oga_landing_save_draft(p_page jsonb, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_now timestamptz := now();
BEGIN
  IF NOT public.oga_landing_admin_allowed(p_admin_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO public.landing_page_cms_state(id, draft, updated_at, updated_by)
  VALUES (1, p_page, v_now, p_admin_id)
  ON CONFLICT (id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  INSERT INTO public.landing_page_publication_log(action, draft_snapshot, admin_id)
  VALUES ('save_draft', p_page, p_admin_id);
  RETURN jsonb_build_object('landing_page', p_page, 'updated_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_landing_publish(p_page jsonb, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_previous jsonb;
  v_page jsonb;
  v_meta jsonb;
BEGIN
  IF NOT public.oga_landing_admin_allowed(p_admin_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT value INTO v_previous FROM public.site_settings WHERE key = 'landing_page_published' FOR UPDATE;
  v_page := p_page || jsonb_build_object('published_at', v_now, 'updated_at', v_now, 'version', GREATEST(COALESCE((p_page->>'version')::int, 2), 2));
  v_meta := jsonb_build_object('published_at', v_now, 'published_by', p_admin_id, 'previous_available', v_previous IS NOT NULL);
  INSERT INTO public.site_settings(key, value, updated_at, updated_by_admin_id)
  VALUES ('landing_page_published', v_page, v_now, p_admin_id), ('landing_page_publication_meta', v_meta, v_now, p_admin_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by_admin_id = EXCLUDED.updated_by_admin_id;
  INSERT INTO public.landing_page_cms_state(id, draft, previous_published, published_at, published_by, updated_at, updated_by)
  VALUES (1, v_page, v_previous, v_now, p_admin_id, v_now, p_admin_id)
  ON CONFLICT (id) DO UPDATE SET draft = EXCLUDED.draft, previous_published = EXCLUDED.previous_published,
    published_at = EXCLUDED.published_at, published_by = EXCLUDED.published_by,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  INSERT INTO public.landing_page_publication_log(action, draft_snapshot, published_snapshot, previous_published_snapshot, admin_id)
  VALUES ('publish', v_page, v_page, v_previous, p_admin_id);
  RETURN jsonb_build_object('landing_page', v_page, 'publication_meta', v_meta);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_landing_restore_draft(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_page jsonb; v_now timestamptz := now();
BEGIN
  IF NOT public.oga_landing_admin_allowed(p_admin_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT value INTO v_page FROM public.site_settings WHERE key = 'landing_page_published';
  IF v_page IS NULL THEN RAISE EXCEPTION 'NO_PUBLISHED_LANDING_PAGE'; END IF;
  INSERT INTO public.landing_page_cms_state(id, draft, updated_at, updated_by)
  VALUES (1, v_page, v_now, p_admin_id)
  ON CONFLICT (id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  INSERT INTO public.landing_page_publication_log(action, draft_snapshot, admin_id)
  VALUES ('restore_draft', v_page, p_admin_id);
  RETURN jsonb_build_object('landing_page', v_page);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_landing_rollback(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_current jsonb;
  v_previous jsonb;
  v_restored jsonb;
  v_meta jsonb;
BEGIN
  IF NOT public.oga_landing_admin_allowed(p_admin_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT value INTO v_current FROM public.site_settings WHERE key = 'landing_page_published' FOR UPDATE;
  SELECT previous_published INTO v_previous FROM public.landing_page_cms_state WHERE id = 1 FOR UPDATE;
  IF v_previous IS NULL THEN RAISE EXCEPTION 'NO_PREVIOUS_LANDING_PUBLICATION'; END IF;
  v_restored := v_previous || jsonb_build_object('published_at', v_now, 'updated_at', v_now, 'version', GREATEST(COALESCE((v_previous->>'version')::int, 2), 2));
  v_meta := jsonb_build_object('published_at', v_now, 'published_by', p_admin_id, 'previous_available', v_current IS NOT NULL);
  INSERT INTO public.site_settings(key, value, updated_at, updated_by_admin_id)
  VALUES ('landing_page_published', v_restored, v_now, p_admin_id), ('landing_page_publication_meta', v_meta, v_now, p_admin_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by_admin_id = EXCLUDED.updated_by_admin_id;
  UPDATE public.landing_page_cms_state SET draft = v_restored, previous_published = v_current,
    published_at = v_now, published_by = p_admin_id, updated_at = v_now, updated_by = p_admin_id WHERE id = 1;
  INSERT INTO public.landing_page_publication_log(action, draft_snapshot, published_snapshot, previous_published_snapshot, admin_id)
  VALUES ('rollback', v_restored, v_restored, v_current, p_admin_id);
  RETURN jsonb_build_object('landing_page', v_restored, 'publication_meta', v_meta);
END;
$$;

REVOKE ALL ON FUNCTION public.oga_landing_admin_allowed(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_landing_save_draft(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_landing_publish(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_landing_restore_draft(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_landing_rollback(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_landing_admin_allowed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_landing_save_draft(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_landing_publish(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_landing_restore_draft(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_landing_rollback(uuid) TO service_role;

-- Aucun ancien réseau ou lien d'application ne doit être publié sans validation explicite.
UPDATE public.landing_page_cms_state
SET social_networks = COALESCE((
  SELECT jsonb_agg(
    CASE WHEN COALESCE(item->>'id', '') LIKE 'legacy-%' THEN
      jsonb_set(jsonb_set(jsonb_set(item, '{enabled}', 'false'::jsonb, true), '{show_homepage}', 'false'::jsonb, true), '{show_footer}', 'false'::jsonb, true)
    ELSE item END ORDER BY ordinality
  ) FROM jsonb_array_elements(COALESCE(social_networks, '[]'::jsonb)) WITH ORDINALITY AS rows(item, ordinality)
), '[]'::jsonb),
mobile_apps = COALESCE((
  SELECT jsonb_agg(
    jsonb_set(jsonb_set(jsonb_set(item, '{enabled}', 'false'::jsonb, true), '{show_homepage}', 'false'::jsonb, true), '{show_footer}', 'false'::jsonb, true)
    ORDER BY ordinality
  ) FROM jsonb_array_elements(COALESCE(mobile_apps, '[]'::jsonb)) WITH ORDINALITY AS rows(item, ordinality)
), '[]'::jsonb),
updated_at = now()
WHERE id = 1;
