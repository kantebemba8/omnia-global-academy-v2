-- 095 — Finance & Commercial synchronisation V30
BEGIN;

-- Provider de paiement actif. Les secrets restent dans Supabase Secrets.
INSERT INTO public.site_settings(key,value)
VALUES
  ('payment_provider_primary','fedapay'),
  ('payment_provider_mode','environment')
ON CONFLICT(key) DO NOTHING;

-- Réservation des retraits pour empêcher un double retrait du même solde.
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS reserved_xof integer NOT NULL DEFAULT 0;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS provider varchar(50),
  ADD COLUMN IF NOT EXISTS provider_reference varchar(255),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE INDEX IF NOT EXISTS idx_payout_requests_status_requested
  ON public.payout_requests(status, requested_at DESC);

-- Reconstituer le montant réservé des demandes déjà ouvertes.
UPDATE public.wallets w
SET reserved_xof = COALESCE((
  SELECT SUM(p.amount_xof)
  FROM public.payout_requests p
  WHERE p.wallet_id=w.id AND p.status IN ('pending','approved')
),0);

-- Licences B2B adaptées au rôle Structure actuel.
ALTER TABLE public.group_licenses
  ADD COLUMN IF NOT EXISTS structure_id uuid,
  ADD COLUMN IF NOT EXISTS name varchar(255),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_group_licenses_structure
  ON public.group_licenses(structure_id, is_active);

-- Création atomique d'une demande de retrait avec réservation du solde.
CREATE OR REPLACE FUNCTION public.finance_create_payout_request(
  p_user_id uuid,
  p_amount_xof integer,
  p_channel text,
  p_mm_operator text DEFAULT NULL,
  p_mm_phone text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_account_holder text DEFAULT NULL,
  p_bank_code text DEFAULT NULL,
  p_branch_code text DEFAULT NULL,
  p_account_number text DEFAULT NULL,
  p_rib_key text DEFAULT NULL,
  p_iban text DEFAULT NULL,
  p_swift text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id=p_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF p_amount_xof <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF (COALESCE(v_wallet.balance_xof,0)-COALESCE(v_wallet.reserved_xof,0)) < p_amount_xof THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE';
  END IF;

  UPDATE public.wallets
  SET reserved_xof=COALESCE(reserved_xof,0)+p_amount_xof, updated_at=now()
  WHERE id=v_wallet.id;

  INSERT INTO public.payout_requests(
    wallet_id,user_id,amount_xof,channel,mm_operator,mm_phone,bank_name,
    account_holder,bank_code,branch_code,account_number,rib_key,iban,swift,status,requested_at
  ) VALUES (
    v_wallet.id,p_user_id,p_amount_xof,p_channel,p_mm_operator,p_mm_phone,p_bank_name,
    p_account_holder,p_bank_code,p_branch_code,p_account_number,p_rib_key,p_iban,p_swift,'pending',now()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Traitement atomique par le Super-admin.
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
SET search_path=public
AS $$
DECLARE
  v_payout public.payout_requests%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_payout FROM public.payout_requests WHERE id=p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE id=v_payout.wallet_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;

  IF p_action='approve' THEN
    IF v_payout.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.payout_requests SET status='approved',approved_at=now(),approved_by=p_admin_id,
      processed_at=now(),admin_note=p_admin_note,provider=COALESCE(p_provider,provider)
    WHERE id=p_payout_id;
    RETURN 'approved';

  ELSIF p_action='reject' THEN
    IF v_payout.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.wallets SET reserved_xof=GREATEST(0,COALESCE(reserved_xof,0)-v_payout.amount_xof),updated_at=now()
      WHERE id=v_wallet.id;
    UPDATE public.payout_requests SET status='rejected',processed_at=now(),admin_note=p_admin_note
      WHERE id=p_payout_id;
    RETURN 'rejected';

  ELSIF p_action='mark_paid' THEN
    IF v_payout.status <> 'approved' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    IF COALESCE(v_wallet.balance_xof,0) < v_payout.amount_xof THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
    UPDATE public.wallets SET
      balance_xof=COALESCE(balance_xof,0)-v_payout.amount_xof,
      reserved_xof=GREATEST(0,COALESCE(reserved_xof,0)-v_payout.amount_xof),
      total_withdrawn_xof=COALESCE(total_withdrawn_xof,0)+v_payout.amount_xof,
      updated_at=now()
    WHERE id=v_wallet.id;
    INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_xof,description)
      VALUES(v_wallet.id,v_payout.user_id,'debit_withdrawal',v_payout.amount_xof,'Retrait payé');
    UPDATE public.payout_requests SET status='paid',paid_at=now(),paid_by=p_admin_id,processed_at=now(),
      admin_note=p_admin_note,provider=COALESCE(p_provider,provider),provider_reference=p_provider_reference
    WHERE id=p_payout_id;
    RETURN 'paid';

  ELSIF p_action='mark_failed' THEN
    IF v_payout.status <> 'approved' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
    UPDATE public.wallets SET reserved_xof=GREATEST(0,COALESCE(reserved_xof,0)-v_payout.amount_xof),updated_at=now()
      WHERE id=v_wallet.id;
    UPDATE public.payout_requests SET status='failed',failed_at=now(),processed_at=now(),
      failure_reason=p_failure_reason,admin_note=p_admin_note,provider=COALESCE(p_provider,provider)
    WHERE id=p_payout_id;
    RETURN 'failed';
  END IF;

  RAISE EXCEPTION 'UNKNOWN_ACTION';
END $$;

COMMIT;
