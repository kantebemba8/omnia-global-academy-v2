BEGIN;

-- GC1 — B2B & contrats
-- Cycle complet : modèles configurables -> devis -> pro forma -> contrat -> paiement -> activation -> avantages -> facture -> renouvellement.

ALTER TABLE public.b2b_plan_templates
  ADD COLUMN IF NOT EXISTS commerce_plan_id uuid REFERENCES public.commerce_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_kind text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS terms_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.b2b_plan_templates'::regclass
      AND conname = 'b2b_plan_templates_kind_check'
  ) THEN
    ALTER TABLE public.b2b_plan_templates
      ADD CONSTRAINT b2b_plan_templates_kind_check
      CHECK (template_kind IN ('education','enterprise','institution','custom'));
  END IF;
END $$;

ALTER TABLE public.b2b_plan_tiers
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.b2b_quotes
  ADD COLUMN IF NOT EXISTS plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

UPDATE public.b2b_quotes
SET submitted_at = COALESCE(submitted_at, created_at)
WHERE status IN ('submitted','changes_requested','accepted','rejected','converted')
  AND submitted_at IS NULL;

ALTER TABLE public.b2b_contracts
  ALTER COLUMN quote_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS renewal_id uuid REFERENCES public.b2b_renewals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.b2b_plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.b2b_plan_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commerce_plan_id uuid REFERENCES public.commerce_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_limit integer,
  ADD COLUMN IF NOT EXISTS benefits_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS structure_signatory_name text,
  ADD COLUMN IF NOT EXISTS structure_signature_note text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.b2b_contracts'::regclass
      AND conname = 'b2b_contracts_source_check'
  ) THEN
    ALTER TABLE public.b2b_contracts
      ADD CONSTRAINT b2b_contracts_source_check
      CHECK (((quote_id IS NOT NULL)::int + (renewal_id IS NOT NULL)::int) = 1);
  END IF;
END $$;

ALTER TABLE public.b2b_payment_proofs
  ADD COLUMN IF NOT EXISTS document_path text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.b2b_invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.b2b_renewals
  ADD COLUMN IF NOT EXISTS result_contract_id uuid REFERENCES public.b2b_contracts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.b2b_proformas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_number text NOT NULL UNIQUE,
  quote_id uuid REFERENCES public.b2b_quotes(id) ON DELETE SET NULL,
  contract_id uuid NOT NULL REFERENCES public.b2b_contracts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  issued_on date NOT NULL DEFAULT current_date,
  due_on date,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','partially_paid','paid','expired','cancelled')),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.b2b_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.b2b_contracts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id,version)
);

CREATE TABLE IF NOT EXISTS public.b2b_entitlement_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.b2b_contracts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  benefit_definition_id uuid NOT NULL REFERENCES public.commerce_benefit_definitions(id) ON DELETE RESTRICT,
  entitlement_id uuid REFERENCES public.commerce_entitlements(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(contract_id,user_id,benefit_definition_id)
);

