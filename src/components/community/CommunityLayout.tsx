import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageFooter } from '../PageFooter';
import SuperAdminEcosystemLayout from '../ecosystem/SuperAdminEcosystemLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell, EcosystemPublicHeader } from '../ecosystem/EcosystemShell';
import { useAuth } from '../../hooks/useAuth';
import CommunityHeaderSearch from './CommunityHeaderSearch';
import { communityAudienceLabel, getCommunityNavigation, resolveCommunityAudience, type CommunityAudience } from '../../lib/communityNavigation';

function PublicCommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6FAF9] text-[#002050]">
      <EcosystemPublicHeader ecosystem="community" navigation={getCommunityNavigation('public')} search={<CommunityHeaderSearch />} />
      <main className="min-w-0">{children}</main>
      <PageFooter ecosystem="community" />
    </div>
  );
}

function ConnectedFrame({ audience, children }: { audience: Exclude<CommunityAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = <EcosystemConnectedShell ecosystem="community" audienceLabel={communityAudienceLabel(audience)} navigation={getCommunityNavigation(audience)} search={<CommunityHeaderSearch />}>{children}</EcosystemConnectedShell>;
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

function CommunityAudienceLayout({ audience, children }: { audience: CommunityAudience; children: ReactNode }) {
  if (audience === 'public') return <PublicCommunityLayout>{children}</PublicCommunityLayout>;
  if (audience === 'super_admin') return <SuperAdminEcosystemLayout ecosystem="community" navigation={getCommunityNavigation('public')} search={<CommunityHeaderSearch />}>{children}</SuperAdminEcosystemLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}

export default function CommunityLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#F8FCFB]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#DDEBE8] border-t-[#0F766E]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCommunityAudience(user?.roles, preview ? params.get('role') : null);
  return <CommunityAudienceLayout audience={audience}>{children}</CommunityAudienceLayout>;
}
