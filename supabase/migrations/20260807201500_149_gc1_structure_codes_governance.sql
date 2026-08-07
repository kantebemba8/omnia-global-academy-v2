BEGIN;

-- GC1 — Codes Structure
-- Rattachement contrôlé, quotas atomiques, cycle de vie et audit.

ALTER TABLE public.partner_code_users
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_comment text;

UPDATE public.partner_code_users
SET requested_at = COALESCE(requested_at, created_at, now())
WHERE requested_at IS NULL;

-- Tous les codes Structure ont désormais une capacité explicite.
UPDATE public.partner_codes
SET max_users = 100
WHERE max_users IS NULL OR max_users < 1;

-- Tout rattachement doit être vérifié par la Structure, y compris pour les anciens codes.
UPDATE public.partner_codes
SET requires_manual_validation = true
WHERE requires_manual_validation IS DISTINCT FROM true;

-- used_count reflète les rattachements réellement actifs, et non les demandes en attente.
UPDATE public.partner_codes pc
SET used_count = COALESCE(src.active_count, 0)
FROM (
  SELECT pc2.id AS code_id,
         count(pcu.id) FILTER (
           WHERE lower(COALESCE(pcu.status, '')) IN ('validated','approved','active','actif')
         )::integer AS active_count
  FROM public.partner_codes pc2
  LEFT JOIN public.partner_code_users pcu ON pcu.code_id = pc2.id
  GROUP BY pc2.id
) src
WHERE pc.id = src.code_id;

