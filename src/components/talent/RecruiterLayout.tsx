import type { ReactNode } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import ContextualHeaderSearch, { type ContextualHeaderSearchItem } from '../ContextualHeaderSearch';
import TalentEcosystemNav from './TalentEcosystemNav';
import TalentHeaderSearch from './TalentHeaderSearch';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchItems?: ContextualHeaderSearchItem[];
};

export function RecruiterLayout({ children, title, subtitle, searchValue, onSearchChange, searchItems }: Props) {
  const headerSearch = searchItems
    ? <ContextualHeaderSearch items={searchItems} placeholder="Rechercher dans Omnia Talent..." value={searchValue} onChange={onSearchChange} />
    : <TalentHeaderSearch />;
  return (
    <DashboardLayout
      role="recruteur"
      headerTitle={title || 'Omnia Talent'}
      headerSubtitle={subtitle || 'Sourcing, recrutement et relations talents'}
      headerSearch={headerSearch}
      brandTitle="Omnia"
      brandAccent="Talent"
      spaceHomePath="/talent"
      spaceHomeLabel="Retour à Omnia Talent"
      contentClassName="bg-[#FCFAFC]"
    >
      <TalentEcosystemNav audience="recruteur" />
      {children}
    </DashboardLayout>
  );
}
