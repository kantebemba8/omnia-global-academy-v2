import type { ElementType, ReactNode } from 'react';
import {
  BarChart3, CreditCard, Film, KeyRound, LayoutDashboard, MessageSquare,
  PlusCircle, Radio, Settings2, User, Users, Wallet,
} from 'lucide-react';
import { DashboardLayout, type NavGroup } from '../../../components/DashboardLayout';

type OrganizerNavItem = { path: string; label: string; icon: ElementType; exact?: boolean };
type OrganizerNavGroup = { id: string; label: string; icon: ElementType; items: OrganizerNavItem[] };

const NAV_GROUPS: OrganizerNavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/omnia-live/organisateur', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'events', label: 'Événements', icon: Radio,
    items: [
      { path: '/omnia-live/proposer', label: 'Créer un événement', icon: PlusCircle },
      { path: '/omnia-live/organisateur/evenements', label: 'Mes événements', icon: Radio },
      { path: '/omnia-live/organisateur/participants', label: 'Participants', icon: Users },
      { path: '/omnia-live/organisateur/communications', label: 'Communications', icon: MessageSquare },
      { path: '/omnia-live/organisateur/acces-prives', label: 'Codes privés', icon: KeyRound },
      { path: '/omnia-live/organisateur/medias', label: 'Médias & Replays', icon: Film },
    ],
  },
  {
    id: 'analytics', label: 'Pilotage', icon: BarChart3,
    items: [{ path: '/omnia-live/organisateur/statistiques', label: 'Analytics', icon: BarChart3 }],
  },
  {
    id: 'commerce', label: 'Offres & revenus', icon: Wallet,
    items: [
      { path: '/omnia-live/organisateur/offres', label: 'Offres aux participants', icon: CreditCard },
      { path: '/omnia-live/organisateur/plan-omnia', label: 'Mon plan organisateur', icon: CreditCard },
      { path: '/omnia-live/revenus', label: 'Revenus & Payouts', icon: Wallet },
    ],
  },
  {
    id: 'settings', label: 'Configuration', icon: Settings2,
    items: [
      { path: '/mon-profil', label: 'Mon profil', icon: User },
      { path: '/omnia-live/organisateur/parametres', label: 'Paramètres', icon: Settings2 },
    ],
  },
];

export default function OrganizerShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <DashboardLayout
      role="organisateur"
      navGroups={NAV_GROUPS as NavGroup[]}
      headerTitle={title}
      headerSubtitle={subtitle || 'Omnia Live'}
      brandTitle="Omnia"
      brandAccent="Live"
      spaceHomePath="/omnia-live"
      spaceHomeLabel="Retour à Omnia Live"
      contentClassName="bg-white"
    >
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</section>
    </DashboardLayout>
  );
}
