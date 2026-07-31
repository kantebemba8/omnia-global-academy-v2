-- Cycle 8 — Réconciliation finale des fonctions Career
-- Sécurise l'export PDF avec débit atomique, réexport gratuit si inchangé
-- et idempotence par identifiant de requête.

ALTER TABLE public.career_export_logs
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_career_export_logs_user_request
  ON public.career_export_logs(user_id, request_id)
  WHERE request_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.career_prepare_pdf_export(
  uuid, uuid, text, text, text, uuid, text, text
);

CREATE OR REPLACE FUNCTION public.career_prepare_pdf_export(
  p_user_id uuid,
  p_document_id uuid,
  p_doc_type text,
  p_title text,
  p_template_key text,
  p_request_id uuid,
  p_ip_address text,
  p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_document public.career_documents%ROWTYPE;
  v_existing public.career_export_logs%ROWTYPE;
  v_export_id uuid;
  v_cost integer := 0;
  v_balance integer := 0;
  v_current_hash text;
  v_free_reexport boolean := false;
  v_config_key text;
BEGIN
  IF p_user_id IS NULL OR p_document_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_FIELDS',
      'message', 'Utilisateur ou document manquant.'
    );
  END IF;

  IF p_doc_type NOT IN ('cv', 'lm') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_DOC_TYPE',
      'message', 'Type de document invalide.'
    );
  END IF;

  IF p_request_id IS NULL THEN
    p_request_id := gen_random_uuid();
  END IF;

  SELECT *
  INTO v_existing
  FROM public.career_export_logs
  WHERE user_id = p_user_id
    AND request_id = p_request_id
  LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(cv_tokens, 0)
    INTO v_balance
    FROM public.users
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'export_id', v_existing.id,
      'tokens_consumed', COALESCE(v_existing.tokens_consumed, 0),
      'tokens_remaining', COALESCE(v_balance, 0),
      'free_reexport', COALESCE(v_existing.tokens_consumed, 0) = 0,
      'message', 'Export déjà préparé.'
    );
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_user.status, '') <> 'actif' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_ACTIVE',
      'message', 'Compte utilisateur inactif ou introuvable.'
    );
  END IF;

  -- Nouvelle vérification après le verrou utilisateur pour fermer la course
  -- entre deux requêtes portant le même request_id.
  SELECT *
  INTO v_existing
  FROM public.career_export_logs
  WHERE user_id = p_user_id
    AND request_id = p_request_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'export_id', v_existing.id,
      'tokens_consumed', COALESCE(v_existing.tokens_consumed, 0),
      'tokens_remaining', COALESCE(v_user.cv_tokens, 0),
      'free_reexport', COALESCE(v_existing.tokens_consumed, 0) = 0,
      'message', 'Export déjà préparé.'
    );
  END IF;

  SELECT *
  INTO v_document
  FROM public.career_documents
  WHERE id = p_document_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DOCUMENT_NOT_FOUND',
      'message', 'Document introuvable.'
    );
  END IF;

  IF v_document.doc_type <> p_doc_type THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DOC_TYPE_MISMATCH',
      'message', 'Le type du document ne correspond pas.'
    );
  END IF;

  v_current_hash := COALESCE(
    NULLIF(v_document.content_hash, ''),
    md5(COALESCE(v_document.doc_data, '{}'::jsonb)::text)
  );

  v_free_reexport :=
    COALESCE(v_document.export_count, 0) > 0
    AND NULLIF(v_document.last_export_hash, '') = v_current_hash;

  IF NOT v_free_reexport THEN
    v_config_key := CASE
      WHEN p_doc_type = 'cv' THEN 'cout_pdf_cv'
      ELSE 'cout_pdf_lm'
    END;

    SELECT GREATEST(0, FLOOR(config_value)::integer)
    INTO v_cost
    FROM public.career_token_config
    WHERE config_key = v_config_key
      AND COALESCE(is_active, true) = true
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      v_cost := CASE WHEN p_doc_type = 'cv' THEN 1 ELSE 0 END;
    END IF;
  END IF;

  v_balance := COALESCE(v_user.cv_tokens, 0);

  IF v_cost > v_balance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_TOKENS',
      'message', format(
        'Le téléchargement PDF nécessite %s jeton(s). Vous avez %s jeton(s).',
        v_cost,
        v_balance
      ),
      'tokens_required', v_cost,
      'tokens_available', v_balance
    );
  END IF;

  IF v_cost > 0 THEN
    v_balance := v_balance - v_cost;

    UPDATE public.users
    SET cv_tokens = v_balance,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.career_token_transactions (
      user_id,
      transaction_type,
      amount,
      balance_after,
      reason,
      reference_id,
      reference_type,
      metadata
    )
    VALUES (
      p_user_id,
      'debit',
      v_cost,
      v_balance,
      'pdf_export',
      p_document_id,
      'career_pdf_export',
      jsonb_build_object(
        'request_id', p_request_id,
        'document_id', p_document_id,
        'doc_type', p_doc_type
      )
    );
  END IF;

  INSERT INTO public.career_export_logs (
    user_id,
    document_id,
    doc_type,
    title,
    template_key,
    export_format,
    tokens_consumed,
    status,
    ip_address,
    user_agent,
    request_id
  )
  VALUES (
    p_user_id,
    p_document_id,
    p_doc_type,
    COALESCE(NULLIF(v_document.title, ''), NULLIF(p_title, '')),
    COALESCE(v_document.template_key, NULLIF(p_template_key, '')),
    'pdf',
    v_cost,
    'prepared',
    NULLIF(left(COALESCE(p_ip_address, ''), 255), ''),
    NULLIF(left(COALESCE(p_user_agent, ''), 500), ''),
    p_request_id
  )
  RETURNING id INTO v_export_id;

  UPDATE public.career_documents
  SET export_count = COALESCE(export_count, 0) + 1,
      last_exported_at = now(),
      last_export_hash = v_current_hash,
      updated_at = now()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'export_id', v_export_id,
    'tokens_consumed', v_cost,
    'tokens_remaining', v_balance,
    'free_reexport', v_free_reexport,
    'message', CASE
      WHEN v_free_reexport THEN 'PDF préparé sans nouveau débit : le document est inchangé.'
      WHEN v_cost > 0 THEN format('PDF préparé. %s jeton(s) consommé(s).', v_cost)
      ELSE 'PDF préparé.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.career_prepare_pdf_export(
  uuid, uuid, text, text, text, uuid, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.career_prepare_pdf_export(
  uuid, uuid, text, text, text, uuid, text, text
) TO service_role;

COMMENT ON FUNCTION public.career_prepare_pdf_export(
  uuid, uuid, text, text, text, uuid, text, text
) IS 'Prépare atomiquement un export PDF Career, avec débit idempotent et réexport gratuit si le document est inchangé.';
