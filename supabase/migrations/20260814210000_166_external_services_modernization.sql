BEGIN;

ALTER TABLE public.live_media
  ADD COLUMN IF NOT EXISTS cloudflare_stream_uid text,
  ADD COLUMN IF NOT EXISTS cloudflare_stream_status text,
  ADD COLUMN IF NOT EXISTS stream_ready_at timestamptz;

CREATE INDEX IF NOT EXISTS live_media_cloudflare_stream_uid_idx
  ON public.live_media(cloudflare_stream_uid)
  WHERE cloudflare_stream_uid IS NOT NULL;

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS cloudflare_stream_uid text;

CREATE INDEX IF NOT EXISTS course_lessons_cloudflare_stream_uid_idx
  ON public.course_lessons(cloudflare_stream_uid)
  WHERE cloudflare_stream_uid IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'course_lessons'
      AND column_name = 'cloudflare_stream_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.course_lessons
      SET cloudflare_stream_uid = NULLIF(cloudflare_stream_id::text, '')
      WHERE cloudflare_stream_uid IS NULL
        AND NULLIF(cloudflare_stream_id::text, '') IS NOT NULL
    $sql$;
  END IF;
END
$$;

ALTER TABLE public.subtitle_jobs
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS srt_storage_path text,
  ADD COLUMN IF NOT EXISTS vtt_storage_path text;

-- Older subtitle jobs may contain permanent public course-covers URLs. Stop
-- publishing them from the database. Future jobs use private course-resources
-- objects and short-lived signed URLs only.
UPDATE public.subtitle_jobs
SET srt_url = NULL,
    vtt_url = NULL
WHERE srt_url IS NOT NULL OR vtt_url IS NOT NULL;

COMMIT;
