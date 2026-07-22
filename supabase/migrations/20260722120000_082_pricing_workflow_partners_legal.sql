-- 082 — Tarification négociée, partenaires publics et gouvernance juridique

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS pricing_status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS admin_selected_price_source text,
  ADD COLUMN IF NOT EXISTS admin_selected_price_xof bigint,
  ADD COLUMN IF NOT EXISTS pricing_admin_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_admin_decided_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS professor_price_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS professor_price_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_revision_comment text;

CREATE INDEX IF NOT EXISTS idx_courses_pricing_status ON public.courses(pricing_status);

CREATE TABLE IF NOT EXISTS public.public_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Autre',
  logo_url text,
  website_url text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_partners_read_active" ON public.public_partners;
CREATE POLICY "public_partners_read_active"
ON public.public_partners FOR SELECT
USING (is_active = true);

-- Valeurs métier canoniques. Les fonctions utilisent ces valeurs si la clé n'existe pas.
INSERT INTO public.site_settings(key,value)
VALUES
('course_pricing_rules', '{
  "module_points":2,
  "lesson_points":0.5,
  "hour_points":1,
  "level_points":{"debutant":2,"intermediaire":5,"avance":8,"expert":12},
  "validation_points":{"qcm":3,"projet_soumettre":8,"projet_corriger":12},
  "oral_exam_points":6,
  "resource_global_cap":5,
  "resources":{
    "pdf_fiche":{"points":0.5,"max":4},
    "url_externe":{"points":0.3,"max":5},
    "glossaire":{"points":1,"max":1},
    "exercice_pratique":{"points":0.5,"max":3},
    "audio":{"points":0.5,"max":2},
    "template":{"points":0.7,"max":3},
    "etude_de_cas":{"points":1,"max":2}
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings(key,value)
VALUES
('legal_documents_meta', '{
  "cgu":{"version":"1.0","effective_date":null,"published":true},
  "confidentialite":{"version":"1.0","effective_date":null,"published":true},
  "mentions_legales":{"version":"1.0","effective_date":null,"published":true},
  "cookies":{"version":"1.0","effective_date":null,"published":false},
  "cgv":{"version":"1.0","effective_date":null,"published":false},
  "remboursements":{"version":"1.0","effective_date":null,"published":false}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
