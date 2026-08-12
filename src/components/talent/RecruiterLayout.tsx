import type { ReactNode } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { EcosystemConnectedShell } from '../ecosystem/EcosystemShell';
import ContextualHeaderSearch, { type ContextualHeaderSearchItem } from '../ContextualHeaderSearch';
import TalentHeaderSearch from './TalentHeaderSearch';
import { getTalentNavigation } from '../../lib/talentNavigation';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchItems?: ContextualHeaderSearchItem[];
};

export function RecruiterLayout({ children, searchValue, onSearchChange, searchItems }: Props) {
  const headerSearch = searchItems
    ? <ContextualHeaderSearch items={searchItems} placeholder="Rechercher dans Omnia Talent..." value={searchValue} onChange={onSearchChange} />
    : <TalentHeaderSearch />;
  return (
    <DashboardLayout role="recruteur" ecosystemMode>
      <EcosystemConnectedShell ecosystem="talent" audienceLabel="Recruteur" navigation={getTalentNavigation('recruteur')} search={headerSearch}>
        {children}
      </EcosystemConnectedShell>
    </DashboardLayout>
  );
}
