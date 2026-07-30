-- Cycle 2 — Lot 6B
-- Alignement du portefeuille professeur et des écritures financières.
BEGIN;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_id text;

UPDATE public.wallet_transactions AS transaction
SET user_id = wallet.user_id
FROM public.wallets AS wallet
WHERE transaction.wallet_id = wallet.id
  AND transaction.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
  ON public.wallet_transactions(reference_id)
  WHERE reference_id IS NOT NULL;

COMMIT;
