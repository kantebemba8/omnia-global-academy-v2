import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import { AdaptiveProjectsLayout } from '../../components/projects/ProjectsRoleLayout';
import { findProjectsSection, resolveProjectsAudience } from '../../lib/projectsNavigation';

function withPreview(path: string, params: URLSearchParams) {
  if (params.get('preview') !== 'true') return path;
  const p = new URLSearchParams(); p.set('preview', 'true');
  const role = params.get('role'); if (role) p.set('role', role);
  return `${path}?${p.toString()}`;
}

export default function ProjectsSectionHub() {
  const { user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveProjectsAudience(user?.roles, preview ? params.get('role') : null);
  const group = findProjectsSection(audience, location.pathname);
  if (!group?.children?.length || group.path !== location.pathname) return <Navigate to={withPreview('/projects', params)} replace />;
  return <AdaptiveProjectsLayout><EcosystemSectionLanding ecosystem="projects" description={group.description} /></AdaptiveProjectsLayout>;
}
