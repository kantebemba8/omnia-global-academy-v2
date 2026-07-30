-- Cycle 6 — Lot 2B
-- Retraits atomiques, traçabilité financière et contrôle sûr des tâches planifiées.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Traçabilité et verrouillage des Cron Jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oga_cron_controls (
  job_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  max_runtime_seconds integer NOT NULL DEFAULT 900 CHECK (max_runtime_seconds BETWEEN 30 AND 7200),
  failure_threshold integer NOT NULL DEFAULT 3 CHECK (failure_threshold BETWEEN 1 AND 20),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  lease_run_id uuid,
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oga_cron_runs (
  id uuid PRIMARY KEY,
  job_key text NOT NULL REFERENCES public.oga_cron_controls(job_key) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','skipped')),
  forced boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms bigint,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_oga_cron_runs_job_started
  ON public.oga_cron_runs(job_key, started_at DESC);

ALTER TABLE public.oga_cron_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oga_cron_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oga_cron_controls FROM anon, authenticated;
REVOKE ALL ON public.oga_cron_runs FROM anon, authenticated;

INSERT INTO public.oga_cron_controls(job_key, enabled, max_runtime_seconds, failure_threshold)
VALUES
  ('coaching-cron', false, 1200, 3),
  ('cron-anti-abandon', false, 900, 3)
ON CONFLICT (job_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.oga_cron_begin(
  p_job_key text,
  p_run_id uuid,
  p_force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control public.oga_cron_controls%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_control
  FROM public.oga_cron_controls
  WHERE job_key = p_job_key
  FOR UPDATE;

  IF v_control.job_key IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'JOB_NOT_CONFIGURED');
  END IF;

  IF NOT v_control.enabled AND NOT p_force THEN
    INSERT INTO public.oga_cron_runs(id, job_key, status, forced, started_at, finished_at, result)
    VALUES (p_run_id, p_job_key, 'skipped', false, v_now, v_now, '{"reason":"JOB_DISABLED"}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
    RETURN jsonb_build_object('allowed', false, 'reason', 'JOB_DISABLED');
  END IF;

  IF v_control.lease_run_id IS NOT NULL
     AND v_control.lease_expires_at IS NOT NULL
     AND v_control.lease_expires_at <= v_now THEN
    UPDATE public.oga_cron_runs
    SET status = 'failed', finished_at = v_now,
        duration_ms = GREATEST(0, floor(extract(epoch FROM (v_now - started_at)) * 1000)::bigint),
        error_message = COALESCE(error_message, 'LEASE_EXPIRED')
    WHERE id = v_control.lease_run_id AND status = 'running';

    UPDATE public.oga_cron_controls
    SET consecutive_failures = consecutive_failures + 1,
        last_failure_at = v_now,
        last_error = 'LEASE_EXPIRED',
        enabled = CASE
          WHEN consecutive_failures + 1 >= failure_threshold THEN false
          ELSE enabled
        END,
        updated_at = v_now
    WHERE job_key = p_job_key
    RETURNING * INTO v_control;

    IF NOT v_control.enabled AND NOT p_force THEN
      INSERT INTO public.oga_cron_runs(id, job_key, status, forced, started_at, finished_at, result)
      VALUES (p_run_id, p_job_key, 'skipped', false, v_now, v_now,
        jsonb_build_object('reason', 'FAILURE_THRESHOLD_REACHED'))
      ON CONFLICT (id) DO NOTHING;
      RETURN jsonb_build_object('allowed', false, 'reason', 'FAILURE_THRESHOLD_REACHED');
    END IF;
  END IF;

  IF v_control.lease_run_id IS NOT NULL
     AND v_control.lease_expires_at IS NOT NULL
     AND v_control.lease_expires_at > v_now THEN
    INSERT INTO public.oga_cron_runs(id, job_key, status, forced, started_at, finished_at, result)
    VALUES (p_run_id, p_job_key, 'skipped', p_force, v_now, v_now,
      jsonb_build_object('reason', 'ALREADY_RUNNING', 'active_run_id', v_control.lease_run_id))
    ON CONFLICT (id) DO NOTHING;
    RETURN jsonb_build_object('allowed', false, 'reason', 'ALREADY_RUNNING', 'active_run_id', v_control.lease_run_id);
  END IF;

  UPDATE public.oga_cron_controls
  SET lease_run_id = p_run_id,
      lease_expires_at = v_now + make_interval(secs => max_runtime_seconds),
      last_started_at = v_now,
      updated_at = v_now
  WHERE job_key = p_job_key;

  INSERT INTO public.oga_cron_runs(id, job_key, status, forced, started_at)
  VALUES (p_run_id, p_job_key, 'running', p_force, v_now)
  ON CONFLICT (id) DO UPDATE
    SET status = 'running', forced = excluded.forced, started_at = excluded.started_at,
        finished_at = null, duration_ms = null, result = '{}'::jsonb, error_message = null;

  RETURN jsonb_build_object('allowed', true, 'run_id', p_run_id, 'forced', p_force);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_cron_finish(
  p_job_key text,
  p_run_id uuid,
  p_success boolean,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_started timestamptz;
  v_failures integer;
  v_threshold integer;
  v_enabled boolean;
BEGIN
  SELECT started_at INTO v_started
  FROM public.oga_cron_runs
  WHERE id = p_run_id AND job_key = p_job_key
  FOR UPDATE;

  UPDATE public.oga_cron_runs
  SET status = CASE WHEN p_success THEN 'success' ELSE 'failed' END,
      finished_at = v_now,
      duration_ms = CASE WHEN v_started IS NULL THEN NULL ELSE GREATEST(0, floor(extract(epoch FROM (v_now - v_started)) * 1000)::bigint) END,
      result = COALESCE(p_result, '{}'::jsonb),
      error_message = CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_error, 'UNKNOWN_ERROR'), 4000) END
  WHERE id = p_run_id AND job_key = p_job_key;

  UPDATE public.oga_cron_controls
  SET lease_run_id = NULL,
      lease_expires_at = NULL,
      last_finished_at = v_now,
      last_success_at = CASE WHEN p_success THEN v_now ELSE last_success_at END,
      last_failure_at = CASE WHEN p_success THEN last_failure_at ELSE v_now END,
      last_error = CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_error, 'UNKNOWN_ERROR'), 4000) END,
      consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
      enabled = CASE
        WHEN p_success THEN enabled
        WHEN consecutive_failures + 1 >= failure_threshold THEN false
        ELSE enabled
      END,
      updated_at = v_now
  WHERE job_key = p_job_key
    AND lease_run_id = p_run_id
  RETURNING consecutive_failures, failure_threshold, enabled
  INTO v_failures, v_threshold, v_enabled;

  RETURN jsonb_build_object(
    'success', p_success,
    'consecutive_failures', COALESCE(v_failures, 0),
    'failure_threshold', COALESCE(v_threshold, 0),
    'job_enabled', COALESCE(v_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.oga_cron_begin(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_cron_finish(text, uuid, boolean, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_cron_begin(text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_cron_finish(text, uuid, boolean, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Retraits génériques : transitions idempotentes et preuves obligatoires
-- ---------------------------------------------------------------------------
-- Garde-fous de schéma : ces colonnes ont été introduites dans les migrations
-- financières précédentes, mais sont répétées ici avec IF NOT EXISTS afin que
-- le lot échoue proprement le moins possible sur un historique déjà ancien.
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS reserved_xof integer NOT NULL DEFAULT 0;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_transactions_idempotency
  ON public.wallet_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS provider varchar(80),
  ADD COLUMN IF NOT EXISTS provider_reference varchar(255),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;
CREATE OR REPLACE FUNCTION public.finance_process_payout(
  p_payout_id uuid,
  p_action text,
  p_admin_id uuid,
  p_admin_note text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_provider_reference text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.payout_requests%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_payout FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE id = v_payout.wallet_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;

  IF p_action = 'approve' THEN
    IF v_payout.status = 'approved' THEN RETURN 'approved'; END IF;
    IF v_payout.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.payout_requests
    SET status = 'approved', approved_at = now(), approved_by = p_admin_id,
        processed_at = now(), admin_note = NULLIF(trim(p_admin_note), ''),
        provider = COALESCE(NULLIF(trim(p_provider), ''), provider)
    WHERE id = p_payout_id;
    RETURN 'approved';

  ELSIF p_action = 'reject' THEN
    IF v_payout.status = 'rejected' THEN RETURN 'rejected'; END IF;
    IF v_payout.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NULLIF(trim(COALESCE(p_admin_note, '')), '') IS NULL THEN RAISE EXCEPTION 'ADMIN_REASON_REQUIRED'; END IF;
    UPDATE public.wallets
    SET reserved_xof = GREATEST(0, COALESCE(reserved_xof, 0) - v_payout.amount_xof), updated_at = now()
    WHERE id = v_wallet.id;
    UPDATE public.payout_requests
    SET status = 'rejected', processed_at = now(), admin_note = trim(p_admin_note)
    WHERE id = p_payout_id;
    RETURN 'rejected';

  ELSIF p_action = 'mark_paid' THEN
    IF v_payout.status = 'paid' THEN RETURN 'paid'; END IF;
    IF v_payout.status <> 'approved' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NULLIF(trim(COALESCE(p_provider_reference, '')), '') IS NULL THEN RAISE EXCEPTION 'PROVIDER_REFERENCE_REQUIRED'; END IF;
    IF COALESCE(v_wallet.balance_xof, 0) < v_payout.amount_xof THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

    INSERT INTO public.wallet_transactions(
      wallet_id, user_id, type, amount_xof, description, reference_id, idempotency_key
    ) VALUES (
      v_wallet.id, v_payout.user_id, 'debit_withdrawal', v_payout.amount_xof,
      'Retrait payé', 'payout:' || v_payout.id::text, 'payout:paid:' || v_payout.id::text
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_transaction_id;

    IF v_transaction_id IS NULL THEN
      RAISE EXCEPTION 'PAYOUT_LEDGER_ALREADY_EXISTS';
    END IF;

    UPDATE public.wallets
    SET balance_xof = COALESCE(balance_xof, 0) - v_payout.amount_xof,
        reserved_xof = GREATEST(0, COALESCE(reserved_xof, 0) - v_payout.amount_xof),
        total_withdrawn_xof = COALESCE(total_withdrawn_xof, 0) + v_payout.amount_xof,
        updated_at = now()
    WHERE id = v_wallet.id;

    UPDATE public.payout_requests
    SET status = 'paid', paid_at = now(), paid_by = p_admin_id, processed_at = now(),
        admin_note = NULLIF(trim(p_admin_note), ''),
        provider = COALESCE(NULLIF(trim(p_provider), ''), provider),
        provider_reference = trim(p_provider_reference)
    WHERE id = p_payout_id;
    RETURN 'paid';

  ELSIF p_action = 'mark_failed' THEN
    IF v_payout.status = 'failed' THEN RETURN 'failed'; END IF;
    IF v_payout.status <> 'approved' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NULLIF(trim(COALESCE(p_failure_reason, p_admin_note, '')), '') IS NULL THEN RAISE EXCEPTION 'FAILURE_REASON_REQUIRED'; END IF;
    UPDATE public.wallets
    SET reserved_xof = GREATEST(0, COALESCE(reserved_xof, 0) - v_payout.amount_xof), updated_at = now()
    WHERE id = v_wallet.id;
    UPDATE public.payout_requests
    SET status = 'failed', failed_at = now(), processed_at = now(),
        failure_reason = trim(COALESCE(p_failure_reason, p_admin_note)),
        admin_note = NULLIF(trim(p_admin_note), ''),
        provider = COALESCE(NULLIF(trim(p_provider), ''), provider)
    WHERE id = p_payout_id;
    RETURN 'failed';
  END IF;

  RAISE EXCEPTION 'UNKNOWN_ACTION';
END;
$$;

REVOKE ALL ON FUNCTION public.finance_process_payout(uuid, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_process_payout(uuid, text, uuid, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Commerce central : commissions et retraits atomiques
-- ---------------------------------------------------------------------------
ALTER TABLE public.commerce_creator_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_creator_ledger_idempotency
  ON public.commerce_creator_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.commerce_credit_creator_sale_once(
  p_creator_user_id uuid,
  p_order_id uuid,
  p_gross_xof integer,
  p_platform_fee_xof integer,
  p_net_xof integer,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_id uuid;
  v_key text := 'sale_available:' || p_order_id::text;
BEGIN
  IF p_creator_user_id IS NULL OR p_order_id IS NULL OR p_gross_xof < 0 OR p_platform_fee_xof < 0 OR p_net_xof < 0 THEN
    RAISE EXCEPTION 'INVALID_CREATOR_REVENUE';
  END IF;
  IF p_platform_fee_xof + p_net_xof <> p_gross_xof THEN
    RAISE EXCEPTION 'INVALID_CREATOR_REVENUE_SPLIT';
  END IF;

  INSERT INTO public.commerce_creator_balances(creator_user_id)
  VALUES (p_creator_user_id)
  ON CONFLICT (creator_user_id) DO NOTHING;

  PERFORM 1 FROM public.commerce_creator_balances
  WHERE creator_user_id = p_creator_user_id
  FOR UPDATE;

  INSERT INTO public.commerce_creator_ledger(
    creator_user_id, order_id, entry_type, gross_xof, platform_fee_xof, net_xof,
    balance_bucket, description, metadata, idempotency_key
  ) VALUES (
    p_creator_user_id, p_order_id, 'sale_available', p_gross_xof, p_platform_fee_xof, p_net_xof,
    'available', p_description, COALESCE(p_metadata, '{}'::jsonb), v_key
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN RETURN false; END IF;

  UPDATE public.commerce_creator_balances
  SET available_xof = available_xof + p_net_xof,
      lifetime_gross_xof = lifetime_gross_xof + p_gross_xof,
      lifetime_platform_fee_xof = lifetime_platform_fee_xof + p_platform_fee_xof,
      updated_at = now()
  WHERE creator_user_id = p_creator_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_create_payout_request(
  p_creator_user_id uuid,
  p_amount_xof integer,
  p_payout_method text,
  p_payout_details jsonb DEFAULT '{}'::jsonb,
  p_creator_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance public.commerce_creator_balances%ROWTYPE;
  v_payout_id uuid;
BEGIN
  IF p_creator_user_id IS NULL OR p_amount_xof <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF p_payout_method NOT IN ('mobile_money','bank_uemoa','swift','manual') THEN RAISE EXCEPTION 'INVALID_PAYOUT_METHOD'; END IF;
  IF p_payout_method = 'mobile_money' AND (
    NULLIF(trim(COALESCE(p_payout_details->>'operator', p_payout_details->>'mm_operator', '')), '') IS NULL OR
    NULLIF(trim(COALESCE(p_payout_details->>'phone', p_payout_details->>'mm_phone', '')), '') IS NULL
  ) THEN RAISE EXCEPTION 'PAYOUT_DETAILS_REQUIRED'; END IF;
  IF p_payout_method IN ('bank_uemoa','swift') AND (
    NULLIF(trim(COALESCE(p_payout_details->>'bank_name', '')), '') IS NULL OR
    NULLIF(trim(COALESCE(p_payout_details->>'account_holder', '')), '') IS NULL OR
    NULLIF(trim(COALESCE(p_payout_details->>'account_number', '')), '') IS NULL
  ) THEN RAISE EXCEPTION 'PAYOUT_DETAILS_REQUIRED'; END IF;
  IF p_payout_method = 'swift' AND NULLIF(trim(COALESCE(p_payout_details->>'swift', '')), '') IS NULL THEN
    RAISE EXCEPTION 'PAYOUT_DETAILS_REQUIRED';
  END IF;

  SELECT * INTO v_balance
  FROM public.commerce_creator_balances
  WHERE creator_user_id = p_creator_user_id
  FOR UPDATE;
  IF v_balance.creator_user_id IS NULL THEN RAISE EXCEPTION 'CREATOR_BALANCE_NOT_FOUND'; END IF;
  IF v_balance.available_xof < p_amount_xof THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE'; END IF;

  INSERT INTO public.commerce_payout_requests(
    creator_user_id, amount_xof, payout_method, payout_details, creator_note, status
  ) VALUES (
    p_creator_user_id, p_amount_xof, p_payout_method, COALESCE(p_payout_details, '{}'::jsonb),
    NULLIF(trim(p_creator_note), ''), 'pending'
  ) RETURNING id INTO v_payout_id;

  UPDATE public.commerce_creator_balances
  SET available_xof = available_xof - p_amount_xof,
      reserved_xof = reserved_xof + p_amount_xof,
      updated_at = now()
  WHERE creator_user_id = p_creator_user_id;

  INSERT INTO public.commerce_creator_ledger(
    creator_user_id, entry_type, net_xof, balance_bucket, description, metadata, idempotency_key
  ) VALUES (
    p_creator_user_id, 'payout_reserved', -p_amount_xof, 'reserved',
    'Demande de retrait ' || v_payout_id::text,
    jsonb_build_object('payout_id', v_payout_id, 'method', p_payout_method),
    'payout:reserved:' || v_payout_id::text
  );

  RETURN v_payout_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.commerce_process_payout(
  p_payout_id uuid,
  p_decision text,
  p_admin_id uuid,
  p_reason text DEFAULT NULL,
  p_provider_payout_id text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.commerce_payout_requests%ROWTYPE;
  v_balance public.commerce_creator_balances%ROWTYPE;
  v_now timestamptz := now();
  v_ledger_id uuid;
  v_target_status text;
BEGIN
  SELECT * INTO v_payout
  FROM public.commerce_payout_requests
  WHERE id = p_payout_id
  FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND'; END IF;

  SELECT * INTO v_balance
  FROM public.commerce_creator_balances
  WHERE creator_user_id = v_payout.creator_user_id
  FOR UPDATE;
  IF v_balance.creator_user_id IS NULL THEN RAISE EXCEPTION 'CREATOR_BALANCE_NOT_FOUND'; END IF;

  IF p_decision = 'approve' THEN
    IF v_payout.status = 'approved' THEN RETURN 'approved'; END IF;
    IF v_payout.status NOT IN ('pending','under_review') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.commerce_payout_requests
    SET status = 'approved', admin_reason = NULLIF(trim(p_reason), ''), reviewed_by = p_admin_id, reviewed_at = v_now
    WHERE id = p_payout_id;
    RETURN 'approved';

  ELSIF p_decision = 'processing' THEN
    IF v_payout.status = 'processing' THEN RETURN 'processing'; END IF;
    IF v_payout.status <> 'approved' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.commerce_payout_requests
    SET status = 'processing', admin_reason = NULLIF(trim(p_reason), ''), reviewed_by = p_admin_id, reviewed_at = v_now
    WHERE id = p_payout_id;
    RETURN 'processing';

  ELSIF p_decision IN ('reject','failed','cancelled') THEN
    v_target_status := CASE
      WHEN p_decision = 'reject' THEN 'rejected'
      ELSE p_decision
    END;

    IF v_payout.status = v_target_status THEN
      RETURN v_target_status;
    END IF;
    IF v_payout.status NOT IN ('pending','under_review','approved','processing') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NULLIF(trim(COALESCE(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'ADMIN_REASON_REQUIRED'; END IF;

    UPDATE public.commerce_creator_balances
    SET reserved_xof = GREATEST(0, reserved_xof - v_payout.amount_xof),
        available_xof = available_xof + v_payout.amount_xof,
        updated_at = v_now
    WHERE creator_user_id = v_payout.creator_user_id;

    INSERT INTO public.commerce_creator_ledger(
      creator_user_id, entry_type, net_xof, balance_bucket, description, metadata, created_by, idempotency_key
    ) VALUES (
      v_payout.creator_user_id, 'payout_released', v_payout.amount_xof, 'available',
      'Retrait libéré ' || p_payout_id::text,
      jsonb_build_object('payout_id', p_payout_id, 'decision', p_decision), p_admin_id,
      'payout:released:' || p_payout_id::text
    ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger_id;
    IF v_ledger_id IS NULL THEN RAISE EXCEPTION 'PAYOUT_LEDGER_ALREADY_EXISTS'; END IF;

    UPDATE public.commerce_payout_requests
    SET status = v_target_status,
        admin_reason = trim(p_reason), reviewed_by = p_admin_id, reviewed_at = v_now
    WHERE id = p_payout_id;
    RETURN v_target_status;

  ELSIF p_decision = 'paid' THEN
    IF v_payout.status = 'paid' THEN RETURN 'paid'; END IF;
    IF v_payout.status NOT IN ('approved','processing') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF NULLIF(trim(COALESCE(p_provider_payout_id, '')), '') IS NULL THEN RAISE EXCEPTION 'PROVIDER_REFERENCE_REQUIRED'; END IF;
    IF v_balance.reserved_xof < v_payout.amount_xof THEN RAISE EXCEPTION 'RESERVED_BALANCE_INCONSISTENT'; END IF;

    INSERT INTO public.commerce_creator_ledger(
      creator_user_id, entry_type, net_xof, balance_bucket, description, metadata, created_by, idempotency_key
    ) VALUES (
      v_payout.creator_user_id, 'payout_completed', -v_payout.amount_xof, 'paid',
      'Retrait payé ' || p_payout_id::text,
      jsonb_build_object('payout_id', p_payout_id, 'provider_payout_id', trim(p_provider_payout_id)), p_admin_id,
      'payout:paid:' || p_payout_id::text
    ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger_id;
    IF v_ledger_id IS NULL THEN RAISE EXCEPTION 'PAYOUT_LEDGER_ALREADY_EXISTS'; END IF;

    UPDATE public.commerce_creator_balances
    SET reserved_xof = reserved_xof - v_payout.amount_xof,
        lifetime_paid_xof = lifetime_paid_xof + v_payout.amount_xof,
        updated_at = v_now
    WHERE creator_user_id = v_payout.creator_user_id;

    UPDATE public.commerce_payout_requests
    SET status = 'paid', admin_reason = NULLIF(trim(p_reason), ''),
        provider_payout_id = trim(p_provider_payout_id), reviewed_by = p_admin_id,
        reviewed_at = v_now, paid_at = v_now
    WHERE id = p_payout_id;
    RETURN 'paid';
  END IF;

  RAISE EXCEPTION 'UNKNOWN_DECISION';
END;
$$;

REVOKE ALL ON FUNCTION public.commerce_credit_creator_sale_once(uuid, uuid, integer, integer, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commerce_create_payout_request(uuid, integer, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commerce_process_payout(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_credit_creator_sale_once(uuid, uuid, integer, integer, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_create_payout_request(uuid, integer, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.commerce_process_payout(uuid, text, uuid, text, text) TO service_role;

COMMIT;
