-- Grand Lot 4 — gouvernance Super-admin, moteurs externes, automatisations et notifications
-- Objectifs :
-- 1) journal fiable et non public des recharges/consommations externes ;
-- 2) budgets/alertes administratifs sans exposer les secrets ;
-- 3) audit des changements de gouvernance ;
-- 4) durcissement de la file de notifications historique.
BEGIN;

CREATE TABLE IF NOT EXISTS public.external_service_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('recharge','usage','refund','adjustment')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','platform','provider')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(18,6),
  currency text,
  quantity numeric(18,6),
  unit text,
  reference text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_service_ledger_amount_currency_chk CHECK (
    amount IS NULL OR (currency IS NOT NULL AND length(trim(currency)) BETWEEN 3 AND 12)
  ),
  CONSTRAINT external_service_ledger_non_empty_chk CHECK (
    amount IS NOT NULL OR quantity IS NOT NULL OR description IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS external_service_ledger_provider_occurred_idx
  ON public.external_service_ledger(provider, occurred_at DESC);
CREATE INDEX IF NOT EXISTS external_service_ledger_type_occurred_idx
  ON public.external_service_ledger(entry_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.external_service_budget_settings (
  provider text PRIMARY KEY,
  monthly_budget numeric(18,6),
  currency text,
  low_balance_threshold numeric(18,6),
  notes text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_service_budget_currency_chk CHECK (
    monthly_budget IS NULL OR (currency IS NOT NULL AND length(trim(currency)) BETWEEN 3 AND 12)
  ),
  CONSTRAINT external_service_budget_positive_chk CHECK (
    (monthly_budget IS NULL OR monthly_budget >= 0)
    AND (low_balance_threshold IS NULL OR low_balance_threshold >= 0)
  )
);

CREATE TABLE IF NOT EXISTS public.external_service_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  provider text,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS external_service_admin_audit_created_idx
  ON public.external_service_admin_audit(created_at DESC);

ALTER TABLE public.external_service_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_service_budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_service_admin_audit ENABLE ROW LEVEL SECURITY;

-- Accès exclusivement via les Edge Functions service_role. Aucun secret ni donnée
-- de facturation fournisseur ne doit être lisible directement depuis le navigateur.
REVOKE ALL ON TABLE public.external_service_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.external_service_budget_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.external_service_admin_audit FROM anon, authenticated;

-- L'ancienne migration 016 autorisait l'alimentation directe de la file de
-- notifications par anon/authenticated. Le moteur actuel passe par les Edge Functions :
-- on ferme donc définitivement cette porte sans changer le comportement serveur.
DROP POLICY IF EXISTS "notif_queue_insert" ON public.notification_queue;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notification_queue FROM anon, authenticated;

COMMIT;