CREATE TABLE IF NOT EXISTS public.b2b_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.partner_organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_proformas_org_status ON public.b2b_proformas(organization_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_grants_org_user ON public.b2b_entitlement_grants(organization_id,user_id,status);
CREATE INDEX IF NOT EXISTS idx_b2b_contract_versions_contract ON public.b2b_contract_versions(contract_id,version DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_audit_org_created ON public.b2b_audit_log(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_contracts_active_period ON public.b2b_contracts(organization_id,status,starts_on,ends_on);
CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_proformas_contract_unique ON public.b2b_proformas(contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_contracts_renewal_unique ON public.b2b_contracts(renewal_id) WHERE renewal_id IS NOT NULL;

ALTER TABLE public.b2b_proformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.b2b_plan_templates FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_plan_tiers FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_quotes FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_contracts FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_payment_proofs FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_invoices FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_renewals FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_proformas FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_contract_versions FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_entitlement_grants FROM anon, authenticated;
REVOKE ALL ON TABLE public.b2b_audit_log FROM anon, authenticated;

GRANT ALL ON TABLE public.b2b_plan_templates TO service_role;
GRANT ALL ON TABLE public.b2b_plan_tiers TO service_role;
GRANT ALL ON TABLE public.b2b_quotes TO service_role;
GRANT ALL ON TABLE public.b2b_contracts TO service_role;
GRANT ALL ON TABLE public.b2b_payment_proofs TO service_role;
GRANT ALL ON TABLE public.b2b_invoices TO service_role;
GRANT ALL ON TABLE public.b2b_renewals TO service_role;
GRANT ALL ON TABLE public.b2b_proformas TO service_role;
GRANT ALL ON TABLE public.b2b_contract_versions TO service_role;
GRANT ALL ON TABLE public.b2b_entitlement_grants TO service_role;
GRANT ALL ON TABLE public.b2b_audit_log TO service_role;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('b2b-documents','b2b-documents',false,8388608,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


CREATE OR REPLACE FUNCTION public.oga_sync_b2b_payment_totals(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.b2b_contracts%ROWTYPE;
  v_verified numeric(14,2) := 0;
  v_status text;
BEGIN
  SELECT * INTO v_contract FROM public.b2b_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','CONTRACT_NOT_FOUND'); END IF;
  SELECT COALESCE(sum(amount),0) INTO v_verified
  FROM public.b2b_payment_proofs
  WHERE contract_id = p_contract_id AND status = 'verified';
  v_status := CASE
    WHEN v_contract.total_amount = 0 OR v_verified >= v_contract.total_amount THEN 'paid'
    WHEN v_verified > 0 THEN 'partially_paid'
    ELSE 'issued'
  END;
  UPDATE public.b2b_proformas
  SET status = v_status, paid_amount = LEAST(v_verified,amount), updated_at = now()
  WHERE contract_id = p_contract_id AND status NOT IN ('cancelled','expired');
  UPDATE public.b2b_invoices
  SET status = v_status, paid_amount = LEAST(v_verified,amount), updated_at = now()
  WHERE contract_id = p_contract_id AND COALESCE(metadata->>'source','') = 'b2b_contract_activation';
  RETURN jsonb_build_object('ok',true,'verified_amount',v_verified,'payment_status',v_status,'total_amount',v_contract.total_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_save_b2b_plan(
  p_plan_id uuid,
  p_name text,
  p_description text,
  p_template_kind text,
  p_billing_cycle text,
  p_currency text,
  p_base_price numeric,
  p_commerce_plan_id uuid,
  p_terms_text text,
  p_is_active boolean,
  p_tiers jsonb,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_tier jsonb;
  v_min integer;
  v_max integer;
  v_position integer := 0;
BEGIN
  IF NULLIF(trim(COALESCE(p_name,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','PLAN_NAME_REQUIRED');
  END IF;
  IF p_template_kind NOT IN ('education','enterprise','institution','custom') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_TEMPLATE_KIND');
  END IF;
  IF p_billing_cycle NOT IN ('monthly','annual','custom') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_BILLING_CYCLE');
  END IF;
  IF COALESCE(p_base_price,0) < 0 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_BASE_PRICE');
  END IF;
  IF p_commerce_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.commerce_plans WHERE id = p_commerce_plan_id AND audience = 'structure'
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','STRUCTURE_COMMERCE_PLAN_REQUIRED');
  END IF;

  IF jsonb_typeof(COALESCE(p_tiers,'[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_TIERS');
  END IF;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(COALESCE(p_tiers,'[]'::jsonb)) LOOP
    v_min := GREATEST(1, COALESCE(NULLIF(v_tier->>'min_members','')::integer,1));
    v_max := NULL;
    IF NULLIF(v_tier->>'max_members','') IS NOT NULL THEN
      v_max := NULLIF(v_tier->>'max_members','')::integer;
      IF v_max < v_min THEN
        RETURN jsonb_build_object('ok',false,'error','INVALID_TIER_LIMITS');
      END IF;
    END IF;
    IF COALESCE(NULLIF(v_tier->>'fixed_price','')::numeric,0) < 0 OR COALESCE(NULLIF(v_tier->>'unit_price','')::numeric,0) < 0 THEN
      RETURN jsonb_build_object('ok',false,'error','INVALID_TIER_PRICE');
    END IF;
  END LOOP;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.b2b_plan_templates(
      name,description,template_kind,billing_cycle,currency,base_price,commerce_plan_id,terms_text,is_active,created_by
    ) VALUES (
      trim(p_name),COALESCE(p_description,''),p_template_kind,p_billing_cycle,upper(COALESCE(NULLIF(trim(p_currency),''),'XOF')),
      COALESCE(p_base_price,0),p_commerce_plan_id,COALESCE(p_terms_text,''),COALESCE(p_is_active,true),p_actor_user_id
    ) RETURNING id INTO v_plan_id;
  ELSE
    UPDATE public.b2b_plan_templates
    SET name = trim(p_name), description = COALESCE(p_description,''), template_kind = p_template_kind,
        billing_cycle = p_billing_cycle, currency = upper(COALESCE(NULLIF(trim(p_currency),''),'XOF')),
        base_price = COALESCE(p_base_price,0), commerce_plan_id = p_commerce_plan_id,
        terms_text = COALESCE(p_terms_text,''), is_active = COALESCE(p_is_active,true), updated_at = now()
    WHERE id = p_plan_id
    RETURNING id INTO v_plan_id;
    IF v_plan_id IS NULL THEN
      RETURN jsonb_build_object('ok',false,'error','B2B_PLAN_NOT_FOUND');
    END IF;
  END IF;

  DELETE FROM public.b2b_plan_tiers WHERE plan_id = v_plan_id;

  v_position := 0;
  FOR v_tier IN SELECT value FROM jsonb_array_elements(COALESCE(p_tiers,'[]'::jsonb)) LOOP
    v_min := GREATEST(1, COALESCE(NULLIF(v_tier->>'min_members','')::integer,1));
    v_max := NULL;
    IF NULLIF(v_tier->>'max_members','') IS NOT NULL THEN
      v_max := NULLIF(v_tier->>'max_members','')::integer;
    END IF;
    INSERT INTO public.b2b_plan_tiers(
      plan_id,name,min_members,max_members,unit_price,fixed_price,benefits,position,is_active,metadata
    ) VALUES (
      v_plan_id,COALESCE(NULLIF(trim(v_tier->>'name'),''),'Palier ' || (v_position + 1)),v_min,v_max,
      COALESCE(NULLIF(v_tier->>'unit_price','')::numeric,0),COALESCE(NULLIF(v_tier->>'fixed_price','')::numeric,0),
      COALESCE(v_tier->'benefits','[]'::jsonb),v_position,COALESCE((v_tier->>'is_active')::boolean,true),
      COALESCE(v_tier->'metadata','{}'::jsonb)
    );
    v_position := v_position + 1;
  END LOOP;

  INSERT INTO public.b2b_audit_log(actor_user_id,event_type,entity_type,entity_id,metadata)
  VALUES (p_actor_user_id,CASE WHEN p_plan_id IS NULL THEN 'b2b_plan_created' ELSE 'b2b_plan_updated' END,'plan',v_plan_id,jsonb_build_object('name',p_name,'commerce_plan_id',p_commerce_plan_id));

  RETURN jsonb_build_object('ok',true,'plan_id',v_plan_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_accept_b2b_quote(
  p_quote_id uuid,
  p_admin_user_id uuid,
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_total numeric,
  p_starts_on date,
  p_ends_on date,
  p_terms text,
  p_title text,
  p_payment_method text,
  p_benefits_snapshot jsonb,
  p_due_on date,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.b2b_quotes%ROWTYPE;
  v_contract public.b2b_contracts%ROWTYPE;
  v_proforma public.b2b_proformas%ROWTYPE;
  v_commerce_plan_id uuid;
BEGIN
  SELECT * INTO v_quote FROM public.b2b_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'submitted' THEN
    RETURN jsonb_build_object('ok',false,'error','QUOTE_NOT_FOUND_OR_ALREADY_REVIEWED');
  END IF;
  IF p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on < p_starts_on THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_CONTRACT_DATES');
  END IF;
  IF NULLIF(trim(COALESCE(p_terms,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','CONTRACT_TERMS_REQUIRED');
  END IF;
  IF p_payment_method NOT IN ('bank_transfer','mobile_money','card','other') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_PAYMENT_METHOD');
  END IF;
  BEGIN
    v_commerce_plan_id := NULLIF(v_quote.plan_snapshot->>'commerce_plan_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_commerce_plan_id := NULL;
  END;

  UPDATE public.b2b_quotes
  SET status = 'accepted', subtotal = GREATEST(COALESCE(p_subtotal,0),0),
      discount_amount = GREATEST(COALESCE(p_discount,0),0), tax_amount = GREATEST(COALESCE(p_tax,0),0),
      total_amount = GREATEST(COALESCE(p_total,0),0), reviewed_by = p_admin_user_id, reviewed_at = now(),
      admin_comment = NULLIF(trim(COALESCE(p_comment,'')),''), updated_at = now()
  WHERE id = v_quote.id
  RETURNING * INTO v_quote;

  INSERT INTO public.b2b_contracts(
    contract_number,quote_id,organization_id,plan_id,tier_id,commerce_plan_id,title,terms,terms_version,
    starts_on,ends_on,member_limit,benefits_snapshot,total_amount,currency,payment_method,status,created_by,metadata
  ) VALUES (
    'CTR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    v_quote.id,v_quote.organization_id,v_quote.plan_id,v_quote.tier_id,v_commerce_plan_id,
    COALESCE(NULLIF(trim(p_title),''),'Contrat ' || v_quote.quote_number),trim(p_terms),1,
    p_starts_on,p_ends_on,v_quote.member_count,COALESCE(p_benefits_snapshot,'[]'::jsonb),v_quote.total_amount,v_quote.currency,
    p_payment_method,'sent',p_admin_user_id,jsonb_build_object('quote_number',v_quote.quote_number)
  ) RETURNING * INTO v_contract;

  INSERT INTO public.b2b_contract_versions(contract_id,version,snapshot,reason,created_by)
  VALUES (v_contract.id,1,to_jsonb(v_contract),'Création depuis devis accepté',p_admin_user_id);

  INSERT INTO public.b2b_proformas(
    proforma_number,quote_id,contract_id,organization_id,amount,currency,due_on,created_by,metadata
  ) VALUES (
    'PRO-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    v_quote.id,v_contract.id,v_quote.organization_id,v_quote.total_amount,v_quote.currency,p_due_on,p_admin_user_id,
    jsonb_build_object('contract_number',v_contract.contract_number)
  ) RETURNING * INTO v_proforma;

  UPDATE public.b2b_quotes SET status = 'converted', updated_at = now() WHERE id = v_quote.id;

  INSERT INTO public.b2b_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  VALUES (v_quote.organization_id,p_admin_user_id,'contract_sent','contract',v_contract.id,jsonb_build_object('quote_id',v_quote.id,'proforma_id',v_proforma.id,'total_amount',v_contract.total_amount));

  RETURN jsonb_build_object('ok',true,'quote_id',v_quote.id,'contract_id',v_contract.id,'contract_number',v_contract.contract_number,'proforma_id',v_proforma.id,'proforma_number',v_proforma.proforma_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_approve_b2b_renewal(
  p_renewal_id uuid,
  p_admin_user_id uuid,
  p_total_amount numeric,
  p_title text,
  p_terms text,
  p_payment_method text,
  p_due_on date,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_renewal public.b2b_renewals%ROWTYPE;
  v_previous public.b2b_contracts%ROWTYPE;
  v_contract public.b2b_contracts%ROWTYPE;
  v_proforma public.b2b_proformas%ROWTYPE;
BEGIN
  SELECT * INTO v_renewal FROM public.b2b_renewals WHERE id = p_renewal_id FOR UPDATE;
  IF NOT FOUND OR v_renewal.status NOT IN ('requested','under_review') THEN
    RETURN jsonb_build_object('ok',false,'error','RENEWAL_NOT_FOUND_OR_ALREADY_REVIEWED');
  END IF;
  SELECT * INTO v_previous FROM public.b2b_contracts WHERE id = v_renewal.contract_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PREVIOUS_CONTRACT_NOT_FOUND'); END IF;
  IF v_renewal.requested_end < v_renewal.requested_start THEN RETURN jsonb_build_object('ok',false,'error','INVALID_RENEWAL_DATES'); END IF;
  IF NULLIF(trim(COALESCE(p_terms,v_previous.terms)),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'error','CONTRACT_TERMS_REQUIRED'); END IF;
  IF p_payment_method NOT IN ('bank_transfer','mobile_money','card','other') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_PAYMENT_METHOD'); END IF;

  UPDATE public.b2b_renewals
  SET status = 'approved', reviewed_by = p_admin_user_id, reviewed_at = now(), admin_comment = NULLIF(trim(COALESCE(p_comment,'')),''), updated_at = now()
  WHERE id = v_renewal.id;

  INSERT INTO public.b2b_contracts(
    contract_number,renewal_id,organization_id,plan_id,tier_id,commerce_plan_id,title,terms,terms_version,
    starts_on,ends_on,member_limit,benefits_snapshot,total_amount,currency,payment_method,status,created_by,metadata
  ) VALUES (
    'CTR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    v_renewal.id,v_renewal.organization_id,v_previous.plan_id,v_previous.tier_id,v_previous.commerce_plan_id,
    COALESCE(NULLIF(trim(p_title),''),v_previous.title || ' — renouvellement'),COALESCE(NULLIF(trim(p_terms),''),v_previous.terms),v_previous.terms_version + 1,
    v_renewal.requested_start,v_renewal.requested_end,v_renewal.requested_member_count,v_previous.benefits_snapshot,
    GREATEST(COALESCE(p_total_amount,v_previous.total_amount),0),v_previous.currency,p_payment_method,'sent',p_admin_user_id,
    jsonb_build_object('previous_contract_id',v_previous.id)
  ) RETURNING * INTO v_contract;

  INSERT INTO public.b2b_contract_versions(contract_id,version,snapshot,reason,created_by)
  VALUES (v_contract.id,v_contract.terms_version,to_jsonb(v_contract),'Renouvellement du contrat ' || v_previous.contract_number,p_admin_user_id);

  INSERT INTO public.b2b_proformas(proforma_number,contract_id,organization_id,amount,currency,due_on,created_by,metadata)
  VALUES (
    'PRO-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    v_contract.id,v_contract.organization_id,v_contract.total_amount,v_contract.currency,p_due_on,p_admin_user_id,
    jsonb_build_object('renewal_id',v_renewal.id,'previous_contract_id',v_previous.id)
  ) RETURNING * INTO v_proforma;

  UPDATE public.b2b_renewals SET result_contract_id = v_contract.id, updated_at = now() WHERE id = v_renewal.id;

  INSERT INTO public.b2b_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  VALUES (v_contract.organization_id,p_admin_user_id,'renewal_contract_sent','contract',v_contract.id,jsonb_build_object('renewal_id',v_renewal.id,'proforma_id',v_proforma.id));

  RETURN jsonb_build_object('ok',true,'renewal_id',v_renewal.id,'contract_id',v_contract.id,'contract_number',v_contract.contract_number,'proforma_id',v_proforma.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_refresh_b2b_contract_entitlements(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract record;
  v_user_id uuid;
  v_benefit jsonb;
  v_definition_id uuid;
  v_value jsonb;
  v_value_type text;
  v_remaining numeric;
  v_grant public.b2b_entitlement_grants%ROWTYPE;
  v_entitlement_id uuid;
  v_granted integer := 0;
  v_revoked integer := 0;
BEGIN
  -- Expiration sans Cron : les accès sont recalculés à chaque passage du moteur B2B.
  UPDATE public.b2b_quotes
  SET status = 'expired', updated_at = now()
  WHERE organization_id = p_organization_id
    AND status IN ('draft','submitted','changes_requested')
    AND valid_until IS NOT NULL AND valid_until < current_date;

  UPDATE public.b2b_contracts
  SET status = 'expired', updated_at = now()
  WHERE organization_id = p_organization_id
    AND status = 'active' AND ends_on < current_date;

  UPDATE public.b2b_proformas
  SET status = 'expired', updated_at = now()
  WHERE organization_id = p_organization_id
    AND status IN ('issued','partially_paid')
    AND due_on IS NOT NULL AND due_on < current_date;

  -- Révoque d'abord les droits qui ne sont plus légitimes.
  FOR v_grant IN
    SELECT g.*
    FROM public.b2b_entitlement_grants g
    LEFT JOIN public.b2b_contracts c ON c.id = g.contract_id
    WHERE g.organization_id = p_organization_id
      AND g.status = 'active'
      AND (
        c.id IS NULL
        OR c.status <> 'active'
        OR current_date < c.starts_on
        OR current_date > c.ends_on
        OR NOT EXISTS (
          SELECT 1
          FROM (
            SELECT pm.user_id
            FROM public.partner_managers pm
            WHERE pm.organization_id = p_organization_id
              AND lower(COALESCE(pm.status,'')) IN ('actif','active')
            UNION
            SELECT pcu.user_id
            FROM public.partner_code_users pcu
            WHERE pcu.organization_id = p_organization_id
              AND lower(COALESCE(pcu.status,'')) IN ('validated','approved','active','actif')
          ) active_users
          WHERE active_users.user_id = g.user_id
        )
      )
  LOOP
    IF v_grant.entitlement_id IS NOT NULL THEN
      UPDATE public.commerce_entitlements
      SET status = 'revoked', updated_at = now()
      WHERE id = v_grant.entitlement_id
        AND status <> 'revoked';
    END IF;
    UPDATE public.b2b_entitlement_grants
    SET status = 'revoked', revoked_at = now()
    WHERE id = v_grant.id;
    v_revoked := v_revoked + 1;
  END LOOP;

  -- Accorde ou réactive les droits prévus par les contrats actifs.
  FOR v_contract IN
    SELECT *
    FROM public.b2b_contracts
    WHERE organization_id = p_organization_id
      AND status = 'active'
      AND current_date BETWEEN starts_on AND ends_on
  LOOP
    IF jsonb_typeof(COALESCE(v_contract.benefits_snapshot,'[]'::jsonb)) <> 'array' THEN
      CONTINUE;
    END IF;

    FOR v_user_id IN
      SELECT DISTINCT user_id
      FROM (
        SELECT pm.user_id
        FROM public.partner_managers pm
        WHERE pm.organization_id = p_organization_id
          AND lower(COALESCE(pm.status,'')) IN ('actif','active')
        UNION
        SELECT pcu.user_id
        FROM public.partner_code_users pcu
        WHERE pcu.organization_id = p_organization_id
          AND lower(COALESCE(pcu.status,'')) IN ('validated','approved','active','actif')
      ) active_users
      WHERE user_id IS NOT NULL
    LOOP
      FOR v_benefit IN SELECT value FROM jsonb_array_elements(v_contract.benefits_snapshot)
      LOOP
        BEGIN
          v_definition_id := NULLIF(v_benefit->>'benefit_definition_id','')::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_definition_id := NULL;
        END;
        IF v_definition_id IS NULL THEN CONTINUE; END IF;

        v_value := COALESCE(v_benefit->'value_json','{}'::jsonb);
        v_value_type := COALESCE(v_benefit->>'value_type','');
        v_remaining := NULL;
        IF v_value_type IN ('quantity','credit','capacity') THEN
          BEGIN
            v_remaining := COALESCE(
              NULLIF(v_value->>'quantity','')::numeric,
              NULLIF(v_value->>'credits','')::numeric,
              NULLIF(v_value->>'capacity','')::numeric,
              NULLIF(v_value->>'value','')::numeric
            );
          EXCEPTION WHEN OTHERS THEN
            v_remaining := NULL;
          END;
        END IF;

        SELECT * INTO v_grant
        FROM public.b2b_entitlement_grants
        WHERE contract_id = v_contract.id
          AND user_id = v_user_id
          AND benefit_definition_id = v_definition_id
        LIMIT 1;

        IF FOUND AND v_grant.entitlement_id IS NOT NULL THEN
          UPDATE public.commerce_entitlements
          SET source_plan_id = v_contract.commerce_plan_id,
              value_json = v_value,
              remaining_quantity = CASE WHEN commerce_entitlements.remaining_quantity IS NULL THEN v_remaining ELSE commerce_entitlements.remaining_quantity END,
              reset_period = NULLIF(v_benefit->>'reset_period',''),
              valid_from = v_contract.starts_on::timestamptz,
              valid_until = (v_contract.ends_on::text || ' 23:59:59+00')::timestamptz,
              status = 'active',
              metadata = jsonb_build_object(
                'source','b2b_contract',
                'organization_id',p_organization_id,
                'contract_id',v_contract.id
              ),
              updated_at = now()
          WHERE id = v_grant.entitlement_id;

          UPDATE public.b2b_entitlement_grants
          SET status = 'active', revoked_at = NULL,
              metadata = jsonb_build_object('reactivated_at',now())
          WHERE id = v_grant.id;
        ELSE
          INSERT INTO public.commerce_entitlements(
            user_id, benefit_definition_id, source_plan_id,
            value_json, remaining_quantity, reset_period,
            valid_from, valid_until, status, metadata
          ) VALUES (
            v_user_id, v_definition_id, v_contract.commerce_plan_id,
            v_value, v_remaining, NULLIF(v_benefit->>'reset_period',''),
            v_contract.starts_on::timestamptz,
            (v_contract.ends_on::text || ' 23:59:59+00')::timestamptz,
            'active',
            jsonb_build_object('source','b2b_contract','organization_id',p_organization_id,'contract_id',v_contract.id)
          ) RETURNING id INTO v_entitlement_id;

          INSERT INTO public.b2b_entitlement_grants(
            contract_id,organization_id,user_id,benefit_definition_id,entitlement_id,status,metadata
          ) VALUES (
            v_contract.id,p_organization_id,v_user_id,v_definition_id,v_entitlement_id,'active',
            jsonb_build_object('source','b2b_contract')
          )
          ON CONFLICT (contract_id,user_id,benefit_definition_id) DO UPDATE
          SET entitlement_id = EXCLUDED.entitlement_id,
              status = 'active', revoked_at = NULL,
              metadata = EXCLUDED.metadata;
          v_granted := v_granted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'granted',v_granted,'revoked',v_revoked);
END;
$$;

CREATE OR REPLACE FUNCTION public.oga_finalize_b2b_contract(
  p_contract_id uuid,
  p_admin_user_id uuid,
  p_admin_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.b2b_contracts%ROWTYPE;
  v_verified numeric(14,2) := 0;
  v_invoice_id uuid;
  v_invoice_status text;
BEGIN
  SELECT * INTO v_contract
  FROM public.b2b_contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','CONTRACT_NOT_FOUND');
  END IF;

  IF v_contract.status IN ('terminated','expired') THEN
    RETURN jsonb_build_object('ok',false,'error','CONTRACT_CLOSED');
  END IF;

  IF v_contract.structure_signed_at IS NULL OR v_contract.structure_signed_by IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','STRUCTURE_SIGNATURE_REQUIRED');
  END IF;

  UPDATE public.b2b_contracts
  SET admin_signed_by = COALESCE(admin_signed_by,p_admin_user_id),
      admin_signed_at = COALESCE(admin_signed_at,now()),
      updated_at = now()
  WHERE id = p_contract_id;

  SELECT COALESCE(sum(amount),0) INTO v_verified
  FROM public.b2b_payment_proofs
  WHERE contract_id = p_contract_id
    AND status = 'verified';

  IF v_contract.total_amount > 0 AND v_verified < v_contract.total_amount THEN
    RETURN jsonb_build_object(
      'ok',true,
      'active',false,
      'payment_required',true,
      'verified_amount',v_verified,
      'total_amount',v_contract.total_amount
    );
  END IF;

  UPDATE public.b2b_contracts
  SET status = 'active',
      activated_at = COALESCE(activated_at,now()),
      suspended_at = NULL,
      status_reason = NULLIF(trim(COALESCE(p_admin_comment,'')),''),
      updated_at = now()
  WHERE id = p_contract_id
  RETURNING * INTO v_contract;

  UPDATE public.b2b_proformas
  SET status = CASE WHEN v_verified >= amount THEN 'paid' ELSE 'partially_paid' END,
      paid_amount = LEAST(v_verified,amount),
      updated_at = now()
  WHERE contract_id = p_contract_id
    AND status NOT IN ('cancelled','expired');

  v_invoice_status := CASE
    WHEN v_contract.total_amount = 0 OR v_verified >= v_contract.total_amount THEN 'paid'
    WHEN v_verified > 0 THEN 'partially_paid'
    ELSE 'issued'
  END;

  SELECT id INTO v_invoice_id
  FROM public.b2b_invoices
  WHERE contract_id = p_contract_id
    AND COALESCE(metadata->>'source','') = 'b2b_contract_activation'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    INSERT INTO public.b2b_invoices(
      invoice_number,contract_id,organization_id,amount,currency,
      issued_on,due_on,status,paid_amount,created_by,metadata
    ) VALUES (
      'FAC-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      v_contract.id,v_contract.organization_id,v_contract.total_amount,v_contract.currency,
      current_date,current_date,v_invoice_status,LEAST(v_verified,v_contract.total_amount),p_admin_user_id,
      jsonb_build_object('source','b2b_contract_activation')
    ) RETURNING id INTO v_invoice_id;
  ELSE
    UPDATE public.b2b_invoices
    SET status = v_invoice_status,
        paid_amount = LEAST(v_verified,v_contract.total_amount),
        updated_at = now()
    WHERE id = v_invoice_id;
  END IF;

  IF v_contract.renewal_id IS NOT NULL THEN
    UPDATE public.b2b_renewals
    SET status = 'completed', result_contract_id = v_contract.id, updated_at = now()
    WHERE id = v_contract.renewal_id;
  END IF;

  PERFORM public.oga_refresh_b2b_contract_entitlements(v_contract.organization_id);

  INSERT INTO public.b2b_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  VALUES (
    v_contract.organization_id,p_admin_user_id,'contract_activated','contract',v_contract.id,
    jsonb_build_object('verified_amount',v_verified,'total_amount',v_contract.total_amount,'invoice_id',v_invoice_id)
  );

  RETURN jsonb_build_object(
    'ok',true,'active',true,'verified_amount',v_verified,
    'total_amount',v_contract.total_amount,'invoice_id',v_invoice_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.oga_sync_b2b_payment_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_save_b2b_plan(uuid,text,text,text,text,text,numeric,uuid,text,boolean,jsonb,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_accept_b2b_quote(uuid,uuid,numeric,numeric,numeric,numeric,date,date,text,text,text,jsonb,date,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_approve_b2b_renewal(uuid,uuid,numeric,text,text,text,date,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_refresh_b2b_contract_entitlements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oga_finalize_b2b_contract(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oga_sync_b2b_payment_totals(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_save_b2b_plan(uuid,text,text,text,text,text,numeric,uuid,text,boolean,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_accept_b2b_quote(uuid,uuid,numeric,numeric,numeric,numeric,date,date,text,text,text,jsonb,date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_approve_b2b_renewal(uuid,uuid,numeric,text,text,text,date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_refresh_b2b_contract_entitlements(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_finalize_b2b_contract(uuid,uuid,text) TO service_role;

COMMIT;
