-- Career & Talent synchronization cleanup.
-- Removes Career documents created under a super-admin test account only.
DELETE FROM public.career_documents d
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = d.user_id AND ur.role = 'super_admin'
);

CREATE INDEX IF NOT EXISTS idx_career_documents_user_type ON public.career_documents(user_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_career_documents_status ON public.career_documents(status);
CREATE INDEX IF NOT EXISTS idx_career_token_transactions_created ON public.career_token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_export_logs_created ON public.career_export_logs(created_at DESC);
