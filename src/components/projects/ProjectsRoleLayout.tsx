import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import ProjectsEcosystemNav from './ProjectsEcosystemNav';
import ProjectsHeaderSearch from './ProjectsHeaderSearch';
import { getProjectsNavigation, resolveProjectsAudience, type ProjectsAudience } from '../../lib/projectsNavigation';

export function PublicProjectsLayout({ children }: { children: ReactNode }) {
  const navItems = getProjectsNavigation('public').map(item => ({ label: item.label, path: item.path, icon: item.icon, exact: item.id === 'accueil' }));
  return <SubspaceHamburgerLayout title="Omnia Projects" navItems={navItems} searchPath="/projects/explorer" searchParam="q" searchPlaceholder="Rechercher un projet, une compétence, une organisation..." navigationMode="horizontal">{children}</SubspaceHamburgerLayout>;
}

function Learner({ children }: { children: ReactNode }) { return <DashboardLayout role="apprenant" headerTitle="Omnia Projects" headerSubtitle="Missions, équipes et preuves d’expérience" headerSearch={<ProjectsHeaderSearch />}><ProjectsEcosystemNav audience="apprenant" />{children}</DashboardLayout>; }
function Professor({ children }: { children: ReactNode }) { return <DashboardLayout role="professeur" headerTitle="Omnia Projects" headerSubtitle="Concevoir, piloter et évaluer des expériences réelles" headerSearch={<ProjectsHeaderSearch />}><ProjectsEcosystemNav audience="professeur" />{children}</DashboardLayout>; }
function Structure({ children }: { children: ReactNode }) { return <StructureLayout headerTitle="Omnia Projects" headerSubtitle="Projets, partenaires et expériences de votre organisation" headerSearch={<ProjectsHeaderSearch />}><ProjectsEcosystemNav audience="structure" />{children}</StructureLayout>; }
function Moderator({ children }: { children: ReactNode }) { return <ModerateurLayout headerTitle="Omnia Projects" headerSubtitle="Observer les projets selon votre périmètre" headerSearch={<ProjectsHeaderSearch />}><ProjectsEcosystemNav audience="moderateur" />{children}</ModerateurLayout>; }
function Generic({ audience, children }: { audience: 'recruteur' | 'organisateur' | 'coach'; children: ReactNode }) { return <DashboardLayout role={audience} headerTitle="Omnia Projects" headerSubtitle="Expériences, missions et collaboration" headerSearch={<ProjectsHeaderSearch />}><ProjectsEcosystemNav audience={audience} />{children}</DashboardLayout>; }

export function ProjectsAudienceLayout({ audience, children }: { audience: ProjectsAudience; children: ReactNode }) {
  if (audience === 'apprenant') return <Learner>{children}</Learner>;
  if (audience === 'professeur') return <Professor>{children}</Professor>;
  if (audience === 'structure') return <Structure>{children}</Structure>;
  if (audience === 'moderateur') return <Moderator>{children}</Moderator>;
  if (audience === 'recruteur' || audience === 'organisateur' || audience === 'coach') return <Generic audience={audience}>{children}</Generic>;
  return <PublicProjectsLayout>{children}</PublicProjectsLayout>;
}

export function AdaptiveProjectsLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FCFBF7]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#A96812]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveProjectsAudience(user?.roles, preview ? params.get('role') : null);
  return <ProjectsAudienceLayout audience={audience}>{children}</ProjectsAudienceLayout>;
}
