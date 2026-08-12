import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import { useAuth } from '../../hooks/useAuth';
import LiveHeaderSearch from './LiveHeaderSearch';
import LivePublicLayout, { LegacySuperAdminLiveLayout } from './LivePublicLayout';
import { getLiveNavigation, liveAudienceLabel, resolveLiveAudience, type LiveAudience } from '../../lib/liveNavigation';

function ConnectedFrame({ audience, children }: { audience: Exclude<LiveAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = <EcosystemConnectedShell ecosystem="live" audienceLabel={liveAudienceLabel(audience)} navigation={getLiveNavigation(audience)} search={<LiveHeaderSearch />}>{children}</EcosystemConnectedShell>;
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

export function LiveAudienceLayout({ audience, children }: { audience: LiveAudience; children: ReactNode }) {
  if (audience === 'public') return <LivePublicLayout>{children}</LivePublicLayout>;
  if (audience === 'super_admin') return <LegacySuperAdminLiveLayout>{children}</LegacySuperAdminLiveLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}

export default function OmniaLiveLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FAFAFE]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E7E6F2] border-t-[#5C55C8]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveLiveAudience(user?.roles, preview ? params.get('role') : null);
  return <LiveAudienceLayout audience={audience}>{children}</LiveAudienceLayout>;
}
