import { Navigate, useSearchParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import { getLiveNavigation, resolveLiveAudience } from '../../lib/liveNavigation';
import { useAuth } from '../../hooks/useAuth';

export default function LiveSectionHub({ sectionId }: { sectionId: string }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveLiveAudience(user?.roles, preview ? params.get('role') : null);
  const effectiveAudience = audience === 'super_admin' ? 'public' : audience;
  const group = getLiveNavigation(effectiveAudience).find(g => g.id === sectionId);
  if (!group?.children?.length) return <Navigate to="/omnia-live" replace />;
  return <OmniaLiveLayout><EcosystemSectionLanding ecosystem="live" group={group} /></OmniaLiveLayout>;
}
