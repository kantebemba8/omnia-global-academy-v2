-- Correctif post-Grand Lot 4 — synchronisation automatique prioritaire de tous les moteurs externes
-- Objectifs :
-- 1) automatiser le suivi fournisseur dès qu'une API officielle ou une télémétrie OGA fiable existe ;
-- 2) rendre les écritures fournisseur idempotentes ;
-- 3) mémoriser l'état de synchronisation sans exposer aucun secret ;
-- 4) conserver la saisie manuelle uniquement comme secours/rapprochement exceptionnel ;
-- 5) ne jamais inventer une recharge, un coût ou une conversion monétaire non fournie par le fournisseur.
BEGIN;

ALTER TABLE public.external_service_ledger
  ADD COLUMN IF NOT EXISTS provider_entry_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'external_service_ledger_provider_entry_key_key'
      AND conrelid = 'public.external_service_ledger'::regclass
  ) THEN
    ALTER TABLE public.external_service_ledger
      ADD CONSTRAINT external_service_ledger_provider_entry_key_key UNIQUE (provider_entry_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.external_service_sync_state (
  provider text PRIMARY KEY,
  auto_sync_enabled boolean NOT NULL DEFAULT true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_project_id text,
  last_project_name text,
  last_rows_synced integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_service_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_service_sync_state FROM anon, authenticated;

INSERT INTO public.external_service_sync_state(provider, auto_sync_enabled, metadata)
VALUES
  ('openai', true, jsonb_build_object(
    'mode', 'provider_costs_api',
    'lookback_days', 90,
    'minimum_interval_minutes', 15,
    'recharge_mode', 'provider_auto_reload',
    'manual_fallback', true,
    'recharge_transactions_api_available', false
  )),
  ('anthropic', true, jsonb_build_object(
    'mode', 'provider_cost_report_api',
    'lookback_days', 30,
    'minimum_interval_minutes', 15,
    'recharge_mode', 'provider_auto_reload',
    'manual_fallback', true
  )),
  ('brevo', true, jsonb_build_object(
    'mode', 'provider_account_credits_api',
    'minimum_interval_minutes', 15,
    'recharge_mode', 'provider_plan_or_credit_purchase',
    'manual_fallback', true
  )),
  ('cloudflare', true, jsonb_build_object(
    'mode', 'provider_billable_usage_api',
    'minimum_interval_minutes', 15,
    'recharge_mode', 'postpaid_or_subscription',
    'manual_fallback', true
  )),
  ('fedapay', true, jsonb_build_object(
    'mode', 'provider_transactions_balances_api',
    'minimum_interval_minutes', 15,
    'recharge_mode', 'merchant_balance',
    'manual_fallback', true,
    'monetary_scale_assumed', false
  )),
  ('jaas', true, jsonb_build_object(
    'mode', 'platform_telemetry',
    'recharge_mode', 'subscription_invoice',
    'manual_fallback', true
  )),
  ('fcm', true, jsonb_build_object(
    'mode', 'platform_telemetry_no_cost',
    'recharge_mode', 'not_applicable',
    'manual_fallback', false
  )),
  ('apns', true, jsonb_build_object(
    'mode', 'platform_telemetry',
    'recharge_mode', 'not_applicable',
    'manual_fallback', false
  )),
  ('sentry', true, jsonb_build_object(
    'mode', 'provider_stats_api_optional',
    'minimum_interval_minutes', 15,
    'recharge_mode', 'subscription_or_quota',
    'manual_fallback', true
  ))
ON CONFLICT (provider) DO UPDATE SET
  auto_sync_enabled = EXCLUDED.auto_sync_enabled,
  metadata = public.external_service_sync_state.metadata || EXCLUDED.metadata,
  updated_at = now();

COMMIT;
