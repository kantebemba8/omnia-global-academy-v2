import type { ReactNode } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import CareerHeaderSearch from './CareerHeaderSearch';
import CareerEcosystemNav from './CareerEcosystemNav';

export default function CareerLearnerLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout role="apprenant" headerTitle="Omnia Career" headerSubtitle="Documents, préparation et candidatures" headerSearch={<CareerHeaderSearch />}>
      <CareerEcosystemNav audience="apprenant" />
      {children}
    </DashboardLayout>
  );
}
