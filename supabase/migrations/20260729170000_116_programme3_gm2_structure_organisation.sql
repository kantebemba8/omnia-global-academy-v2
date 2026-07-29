-- Programme 3 / GM2 — Groupes, cohortes et formations obligatoires

CREATE TABLE IF NOT EXISTS public.structure_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  manager_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.structure_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.structure_departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.structure_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  starts_at date,
  ends_at date,
  status text NOT NULL DEFAULT 'préparation' CHECK (status IN ('préparation','active','terminée','archivée')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.structure_member_organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.structure_departments(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.structure_groups(id) ON DELETE SET NULL,
  employee_reference text,
  job_title text,
  joined_at date,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.structure_cohort_members (
  cohort_id uuid NOT NULL REFERENCES public.structure_cohorts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.structure_mandatory_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  title text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('tous','département','groupe','cohorte','membres')),
  target_id uuid,
  starts_at date,
  due_at date NOT NULL,
  priority text NOT NULL DEFAULT 'normale' CHECK (priority IN ('faible','normale','haute','critique')),
  reminder_days integer[] NOT NULL DEFAULT ARRAY[30,7,1],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('brouillon','active','suspendue','terminée','archivée')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.structure_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandatory_training_id uuid NOT NULL REFERENCES public.structure_mandatory_trainings(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at date NOT NULL,
  status text NOT NULL DEFAULT 'à_commencer' CHECK (status IN ('à_commencer','en_cours','terminée','en_retard','dispensée')),
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  completed_at timestamptz,
  last_reminder_at timestamptz,
  UNIQUE (mandatory_training_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.structure_member_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  imported_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  file_name text,
  total_rows integer NOT NULL DEFAULT 0,
  successful_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_structure_departments_org ON public.structure_departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_structure_groups_org ON public.structure_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_structure_cohorts_org ON public.structure_cohorts(organization_id);
CREATE INDEX IF NOT EXISTS idx_structure_member_org_org ON public.structure_member_organization(organization_id);
CREATE INDEX IF NOT EXISTS idx_structure_member_org_user ON public.structure_member_organization(user_id);
CREATE INDEX IF NOT EXISTS idx_structure_mandatory_org ON public.structure_mandatory_trainings(organization_id);
CREATE INDEX IF NOT EXISTS idx_structure_assignments_org_user ON public.structure_training_assignments(organization_id,user_id);
CREATE INDEX IF NOT EXISTS idx_structure_assignments_due ON public.structure_training_assignments(due_at,status);

ALTER TABLE public.structure_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_member_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_mandatory_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_member_imports ENABLE ROW LEVEL SECURITY;
