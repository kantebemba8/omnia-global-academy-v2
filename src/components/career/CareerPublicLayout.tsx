import type { ReactNode } from 'react';
import { Briefcase, Heart, MessageCircle, Users } from 'lucide-react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';

const NAV = [
  { label: 'Opportunités', path: '/forum/emploi', icon: Briefcase, exact: true },
  { label: 'Conseils carrière', path: '/forum/carriere', icon: MessageCircle },
  { label: 'Omnia Talent', path: '/talent', icon: Users },
  { label: 'Coaching', path: '/coaching', icon: Heart },
];

export default function CareerPublicLayout({ children }: { children: ReactNode }) {
  return (
    <SubspaceHamburgerLayout
      title="Omnia Career"
      navItems={NAV}
      searchPath="/forum/emploi"
      searchParam="search"
      searchPlaceholder="Rechercher une opportunité, un métier ou une entreprise..."
      navigationMode="horizontal"
    >
      {children}
    </SubspaceHamburgerLayout>
  );
}
