import type { ReactNode } from 'react';
import { Home } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { PageFooter } from '../PageFooter';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { useAuth } from '../../hooks/useAuth';
import CoachingEcosystemNav from './CoachingEcosystemNav';
import CoachingHeaderSearch from './CoachingHeaderSearch';
import { resolveCoachingAudience, type CoachingAudience } from '../../lib/coachingNavigation';

function PublicCoachingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBFCFA] text-[#002050]">
      <Navbar />
      <div className="pt-20">
        <header className="border-b border-[#DCE7E1] bg-white">
          <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-5 px-4 sm:px-5 lg:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#356C63]">Accompagnement professionnel & continuité</p>
              <p className="mt-1 hidden text-sm text-slate-500 md:block">Choisir un coach, préparer une séance, agir et mesurer la suite.</p>
            </div>
            <div className="hidden w-[min(40vw,480px)] lg:block"><CoachingHeaderSearch /></div>
          </div>
        </header>
        <CoachingEcosystemNav audience="public" publicMode />
        <main className="min-w-0">{children}</main>
        <PageFooter />
      </div>
    </div>
  );
}

function GenericCoachingLayout({ audience, children }: { audience: 'apprenant' | 'professeur' | 'recruteur' | 'organisateur' | 'coach'; children: ReactNode }) {
  const subtitle = audience === 'apprenant'
    ? 'Séances, objectifs et continuité de votre accompagnement'
    : audience === 'professeur'
      ? 'Prendre du recul et compléter l’accompagnement pédagogique'
      : audience === 'recruteur'
        ? 'Accompagner les transitions, prises de poste et potentiels'
        : audience === 'organisateur'
          ? 'Relier événements, expertise et accompagnement dans la durée'
          : 'Pratique, rendez-vous, qualité et développement de votre offre';
  return (
    <DashboardLayout
      role={audience}
      navItems={['recruteur', 'organisateur', 'coach'].includes(audience) ? [{ path: '/home', label: 'Accueil Omnia', icon: Home, exact: true }] : undefined}
      headerTitle="Omnia Coaching"
      headerSubtitle={subtitle}
      headerSearch={<CoachingHeaderSearch />}
      brandTitle="Omnia"
      brandAccent="Coaching"
      spaceHomePath="/coaching"
      spaceHomeLabel="Retour à Omnia Coaching"
      contentClassName="bg-[#FBFCFA]"
    >
      <CoachingEcosystemNav audience={audience} />
      {children}
    </DashboardLayout>
  );
}

export function CoachingAudienceLayout({ audience, children }: { audience: CoachingAudience; children: ReactNode }) {
  if (audience === 'public' || audience === 'super_admin') return <PublicCoachingLayout>{children}</PublicCoachingLayout>;
  if (audience === 'structure') {
    return (
      <StructureLayout headerTitle="Omnia Coaching" headerSubtitle="Accompagnement, développement et continuité des compétences" headerSearch={<CoachingHeaderSearch />}>
        <CoachingEcosystemNav audience="structure" />
        {children}
      </StructureLayout>
    );
  }
  if (audience === 'moderateur') {
    return (
      <ModerateurLayout headerTitle="Omnia Coaching" headerSubtitle="Offre visible, confiance et qualité de l’écosystème" headerSearch={<CoachingHeaderSearch />}>
        <CoachingEcosystemNav audience="moderateur" />
        {children}
      </ModerateurLayout>
    );
  }
  return <GenericCoachingLayout audience={audience}>{children}</GenericCoachingLayout>;
}

export default function CoachingLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#FBFCFA]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#DCE7E1] border-t-[#356C63]" /></div>;
  }
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCoachingAudience(user?.roles, preview ? params.get('role') : null);
  return <CoachingAudienceLayout audience={audience}>{children}</CoachingAudienceLayout>;
}
