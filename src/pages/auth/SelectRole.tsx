import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Building2, ChevronRight, Radio, UserRoundSearch } from 'lucide-react';
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
    description: 'J’organise des Lives, conférences, masterclass et événements en ligne',
    path: '/inscription/organisateur',
  },
  {
    key: 'recruteur_independant',
    icon: UserRoundSearch,
    title: 'Recruteur indépendant',
    description: 'Je recrute avec un compte professionnel distinct',
    path: '/inscription/recruteur',
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
    <AuthLayout
      title="Créer un compte"
      subtitle="Choisissez le profil qui correspond à votre utilisation de la plateforme"
      variant="wide"
    >
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {roles.map(({ key, icon: Icon, title, description, path }, index) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(path)}
            className={`group flex min-h-[112px] w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#BF8813] hover:shadow-[0_12px_30px_rgba(0,32,80,0.08)] focus:outline-none focus:ring-2 focus:ring-[#BF8813]/30 ${index === roles.length - 1 ? 'sm:col-span-2' : ''}`}
            style={{ borderColor: '#E5E7EB' }}
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F0F4FF] transition-colors group-hover:bg-[#FFF8E7]">
              <Icon size={22} style={{ color: '#002050' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold sm:text-[15px]" style={{ color: '#002050' }}>{title}</div>
              <div className="mt-1 text-xs leading-5 sm:text-sm" style={{ color: '#6B7280' }}>{description}</div>
            </div>
            <ChevronRight size={19} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#BF8813' }} />
          </button>
        ))}
      </div>

      <p className="mt-7 text-center text-sm" style={{ color: '#6B7280' }}>
        Déjà un compte ?{' '}
        <Link to="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
