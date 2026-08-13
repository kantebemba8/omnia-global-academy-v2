-- OGA Stage 2 — Coach OGA, offres externes et formations externes payantes
-- Référence reconstruite : 1329 + Stage 1 V3 / migration 158.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Invitations Coach OGA + codes de rattachement pour comptes existants
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_access_invitations
  DROP CONSTRAINT IF EXISTS platform_access_invitations_invitation_type_check;

ALTER TABLE public.platform_access_invitations
  ADD CONSTRAINT platform_access_invitations_invitation_type_check
  CHECK (invitation_type IN ('moderator','structure_team','structure_recruiter','coach_oga'));

CREATE TABLE IF NOT EXISTS public.coach_oga_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','used','revoked','expired')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_oga_link_codes_target_status
  ON public.coach_oga_link_codes(target_user_id, status, expires_at DESC);

ALTER TABLE public.coach_oga_link_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coach_oga_link_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.coach_oga_link_codes TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Offres d'emploi externes : coordonnées pratiques complètes
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS recruiter_phone varchar(80),
  ADD COLUMN IF NOT EXISTS recruiter_address text;

-- ---------------------------------------------------------------------------
-- 3. Formations externes : inscription, contacts, paiement et délivrance
-- ---------------------------------------------------------------------------
ALTER TABLE public.external_courses
  DROP CONSTRAINT IF EXISTS external_courses_access_mode_check;

ALTER TABLE public.external_courses
  ADD CONSTRAINT external_courses_access_mode_check
  CHECK (access_mode IN ('public','registered','premium','paid'));

ALTER TABLE public.external_courses
  ADD COLUMN IF NOT EXISTS registration_deadline date,
  ADD COLUMN IF NOT EXISTS registration_url text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email varchar(320),
  ADD COLUMN IF NOT EXISTS contact_phone varchar(80),
  ADD COLUMN IF NOT EXISTS contact_address text,
  ADD COLUMN IF NOT EXISTS price_xof integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_methods text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS private_access_url text,
  ADD COLUMN IF NOT EXISTS access_code_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS provider_access_code text;

ALTER TABLE public.external_courses
  DROP CONSTRAINT IF EXISTS external_courses_price_xof_check,
  DROP CONSTRAINT IF EXISTS external_courses_delivery_methods_check,
  DROP CONSTRAINT IF EXISTS external_courses_access_code_mode_check;

ALTER TABLE public.external_courses
  ADD CONSTRAINT external_courses_price_xof_check CHECK (price_xof >= 0),
  ADD CONSTRAINT external_courses_delivery_methods_check
    CHECK (delivery_methods <@ ARRAY['private_link','access_code','manual_registration']::text[]),
  ADD CONSTRAINT external_courses_access_code_mode_check
    CHECK (access_code_mode IN ('none','provider','personal'));

CREATE TABLE IF NOT EXISTS public.external_course_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  external_course_id uuid NOT NULL REFERENCES public.external_courses(id) ON DELETE RESTRICT,
  amount_xof integer NOT NULL CHECK (amount_xof > 0),
  currency varchar(3) NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','completed','failed','cancelled','refunded')),
  payment_gateway text NOT NULL DEFAULT 'fedapay',
  provider_transaction_id text,
  gateway_reference text,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_course_orders_provider_transaction
  ON public.external_course_orders(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_course_orders_user_course
  ON public.external_course_orders(user_id, external_course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_course_orders_status
  ON public.external_course_orders(payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_course_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  external_course_id uuid NOT NULL REFERENCES public.external_courses(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.external_course_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'registration_in_progress'
    CHECK (status IN ('registration_in_progress','access_ready','revoked')),
  delivery_methods text[] NOT NULL DEFAULT '{}'::text[],
  private_access_url text,
  access_code text,
  admin_note text,
  ready_at timestamptz,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, external_course_id)
);

CREATE INDEX IF NOT EXISTS idx_external_course_access_grants_course_status
  ON public.external_course_access_grants(external_course_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_course_access_grants_user
  ON public.external_course_access_grants(user_id, created_at DESC);

ALTER TABLE public.external_course_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_course_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_course_orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.external_course_access_grants FROM anon, authenticated;
GRANT ALL ON TABLE public.external_course_orders TO service_role;
GRANT ALL ON TABLE public.external_course_access_grants TO service_role;

-- Règlement idempotent d'une commande externe après validation FedaPay.
CREATE OR REPLACE FUNCTION public.settle_external_course_order(
  p_order_id uuid,
  p_transaction_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.external_course_orders%ROWTYPE;
  v_course public.external_courses%ROWTYPE;
  v_grant_id uuid;
  v_status text;
  v_code text;
BEGIN
  SELECT * INTO v_order
  FROM public.external_course_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXTERNAL_COURSE_ORDER_NOT_FOUND';
  END IF;

  SELECT * INTO v_course
  FROM public.external_courses
  WHERE id = v_order.external_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXTERNAL_COURSE_NOT_FOUND';
  END IF;

  IF v_order.payment_status <> 'completed' THEN
    UPDATE public.external_course_orders
    SET payment_status = 'completed',
        provider_transaction_id = COALESCE(NULLIF(p_transaction_id, ''), provider_transaction_id),
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE id = v_order.id;
  END IF;

  v_code := CASE
    WHEN v_course.access_code_mode = 'provider' THEN v_course.provider_access_code
    ELSE NULL
  END;

  v_status := CASE
    WHEN 'manual_registration' = ANY(COALESCE(v_course.delivery_methods, '{}'::text[])) THEN 'registration_in_progress'
    WHEN v_course.access_code_mode = 'personal' THEN 'registration_in_progress'
    ELSE 'access_ready'
  END;

  INSERT INTO public.external_course_access_grants(
    user_id,
    external_course_id,
    order_id,
    status,
    delivery_methods,
    private_access_url,
    access_code,
    ready_at,
    updated_at
  )
  VALUES (
    v_order.user_id,
    v_order.external_course_id,
    v_order.id,
    v_status,
    COALESCE(v_course.delivery_methods, '{}'::text[]),
    CASE WHEN 'private_link' = ANY(COALESCE(v_course.delivery_methods, '{}'::text[])) THEN v_course.private_access_url ELSE NULL END,
    v_code,
    CASE WHEN v_status = 'access_ready' THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id, external_course_id)
  DO UPDATE SET
    order_id = EXCLUDED.order_id,
    status = CASE
      WHEN public.external_course_access_grants.status = 'revoked' THEN EXCLUDED.status
      ELSE public.external_course_access_grants.status
    END,
    delivery_methods = EXCLUDED.delivery_methods,
    private_access_url = COALESCE(public.external_course_access_grants.private_access_url, EXCLUDED.private_access_url),
    access_code = COALESCE(public.external_course_access_grants.access_code, EXCLUDED.access_code),
    ready_at = CASE
      WHEN public.external_course_access_grants.status = 'access_ready' THEN public.external_course_access_grants.ready_at
      WHEN EXCLUDED.status = 'access_ready' THEN now()
      ELSE NULL
    END,
    updated_at = now()
  RETURNING id INTO v_grant_id;

  RETURN v_grant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_external_course_order(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_external_course_order(uuid, text) TO service_role;

COMMIT;
