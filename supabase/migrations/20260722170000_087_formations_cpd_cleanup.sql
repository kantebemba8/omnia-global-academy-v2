-- 087 — Formations & CPD : historique crédits + nettoyage tests supprimés
BEGIN;

CREATE TABLE IF NOT EXISTS public.cpd_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credits_added integer NOT NULL CHECK (credits_added > 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  operator_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpd_credit_transactions_created
  ON public.cpd_credit_transactions(created_at DESC);

ALTER TABLE public.cpd_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpd_credit_transactions_superadmin_select" ON public.cpd_credit_transactions;
CREATE POLICY "cpd_credit_transactions_superadmin_select"
ON public.cpd_credit_transactions FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role='super_admin')
);

-- Nettoyage ciblé des anciens tests "Comptabilité SYSCOHADA" déjà supprimés depuis l'interface.
-- La suppression n'est exécutée que si aucune donnée métier réelle n'est liée.
DELETE FROM public.courses c
WHERE lower(trim(c.title)) = lower('Comptabilité SYSCOHADA')
  AND NOT EXISTS (SELECT 1 FROM public.user_enrollments e WHERE e.course_id=c.id)
  AND NOT EXISTS (SELECT 1 FROM public.certificates ce WHERE ce.course_id=c.id)
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.course_id=c.id);

COMMIT;
