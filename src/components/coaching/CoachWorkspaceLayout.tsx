import type { ReactNode } from 'react';
import { Home } from 'lucide-react';
import { DashboardLayout } from '../DashboardLayout';
import CoachingEcosystemNav from './CoachingEcosystemNav';
import CoachingHeaderSearch from './CoachingHeaderSearch';

export default function CoachWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout
      role="coach"
      navItems={[{ path: '/home', label: 'Accueil Omnia', icon: Home, exact: true }]}
      headerTitle="Omnia Coaching"
      headerSubtitle="Pratique, séances, qualité et développement"
      headerSearch={<CoachingHeaderSearch />}
      brandTitle="Omnia"
      brandAccent="Coaching"
      spaceHomePath="/coaching"
      spaceHomeLabel="Retour à Omnia Coaching"
      contentClassName="bg-[#FBFCFA]"
    >
      <CoachingEcosystemNav audience="coach" />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</div>
    </DashboardLayout>
  );
}
