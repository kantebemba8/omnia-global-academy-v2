import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from '../Navbar';
import { PageFooter } from '../PageFooter';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import FormationsHeaderSearch from './FormationsHeaderSearch';
import FormationsEcosystemNav from './FormationsEcosystemNav';
import {
  formationsAudienceLabel,
  getFormationsNavigation,
  resolveFormationsAudience,
  type FormationsAudience,
} from '../../lib/formationsNavigation';

export function PublicFormationsLayout({ children, audience = 'public' }: { children: ReactNode; audience?: FormationsAudience }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <div className="pt-20">
        <FormationsEcosystemNav audience={audience} publicMode />
        {children}
        <PageFooter ecosystem="formations" />
      </div>
    </div>
  );
}

function ConnectedFrame({ audience, children }: { audience: Exclude<FormationsAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = (
    <EcosystemConnectedShell
      ecosystem="formations"
      audienceLabel={formationsAudienceLabel(audience)}
      navigation={getFormationsNavigation(audience)}
      search={<FormationsHeaderSearch />}
    >
      {children}
    </EcosystemConnectedShell>
  );
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

export function LearnerFormationsLayout({ children }: { children: ReactNode }) {
  return <ConnectedFrame audience="apprenant">{children}</ConnectedFrame>;
}
export function ProfessorFormationsLayout({ children }: { children: ReactNode }) {
  return <ConnectedFrame audience="professeur">{children}</ConnectedFrame>;
}
export function StructureFormationsLayout({ children }: { children: ReactNode }) {
  return <ConnectedFrame audience="structure">{children}</ConnectedFrame>;
}
export function ModeratorFormationsLayout({ children }: { children: ReactNode }) {
  return <ConnectedFrame audience="moderateur">{children}</ConnectedFrame>;
}

export function AdaptiveFormationsLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  }
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveFormationsAudience(user?.roles, preview ? params.get('role') : null);
  if (audience === 'super_admin' && !preview) return <PublicFormationsLayout audience="public">{children}</PublicFormationsLayout>;
  if (audience === 'public') return <PublicFormationsLayout audience="public">{children}</PublicFormationsLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}
