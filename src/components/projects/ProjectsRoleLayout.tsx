import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { PageFooter } from '../PageFooter';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import ProjectsHeaderSearch from './ProjectsHeaderSearch';
import { getProjectsNavigation, resolveProjectsAudience, type ProjectsAudience } from '../../lib/projectsNavigation';

export function PublicProjectsLayout({ children }: { children: ReactNode }) {
  const navItems = getProjectsNavigation('public').map(item => ({ label: item.label, path: item.path, icon: item.icon, exact: item.id === 'accueil' }));
  return <><SubspaceHamburgerLayout title="Omnia Projects" navItems={navItems} searchPath="/projects/explorer" searchParam="q" searchPlaceholder="Rechercher un projet, une compétence, une organisation..." navigationMode="horizontal">{children}</SubspaceHamburgerLayout><PageFooter ecosystem="projects" /></>;
}

function audienceLabel(audience: ProjectsAudience) {
  return ({ apprenant: 'Apprenant', professeur: 'Professeur', structure: 'Structure', moderateur: 'Modérateur', recruteur: 'Recruteur', organisateur: 'Organisateur', coach: 'Coach', public: 'Découvrir', super_admin: 'Administration' } as const)[audience];
}

function ConnectedFrame({ audience, children }: { audience: Exclude<ProjectsAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = <EcosystemConnectedShell ecosystem="projects" audienceLabel={audienceLabel(audience)} navigation={getProjectsNavigation(audience)} search={<ProjectsHeaderSearch />}>{children}</EcosystemConnectedShell>;
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

export function ProjectsAudienceLayout({ audience, children }: { audience: ProjectsAudience; children: ReactNode }) {
  if (audience === 'public' || audience === 'super_admin') return <PublicProjectsLayout>{children}</PublicProjectsLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}

export function AdaptiveProjectsLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FCFBF7]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#B5623C]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveProjectsAudience(user?.roles, preview ? params.get('role') : null);
  return <ProjectsAudienceLayout audience={audience}>{children}</ProjectsAudienceLayout>;
}
