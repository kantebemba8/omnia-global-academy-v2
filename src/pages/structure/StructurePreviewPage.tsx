import { useLocation } from 'react-router-dom';
import { StructureLayout } from '../../components/StructureLayout';
import {
  BarChart2, Bell, BookOpen, Briefcase, Building2, CalendarDays, Gift,
  Heart, MessageSquare, PlusCircle, QrCode, Search, Settings, Shield,
  UserCheck, Users, UserRoundSearch
} from 'lucide-react';

const SECTION_BY_PATH: Array<{ test: (p: string) => boolean; title: string; description: string; icon: typeof Building2 }> = [
  { test: p => p === '/structure/profil', title: 'Profil de la structure', description: 'Aucune information de structure disponible dans ce mode aperçu.', icon: Building2 },
  { test: p => p === '/structure/formations', title: 'Formations', description: 'Aucune formation disponible.', icon: BookOpen },
  { test: p => p === '/structure/formations/nouvelle', title: 'Créer une formation', description: 'La création est désactivée en mode aperçu Super Admin.', icon: PlusCircle },
  { test: p => p === '/structure/membres', title: 'Membres liés', description: 'Aucun membre lié.', icon: Users },
  { test: p => p === '/structure/rattachements', title: 'Demandes de rattachement', description: 'Aucune demande de rattachement.', icon: UserCheck },
  { test: p => p === '/structure/codes', title: 'Codes Structure', description: 'Aucun code Structure actif.', icon: QrCode },
  { test: p => p === '/structure/abonnements', title: 'Avantages Structure', description: 'Aucun avantage Structure actif.', icon: Gift },
  { test: p => p === '/structure/offres-emploi', title: "Offres d'emploi", description: 'Aucune offre publiée.', icon: Briefcase },
  { test: p => p === '/structure/recrutement/dashboard', title: 'Recrutement', description: 'Aucune activité de recrutement.', icon: UserRoundSearch },
  { test: p => p === '/structure/recrutement/offres', title: 'Offres de recrutement', description: 'Aucune offre de recrutement.', icon: Briefcase },
  { test: p => p === '/structure/recrutement/talents', title: 'Recherche de talents', description: 'Aucun résultat à afficher dans ce mode aperçu.', icon: Search },
  { test: p => p === '/structure/recrutement/favoris', title: 'Talents favoris', description: 'Aucun talent favori.', icon: Heart },
  { test: p => p === '/structure/recrutement/candidats', title: 'Candidats', description: 'Aucun candidat.', icon: Users },
  { test: p => p === '/structure/recrutement/entretiens', title: 'Entretiens', description: 'Aucun entretien programmé.', icon: CalendarDays },
  { test: p => p === '/structure/recrutement/messages', title: 'Messages recrutement', description: 'Aucun message.', icon: MessageSquare },
  { test: p => p === '/structure/recrutement/statistiques', title: 'Statistiques recrutement', description: 'Aucune donnée statistique disponible.', icon: BarChart2 },
  { test: p => p === '/structure/recrutement/equipe' || p === '/structure/equipe', title: 'Équipe de la structure', description: 'Aucun membre d’équipe disponible.', icon: Shield },
  { test: p => p === '/structure/statistiques', title: 'Statistiques', description: 'Aucune donnée statistique disponible.', icon: BarChart2 },
  { test: p => p === '/structure/notifications', title: 'Notifications', description: 'Aucune notification.', icon: Bell },
  { test: p => p === '/structure/parametres', title: 'Paramètres', description: 'Les modifications sont désactivées en mode aperçu Super Admin.', icon: Settings },
];

export default function StructurePreviewPage() {
  const { pathname } = useLocation();
  const section = SECTION_BY_PATH.find(item => item.test(pathname)) ?? {
    title: 'Espace Structure',
    description: 'Aucune donnée disponible.',
    icon: Building2,
  };
  const Icon = section.icon;

  return (
    <StructureLayout displayName="Espace Structure">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>{section.title}</h1>
          <p className="mt-1 text-sm text-gray-500">Mode aperçu en lecture seule</p>
        </div>
        <div className="rounded-2xl border bg-white p-10 text-center" style={{ borderColor: '#E4E7EC' }}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#F3F6FA' }}>
            <Icon size={24} style={{ color: '#002050' }} />
          </div>
          <h2 className="mt-4 text-base font-semibold" style={{ color: '#002050' }}>{section.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{section.description}</p>
        </div>
      </div>
    </StructureLayout>
  );
}
