ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS scorm_url TEXT;
ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS pdf_doc_url TEXT;