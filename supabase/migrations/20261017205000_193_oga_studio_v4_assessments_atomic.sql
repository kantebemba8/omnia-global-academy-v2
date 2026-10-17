-- OGA Formation Studio V4 : règles atomiques de sauvegarde des évaluations.
-- Seul le rôle serveur est autorisé à appeler ces fonctions (les RPC ne sont
-- jamais exposées directement à l'apprenant). Migration additive, sans suppression
-- des questions, copies, évaluations publiées ni anciennes migrations 190/191.
BEGIN;

CREATE OR REPLACE FUNCTION public.oga_studio_v4_193_apply_policy(
  p_course_id uuid, p_updates jsonb, p_course_patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  entry jsonb; patch jsonb; answer_id uuid; col text; setters text;
  mapping jsonb; allowed text[] := ARRAY[
    'passing_score','max_attempts','remediation_after_attempts','retry_cooldown_hours',
    'remediation_mode','attempts_unlimited_for_purchased','time_limit_minutes','required',
    'attempts_per_period','attempt_period','retry_instructions','assessment_type',
    'delivery_mode','security_level','session_required','identity_verification_required',
    'proctoring_settings','result_release_mode','competency_labels',
    'competency_framework_id','jury_required','jury_min_members','jury_decision_mode',
    'appeal_enabled','appeal_deadline_days','allowed_materials','candidate_instructions',
    'integrity_rules','randomize_questions','random_question_count'
  ];
BEGIN
  IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_course_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'OGA_POLICY_INVALID_PAYLOAD';
  END IF;
  -- Verrouille le cours afin que la mise à jour des règles soit indivisible.
  PERFORM 1 FROM public.courses WHERE id=p_course_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OGA_COURSE_NOT_FOUND'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_updates) LOOP
    answer_id := (entry->>'id')::uuid;
    patch := entry->'patch';
    IF patch IS NULL OR jsonb_typeof(patch) <> 'object' THEN
      RAISE EXCEPTION 'OGA_POLICY_INVALID_ASSESSMENT';
    END IF;
    PERFORM 1 FROM public.course_assessments
      WHERE id=answer_id AND course_id=p_course_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OGA_ASSESSMENT_OUTSIDE_COURSE'; END IF;
    setters := '';
    FOR col IN SELECT jsonb_object_keys(patch) LOOP
      IF NOT col = ANY(allowed) THEN
        RAISE EXCEPTION 'OGA_POLICY_FORBIDDEN_FIELD: %', col;
      END IF;
      IF setters <> '' THEN setters := setters || ','; END IF;
      setters := setters || format('%I = (jsonb_populate_record(NULL::public.course_assessments,$1)).%I',col,col);
    END LOOP;
    IF setters <> '' THEN
      EXECUTE 'UPDATE public.course_assessments SET ' || setters ||
        ', updated_at = now() WHERE id = $2' USING patch, answer_id;
    END IF;
    IF entry ? 'mappings' THEN
      IF jsonb_typeof(entry->'mappings') <> 'array' THEN
        RAISE EXCEPTION 'OGA_POLICY_INVALID_MAPPINGS';
      END IF;
      DELETE FROM public.assessment_competency_mappings WHERE assessment_id=answer_id;
      FOR mapping IN SELECT value FROM jsonb_array_elements(entry->'mappings') LOOP
        INSERT INTO public.assessment_competency_mappings
          (assessment_id,competency_id,target_level_id,weight,passing_score,required,created_by)
        VALUES
          (answer_id,(mapping->>'competency_id')::uuid,
           NULLIF(mapping->>'target_level_id','')::uuid,
           COALESCE((mapping->>'weight')::numeric,1),
           (mapping->>'passing_score')::numeric,
           COALESCE((mapping->>'required')::boolean,true),
           NULLIF(mapping->>'created_by','')::uuid);
      END LOOP;
    END IF;
  END LOOP;
  UPDATE public.courses SET
    assessment_policy=COALESCE(p_course_patch->'assessment_policy','{}'::jsonb),
    lesson_passing_score=COALESCE((p_course_patch->>'lesson_passing_score')::integer,lesson_passing_score),
    module_passing_score=COALESCE((p_course_patch->>'module_passing_score')::integer,module_passing_score),
    final_passing_score=COALESCE((p_course_patch->>'final_passing_score')::integer,final_passing_score),
    assessment_rules_locked=COALESCE((p_course_patch->>'assessment_rules_locked')::boolean,false),
    updated_at=now()
  WHERE id=p_course_id;
  RETURN jsonb_build_object('success',true,'updated',jsonb_array_length(p_updates));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.oga_studio_v4_193_submit_assessment(
  p_assessment_id uuid,p_user_id uuid,p_attempt jsonb,p_answers jsonb,p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $fn$
DECLARE
  a public.course_assessments%ROWTYPE;
  last_attempt public.assessment_attempts%ROWTYPE;
  submission_id uuid; answer_record_id uuid;
  item jsonb; answer jsonb; q uuid; uploaded jsonb; file_path text;
  expected_number integer;
  seen uuid[]:=ARRAY[]::uuid[];
BEGIN
  IF jsonb_typeof(p_attempt) <> 'object'
     OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_typeof(p_result) <> 'object' THEN
    RAISE EXCEPTION 'OGA_ATTEMPT_INVALID_PAYLOAD';
  END IF;
  -- Un verrou transactionnel par étudiant/évaluation supprime les doubles copies.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_assessment_id::text||':'||p_user_id::text,0));
  SELECT * INTO a FROM public.course_assessments
     WHERE id=p_assessment_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OGA_ASSESSMENT_NOT_FOUND'; END IF;
  IF (p_attempt->>'course_id')::uuid IS DISTINCT FROM a.course_id
    OR (p_attempt->>'user_id')::uuid IS DISTINCT FROM p_user_id
    OR (p_attempt->>'assessment_id')::uuid IS DISTINCT FROM p_assessment_id THEN
    RAISE EXCEPTION 'OGA_ATTEMPT_COURSE_MISMATCH';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_enrollments
    WHERE course_id=a.course_id AND user_id=p_user_id) THEN
    RAISE EXCEPTION 'OGA_ATTEMPT_NOT_ENROLLED';
  END IF;
  SELECT * INTO last_attempt FROM public.assessment_attempts
    WHERE assessment_id=p_assessment_id AND user_id=p_user_id
    ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE;
  expected_number:=COALESCE(last_attempt.attempt_number,0)+1;
  IF (p_attempt->>'attempt_number')::integer IS DISTINCT FROM expected_number
    OR last_attempt.status IN ('submitted','pending_review','in_progress')
    OR (last_attempt.retry_available_at IS NOT NULL AND last_attempt.retry_available_at>now())
    OR (last_attempt.remediation_required=true AND last_attempt.remediation_completed_at IS NULL)
  THEN RAISE EXCEPTION 'OGA_ATTEMPT_CONFLICT'; END IF;
  IF jsonb_array_length(p_answers)<1 THEN RAISE EXCEPTION 'OGA_ATTEMPT_NO_QUESTIONS'; END IF;
  -- On valide tous les identifiants avant tout INSERT.
  FOR item IN SELECT value FROM jsonb_array_elements(p_answers) LOOP
    q:=(item->>'question_id')::uuid;
    IF q=ANY(seen) OR NOT EXISTS(
      SELECT 1 FROM public.assessment_questions
      WHERE id=q AND assessment_id=p_assessment_id
    ) THEN RAISE EXCEPTION 'OGA_ATTEMPT_INVALID_QUESTION'; END IF;
    seen:=array_append(seen,q);
  END LOOP;
  INSERT INTO public.assessment_attempts
    (assessment_id,course_id,user_id,attempt_number,status,submitted_at,
     session_id,result_status,identity_verified_at,security_snapshot,
     localization_snapshot,score,passed,retry_available_at,remediation_required,
     graded_at,result_published_at)
  VALUES
    (p_assessment_id,a.course_id,p_user_id,expected_number,p_result->>'status',
     COALESCE((p_attempt->>'submitted_at')::timestamptz,now()),
     NULLIF(p_attempt->>'session_id','')::uuid,p_result->>'result_status',
     (p_attempt->>'identity_verified_at')::timestamptz,
     COALESCE(p_attempt->'security_snapshot','{}'::jsonb),
     COALESCE(p_attempt->'localization_snapshot','{}'::jsonb),
     (p_result->>'score')::numeric,COALESCE((p_result->>'passed')::boolean,false),
     (p_result->>'retry_available_at')::timestamptz,
     COALESCE((p_result->>'remediation_required')::boolean,false),
     CASE WHEN p_result->>'result_status'='published' THEN now() ELSE NULL END,
     CASE WHEN p_result->>'result_status'='published' THEN now() ELSE NULL END)
  RETURNING id INTO submission_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_answers) LOOP
    q:=(item->>'question_id')::uuid; answer:=item->'answer';
    INSERT INTO public.assessment_answers
      (attempt_id,question_id,answer_json,submission_files,auto_score,
       final_score,review_status,ai_score,ai_feedback,ai_grading_json,
       ai_provider,ai_model,ai_graded_at,human_validated_ai)
    VALUES
      (submission_id,q,answer->'answer_json',
       COALESCE(item->'files',answer->'submission_files','[]'::jsonb),
       (answer->>'auto_score')::numeric,(answer->>'final_score')::numeric,
       COALESCE(answer->>'review_status','not_required'),
       (answer->>'ai_score')::numeric,answer->>'ai_feedback',
       COALESCE(answer->'ai_grading_json','{}'::jsonb),
       answer->>'ai_provider',answer->>'ai_model',
       (answer->>'ai_graded_at')::timestamptz,
       COALESCE((answer->>'human_validated_ai')::boolean,false))
    RETURNING id INTO answer_record_id;
    FOR uploaded IN SELECT value FROM jsonb_array_elements(COALESCE(item->'files','[]'::jsonb)) LOOP
      file_path:=uploaded->>'storage_path';
      IF COALESCE(uploaded->>'bucket_name','')<>'assessment-submissions'
        OR file_path IS NULL
        OR left(file_path,length(p_user_id::text||'/'||a.course_id::text||'/'||p_assessment_id::text||'/'))
          <>p_user_id::text||'/'||a.course_id::text||'/'||p_assessment_id::text||'/'
        OR COALESCE((uploaded->>'size_bytes')::bigint,0)>52428800 THEN
        RAISE EXCEPTION 'OGA_ATTEMPT_INVALID_FILE';
      END IF;
      INSERT INTO public.assessment_submission_files
        (attempt_id,answer_id,owner_user_id,bucket_name,storage_path,file_name,mime_type,size_bytes)
      VALUES
        (submission_id,answer_record_id,p_user_id,'assessment-submissions',file_path,
         COALESCE(uploaded->>'file_name','Fichier'),uploaded->>'mime_type',
         COALESCE((uploaded->>'size_bytes')::bigint,0));
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('success',true,'attempt_id',submission_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.oga_studio_v4_193_apply_policy(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oga_studio_v4_193_submit_assessment(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oga_studio_v4_193_apply_policy(uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.oga_studio_v4_193_submit_assessment(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
