-- Étape 4D — Studio v1.0 : audit, versionnage, santé, anti-doublon et synchronisation
CREATE TABLE IF NOT EXISTS course_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'course',
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_audit_course_created ON course_audit_log(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_audit_action ON course_audit_log(action);

-- La table course_versions existe depuis la migration 042.
ALTER TABLE course_versions ADD COLUMN IF NOT EXISTS change_summary text;
ALTER TABLE course_versions ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS publication_lock_token uuid;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS publication_lock_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS health_issues jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS update_recommended boolean NOT NULL DEFAULT false;

ALTER TABLE user_enrollments ADD COLUMN IF NOT EXISTS course_version text;
UPDATE user_enrollments e SET course_version = COALESCE(c.current_version, '1.0') FROM courses c WHERE e.course_id=c.id AND e.course_version IS NULL;

CREATE OR REPLACE VIEW studio_course_health AS
WITH lesson_totals AS (
  SELECT course_id, count(*)::numeric total_lessons FROM course_lessons GROUP BY course_id
), learner_progress AS (
  SELECT ue.course_id, ue.user_id, count(ulp.lesson_id) FILTER (WHERE ulp.is_completed)::numeric completed_lessons
  FROM user_enrollments ue LEFT JOIN user_lesson_progress ulp ON ulp.course_id=ue.course_id AND ulp.user_id=ue.user_id
  GROUP BY ue.course_id,ue.user_id
), enrollment_stats AS (
  SELECT lp.course_id,count(*)::int enrollments,
    count(*) FILTER (WHERE COALESCE(lp.completed_lessons/NULLIF(lt.total_lessons,0)*100,0)<20)::int early_abandons,
    avg(COALESCE(lp.completed_lessons/NULLIF(lt.total_lessons,0)*100,0))::numeric(6,2) avg_progress
  FROM learner_progress lp LEFT JOIN lesson_totals lt ON lt.course_id=lp.course_id GROUP BY lp.course_id
), cert_expiry AS (
  SELECT course_id,min(expires_at) next_expiry FROM course_certifications WHERE status='validated' AND expires_at IS NOT NULL GROUP BY course_id
), assisted AS (
  SELECT course_id,count(*) FILTER (WHERE status IN ('pending','in_progress'))::int pending_assisted FROM assisted_course_requests GROUP BY course_id
)
SELECT c.id course_id,c.title,c.studio_status,c.is_published,c.updated_at,c.current_version,c.health_score,c.health_issues,
  COALESCE(es.enrollments,0) enrollments,COALESCE(es.early_abandons,0) early_abandons,COALESCE(es.avg_progress,0) avg_progress,
  ce.next_expiry,COALESCE(a.pending_assisted,0) pending_assisted,
  (c.is_published AND COALESCE(es.enrollments,0)=0) never_purchased,
  (COALESCE(es.enrollments,0)>=5 AND COALESCE(es.early_abandons,0)::numeric/NULLIF(es.enrollments,0)>=.5) high_abandon,
  (ce.next_expiry IS NOT NULL AND ce.next_expiry<=current_date+60) certification_expiring,
  (c.updated_at<now()-interval '365 days') stale_content
FROM courses c LEFT JOIN enrollment_stats es ON es.course_id=c.id
LEFT JOIN cert_expiry ce ON ce.course_id=c.id LEFT JOIN assisted a ON a.course_id=c.id;

ALTER TABLE course_audit_log ENABLE ROW LEVEL SECURITY;
