-- 091 — Registre unifié Certificats & Attestations + synchronisation Omnia Live
BEGIN;

-- Lie les anciens modèles Omnia Live au nouveau gestionnaire global.
ALTER TABLE public.live_document_templates
  ADD COLUMN IF NOT EXISTS global_template_id uuid
  REFERENCES public.certificate_templates(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_live_document_templates_global_template
  ON public.live_document_templates(global_template_id)
  WHERE global_template_id IS NOT NULL;

-- Synchronise les modèles globaux destinés à Omnia Live avec le moteur Live existant.
CREATE OR REPLACE FUNCTION public.sync_global_certificate_template_to_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  mapped_status text;
BEGIN
  IF NEW.source_type <> 'omnia_live' THEN
    RETURN NEW;
  END IF;

  mapped_status := CASE
    WHEN NEW.is_active THEN 'active'
    ELSE 'inactive'
  END;

  INSERT INTO public.live_document_templates(
    global_template_id,
    template_key,
    name,
    document_type,
    status,
    design_config,
    eligibility_rules,
    logo_mode,
    created_by,
    updated_by,
    updated_at
  )
  VALUES(
    NEW.id,
    NEW.code,
    NEW.name,
    NEW.document_type,
    mapped_status,
    COALESCE(NEW.layout_json,'{}'::jsonb),
    '{}'::jsonb,
    CASE WHEN NEW.issuer_scope='structure' THEN 'platform_and_organizer' ELSE 'platform' END,
    NEW.created_by,
    NEW.created_by,
    now()
  )
  ON CONFLICT(global_template_id) DO UPDATE SET
    template_key=EXCLUDED.template_key,
    name=EXCLUDED.name,
    document_type=EXCLUDED.document_type,
    status=EXCLUDED.status,
    design_config=EXCLUDED.design_config,
    logo_mode=EXCLUDED.logo_mode,
    updated_by=EXCLUDED.updated_by,
    updated_at=now();

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_global_certificate_template_to_live
  ON public.certificate_templates;

CREATE TRIGGER trg_sync_global_certificate_template_to_live
AFTER INSERT OR UPDATE OF
  name,code,document_type,source_type,issuer_scope,is_active,layout_json
ON public.certificate_templates
FOR EACH ROW
EXECUTE FUNCTION public.sync_global_certificate_template_to_live();

-- Synchronisation initiale des modèles Live déjà créés en V18.
INSERT INTO public.live_document_templates(
  global_template_id,template_key,name,document_type,status,
  design_config,eligibility_rules,logo_mode,created_by,updated_by
)
SELECT
  t.id,t.code,t.name,t.document_type,
  CASE WHEN t.is_active THEN 'active' ELSE 'inactive' END,
  COALESCE(t.layout_json,'{}'::jsonb),'{}'::jsonb,
  CASE WHEN t.issuer_scope='structure' THEN 'platform_and_organizer' ELSE 'platform' END,
  t.created_by,t.created_by
FROM public.certificate_templates t
WHERE t.source_type='omnia_live'
ON CONFLICT(global_template_id) DO UPDATE SET
  template_key=EXCLUDED.template_key,
  name=EXCLUDED.name,
  document_type=EXCLUDED.document_type,
  status=EXCLUDED.status,
  design_config=EXCLUDED.design_config,
  logo_mode=EXCLUDED.logo_mode,
  updated_at=now();

-- Registre administratif unifié.
-- Aucune duplication physique : la vue lit les 2 moteurs existants en temps réel.
CREATE OR REPLACE VIEW public.certificate_registry_unified AS

SELECT
  c.id AS source_record_id,
  'course'::text AS registry_source,
  c.omnia_certificate_id::text AS document_number,
  c.user_id,
  c.student_full_name::text AS beneficiary_name,
  c.course_title::text AS subject_title,
  COALESCE(c.document_type,'completion_certificate')::text AS document_type,
  COALESCE(c.source_type,'course')::text AS source_type,
  COALESCE(c.language_code,'fr')::text AS language_code,
  COALESCE(c.issuer_name,c.creator_name,c.establishment_name,'Omnia Global Academy')::text AS issuer_name,
  COALESCE(c.status,c.validity_status,'valide')::text AS status,
  c.cpd_accredited,
  c.cpd_badge_url,
  c.pdf_url,
  c.verification_url,
  c.issued_at::timestamptz AS issued_at,
  c.revoked_at::timestamptz AS revoked_at,
  c.revocation_reason::text AS revocation_reason,
  c.template_id,
  c.template_version,
  c.issuance_snapshot
FROM public.certificates c

UNION ALL

SELECT
  l.id AS source_record_id,
  'omnia_live'::text AS registry_source,
  l.document_number::text AS document_number,
  l.user_id,
  l.participant_name::text AS beneficiary_name,
  l.event_title::text AS subject_title,
  l.document_type::text AS document_type,
  'omnia_live'::text AS source_type,
  COALESCE((l.immutable_payload->>'language_code'),'fr')::text AS language_code,
  COALESCE(l.organizer_name,'Omnia Global Academy')::text AS issuer_name,
  l.status::text AS status,
  (l.document_type='cpd_certificate') AS cpd_accredited,
  NULL::text AS cpd_badge_url,
  CASE
    WHEN l.pdf_storage_key IS NOT NULL THEN l.pdf_storage_key
    ELSE NULL
  END::text AS pdf_url,
  l.verification_url::text AS verification_url,
  l.created_at::timestamptz AS issued_at,
  l.revoked_at::timestamptz AS revoked_at,
  l.revocation_reason::text AS revocation_reason,
  ldt.global_template_id AS template_id,
  NULL::integer AS template_version,
  l.immutable_payload AS issuance_snapshot
FROM public.live_issued_documents l
LEFT JOIN public.live_document_templates ldt ON ldt.id=l.template_id;

COMMENT ON VIEW public.certificate_registry_unified IS
'Registre administratif temps réel des certificats de formation et documents Omnia Live. Ne duplique aucune donnée.';

COMMIT;
