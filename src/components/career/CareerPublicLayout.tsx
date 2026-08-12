import type { ReactNode } from 'react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { getCareerNavigation } from '../../lib/careerNavigation';

export default function CareerPublicLayout({ children }: { children: ReactNode }) {
  const navItems = getCareerNavigation('public').map(item => ({
    label: item.label,
    path: item.path,
    icon: item.icon,
    exact: item.id === 'accueil',
  }));
  return (
    <SubspaceHamburgerLayout
      title="Omnia Career"
      navItems={navItems}
      searchPath="/forum/emploi"
      searchParam="search"
      searchPlaceholder="Rechercher une opportunité, un métier ou une entreprise..."
      navigationMode="horizontal"
    >
      {children}
    </SubspaceHamburgerLayout>
  );
}
