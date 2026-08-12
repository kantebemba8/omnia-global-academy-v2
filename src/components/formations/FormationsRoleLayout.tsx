import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from '../Navbar';
import { PageFooter } from '../PageFooter';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import FormationsHeaderSearch from './FormationsHeaderSearch';
import FormationsEcosystemNav from './FormationsEcosystemNav';
import { resolveFormationsAudience, type FormationsAudience } from '../../lib/formationsNavigation';

export function PublicFormationsLayout({ children, audience = 'public' }: { children: ReactNode; audience?: FormationsAudience }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <div className="pt-20">
        <FormationsEcosystemNav audience={audience} publicMode />
        {children}
        <PageFooter />
      </div>
    </div>
  );
}

export function LearnerFormationsLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout role="apprenant" headerTitle="Formations" headerSubtitle="Apprendre, progresser et certifier" headerSearch={<FormationsHeaderSearch />}><FormationsEcosystemNav audience="apprenant" />{children}</DashboardLayout>;
}

export function ProfessorFormationsLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout role="professeur" headerTitle="Formations" headerSubtitle="Conception, évaluation et suivi pédagogique" headerSearch={<FormationsHeaderSearch />}><FormationsEcosystemNav audience="professeur" />{children}</DashboardLayout>;
}

export function StructureFormationsLayout({ children }: { children: ReactNode }) {
  return <StructureLayout headerTitle="Formations" headerSubtitle="Conception et pilotage pédagogique" headerSearch={<FormationsHeaderSearch />}><FormationsEcosystemNav audience="structure" />{children}</StructureLayout>;
}

export function ModeratorFormationsLayout({ children }: { children: ReactNode }) {
  return <ModerateurLayout headerTitle="Formations" headerSubtitle="Contrôle pédagogique selon vos permissions" headerSearch={<FormationsHeaderSearch />}><FormationsEcosystemNav audience="moderateur" />{children}</ModerateurLayout>;
}

export function AdaptiveFormationsLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  }
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveFormationsAudience(user?.roles, preview ? params.get('role') : null);
  if (audience === 'apprenant') return <LearnerFormationsLayout>{children}</LearnerFormationsLayout>;
  if (audience === 'professeur') return <ProfessorFormationsLayout>{children}</ProfessorFormationsLayout>;
  if (audience === 'structure') return <StructureFormationsLayout>{children}</StructureFormationsLayout>;
  if (audience === 'moderateur') return <ModeratorFormationsLayout>{children}</ModeratorFormationsLayout>;
  return <PublicFormationsLayout audience={audience === 'super_admin' ? 'public' : audience}>{children}</PublicFormationsLayout>;
}
