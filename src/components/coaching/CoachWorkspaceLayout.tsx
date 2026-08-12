import type { ReactNode } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import CoachingHeaderSearch from './CoachingHeaderSearch';
import { getCoachingNavigation } from '../../lib/coachingNavigation';

export default function CoachWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout role="coach" ecosystemMode>
      <EcosystemConnectedShell ecosystem="coaching" audienceLabel="Coach" navigation={getCoachingNavigation('coach')} search={<CoachingHeaderSearch />}>
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</div>
      </EcosystemConnectedShell>
    </DashboardLayout>
  );
}
