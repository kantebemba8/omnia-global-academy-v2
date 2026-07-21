import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Building2, ChevronRight, Radio } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';

const roles = [
  {
    key: 'apprenant',
    icon: BookOpen,
    title: 'Apprenant',
    description: "J'explore et j'apprends à mon rythme",
    path: '/inscription/apprenant',
  },
  {
    key: 'professeur',
    icon: GraduationCap,
    title: 'Professeur',
    description: 'Je partage mon expertise et crée des cours',
    path: '/inscription/professeur',
  },
  {
    key: 'organizer',
    icon: Radio,
    title: 'Organisateur',
    description: "J’organise des Lives, conférences, masterclass et événements en ligne",
    path: '/inscription/organisateur',
  },
  {
    key: 'structure',
    icon: Building2,
    title: 'Structure',
    description: 'Mon organisation souhaite rejoindre Omnia Global Academy',
    path: '/inscription/structure',
  },
];

export function SelectRole() {
  const navigate = useNavigate();

  return (
    <AuthLayout title="Créer un compte" subtitle="Choisissez votre profil pour commencer">
      <div className="space-y-3 mt-4">
        {roles.map(({ key, icon: Icon, title, description, path }) => (
          <button
            key={key}
            onClick={() => navigate(path)}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all group"
            style={{ borderColor: '#E5E7EB' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#BF8813')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <div
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#F0F4FF' }}
            >
              <Icon size={22} style={{ color: '#002050' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm" style={{ color: '#002050' }}>{title}</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{description}</div>
            </div>
            <ChevronRight size={18} style={{ color: '#BF8813' }} />
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-sm" style={{ color: '#6B7280' }}>
        Déjà un compte ?{' '}
        <a href="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>
          Se connecter
        </a>
      </p>
    </AuthLayout>
  );
}
