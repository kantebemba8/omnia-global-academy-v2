import { ReactNode } from 'react';
import { BookOpen as BookOpenCheck, Home, MessageCircle as MessageCircleQuestion } from 'lucide-react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';

const NAV = [
  { label: 'Accueil Communauté', path: '/forum', icon: Home, exact: true },
  { label: 'Espace général', path: '/forum/general', icon: MessageCircleQuestion },
  { label: 'Forums des formations', path: '/forum/formations', icon: BookOpenCheck },
];

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <SubspaceHamburgerLayout
      title="Omnia Communauté"
      navItems={NAV}
      searchPath="/forum"
      searchParam="search"
      searchPlaceholder="Rechercher une discussion, une formation ou une opportunité..."
      navigationMode="horizontal"
    >
      {children}
    </SubspaceHamburgerLayout>
  );
}
