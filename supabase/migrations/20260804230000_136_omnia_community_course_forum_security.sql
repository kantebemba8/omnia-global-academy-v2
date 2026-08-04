-- 136 — Omnia Communauté : sécurité des forums de formation et compteurs atomiques
BEGIN;

-- Centraliser l'autorisation des forums de formation pour les rares accès
-- directs effectués avec un JWT Supabase. Les Edge Functions utilisent la
-- clé service_role et appliquent en plus la session personnalisée Omnia.
CREATE OR REPLACE FUNCTION public.can_access_course_forum(target_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND target_course_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_enrollments enrollment
        WHERE enrollment.user_id = auth.uid()
          AND enrollment.course_id = target_course_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.courses course
        WHERE course.id = target_course_id
          AND (course.creator_id = auth.uid() OR course.instructor_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles user_role
        WHERE user_role.user_id = auth.uid()
          AND user_role.role = 'super_admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles user_role
        JOIN public.moderator_permissions moderator_permission
          ON moderator_permission.moderator_user_id = user_role.user_id
        WHERE user_role.user_id = auth.uid()
          AND user_role.role = 'moderateur'
          AND (
            moderator_permission.can_moderate_forum = true
            OR moderator_permission.permissions @> '{"can_moderate_forum": true}'::jsonb
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_course_forum(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_course_forum(uuid) TO authenticated, service_role;

-- Les discussions générales et carrière restent consultables publiquement.
-- Les forums de formation ne sont visibles directement que par un utilisateur
-- Supabase authentifié et autorisé. Le frontend principal passe par
-- forum-manage, qui vérifie la session personnalisée Omnia côté serveur.
DROP POLICY IF EXISTS "forum_public_select" ON public.forum_posts;
DROP POLICY IF EXISTS "forum_course_authorized_select" ON public.forum_posts;

CREATE POLICY "forum_public_select"
ON public.forum_posts
FOR SELECT
TO anon, authenticated
USING (
  is_visible = true
  AND space IN ('general', 'carriere')
);

CREATE POLICY "forum_course_authorized_select"
ON public.forum_posts
FOR SELECT
TO authenticated
USING (
  is_visible = true
  AND space = 'cours'
  AND course_id IS NOT NULL
  AND public.can_access_course_forum(course_id)
);

-- Renforcer aussi les écritures directes afin qu'un compte Supabase ne puisse
-- pas contourner l'Edge Function pour publier dans une formation inaccessible.
DROP POLICY IF EXISTS "forum_insert" ON public.forum_posts;
DROP POLICY IF EXISTS "forum_update" ON public.forum_posts;
DROP POLICY IF EXISTS "forum_delete" ON public.forum_posts;

CREATE POLICY "forum_insert"
ON public.forum_posts
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    space IN ('general', 'carriere')
    OR (
      space = 'cours'
      AND course_id IS NOT NULL
      AND public.can_access_course_forum(course_id)
    )
  )
);

CREATE POLICY "forum_update"
ON public.forum_posts
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    space IN ('general', 'carriere')
    OR (
      space = 'cours'
      AND course_id IS NOT NULL
      AND public.can_access_course_forum(course_id)
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    space IN ('general', 'carriere')
    OR (
      space = 'cours'
      AND course_id IS NOT NULL
      AND public.can_access_course_forum(course_id)
    )
  )
);

CREATE POLICY "forum_delete"
ON public.forum_posts
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    space IN ('general', 'carriere')
    OR (
      space = 'cours'
      AND course_id IS NOT NULL
      AND public.can_access_course_forum(course_id)
    )
  )
);

CREATE OR REPLACE FUNCTION public.increment_replies_count(target_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.forum_posts
  SET replies_count = COALESCE(replies_count, 0) + 1
  WHERE id = target_post_id
  RETURNING replies_count INTO updated_count;

  RETURN COALESCE(updated_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_replies_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_replies_count(uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_forum_posts_public_space_country_created
  ON public.forum_posts(space, country_code, created_at DESC)
  WHERE is_visible = true AND parent_id IS NULL AND space IN ('general', 'carriere');

CREATE INDEX IF NOT EXISTS idx_forum_posts_course_created
  ON public.forum_posts(course_id, created_at DESC)
  WHERE is_visible = true AND parent_id IS NULL AND space = 'cours';

CREATE INDEX IF NOT EXISTS idx_forum_posts_parent_created
  ON public.forum_posts(parent_id, created_at ASC)
  WHERE is_visible = true AND parent_id IS NOT NULL;

-- Harmoniser aussi les libellés déjà enregistrés par le CMS sans modifier les
-- routes techniques /forum, afin de préserver tous les liens existants.
UPDATE public.site_settings
SET value = replace(
  replace(value::text, '"Omnia Forum"', '"Omnia Communauté"'),
  '"Forum"', '"Omnia Communauté"'
)::jsonb,
updated_at = now()
WHERE key IN ('landing_page_published', 'landing_page_draft', 'landing_page_previous_published')
  AND value IS NOT NULL;

UPDATE public.landing_page_cms_state
SET draft = replace(
      replace(draft::text, '"Omnia Forum"', '"Omnia Communauté"'),
      '"Forum"', '"Omnia Communauté"'
    )::jsonb,
    previous_published = CASE
      WHEN previous_published IS NULL THEN NULL
      ELSE replace(
        replace(previous_published::text, '"Omnia Forum"', '"Omnia Communauté"'),
        '"Forum"', '"Omnia Communauté"'
      )::jsonb
    END,
    updated_at = now()
WHERE id = 1;

COMMIT;
