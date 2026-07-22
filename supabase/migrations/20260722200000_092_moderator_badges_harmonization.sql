-- 092 — Harmonisation modérateurs, badges de certification et comptes tests épinglés
BEGIN;

-- Matrice de permissions : les clés restent JSONB pour permettre l'évolution sans migration à chaque ajout.
-- Les permissions financières, publication définitive, suppression définitive, rôles et configuration plateforme
-- restent réservées au Super-admin.
ALTER TABLE public.moderator_permissions
  ADD COLUMN IF NOT EXISTS permission_version integer NOT NULL DEFAULT 2;

-- Valeurs par défaut uniquement pour les permissions support/modération.
UPDATE public.moderator_permissions
SET permissions = COALESCE(permissions,'{}'::jsonb) || jsonb_build_object(
  'can_see_pending_courses', true,
  'can_review_course_content', true,
  'can_request_course_modification', true,
  'can_recommend_course_price', true,
  'can_approve_transmit_course', true,
  'can_manage_course_certifications', true,
  'can_create_assisted_course', true,
  'can_see_learners_list', true,
  'can_see_professors_list', true,
  'can_see_structures_list', true,
  'can_see_organizers_list', true,
  'can_validate_professor_kyc', true,
  'can_validate_structure_kyc', true,
  'can_request_account_suspension', true,
  'can_moderate_forum', true,
  'can_moderate_jobs', true,
  'can_manage_support', true,
  'can_view_ai_conversations', true,
  'can_manage_reports', true,
  'can_review_live_events', true,
  'can_review_live_reports', true,
  'can_review_live_refunds', true,
  'can_review_live_organizers', true,
  'can_review_structure_requests', true,
  'can_review_structure_codes', true,
  'can_review_structure_benefits', true,
  'can_view_analytics', true
),
permission_version=2;

-- Les badges et accréditations validés font foi pour le certificat final.
-- Aucun badge en statut pending/rejected/revoked ne doit être affiché.
CREATE OR REPLACE VIEW public.course_validated_certificate_badges AS
SELECT
  cc.course_id,
  jsonb_agg(
    jsonb_build_object(
      'id',cc.id,
      'type',cc.certification_type,
      'organization_name',cc.organization_name,
      'certification_name',cc.certification_name,
      'certification_code',cc.certification_code,
      'badge_url',cc.badge_url,
      'logo_url',cc.logo_url,
      'verification_url',cc.verification_url,
      'credit_value',cc.credit_value,
      'credit_unit',cc.credit_unit
    ) ORDER BY cc.created_at
  ) FILTER (WHERE cc.status='validated') AS badges
FROM public.course_certifications cc
GROUP BY cc.course_id;

COMMIT;
