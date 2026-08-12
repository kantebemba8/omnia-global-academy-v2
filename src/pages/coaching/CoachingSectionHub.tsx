import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import CoachingLayout from '../../components/coaching/CoachingLayout';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import { useAuth } from '../../hooks/useAuth';
import { findCoachingSection, resolveCoachingAudience } from '../../lib/coachingNavigation';

export default function CoachingSectionHub() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCoachingAudience(user?.roles, preview ? params.get('role') : null);
  const effectiveAudience = audience === 'super_admin' ? 'public' : audience;
  const section = findCoachingSection(effectiveAudience, location.pathname);
  if (!section?.children?.length || section.path !== location.pathname) return <Navigate to="/coaching" replace />;
  return <CoachingLayout><EcosystemSectionLanding ecosystem="coaching" description={section.description} /></CoachingLayout>;
}
