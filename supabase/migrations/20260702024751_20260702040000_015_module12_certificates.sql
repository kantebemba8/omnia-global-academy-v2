/*
# Module 12 — Certificats PDF + QR + Vérification Publique + Open CPD

## Summary
Adds the complete certificate infrastructure: unique tamper-evident IDs,
dual certificate templates (independent professor vs. establishment), public
verification endpoint data, Open CPD badge tracking with credit management,
and a storage bucket for certificate HTML files.

## New Tables

### certificates
Master table for all issued certificates. Stores all data at the moment of
issuance (snapshot) so the certificate remains valid even if the course or
user profile changes later. Unique per (user_id, course_id) — only one cert
per student per course. Contains the QR-linked omnia_certificate_id, template
type (A = professor, B = establishment), CPD details, revocation fields, and
the URL of the stored HTML/PDF.

### cpd_credits
Single-row table tracking the platform's Open CPD badge credit balance.
total_credits = purchased credits, used_credits = emitted badges.
When used_credits >= total_credits badges go into cpd_pending state on the
certificate row.

## Security
- certificates: publicly readable (anon + authenticated) for /verify/ route.
  Writes are restricted to service_role only (edge functions use service key).
- cpd_credits: restricted to super_admin role via RLS.

## Storage
- Creates the 'certificates' public bucket for HTML/PDF certificate files.
*/

-- ─── certificates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  omnia_certificate_id  VARCHAR(20) UNIQUE NOT NULL,
  user_id               UUID NOT NULL REFERENCES users(id),
  course_id             UUID NOT NULL REFERENCES courses(id),

  student_full_name     VARCHAR(255) NOT NULL,
  course_title          VARCHAR(500) NOT NULL,
  course_level          VARCHAR(30)  NOT NULL,
  course_category       VARCHAR(100) NOT NULL,
  cpd_hours             DECIMAL(5,2) DEFAULT 0,

  template_type         VARCHAR(10) NOT NULL,

  creator_name          VARCHAR(255),

  establishment_name    VARCHAR(255),
  establishment_logo_url TEXT,
  director_name         VARCHAR(255),
  director_signature_url TEXT,

  cpd_accredited        BOOLEAN DEFAULT FALSE,
  cpd_provider_code     VARCHAR(100),
  cpd_badge_url         TEXT,
  cpd_pending           BOOLEAN DEFAULT FALSE,

  status                VARCHAR(20) DEFAULT 'valide',
  revocation_reason     TEXT,
  revoked_by            UUID REFERENCES users(id),
  revoked_at            TIMESTAMP WITH TIME ZONE,

  pdf_url               TEXT,

  issued_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_cert_omnia_id ON certificates(omnia_certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_user     ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_course   ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_cert_status   ON certificates(status);

-- ─── cpd_credits ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cpd_credits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_credits        INTEGER DEFAULT 0,
  used_credits         INTEGER DEFAULT 0,
  last_recharged_at    TIMESTAMP WITH TIME ZONE,
  last_recharged_by    UUID REFERENCES users(id),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO cpd_credits (total_credits, used_credits)
VALUES (0, 0)
ON CONFLICT DO NOTHING;

-- ─── Storage bucket for certificates ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpd_credits  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cert_public_verify" ON certificates;
CREATE POLICY "cert_public_verify" ON certificates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cpd_credits_superadmin_all" ON cpd_credits;
CREATE POLICY "cpd_credits_superadmin_all" ON cpd_credits
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'super_admin'
    )
  );

-- Storage policy for certificate bucket
DROP POLICY IF EXISTS "certs_public_read" ON storage.objects;
CREATE POLICY "certs_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'certificates');
