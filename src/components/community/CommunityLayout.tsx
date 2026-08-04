import { ReactNode } from 'react';
import { BookOpen as BookOpenCheck, Briefcase as BriefcaseBusiness, GraduationCap, Home, MessageCircle as MessageCircleQuestion } from 'lucide-react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';

const NAV = [
  { label: 'Accueil Communauté', path: '/forum', icon: Home, exact: true },
  { label: 'Espace général', path: '/forum/general', icon: MessageCircleQuestion },
  { label: 'Carrière & emploi', path: '/emploi', icon: BriefcaseBusiness },
  { label: 'Conseils carrière', path: '/forum/carriere', icon: GraduationCap },
  { label: 'Forums des formations', path: '/forum/formations', icon: BookOpenCheck },
];

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <SubspaceHamburgerLayout
      title="Omnia Communauté"
      navItems={NAV}
      showSearch={false}
      searchPlaceholder="Rechercher une discussion, une formation ou une opportunité..."
    >
      {children}
    </SubspaceHamburgerLayout>
  );
}
