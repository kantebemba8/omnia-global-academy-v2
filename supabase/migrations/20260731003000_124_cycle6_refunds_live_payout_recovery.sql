-- Cycle 6 — Lot 2C
-- Remboursements atomiques, reprise des gains Coaching et retraits Omnia Live réservés.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Débit idempotent d'un portefeuille après remboursement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oga_debit_wallet_once(
  p_user_id uuid,
  p_amount_xof integer,
  p_type text,
  p_description text,
  p_reference_id text,
  p_order_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_source_id text DEFAULT NULL
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

  v_key := COALESCE(
    NULLIF(trim(p_idempotency_key), ''),
    p_type || ':' || COALESCE(NULLIF(trim(p_reference_id), ''), p_order_id::text)
  );

  INSERT INTO public.wallets(user_id, balance_xof, total_earned_xof, total_withdrawn_xof, reserved_xof, updated_at)
  VALUES (p_user_id, 0, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, amount_xof, description, order_id, reference_id,
    source_type, source_id, idempotency_key
  ) VALUES (
    v_wallet_id, p_user_id, p_type, p_amount_xof, p_description, p_order_id,
    p_reference_id, p_source_type, p_source_id, v_key
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    RETURN false;
  END IF;

  -- Un remboursement peut créer temporairement un solde négatif. Cela bloque
  -- naturellement tout nouveau retrait jusqu'à compensation par des gains futurs.
  UPDATE public.wallets
  SET balance_xof = COALESCE(balance_xof, 0) - p_amount_xof,
      updated_at = now()
  WHERE id = v_wallet_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.oga_debit_wallet_once(uuid, integer, text, text, text, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_debit_wallet_once(uuid, integer, text, text, text, uuid, text, text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Coaching : reprise proportionnelle des gains lors d'un remboursement
-- ---------------------------------------------------------------------------
ALTER TABLE public.coaching_advanced_earnings
  ADD COLUMN IF NOT EXISTS refunded_gross_xof integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_net_xof integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coaching_earnings_order
  ON public.coaching_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_coaching_advanced_earnings_order
  ON public.coaching_advanced_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_coaching_refunds_order_status
  ON public.coaching_refund_requests(order_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coaching_refund_provider_reference
  ON public.coaching_refund_requests(provider_refund_reference)
  WHERE provider_refund_reference IS NOT NULL
    AND btrim(provider_refund_reference) <> '';

CREATE OR REPLACE FUNCTION public.coaching_process_refund(
  p_refund_id uuid,
  p_admin_id uuid,
  p_provider_refund_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.coaching_refund_requests%ROWTYPE;
  v_order public.coaching_payment_orders%ROWTYPE;
  v_earning public.coaching_earnings%ROWTYPE;
  v_advanced public.coaching_advanced_earnings%ROWTYPE;
  v_amount integer;
  v_prior_processed integer := 0;
  v_total_refunded integer := 0;
  v_full boolean := false;
  v_remaining_gross integer := 0;
  v_remaining_net integer := 0;
  v_delta_gross integer := 0;
  v_delta_net integer := 0;
  v_wallet_recovered integer := 0;
  v_reference text;
  v_now timestamptz := now();
  v_debited boolean := false;
BEGIN
  IF p_refund_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PARAMS';
  END IF;

  v_reference := NULLIF(trim(COALESCE(p_provider_refund_reference, '')), '');
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_REFERENCE_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('coaching_refund:' || p_refund_id::text));

  SELECT * INTO v_refund
  FROM public.coaching_refund_requests
  WHERE id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN
    RAISE EXCEPTION 'REFUND_NOT_FOUND';
  END IF;

  IF v_refund.status = 'processed' THEN
    IF v_refund.provider_refund_reference IS DISTINCT FROM v_reference THEN
      RAISE EXCEPTION 'REFUND_ALREADY_PROCESSED';
    END IF;
    RETURN jsonb_build_object(
      'refund', to_jsonb(v_refund),
      'already_processed', true,
      'wallet_recovered_xof', 0
    );
  END IF;

  IF v_refund.status NOT IN ('approved', 'partially_approved') THEN
    RAISE EXCEPTION 'REFUND_NOT_APPROVED';
  END IF;

  SELECT * INTO v_order
  FROM public.coaching_payment_orders
  WHERE id = v_refund.order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'COACHING_ORDER_NOT_FOUND';
  END IF;

  v_amount := COALESCE(v_refund.approved_amount_xof, 0);
  IF v_amount <= 0 OR v_amount > COALESCE(v_order.amount_xof, 0) THEN
    RAISE EXCEPTION 'INVALID_REFUND_AMOUNT';
  END IF;

  SELECT COALESCE(SUM(COALESCE(approved_amount_xof, 0)), 0)::integer
  INTO v_prior_processed
  FROM public.coaching_refund_requests
  WHERE order_id = v_refund.order_id
    AND id <> v_refund.id
    AND status = 'processed';

  IF v_prior_processed + v_amount > COALESCE(v_order.amount_xof, 0) THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_ORDER_AMOUNT';
  END IF;

  v_total_refunded := v_prior_processed + v_amount;
  v_full := v_total_refunded >= COALESCE(v_order.amount_xof, 0);

  IF COALESCE(v_order.product_type, 'session') = 'session' OR v_order.session_id IS NOT NULL THEN
    SELECT * INTO v_earning
    FROM public.coaching_earnings
    WHERE order_id = v_order.id
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF v_earning.id IS NOT NULL THEN
      v_remaining_gross := GREATEST(0, COALESCE(v_earning.gross_amount_xof, 0) - COALESCE(v_earning.refunded_gross_xof, 0));
      v_remaining_net := GREATEST(0, COALESCE(v_earning.net_amount_xof, 0) - COALESCE(v_earning.refunded_net_xof, 0));
      v_delta_gross := LEAST(v_amount, v_remaining_gross);

      IF v_delta_gross >= v_remaining_gross THEN
        v_delta_net := v_remaining_net;
      ELSIF COALESCE(v_earning.gross_amount_xof, 0) > 0 THEN
        v_delta_net := LEAST(
          v_remaining_net,
          ROUND(v_delta_gross::numeric * COALESCE(v_earning.net_amount_xof, 0)::numeric /
                v_earning.gross_amount_xof::numeric)::integer
        );
      ELSE
        v_delta_net := 0;
      END IF;

      IF v_delta_net > 0
         AND (v_earning.credited_at IS NOT NULL OR v_earning.wallet_transaction_id IS NOT NULL OR v_earning.status = 'available') THEN
        SELECT public.oga_debit_wallet_once(
          v_earning.coach_user_id,
          v_delta_net,
          'debit_coaching_refund',
          'Reprise de gain après remboursement Coaching',
          'coaching_refund:' || v_refund.id::text,
          v_order.id,
          'coaching:refund:' || v_refund.id::text || ':earning:' || v_earning.id::text,
          'coaching_refund',
          v_refund.id::text
        ) INTO v_debited;

        IF v_debited THEN
          v_wallet_recovered := v_wallet_recovered + v_delta_net;
        END IF;
      END IF;

      UPDATE public.coaching_earnings
      SET refunded_gross_xof = LEAST(gross_amount_xof, COALESCE(refunded_gross_xof, 0) + v_delta_gross),
          refunded_net_xof = LEAST(net_amount_xof, COALESCE(refunded_net_xof, 0) + v_delta_net),
          updated_at = v_now
      WHERE id = v_earning.id;
    END IF;
  ELSE
    SELECT * INTO v_advanced
    FROM public.coaching_advanced_earnings
    WHERE order_id = v_order.id
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF v_advanced.id IS NOT NULL THEN
      v_remaining_gross := GREATEST(0, COALESCE(v_advanced.gross_amount_xof, 0) - COALESCE(v_advanced.refunded_gross_xof, 0));
      v_remaining_net := GREATEST(0, COALESCE(v_advanced.net_amount_xof, 0) - COALESCE(v_advanced.refunded_net_xof, 0));
      v_delta_gross := LEAST(v_amount, v_remaining_gross);

      IF v_delta_gross >= v_remaining_gross THEN
        v_delta_net := v_remaining_net;
      ELSIF COALESCE(v_advanced.gross_amount_xof, 0) > 0 THEN
        v_delta_net := LEAST(
          v_remaining_net,
          ROUND(v_delta_gross::numeric * COALESCE(v_advanced.net_amount_xof, 0)::numeric /
                v_advanced.gross_amount_xof::numeric)::integer
        );
      ELSE
        v_delta_net := 0;
      END IF;

      IF v_delta_net > 0
         AND (v_advanced.credited_at IS NOT NULL OR v_advanced.wallet_transaction_id IS NOT NULL OR v_advanced.status = 'available') THEN
        SELECT public.oga_debit_wallet_once(
          v_advanced.coach_user_id,
          v_delta_net,
          'debit_coaching_advanced_refund',
          'Reprise de gain après remboursement d’un produit Coaching',
          'coaching_refund:' || v_refund.id::text,
          v_order.id,
          'coaching:refund:' || v_refund.id::text || ':advanced:' || v_advanced.id::text,
          'coaching_refund',
          v_refund.id::text
        ) INTO v_debited;

        IF v_debited THEN
          v_wallet_recovered := v_wallet_recovered + v_delta_net;
        END IF;
      END IF;

      UPDATE public.coaching_advanced_earnings
      SET refunded_gross_xof = LEAST(gross_amount_xof, COALESCE(refunded_gross_xof, 0) + v_delta_gross),
          refunded_net_xof = LEAST(net_amount_xof, COALESCE(refunded_net_xof, 0) + v_delta_net),
          updated_at = v_now
      WHERE id = v_advanced.id;
    END IF;
  END IF;

  UPDATE public.coaching_refund_requests
  SET status = 'processed',
      provider_refund_reference = v_reference,
      processed_at = v_now,
      decided_by = COALESCE(decided_by, p_admin_id),
      decided_at = COALESCE(decided_at, v_now),
      updated_at = v_now
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  UPDATE public.coaching_payment_orders
  SET payment_status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
      updated_at = v_now
  WHERE id = v_order.id;

  IF v_order.session_id IS NOT NULL THEN
    UPDATE public.coaching_sessions
    SET payment_status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
        status = CASE
          WHEN v_full AND status IN ('confirmed', 'ready', 'pending_payment', 'payment_pending') THEN 'refunded'
          WHEN NOT v_full AND status IN ('confirmed', 'ready') THEN 'partially_refunded'
          ELSE status
        END,
        updated_at = v_now
    WHERE id = v_order.session_id;
  END IF;

  RETURN jsonb_build_object(
    'refund', to_jsonb(v_refund),
    'already_processed', false,
    'full_refund', v_full,
    'total_refunded_xof', v_total_refunded,
    'wallet_recovered_xof', v_wallet_recovered
  );
END;
$$;

REVOKE ALL ON FUNCTION public.coaching_process_refund(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coaching_process_refund(uuid, uuid, text)
  TO service_role;

-- Les fonctions de libération tiennent explicitement compte des remboursements.
CREATE OR REPLACE FUNCTION public.coaching_release_eligible_earnings()
RETURNS TABLE(
  earning_id uuid,
  coach_user_id uuid,
  session_id uuid,
  amount_xof integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.coaching_earnings%ROWTYPE;
  v_amount integer;
  v_wallet public.wallets%ROWTYPE;
  v_transaction_id uuid;
  v_key text;
  v_refunded_gross integer;
  v_refunded_net integer;
BEGIN
  FOR v_row IN
    SELECT e.*
    FROM public.coaching_earnings e
    WHERE e.status = 'locked'
      AND COALESCE(e.unlock_at, now()) <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.coaching_refund_requests r
        WHERE r.order_id = e.order_id
          AND r.status IN ('pending', 'under_review', 'approved', 'partially_approved')
      )
    ORDER BY e.unlock_at NULLS FIRST, e.created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT LEAST(
      COALESCE(v_row.gross_amount_xof, 0),
      COALESCE(SUM(COALESCE(r.approved_amount_xof, 0)), 0)::integer
    )
    INTO v_refunded_gross
    FROM public.coaching_refund_requests r
    WHERE r.order_id = v_row.order_id
      AND r.status = 'processed';

    v_refunded_gross := GREATEST(COALESCE(v_row.refunded_gross_xof, 0), COALESCE(v_refunded_gross, 0));
    v_refunded_net := CASE
      WHEN v_refunded_gross >= COALESCE(v_row.gross_amount_xof, 0) THEN COALESCE(v_row.net_amount_xof, 0)
      WHEN COALESCE(v_row.gross_amount_xof, 0) > 0 THEN
        ROUND(v_refunded_gross::numeric * COALESCE(v_row.net_amount_xof, 0)::numeric /
              v_row.gross_amount_xof::numeric)::integer
      ELSE 0
    END;
    v_refunded_net := GREATEST(COALESCE(v_row.refunded_net_xof, 0), v_refunded_net);
    v_amount := GREATEST(0, COALESCE(v_row.net_amount_xof, 0) - v_refunded_net);
    v_key := 'coaching:earning:released:' || v_row.id::text;

    IF v_amount > 0 THEN
      PERFORM public.oga_credit_wallet_once(
        v_row.coach_user_id,
        v_amount,
        'credit_coaching_session',
        'Gain Coaching disponible',
        'coaching_earning:' || v_row.id::text,
        v_row.order_id,
        v_key
      );

      SELECT * INTO v_wallet
      FROM public.wallets
      WHERE user_id = v_row.coach_user_id;

      SELECT id INTO v_transaction_id
      FROM public.wallet_transactions
      WHERE idempotency_key = v_key
      LIMIT 1;
    ELSE
      v_wallet.id := NULL;
      v_transaction_id := NULL;
    END IF;

    UPDATE public.coaching_earnings
    SET status = 'available',
        refunded_gross_xof = LEAST(gross_amount_xof, v_refunded_gross),
        refunded_net_xof = LEAST(net_amount_xof, v_refunded_net),
        credited_at = COALESCE(credited_at, now()),
        wallet_id = COALESCE(wallet_id, v_wallet.id),
        wallet_transaction_id = COALESCE(wallet_transaction_id, v_transaction_id),
        updated_at = now()
    WHERE id = v_row.id;

    earning_id := v_row.id;
    coach_user_id := v_row.coach_user_id;
    session_id := v_row.session_id;
    amount_xof := v_amount;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.coaching_release_advanced_earnings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.coaching_advanced_earnings%ROWTYPE;
  v_amount integer;
  v_transaction_id uuid;
  v_key text;
  v_refunded_gross integer;
  v_refunded_net integer;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT e.*
    FROM public.coaching_advanced_earnings e
    WHERE e.status = 'locked'
      AND COALESCE(e.unlock_at, now()) <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.coaching_refund_requests r
        WHERE r.order_id = e.order_id
          AND r.status IN ('pending', 'under_review', 'approved', 'partially_approved')
      )
    ORDER BY e.unlock_at NULLS FIRST, e.created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT LEAST(
      COALESCE(v_row.gross_amount_xof, 0),
      COALESCE(SUM(COALESCE(r.approved_amount_xof, 0)), 0)::integer
    )
    INTO v_refunded_gross
    FROM public.coaching_refund_requests r
    WHERE r.order_id = v_row.order_id
      AND r.status = 'processed';

    v_refunded_gross := GREATEST(COALESCE(v_row.refunded_gross_xof, 0), COALESCE(v_refunded_gross, 0));
    v_refunded_net := CASE
      WHEN v_refunded_gross >= COALESCE(v_row.gross_amount_xof, 0) THEN COALESCE(v_row.net_amount_xof, 0)
      WHEN COALESCE(v_row.gross_amount_xof, 0) > 0 THEN
        ROUND(v_refunded_gross::numeric * COALESCE(v_row.net_amount_xof, 0)::numeric /
              v_row.gross_amount_xof::numeric)::integer
      ELSE 0
    END;
    v_refunded_net := GREATEST(COALESCE(v_row.refunded_net_xof, 0), v_refunded_net);
    v_amount := GREATEST(0, COALESCE(v_row.net_amount_xof, 0) - v_refunded_net);
    v_key := 'coaching:advanced:released:' || v_row.id::text;

    IF v_amount > 0 THEN
      PERFORM public.oga_credit_wallet_once(
        v_row.coach_user_id,
        v_amount,
        'credit_coaching_advanced',
        'Gain produit Coaching disponible',
        'coaching_advanced_earning:' || v_row.id::text,
        v_row.order_id,
        v_key
      );

      SELECT id INTO v_transaction_id
      FROM public.wallet_transactions
      WHERE idempotency_key = v_key
      LIMIT 1;
    ELSE
      v_transaction_id := NULL;
    END IF;

    UPDATE public.coaching_advanced_earnings
    SET status = 'available',
        refunded_gross_xof = LEAST(gross_amount_xof, v_refunded_gross),
        refunded_net_xof = LEAST(net_amount_xof, v_refunded_net),
        credited_at = COALESCE(credited_at, now()),
        wallet_transaction_id = COALESCE(wallet_transaction_id, v_transaction_id),
        updated_at = now()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.coaching_release_eligible_earnings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coaching_release_advanced_earnings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coaching_release_eligible_earnings() TO service_role;
GRANT EXECUTE ON FUNCTION public.coaching_release_advanced_earnings() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Omnia Live : contre-écritures de remboursement et preuve fournisseur
-- ---------------------------------------------------------------------------
ALTER TABLE public.live_refund_requests
  ADD COLUMN IF NOT EXISTS provider_refund_reference text;

ALTER TABLE public.live_organizer_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_live_refund_provider_reference
  ON public.live_refund_requests(provider_refund_reference)
  WHERE provider_refund_reference IS NOT NULL
    AND btrim(provider_refund_reference) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_live_organizer_ledger_idempotency
  ON public.live_organizer_ledger(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_live_payout_provider_reference
  ON public.live_payout_batches(provider_reference)
  WHERE provider_reference IS NOT NULL
    AND btrim(provider_reference) <> '';

CREATE INDEX IF NOT EXISTS idx_live_organizer_ledger_order_type
  ON public.live_organizer_ledger(order_id, entry_type);

CREATE OR REPLACE FUNCTION public.omnia_live_process_refund(
  p_refund_id uuid,
  p_admin_id uuid,
  p_provider_refund_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.live_refund_requests%ROWTYPE;
  v_order public.live_orders%ROWTYPE;
  v_sale public.live_organizer_ledger%ROWTYPE;
  v_amount numeric(14,2);
  v_prior numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_full boolean := false;
  v_existing_refund_gross numeric(14,2) := 0;
  v_existing_refund_oga numeric(14,2) := 0;
  v_existing_refund_organizer numeric(14,2) := 0;
  v_refund_oga numeric(14,2) := 0;
  v_refund_organizer numeric(14,2) := 0;
  v_reference text;
  v_ledger_status text := 'available';
  v_now timestamptz := now();
  v_ledger_id uuid;
BEGIN
  v_reference := NULLIF(trim(COALESCE(p_provider_refund_reference, '')), '');
  IF p_refund_id IS NULL OR p_admin_id IS NULL THEN RAISE EXCEPTION 'MISSING_PARAMS'; END IF;
  IF v_reference IS NULL THEN RAISE EXCEPTION 'PROVIDER_REFERENCE_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('live_refund:' || p_refund_id::text));

  SELECT * INTO v_refund
  FROM public.live_refund_requests
  WHERE id = p_refund_id
  FOR UPDATE;

  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'REFUND_NOT_FOUND'; END IF;

  IF v_refund.status = 'processed' THEN
    IF v_refund.provider_refund_reference IS DISTINCT FROM v_reference THEN
      RAISE EXCEPTION 'REFUND_ALREADY_PROCESSED';
    END IF;
    RETURN jsonb_build_object('refund', to_jsonb(v_refund), 'already_processed', true);
  END IF;

  IF v_refund.status NOT IN ('approved', 'partially_approved') THEN
    RAISE EXCEPTION 'REFUND_NOT_APPROVED';
  END IF;

  SELECT * INTO v_order
  FROM public.live_orders
  WHERE id = v_refund.order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  v_amount := COALESCE(v_refund.approved_amount, 0);
  IF v_amount <= 0 OR v_amount > COALESCE(v_order.amount, 0) THEN
    RAISE EXCEPTION 'INVALID_REFUND_AMOUNT';
  END IF;

  SELECT COALESCE(SUM(COALESCE(approved_amount, 0)), 0)
  INTO v_prior
  FROM public.live_refund_requests
  WHERE order_id = v_order.id
    AND id <> v_refund.id
    AND status = 'processed';

  IF v_prior + v_amount > COALESCE(v_order.amount, 0) THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_ORDER_AMOUNT';
  END IF;

  v_total := v_prior + v_amount;
  v_full := v_total >= COALESCE(v_order.amount, 0);

  SELECT * INTO v_sale
  FROM public.live_organizer_ledger
  WHERE order_id = v_order.id
    AND entry_type = 'sale'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_sale.id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(ABS(gross_amount)), 0),
      COALESCE(SUM(ABS(oga_amount)), 0),
      COALESCE(SUM(ABS(organizer_amount)), 0)
    INTO v_existing_refund_gross, v_existing_refund_oga, v_existing_refund_organizer
    FROM public.live_organizer_ledger
    WHERE order_id = v_order.id
      AND entry_type = 'refund';

    IF v_amount >= GREATEST(0, v_sale.gross_amount - v_existing_refund_gross) THEN
      v_refund_oga := GREATEST(0, v_sale.oga_amount - v_existing_refund_oga);
      v_refund_organizer := GREATEST(0, v_sale.organizer_amount - v_existing_refund_organizer);
    ELSIF v_sale.gross_amount > 0 THEN
      v_refund_oga := LEAST(
        GREATEST(0, v_sale.oga_amount - v_existing_refund_oga),
        ROUND(v_amount * v_sale.oga_amount / v_sale.gross_amount, 2)
      );
      v_refund_organizer := LEAST(
        GREATEST(0, v_sale.organizer_amount - v_existing_refund_organizer),
        ROUND(v_amount * v_sale.organizer_amount / v_sale.gross_amount, 2)
      );
    END IF;

    v_ledger_status := CASE
      WHEN v_sale.status = 'pending' AND COALESCE(v_sale.available_at, v_now) > v_now THEN 'pending'
      ELSE 'available'
    END;

    INSERT INTO public.live_organizer_ledger(
      event_id, organizer_user_id, order_id, entry_type,
      gross_amount, oga_amount, organizer_amount, currency,
      status, available_at, calculation_snapshot, metadata, idempotency_key
    ) VALUES (
      v_sale.event_id, v_sale.organizer_user_id, v_order.id, 'refund',
      -v_amount, -v_refund_oga, -v_refund_organizer, v_sale.currency,
      v_ledger_status, v_sale.available_at,
      jsonb_build_object(
        'original_sale_ledger_id', v_sale.id,
        'refund_id', v_refund.id,
        'refund_amount', v_amount,
        'oga_reversal', v_refund_oga,
        'organizer_reversal', v_refund_organizer
      ),
      jsonb_build_object(
        'provider_refund_reference', v_reference,
        'processed_by', p_admin_id
      ),
      'live:refund:' || v_refund.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;
  END IF;

  UPDATE public.live_refund_requests
  SET status = 'processed',
      provider_refund_reference = v_reference,
      processed_at = v_now,
      decided_by = COALESCE(decided_by, p_admin_id),
      decided_at = COALESCE(decided_at, v_now),
      updated_at = v_now
  WHERE id = v_refund.id
  RETURNING * INTO v_refund;

  UPDATE public.live_orders
  SET payment_status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
      updated_at = v_now
  WHERE id = v_order.id;

  IF v_full THEN
    IF v_order.registration_id IS NOT NULL THEN
      UPDATE public.live_registrations
      SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, v_now)
      WHERE id = v_order.registration_id;
    END IF;

    UPDATE public.live_entitlements
    SET revoked_at = COALESCE(revoked_at, v_now)
    WHERE order_id = v_order.id
      AND revoked_at IS NULL;

    UPDATE public.live_replay_entitlements
    SET revoked_at = COALESCE(revoked_at, v_now)
    WHERE user_id = v_order.user_id
      AND event_id = v_order.event_id
      AND source IN ('live_purchase', 'replay_purchase')
      AND revoked_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'refund', to_jsonb(v_refund),
    'already_processed', false,
    'full_refund', v_full,
    'total_refunded', v_total,
    'ledger_reversal_id', v_ledger_id,
    'organizer_recovered', v_refund_organizer,
    'oga_recovered', v_refund_oga
  );
END;
$$;

REVOKE ALL ON FUNCTION public.omnia_live_process_refund(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_live_process_refund(uuid, uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Omnia Live : réservations atomiques des retraits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_payout_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL REFERENCES public.live_payout_requests(id) ON DELETE CASCADE,
  payout_batch_id uuid REFERENCES public.live_payout_batches(id) ON DELETE SET NULL,
  ledger_entry_id uuid NOT NULL REFERENCES public.live_organizer_ledger(id) ON DELETE RESTRICT,
  organizer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  currency text NOT NULL,
  allocated_amount numeric(14,2) NOT NULL CHECK (allocated_amount > 0),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'paid', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  paid_at timestamptz,
  UNIQUE(payout_request_id, ledger_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_live_payout_allocations_ledger_status
  ON public.live_payout_allocations(ledger_entry_id, status);
CREATE INDEX IF NOT EXISTS idx_live_payout_allocations_request_status
  ON public.live_payout_allocations(payout_request_id, status);

ALTER TABLE public.live_payout_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_payout_allocations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.omnia_live_refresh_ledger_availability(
  p_organizer_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.live_organizer_ledger
  SET status = 'available'
  WHERE status = 'pending'
    AND COALESCE(available_at, now()) <= now()
    AND (p_organizer_user_id IS NULL OR organizer_user_id = p_organizer_user_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.omnia_live_available_balance(
  p_organizer_user_id uuid,
  p_currency text
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH allocations AS (
    SELECT ledger_entry_id,
           COALESCE(SUM(allocated_amount) FILTER (WHERE status IN ('reserved', 'paid')), 0) AS allocated
    FROM public.live_payout_allocations
    GROUP BY ledger_entry_id
  )
  SELECT COALESCE(SUM(
    CASE
      WHEN l.organizer_amount > 0 THEN l.organizer_amount - COALESCE(a.allocated, 0)
      ELSE l.organizer_amount
    END
  ), 0)
  FROM public.live_organizer_ledger l
  LEFT JOIN allocations a ON a.ledger_entry_id = l.id
  WHERE l.organizer_user_id = p_organizer_user_id
    AND l.currency = p_currency
    AND l.status = 'available';
$$;

CREATE OR REPLACE FUNCTION public.omnia_live_allocate_payout_request(
  p_request_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.live_payout_requests%ROWTYPE;
  v_existing numeric(14,2) := 0;
  v_available numeric(14,2) := 0;
  v_remaining numeric(14,2) := 0;
  v_take numeric(14,2) := 0;
  v_entry record;
BEGIN
  SELECT * INTO v_request
  FROM public.live_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN RAISE EXCEPTION 'PAYOUT_REQUEST_NOT_FOUND'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(
    'live_payout:' || v_request.organizer_user_id::text || ':' || v_request.currency
  ));

  PERFORM public.omnia_live_refresh_ledger_availability(v_request.organizer_user_id);

  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_existing
  FROM public.live_payout_allocations
  WHERE payout_request_id = v_request.id
    AND status = 'reserved';

  v_remaining := v_request.requested_amount - v_existing;
  IF v_remaining <= 0 THEN RETURN v_existing; END IF;

  SELECT public.omnia_live_available_balance(v_request.organizer_user_id, v_request.currency)
  INTO v_available;

  IF v_available < v_remaining THEN
    RAISE EXCEPTION 'INSUFFICIENT_LEDGER_BALANCE';
  END IF;

  FOR v_entry IN
    SELECT
      l.id,
      l.organizer_amount - COALESCE((
        SELECT SUM(a.allocated_amount)
        FROM public.live_payout_allocations a
        WHERE a.ledger_entry_id = l.id
          AND a.status IN ('reserved', 'paid')
      ), 0) AS remaining_amount
    FROM public.live_organizer_ledger l
    WHERE l.organizer_user_id = v_request.organizer_user_id
      AND l.currency = v_request.currency
      AND l.status = 'available'
      AND l.organizer_amount > 0
    ORDER BY l.available_at NULLS FIRST, l.created_at, l.id
    FOR UPDATE OF l
  LOOP
    EXIT WHEN v_remaining <= 0;
    IF v_entry.remaining_amount <= 0 THEN CONTINUE; END IF;

    v_take := LEAST(v_remaining, v_entry.remaining_amount);

    INSERT INTO public.live_payout_allocations(
      payout_request_id, ledger_entry_id, organizer_user_id, currency,
      allocated_amount, status
    ) VALUES (
      v_request.id, v_entry.id, v_request.organizer_user_id, v_request.currency,
      v_take, 'reserved'
    )
    ON CONFLICT (payout_request_id, ledger_entry_id)
    DO UPDATE SET
      allocated_amount = public.live_payout_allocations.allocated_amount + EXCLUDED.allocated_amount,
      status = 'reserved',
      released_at = NULL;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0.009 THEN
    RAISE EXCEPTION 'INSUFFICIENT_LEDGER_BALANCE';
  END IF;

  RETURN v_request.requested_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.omnia_live_create_payout_request(
  p_organizer_user_id uuid,
  p_currency text,
  p_requested_amount numeric,
  p_payout_method text DEFAULT NULL,
  p_payout_details jsonb DEFAULT '{}'::jsonb,
  p_request_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.live_payout_requests%ROWTYPE;
  v_available numeric;
BEGIN
  IF p_organizer_user_id IS NULL OR NULLIF(trim(COALESCE(p_currency, '')), '') IS NULL THEN
    RAISE EXCEPTION 'MISSING_PARAMS';
  END IF;
  IF COALESCE(p_requested_amount, 0) <= 0 THEN RAISE EXCEPTION 'INVALID_PAYOUT_AMOUNT'; END IF;
  IF p_payout_method IS NOT NULL AND p_payout_method NOT IN ('bank_transfer', 'mobile_money', 'manual') THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_METHOD';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(
    'live_payout:' || p_organizer_user_id::text || ':' || upper(trim(p_currency))
  ));

  PERFORM public.omnia_live_refresh_ledger_availability(p_organizer_user_id);

  SELECT public.omnia_live_available_balance(p_organizer_user_id, upper(trim(p_currency)))
  INTO v_available;

  IF v_available < p_requested_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_LEDGER_BALANCE';
  END IF;

  INSERT INTO public.live_payout_requests(
    organizer_user_id, currency, requested_amount, status,
    payout_method, payout_details, request_note
  ) VALUES (
    p_organizer_user_id, upper(trim(p_currency)), p_requested_amount, 'pending',
    NULLIF(trim(p_payout_method), ''), COALESCE(p_payout_details, '{}'::jsonb),
    NULLIF(trim(p_request_note), '')
  )
  RETURNING * INTO v_request;

  PERFORM public.omnia_live_allocate_payout_request(v_request.id);

  SELECT public.omnia_live_available_balance(p_organizer_user_id, upper(trim(p_currency)))
  INTO v_available;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_request),
    'available_balance', v_available
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.omnia_live_process_payout(
  p_request_id uuid,
  p_status text,
  p_admin_id uuid,
  p_decision_note text DEFAULT NULL,
  p_provider_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.live_payout_requests%ROWTYPE;
  v_batch public.live_payout_batches%ROWTYPE;
  v_now timestamptz := now();
  v_ledger_ids uuid[];
  v_reserved numeric(14,2) := 0;
  v_total_reserved numeric(14,2) := 0;
  v_net_unpaid numeric(14,2) := 0;
  v_reference text;
BEGIN
  IF p_request_id IS NULL OR p_admin_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'MISSING_PARAMS';
  END IF;

  SELECT * INTO v_request
  FROM public.live_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN RAISE EXCEPTION 'PAYOUT_REQUEST_NOT_FOUND'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(
    'live_payout:' || v_request.organizer_user_id::text || ':' || v_request.currency
  ));
  PERFORM public.omnia_live_refresh_ledger_availability(v_request.organizer_user_id);

  IF p_status = v_request.status THEN
    RETURN jsonb_build_object('request', to_jsonb(v_request), 'already_processed', true);
  END IF;

  IF p_status = 'under_review' THEN
    IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.live_payout_requests
    SET status = 'under_review', decision_note = NULLIF(trim(p_decision_note), ''),
        decided_by = p_admin_id, decided_at = v_now, updated_at = v_now
    WHERE id = v_request.id
    RETURNING * INTO v_request;

  ELSIF p_status = 'approved' THEN
    IF v_request.status NOT IN ('pending', 'under_review') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;

    PERFORM public.omnia_live_allocate_payout_request(v_request.id);

    SELECT ARRAY_AGG(DISTINCT ledger_entry_id), COALESCE(SUM(allocated_amount), 0)
    INTO v_ledger_ids, v_reserved
    FROM public.live_payout_allocations
    WHERE payout_request_id = v_request.id
      AND status = 'reserved';

    IF v_reserved <> v_request.requested_amount THEN
      RAISE EXCEPTION 'PAYOUT_ALLOCATION_INCONSISTENT';
    END IF;

    IF v_request.payout_batch_id IS NULL THEN
      INSERT INTO public.live_payout_batches(
        batch_number, organizer_user_id, currency, amount, status,
        payment_method, ledger_entry_ids, approved_by, approved_at, notes
      ) VALUES (
        'OL-PAYOUT-' || extract(year FROM v_now)::integer || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        v_request.organizer_user_id, v_request.currency, v_request.requested_amount, 'approved',
        v_request.payout_method, COALESCE(v_ledger_ids, '{}'::uuid[]), p_admin_id, v_now,
        COALESCE(NULLIF(trim(p_decision_note), ''), v_request.request_note)
      )
      RETURNING * INTO v_batch;

      UPDATE public.live_payout_allocations
      SET payout_batch_id = v_batch.id
      WHERE payout_request_id = v_request.id
        AND status = 'reserved';
    ELSE
      SELECT * INTO v_batch
      FROM public.live_payout_batches
      WHERE id = v_request.payout_batch_id
      FOR UPDATE;

      UPDATE public.live_payout_batches
      SET status = 'approved', approved_by = p_admin_id,
          approved_at = COALESCE(approved_at, v_now), updated_at = v_now
      WHERE id = v_batch.id
      RETURNING * INTO v_batch;
    END IF;

    UPDATE public.live_payout_requests
    SET status = 'approved', payout_batch_id = v_batch.id,
        decision_note = NULLIF(trim(p_decision_note), ''),
        decided_by = p_admin_id, decided_at = v_now, updated_at = v_now
    WHERE id = v_request.id
    RETURNING * INTO v_request;

  ELSIF p_status IN ('rejected', 'cancelled') THEN
    IF v_request.status NOT IN ('pending', 'under_review', 'approved') THEN
      RAISE EXCEPTION 'INVALID_STATUS_TRANSITION';
    END IF;
    IF p_status = 'rejected' AND NULLIF(trim(COALESCE(p_decision_note, '')), '') IS NULL THEN
      RAISE EXCEPTION 'ADMIN_REASON_REQUIRED';
    END IF;

    UPDATE public.live_payout_allocations
    SET status = 'released', released_at = v_now
    WHERE payout_request_id = v_request.id
      AND status = 'reserved';

    IF v_request.payout_batch_id IS NOT NULL THEN
      UPDATE public.live_payout_batches
      SET status = 'cancelled', notes = COALESCE(NULLIF(trim(p_decision_note), ''), notes), updated_at = v_now
      WHERE id = v_request.payout_batch_id
        AND status <> 'paid';
    END IF;

    UPDATE public.live_payout_requests
    SET status = p_status, decision_note = NULLIF(trim(p_decision_note), ''),
        decided_by = p_admin_id, decided_at = v_now, updated_at = v_now
    WHERE id = v_request.id
    RETURNING * INTO v_request;

  ELSIF p_status = 'paid' THEN
    IF v_request.status <> 'approved' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;

    -- Les anciennes demandes approuvées peuvent ne pas encore avoir d'allocation.
    -- La réservation est créée ici avant tout paiement réel.
    PERFORM public.omnia_live_allocate_payout_request(v_request.id);

    v_reference := NULLIF(trim(COALESCE(p_provider_reference, '')), '');
    IF v_reference IS NULL THEN RAISE EXCEPTION 'PROVIDER_REFERENCE_REQUIRED'; END IF;

    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO v_reserved
    FROM public.live_payout_allocations
    WHERE payout_request_id = v_request.id
      AND status = 'reserved';

    IF v_reserved <> v_request.requested_amount THEN
      RAISE EXCEPTION 'PAYOUT_ALLOCATION_INCONSISTENT';
    END IF;

    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO v_total_reserved
    FROM public.live_payout_allocations
    WHERE organizer_user_id = v_request.organizer_user_id
      AND currency = v_request.currency
      AND status = 'reserved';

    WITH paid_allocations AS (
      SELECT ledger_entry_id, SUM(allocated_amount) AS paid_amount
      FROM public.live_payout_allocations
      WHERE status = 'paid'
      GROUP BY ledger_entry_id
    )
    SELECT COALESCE(SUM(
      CASE
        WHEN l.organizer_amount > 0 THEN l.organizer_amount - COALESCE(p.paid_amount, 0)
        ELSE l.organizer_amount
      END
    ), 0)
    INTO v_net_unpaid
    FROM public.live_organizer_ledger l
    LEFT JOIN paid_allocations p ON p.ledger_entry_id = l.id
    WHERE l.organizer_user_id = v_request.organizer_user_id
      AND l.currency = v_request.currency
      AND l.status IN ('available', 'paid');

    IF v_net_unpaid < v_total_reserved THEN
      RAISE EXCEPTION 'INSUFFICIENT_LEDGER_BALANCE_AFTER_REFUND';
    END IF;

    UPDATE public.live_payout_allocations
    SET status = 'paid', paid_at = v_now
    WHERE payout_request_id = v_request.id
      AND status = 'reserved';

    UPDATE public.live_organizer_ledger l
    SET status = 'paid', paid_at = v_now
    WHERE l.id IN (
      SELECT a.ledger_entry_id
      FROM public.live_payout_allocations a
      WHERE a.payout_request_id = v_request.id
    )
      AND l.organizer_amount > 0
      AND COALESCE((
        SELECT SUM(a2.allocated_amount)
        FROM public.live_payout_allocations a2
        WHERE a2.ledger_entry_id = l.id
          AND a2.status = 'paid'
      ), 0) >= l.organizer_amount;

    IF v_request.payout_batch_id IS NOT NULL THEN
      UPDATE public.live_payout_batches
      SET status = 'paid', paid_at = v_now, provider_reference = v_reference,
          updated_at = v_now
      WHERE id = v_request.payout_batch_id;
    END IF;

    UPDATE public.live_payout_requests
    SET status = 'paid', decision_note = NULLIF(trim(p_decision_note), ''),
        decided_by = p_admin_id, decided_at = v_now, updated_at = v_now
    WHERE id = v_request.id
    RETURNING * INTO v_request;

  ELSE
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_request),
    'batch', CASE WHEN v_batch.id IS NULL THEN NULL ELSE to_jsonb(v_batch) END,
    'already_processed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.omnia_live_refresh_ledger_availability(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.omnia_live_available_balance(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.omnia_live_allocate_payout_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.omnia_live_create_payout_request(uuid, text, numeric, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.omnia_live_process_payout(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.omnia_live_refresh_ledger_availability(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.omnia_live_available_balance(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.omnia_live_allocate_payout_request(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.omnia_live_create_payout_request(uuid, text, numeric, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.omnia_live_process_payout(uuid, text, uuid, text, text) TO service_role;

COMMIT;
