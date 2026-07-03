-- Bucket for CV/diplomas (professeur)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cv-documents', 'cv-documents', false, 4194304, '{application/pdf}')
ON CONFLICT (id) DO NOTHING;

-- Bucket for school logos and director signatures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-documents', 'school-documents', false, 2097152, '{image/png,image/jpeg,image/jpg}')
ON CONFLICT (id) DO NOTHING;
