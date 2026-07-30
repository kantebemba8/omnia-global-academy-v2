-- Cycle 6 — Lot 2A
-- Sécurisation FedaPay, idempotence des effets de paiement et règlement atomique.
BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'fedapay',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_transaction_id text,
  provider_reference text,
  resource_type text,
  resource_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processing','processed','ignored','failed')),
  processing_attempts integer NOT NULL DEFAULT 1,
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_status
  ON public.payment_webhook_events(processing_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_transaction
  ON public.payment_webhook_events(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.payment_order_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  effect_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, effect_key)
);

ALTER TABLE public.payment_order_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_order_effects FROM anon, authenticated;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_transactions_idempotency
  ON public.wallet_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.oga_setting_numeric(
  p_key text,
  p_default numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_text text;
BEGIN
  SELECT trim(both '"' from value::text)
  INTO v_text
  FROM public.site_settings
  WHERE key = p_key
  LIMIT 1;

  IF v_text IS NULL OR v_text !~ '^-?[0-9]+([.][0-9]+)?$' THEN
    RETURN p_default;
  END IF;

  RETURN v_text::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_credit_wallet_once(
  p_user_id uuid,
  p_amount_xof integer,
  p_type text,
  p_description text,
  p_reference_id text,
  p_order_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet_id uuid;
  v_transaction_id uuid;
  v_key text;
BEGIN
  IF p_user_id IS NULL OR COALESCE(p_amount_xof, 0) <= 0 THEN
    RETURN false;
  END IF;

  v_key := COALESCE(NULLIF(p_idempotency_key, ''), p_type || ':' || COALESCE(p_reference_id, p_order_id::text));

  INSERT INTO public.wallets(user_id, balance_xof, total_earned_xof, total_withdrawn_xof, updated_at)
  VALUES (p_user_id, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, amount_xof, description, order_id, reference_id, idempotency_key
  ) VALUES (
    v_wallet_id, p_user_id, p_type, p_amount_xof, p_description, p_order_id, p_reference_id, v_key
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.wallets
  SET balance_xof = COALESCE(balance_xof, 0) + p_amount_xof,
      total_earned_xof = COALESCE(total_earned_xof, 0) + p_amount_xof,
      updated_at = now()
  WHERE id = v_wallet_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_settle_course_order(
  p_order_id uuid,
  p_provider_transaction_id text,
  p_provider_reference text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_course record;
  v_license record;
  v_enrollment_id uuid;
  v_usage_id uuid;
  v_coupon_usage_id uuid;
  v_effect_id uuid;
  v_referral record;
  v_completed_count integer := 0;
  v_final integer := 0;
  v_platform_percent numeric := 0;
  v_professor_percent numeric := 0;
  v_fixed_fee integer := 0;
  v_platform_share integer := 0;
  v_professor_share integer := 0;
  v_referrer_reward integer := 0;
  v_referred_reward integer := 0;
  v_ai_tokens integer := 0;
  v_was_completed boolean := false;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  v_was_completed := v_order.payment_status = 'completed';
  v_final := COALESCE(v_order.final_price_xof, 0);

  SELECT * INTO v_course
  FROM public.courses
  WHERE id = v_order.course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  UPDATE public.orders
  SET payment_status = 'completed',
      fedapay_transaction_id = COALESCE(NULLIF(p_provider_transaction_id, ''), fedapay_transaction_id),
      gateway_reference = COALESCE(NULLIF(p_provider_reference, ''), gateway_reference),
      paid_at = COALESCE(paid_at, now())
  WHERE id = v_order.id;

  INSERT INTO public.user_enrollments(user_id, course_id, enrolled_at)
  VALUES (v_order.user_id, v_order.course_id, now())
  ON CONFLICT (user_id, course_id) DO NOTHING
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NOT NULL THEN
    UPDATE public.courses
    SET total_students = COALESCE(total_students, 0) + 1
    WHERE id = v_order.course_id;
  END IF;

  IF v_order.license_id IS NOT NULL THEN
    SELECT * INTO v_license
    FROM public.group_licenses
    WHERE id = v_order.license_id
    FOR UPDATE;

    IF NOT FOUND OR NOT COALESCE(v_license.is_active, false) OR
       (v_license.expires_at IS NOT NULL AND v_license.expires_at < now()) THEN
      RAISE EXCEPTION 'LICENSE_INVALID';
    END IF;

    INSERT INTO public.license_usages(license_id, user_id, used_at)
    VALUES (v_order.license_id, v_order.user_id, now())
    ON CONFLICT (license_id, user_id) DO NOTHING
    RETURNING id INTO v_usage_id;

    IF v_usage_id IS NOT NULL THEN
      IF COALESCE(v_license.used_seats, 0) >= COALESCE(v_license.max_seats, 0) THEN
        RAISE EXCEPTION 'LICENSE_FULL';
      END IF;
      UPDATE public.group_licenses
      SET used_seats = COALESCE(used_seats, 0) + 1
      WHERE id = v_order.license_id;
    END IF;
  END IF;

  IF COALESCE(to_jsonb(v_course)->>'creator_type', 'professeur') = 'professeur' THEN
    SELECT rule.platform_percent, rule.fixed_fee_xof
    INTO v_platform_percent, v_fixed_fee
    FROM public.commerce_commission_rules rule
    WHERE rule.module_key IN ('courses', 'global')
      AND rule.status = 'active'
      AND rule.valid_from <= now()
      AND (rule.valid_until IS NULL OR rule.valid_until >= now())
      AND (rule.creator_user_id IS NULL OR rule.creator_user_id = v_course.creator_id)
      AND (rule.offer_type IS NULL OR rule.offer_type = 'course_sale')
      AND v_final >= COALESCE(rule.minimum_amount_xof, 0)
    ORDER BY CASE WHEN rule.module_key = 'courses' THEN 0 ELSE 1 END,
             rule.priority ASC
    LIMIT 1;

    IF v_platform_percent IS NULL THEN
      IF COALESCE(v_course.cpd_accredited, false) AND COALESCE(v_course.is_assisted, false) THEN
        v_professor_percent := public.oga_setting_numeric('commission_cpd_assiste_prof', 60);
      ELSIF COALESCE(v_course.cpd_accredited, false) THEN
        v_professor_percent := public.oga_setting_numeric('commission_avec_cpd_prof', 65);
      ELSIF COALESCE(v_course.is_assisted, false) THEN
        v_professor_percent := public.oga_setting_numeric('commission_assiste_prof', 55);
      ELSE
        v_professor_percent := public.oga_setting_numeric('commission_sans_cpd_prof', 70);
      END IF;
      v_platform_percent := 100 - v_professor_percent;
      v_fixed_fee := 0;
    END IF;

    v_platform_share := LEAST(v_final, ROUND(v_final * v_platform_percent / 100.0)::integer + COALESCE(v_fixed_fee, 0));
    v_professor_share := GREATEST(0, v_final - v_platform_share);
    v_professor_percent := CASE WHEN v_final > 0 THEN ROUND(v_professor_share * 100.0 / v_final) ELSE 0 END;
    v_platform_percent := CASE WHEN v_final > 0 THEN 100 - v_professor_percent ELSE 0 END;

    UPDATE public.orders
    SET professor_share_xof = v_professor_share,
        platform_share_xof = v_platform_share,
        professor_percent = v_professor_percent::integer,
        platform_percent = v_platform_percent::integer
    WHERE id = v_order.id;

    IF v_course.creator_id IS NOT NULL AND v_professor_share > 0 THEN
      PERFORM public.oga_credit_wallet_once(
        v_course.creator_id,
        v_professor_share,
        'credit_sale',
        'Vente — commande ' || v_order.order_number,
        v_order.id::text,
        v_order.id,
        'course-sale:' || v_order.id::text
      );
    END IF;
  END IF;

  IF v_order.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_usages(coupon_id, user_id, order_id, discount_applied_xof, used_at)
    VALUES (v_order.coupon_id, v_order.user_id, v_order.id, COALESCE(v_order.discount_xof, 0), now())
    ON CONFLICT (coupon_id, user_id) DO NOTHING
    RETURNING id INTO v_coupon_usage_id;

    IF v_coupon_usage_id IS NOT NULL THEN
      UPDATE public.coupons
      SET used_count = COALESCE(used_count, 0) + 1
      WHERE id = v_order.coupon_id;
    END IF;
  END IF;

  SELECT count(*)::integer INTO v_completed_count
  FROM public.orders
  WHERE user_id = v_order.user_id
    AND payment_status = 'completed';

  IF v_completed_count = 1 THEN
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE referred_id = v_order.user_id
      AND status = 'pending'
    FOR UPDATE;

    IF FOUND THEN
      v_referrer_reward := public.oga_setting_numeric('referral_reward_referrer_xof', 2500)::integer;
      v_referred_reward := public.oga_setting_numeric('referral_reward_referred_xof', 1000)::integer;

      UPDATE public.referrals
      SET status = 'rewarded',
          reward_referrer_xof = v_referrer_reward,
          reward_referred_xof = v_referred_reward,
          rewarded_at = now()
      WHERE id = v_referral.id
        AND status = 'pending';

      PERFORM public.oga_credit_wallet_once(
        v_referral.referrer_id, v_referrer_reward, 'credit_referral',
        'Bonus parrainage — premier achat du filleul', v_referral.id::text, v_order.id,
        'referral-referrer:' || v_referral.id::text
      );

      PERFORM public.oga_credit_wallet_once(
        v_order.user_id, v_referred_reward, 'credit_referral',
        'Bonus parrainage — bienvenue filleul', v_referral.id::text, v_order.id,
        'referral-referred:' || v_referral.id::text
      );
    END IF;
  END IF;

  v_ai_tokens := public.oga_setting_numeric('ai_token_per_purchase', 1)::integer;
  IF v_ai_tokens > 0 THEN
    INSERT INTO public.payment_order_effects(order_id, effect_key, metadata)
    VALUES (v_order.id, 'ai_tokens', jsonb_build_object('tokens', v_ai_tokens))
    ON CONFLICT (order_id, effect_key) DO NOTHING
    RETURNING id INTO v_effect_id;

    IF v_effect_id IS NOT NULL THEN
      UPDATE public.users
      SET ai_tokens = COALESCE(ai_tokens, 0) + v_ai_tokens
      WHERE id = v_order.user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'already_completed', v_was_completed,
    'enrollment_created', v_enrollment_id IS NOT NULL,
    'professor_user_id', v_course.creator_id,
    'professor_share_xof', v_professor_share,
    'platform_share_xof', v_platform_share
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_credit_cv_tokens_once(
  p_order_id uuid,
  p_user_id uuid,
  p_tokens integer,
  p_provider_transaction_id text,
  p_provider_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect_id uuid;
  v_was_completed boolean;
BEGIN
  SELECT payment_status = 'completed' INTO v_was_completed
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  UPDATE public.orders
  SET payment_status = 'completed',
      fedapay_transaction_id = COALESCE(NULLIF(p_provider_transaction_id, ''), fedapay_transaction_id),
      gateway_reference = COALESCE(NULLIF(p_provider_reference, ''), gateway_reference),
      paid_at = COALESCE(paid_at, now())
  WHERE id = p_order_id;

  IF COALESCE(p_tokens, 0) > 0 THEN
    INSERT INTO public.payment_order_effects(order_id, effect_key, metadata)
    VALUES (p_order_id, 'cv_tokens', jsonb_build_object('tokens', p_tokens))
    ON CONFLICT (order_id, effect_key) DO NOTHING
    RETURNING id INTO v_effect_id;

    IF v_effect_id IS NOT NULL THEN
      UPDATE public.users
      SET cv_tokens = COALESCE(cv_tokens, 0) + p_tokens
      WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'already_completed', COALESCE(v_was_completed, false),
    'tokens_credited', v_effect_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.oga_setting_numeric(text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_credit_wallet_once(uuid, integer, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_settle_course_order(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_credit_cv_tokens_once(uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.oga_setting_numeric(text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_credit_wallet_once(uuid, integer, text, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_settle_course_order(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_credit_cv_tokens_once(uuid, uuid, integer, text, text) TO service_role;

COMMIT;
