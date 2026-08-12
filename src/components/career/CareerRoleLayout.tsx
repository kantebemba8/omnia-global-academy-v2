import type { ReactNode } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import CareerHeaderSearch from './CareerHeaderSearch';
import { careerAudienceLabel, getCareerNavigation, type CareerAudience } from '../../lib/careerNavigation';

export function CareerAudienceLayout({ audience, children }: { audience: Exclude<CareerAudience, 'public' | 'super_admin'>; children: ReactNode }) {
  const shell = (
    <EcosystemConnectedShell ecosystem="career" audienceLabel={careerAudienceLabel(audience)} navigation={getCareerNavigation(audience)} search={<CareerHeaderSearch />}>
      {children}
    </EcosystemConnectedShell>
  );
  if (audience === 'structure') return <StructureLayout ecosystemMode>{shell}</StructureLayout>;
  if (audience === 'moderateur') return <ModerateurLayout ecosystemMode>{shell}</ModerateurLayout>;
  return <DashboardLayout role={audience} ecosystemMode>{shell}</DashboardLayout>;
}

export default function CareerLearnerLayout({ children }: { children: ReactNode }) {
  return <CareerAudienceLayout audience="apprenant">{children}</CareerAudienceLayout>;
}
