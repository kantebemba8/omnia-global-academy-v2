import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { PageFooter } from '../PageFooter';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell, EcosystemPublicHeader } from '../ecosystem/EcosystemShell';
import { useAuth } from '../../hooks/useAuth';
import CommunityEcosystemNav from './CommunityEcosystemNav';
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

function LegacySuperAdminCommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FCFB] text-[#002050]">
      <Navbar />
      <div className="pt-20">
        <header className="border-b border-[#DDEBE8] bg-white">
          <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-5 px-4 sm:px-5 lg:px-6">
            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.18em] text-[#0F766E]">Conversations, entraide & confiance</p><p className="mt-1 hidden text-sm text-slate-500 md:block">Un espace pour poser, répondre, apprendre et prolonger les échanges.</p></div>
            <div className="hidden w-[min(40vw,480px)] lg:block"><CommunityHeaderSearch /></div>
          </div>
        </header>
        <CommunityEcosystemNav audience="public" />
        <main className="min-w-0">{children}</main>
        <PageFooter ecosystem="community" />
      </div>
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
  if (audience === 'super_admin') return <LegacySuperAdminCommunityLayout>{children}</LegacySuperAdminCommunityLayout>;
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
