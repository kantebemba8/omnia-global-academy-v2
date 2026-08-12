import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageFooter } from '../PageFooter';
import SuperAdminEcosystemLayout from '../ecosystem/SuperAdminEcosystemLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell, EcosystemPublicHeader } from '../ecosystem/EcosystemShell';
import { useAuth } from '../../hooks/useAuth';
import CoachingHeaderSearch from './CoachingHeaderSearch';
import { coachingAudienceLabel, getCoachingNavigation, resolveCoachingAudience, type CoachingAudience } from '../../lib/coachingNavigation';

function PublicCoachingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFBF4] text-[#002050]">
      <EcosystemPublicHeader ecosystem="coaching" navigation={getCoachingNavigation('public')} search={<CoachingHeaderSearch />} />
      <main className="min-w-0">{children}</main>
      <PageFooter ecosystem="coaching" />
    </div>
  );
}

function ConnectedFrame({ audience, children }: { audience: Exclude<CoachingAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = <EcosystemConnectedShell ecosystem="coaching" audienceLabel={coachingAudienceLabel(audience)} navigation={getCoachingNavigation(audience)} search={<CoachingHeaderSearch />}>{children}</EcosystemConnectedShell>;
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

export function CoachingAudienceLayout({ audience, children }: { audience: CoachingAudience; children: ReactNode }) {
  if (audience === 'public') return <PublicCoachingLayout>{children}</PublicCoachingLayout>;
  if (audience === 'super_admin') return <SuperAdminEcosystemLayout ecosystem="coaching" navigation={getCoachingNavigation('public')} search={<CoachingHeaderSearch />}>{children}</SuperAdminEcosystemLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}

export default function CoachingLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FBFCFA]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#DFE4C9] border-t-[#667A3D]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCoachingAudience(user?.roles, preview ? params.get('role') : null);
  return <CoachingAudienceLayout audience={audience}>{children}</CoachingAudienceLayout>;
}
