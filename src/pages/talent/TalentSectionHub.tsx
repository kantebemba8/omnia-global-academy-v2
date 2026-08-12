import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AdaptiveTalentLayout } from '../../components/talent/TalentRoleLayout';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import { findTalentSection, resolveTalentAudience } from '../../lib/talentNavigation';
import { useAuth } from '../../hooks/useAuth';

function withPreview(path: string, params: URLSearchParams) {
  if (params.get('preview') !== 'true') return path;
  const p = new URLSearchParams(); p.set('preview', 'true');
  const role = params.get('role'); if (role) p.set('role', role);
  return `${path}?${p.toString()}`;
}

export default function TalentSectionHub() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveTalentAudience(user?.roles, preview ? params.get('role') : null);
  const section = findTalentSection(audience, location.pathname);
  if (!section?.children?.length || section.path.split('?')[0] !== location.pathname) return <Navigate to={withPreview('/talent', params)} replace />;
  return <AdaptiveTalentLayout><EcosystemSectionLanding ecosystem="talent" group={section} /></AdaptiveTalentLayout>;
}
