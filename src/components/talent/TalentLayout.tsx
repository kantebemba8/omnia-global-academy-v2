import { ReactNode } from 'react';
import { Briefcase, Building2, Compass, Home, Info, MessageSquare } from 'lucide-react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';

const NAV = [
  { label: 'Accueil Talent', path: '/talent', icon: Home, exact: true },
  { label: 'Explorer', path: '/talent/explorer', icon: Compass },
  { label: 'Communauté', path: '/forum', icon: MessageSquare },
  { label: 'Pour les recruteurs', path: '/talent/recruteurs', icon: Briefcase },
  { label: 'Organisations', path: '/talent/organisations', icon: Building2 },
  { label: 'À propos', path: '/talent/a-propos', icon: Info },
];

export function TalentLayout({ children }: { children: ReactNode }) {
  return (
    <SubspaceHamburgerLayout title="Talent Omnia" navItems={NAV} searchPlaceholder="Rechercher un talent, une compétence...">
      {children}
    </SubspaceHamburgerLayout>
  );
}
