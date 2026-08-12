import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { PageFooter } from '../PageFooter';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import TalentHeaderSearch from './TalentHeaderSearch';
import { getTalentNavigation, resolveTalentAudience, type TalentAudience } from '../../lib/talentNavigation';

export function PublicTalentLayout({ children }: { children: ReactNode }) {
  const navItems = getTalentNavigation('public').map(item => ({ label: item.label, path: item.path, icon: item.icon, exact: item.id === 'accueil' }));
  return <><SubspaceHamburgerLayout title="Omnia Talent" navItems={navItems} searchPath="/talent/explorer" searchParam="q" searchPlaceholder="Rechercher un talent, une compétence ou une organisation..." navigationMode="horizontal">{children}</SubspaceHamburgerLayout><PageFooter ecosystem="talent" /></>;
}

function audienceLabel(audience: TalentAudience) {
  return ({ apprenant: 'Apprenant', professeur: 'Professeur', structure: 'Structure', moderateur: 'Modérateur', recruteur: 'Recruteur', organisateur: 'Organisateur', coach: 'Coach', public: 'Découvrir', super_admin: 'Administration' } as const)[audience];
}

function ConnectedFrame({ audience, children }: { audience: Exclude<TalentAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = <EcosystemConnectedShell ecosystem="talent" audienceLabel={audienceLabel(audience)} navigation={getTalentNavigation(audience)} search={<TalentHeaderSearch />}>{children}</EcosystemConnectedShell>;
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

export function TalentAudienceLayout({ audience, children }: { audience: TalentAudience; children: ReactNode }) {
  if (audience === 'public' || audience === 'super_admin') return <PublicTalentLayout>{children}</PublicTalentLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}

export function AdaptiveTalentLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FCFAFC]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#76506F]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveTalentAudience(user?.roles, preview ? params.get('role') : null);
  return <TalentAudienceLayout audience={audience}>{children}</TalentAudienceLayout>;
}