CREATE INDEX IF NOT EXISTS idx_partner_code_users_org_user_status
  ON public.partner_code_users (organization_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_code_users_code_status
  ON public.partner_code_users (code_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_codes_org_status_created
  ON public.partner_codes (organization_id, status, created_at DESC);

-- Aucun accès client direct : le moteur canonique est structure-manage.
ALTER TABLE public.partner_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_code_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.partner_code_users FROM anon, authenticated;
GRANT ALL ON TABLE public.partner_codes TO service_role;
GRANT ALL ON TABLE public.partner_code_users TO service_role;

-- Création atomique d'une demande de rattachement.
CREATE OR REPLACE FUNCTION public.oga_use_structure_code(
  p_code_value text,
  p_user_id uuid,
  p_pin text DEFAULT NULL,
  p_structure_capacity integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.partner_codes%ROWTYPE;
  v_org_status text;
  v_existing uuid;
  v_active_code integer := 0;
  v_active_org integer := 0;
  v_membership public.partner_code_users%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_code
  FROM public.partner_codes
  WHERE upper(trim(code)) = upper(trim(COALESCE(p_code_value, '')))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;

  -- Verrou Structure : sérialise aussi les quotas lorsqu'il existe plusieurs codes.
  SELECT status INTO v_org_status
  FROM public.partner_organizations
  WHERE id = v_code.organization_id
  FOR UPDATE;

  IF COALESCE(v_org_status, '') <> 'validated' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STRUCTURE_NOT_ACTIVE');
  END IF;

  IF lower(COALESCE(v_code.status, '')) NOT IN ('validated','active','actif') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_NOT_ACTIVE');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_EXPIRED');
  END IF;

  IF NULLIF(trim(COALESCE(v_code.pin, '')), '') IS NOT NULL THEN
    IF NULLIF(trim(COALESCE(p_pin, '')), '') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PIN_REQUIRED');
    END IF;
    IF trim(COALESCE(p_pin, '')) <> trim(v_code.pin) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PIN');
    END IF;
  END IF;

  SELECT id INTO v_existing
  FROM public.partner_code_users
  WHERE organization_id = v_code.organization_id
    AND user_id = p_user_id
    AND lower(COALESCE(status, '')) IN (
      'pending','requested','en_attente','validated','approved','active','actif'
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_LINKED_TO_STRUCTURE');
  END IF;

  SELECT count(*)::integer INTO v_active_code
  FROM public.partner_code_users
  WHERE code_id = v_code.id
    AND lower(COALESCE(status, '')) IN ('validated','approved','active','actif');

  IF COALESCE(v_code.max_users, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_LIMIT_INVALID');
  END IF;

  IF v_active_code >= v_code.max_users THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_QUOTA_REACHED');
  END IF;

  IF p_structure_capacity IS NOT NULL AND p_structure_capacity >= 0 THEN
    SELECT count(*)::integer INTO v_active_org
    FROM public.partner_code_users
    WHERE organization_id = v_code.organization_id
      AND lower(COALESCE(status, '')) IN ('validated','approved','active','actif');

    IF v_active_org >= p_structure_capacity THEN
      RETURN jsonb_build_object('ok', false, 'error', 'STRUCTURE_MEMBER_LIMIT_REACHED');
    END IF;
  END IF;

  INSERT INTO public.partner_code_users (
    code_id,
    user_id,
    organization_id,
    status,
    advantages_remaining,
    expires_at,
    requested_at
  ) VALUES (
    v_code.id,
    p_user_id,
    v_code.organization_id,
    'pending',
    '{}'::jsonb,
    v_code.expires_at,
    now()
  )
  RETURNING * INTO v_membership;

  RETURN jsonb_build_object(
    'ok', true,
    'membership_id', v_membership.id,
    'organization_id', v_code.organization_id,
    'code_id', v_code.id,
    'status', 'pending'
  );
END;
$$;

-- Décision atomique de la Structure sur une demande de rattachement.
CREATE OR REPLACE FUNCTION public.oga_decide_structure_membership(
  p_membership_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_structure_capacity integer DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.partner_code_users%ROWTYPE;
  v_code public.partner_codes%ROWTYPE;
  v_org_status text;
  v_active_code integer := 0;
  v_active_org integer := 0;
  v_decision text := lower(trim(COALESCE(p_decision, '')));
BEGIN
  IF v_decision NOT IN ('approve','reject') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DECISION');
  END IF;

  SELECT status INTO v_org_status
  FROM public.partner_organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STRUCTURE_NOT_FOUND');
  END IF;

  IF v_org_status <> 'validated' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STRUCTURE_NOT_ACTIVE');
  END IF;

  SELECT * INTO v_membership
  FROM public.partner_code_users
  WHERE id = p_membership_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  IF lower(COALESCE(v_membership.status, '')) NOT IN ('pending','requested','en_attente') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_ALREADY_PROCESSED');
  END IF;

  SELECT * INTO v_code
  FROM public.partner_codes
  WHERE id = v_membership.code_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_NOT_FOUND');
  END IF;

  IF v_decision = 'reject' THEN
    UPDATE public.partner_code_users
    SET status = 'rejected',
        rejected_at = now(),
        rejected_by = p_actor_user_id,
        decision_comment = NULLIF(trim(COALESCE(p_comment, '')), '')
    WHERE id = v_membership.id;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'user_id', v_membership.user_id, 'code_id', v_code.id);
  END IF;

  IF lower(COALESCE(v_code.status, '')) NOT IN ('validated','active','actif') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_NOT_ACTIVE');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_EXPIRED');
  END IF;

  SELECT count(*)::integer INTO v_active_code
  FROM public.partner_code_users
  WHERE code_id = v_code.id
    AND lower(COALESCE(status, '')) IN ('validated','approved','active','actif');

  IF COALESCE(v_code.max_users, 0) < 1 OR v_active_code >= v_code.max_users THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_QUOTA_REACHED');
  END IF;

  IF p_structure_capacity IS NOT NULL AND p_structure_capacity >= 0 THEN
    SELECT count(*)::integer INTO v_active_org
    FROM public.partner_code_users
    WHERE organization_id = p_organization_id
      AND lower(COALESCE(status, '')) IN ('validated','approved','active','actif');

    IF v_active_org >= p_structure_capacity THEN
      RETURN jsonb_build_object('ok', false, 'error', 'STRUCTURE_MEMBER_LIMIT_REACHED');
    END IF;
  END IF;

  UPDATE public.partner_code_users
  SET status = 'validated',
      validated_at = now(),
      validated_by = p_actor_user_id,
      decision_comment = NULLIF(trim(COALESCE(p_comment, '')), ''),
      advantages_remaining = '{}'::jsonb
  WHERE id = v_membership.id;

  UPDATE public.partner_codes pc
  SET used_count = (
        SELECT count(*)::integer
        FROM public.partner_code_users pcu
        WHERE pcu.code_id = pc.id
          AND lower(COALESCE(pcu.status, '')) IN ('validated','approved','active','actif')
      ),
      updated_at = now()
  WHERE pc.id = v_code.id;

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'user_id', v_membership.user_id, 'code_id', v_code.id);
END;
$$;

-- Retrait d'un rattachement actif ou annulation d'une demande en attente.
CREATE OR REPLACE FUNCTION public.oga_remove_structure_membership(
  p_membership_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.partner_code_users%ROWTYPE;
BEGIN
  PERFORM 1
  FROM public.partner_organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STRUCTURE_NOT_FOUND');
  END IF;

  SELECT * INTO v_membership
  FROM public.partner_code_users
  WHERE id = p_membership_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  IF lower(COALESCE(v_membership.status, '')) IN ('removed','revoked','expired','inactive','retire') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_ALREADY_REMOVED');
  END IF;

  UPDATE public.partner_code_users
  SET status = 'removed',
      removed_at = now(),
      removed_by = p_actor_user_id,
      decision_comment = NULLIF(trim(COALESCE(p_comment, '')), '')
  WHERE id = v_membership.id;

  IF v_membership.code_id IS NOT NULL THEN
    UPDATE public.partner_codes pc
    SET used_count = (
          SELECT count(*)::integer
          FROM public.partner_code_users pcu
          WHERE pcu.code_id = pc.id
            AND lower(COALESCE(pcu.status, '')) IN ('validated','approved','active','actif')
        ),
        updated_at = now()
    WHERE pc.id = v_membership.code_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'removed', 'user_id', v_membership.user_id, 'code_id', v_membership.code_id);
END;
$$;

REVOKE ALL ON FUNCTION public.oga_use_structure_code(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_decide_structure_membership(uuid, uuid, uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_remove_structure_membership(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_use_structure_code(text, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_decide_structure_membership(uuid, uuid, uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_remove_structure_membership(uuid, uuid, uuid, text) TO service_role;

COMMIT;
