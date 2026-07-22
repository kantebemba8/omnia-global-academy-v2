-- 088 — Open CPD : sécurisation de l'intégration et libellés
BEGIN;

-- Garantit que les certificats en attente restent explicitement marqués tant
-- qu'aucun workflow Open CPD officiel n'a confirmé leur émission.
UPDATE public.certificates
SET cpd_pending = TRUE
WHERE cpd_accredited = TRUE
  AND cpd_badge_url IS NULL
  AND COALESCE(cpd_pending,FALSE) = FALSE;

COMMIT;
