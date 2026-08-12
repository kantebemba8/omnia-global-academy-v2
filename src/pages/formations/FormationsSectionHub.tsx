import type { ReactNode } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import {
  LearnerFormationsLayout,
  ModeratorFormationsLayout,
  ProfessorFormationsLayout,
  PublicFormationsLayout,
  StructureFormationsLayout,
} from '../../components/formations/FormationsRoleLayout';
import { getFormationsNavigation, resolveFormationsAudience, type FormationsAudience } from '../../lib/formationsNavigation';

function Frame({ audience, children }: { audience: FormationsAudience; children: ReactNode }) {
  if (audience === 'apprenant') return <LearnerFormationsLayout>{children}</LearnerFormationsLayout>;
  if (audience === 'professeur') return <ProfessorFormationsLayout>{children}</ProfessorFormationsLayout>;
  if (audience === 'structure') return <StructureFormationsLayout>{children}</StructureFormationsLayout>;
  if (audience === 'moderateur') return <ModeratorFormationsLayout>{children}</ModeratorFormationsLayout>;
  return <PublicFormationsLayout audience={audience}>{children}</PublicFormationsLayout>;
}

function withPreview(path: string, params: URLSearchParams, audience: FormationsAudience) {
  if (params.get('preview') !== 'true') return path;
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}preview=true&role=${audience}`;
}

export default function FormationsSectionHub() {
  const { sectionId = '' } = useParams();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveFormationsAudience(user?.roles, preview ? params.get('role') : null);
  const section = getFormationsNavigation(audience).find(group => group.id === sectionId);

  if (loading) return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  if (audience === 'super_admin' && !preview) return <Navigate to="/admin/courses" replace />;
  if (!section?.children?.length) return <Navigate to={withPreview('/formations', params, audience)} replace />;

  return <Frame audience={audience}><EcosystemSectionLanding ecosystem="formations" group={section} /></Frame>;
}
