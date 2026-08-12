import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import CommunityLayout from '../../components/community/CommunityLayout';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import { useAuth } from '../../hooks/useAuth';
import { findCommunitySection, resolveCommunityAudience } from '../../lib/communityNavigation';

export default function CommunitySectionHub() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCommunityAudience(user?.roles, preview ? params.get('role') : null);
  const section = findCommunitySection(audience === 'super_admin' ? 'public' : audience, location.pathname);
  if (!section?.children?.length || section.path !== location.pathname) return <Navigate to="/forum" replace />;
  return <CommunityLayout><EcosystemSectionLanding ecosystem="community" description={section.description} /></CommunityLayout>;
}
