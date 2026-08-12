import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageFooter } from '../PageFooter';
import SuperAdminEcosystemLayout from '../ecosystem/SuperAdminEcosystemLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell, EcosystemPublicHeader } from '../ecosystem/EcosystemShell';
import FormationsHeaderSearch from './FormationsHeaderSearch';
import {
  formationsAudienceLabel,
  getFormationsNavigation,
  resolveFormationsAudience,
  type FormationsAudience,
} from '../../lib/formationsNavigation';

export function PublicFormationsLayout({ children, audience = 'public' }: { children: ReactNode; audience?: FormationsAudience }) {
  if (audience === 'super_admin') return <SuperAdminEcosystemLayout ecosystem="formations" navigation={getFormationsNavigation('public')} search={<FormationsHeaderSearch />}>{children}</SuperAdminEcosystemLayout>;
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EcosystemPublicHeader ecosystem="formations" navigation={getFormationsNavigation('public')} search={<FormationsHeaderSearch />} />
      <main className="min-w-0">{children}</main>
      <PageFooter ecosystem="formations" />
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
  if (audience === 'super_admin' && !preview) return <PublicFormationsLayout audience="super_admin">{children}</PublicFormationsLayout>;
  if (audience === 'public') return <PublicFormationsLayout audience="public">{children}</PublicFormationsLayout>;
  return <ConnectedFrame audience={audience}>{children}</ConnectedFrame>;
}
