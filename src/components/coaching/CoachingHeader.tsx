import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';
import UserAccountMenu from '../UserAccountMenu';
import { EcosystemConnectedHeader } from '../ecosystem/EcosystemShell';
import CoachingHeaderSearch from './CoachingHeaderSearch';
import CoachingEcosystemNav from './CoachingEcosystemNav';
import {
  coachingAudienceLabel,
  getCoachingNavigation,
  resolveCoachingAudience,
} from '../../lib/coachingNavigation';

const BLUE = '#002050';

type StoredUser = {
  full_name?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
  roles?: string[];
};

type Props = {
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

function dashboardPathForRoles(roles: string[]): string {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('coach')) return '/coach/dashboard';
  if (roles.includes('responsable_structure') || roles.includes('gestionnaire_structure') || roles.includes('structure_admin') || roles.includes('directeur') || roles.includes('gestionnaire_partenaire')) return '/structure/dashboard';
  if (roles.includes('recruteur_independant') || roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('recruteur_structure')) return '/structure/recrutement/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur') || roles.includes('enseignant') || roles.includes('etablissement_enseignant')) return '/professeur/dashboard';
  if (roles.includes('moderateur')) return '/moderateur/dashboard';
  if (roles.includes('organisateur') || roles.includes('organizer')) return '/omnia-live/organisateur';
  return '/dashboard';
}

/**
 * Header de compatibilité pour les pages profondes Coaching qui ne sont pas
 * encore enveloppées par CoachingLayout (paiement, réservation, session, etc.).
 * En session connectée, il réutilise exactement le chrome d'écosystème commun.
 * En public, il conserve l'entête de découverte historique.
 */
export default function CoachingHeader({ showSearch = true }: Props) {
  const location = useLocation();
  const [params] = useSearchParams();
  const [user, setUser] = useState<StoredUser | null>(() => {
    try {
      const raw = localStorage.getItem('omnia_user');
      return raw ? JSON.parse(raw) as StoredUser : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const refreshUser = () => {
      try {
        const raw = localStorage.getItem('omnia_user');
        setUser(raw ? JSON.parse(raw) as StoredUser : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('omnia:profile-updated', refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener('omnia:profile-updated', refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);

  const roles = user?.roles || [];
  const loggedIn = Boolean(getSessionToken()) && Boolean(user);
  const preview = params.get('preview') === 'true' && roles.includes('super_admin');
  const audience = resolveCoachingAudience(roles, preview ? params.get('role') : null);
  const dashboardPath = dashboardPathForRoles(roles);

  // Le Super-admin normal reste hors de la refonte jusqu'à son lot final.
  const connectedAudience = loggedIn && (audience !== 'super_admin' || preview) ? audience : null;
  if (connectedAudience && connectedAudience !== 'public' && connectedAudience !== 'super_admin') {
    return (
      <EcosystemConnectedHeader
        ecosystem="coaching"
        audienceLabel={coachingAudienceLabel(connectedAudience)}
        navigation={getCoachingNavigation(connectedAudience)}
        search={showSearch ? <CoachingHeaderSearch /> : undefined}
        dashboardPath={dashboardPath}
      />
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 flex h-[72px] items-center border-b border-[#DCE7E1] bg-white/95 px-4 backdrop-blur md:px-7">
        <Link to="/coaching" className="flex min-w-0 items-center gap-3">
          <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-9 w-9 flex-none rounded-lg object-cover" />
          <span className="truncate text-lg font-black tracking-[-.025em] md:text-xl" style={{ color: BLUE }}>Omnia <span className="text-[#BF8813]">Coaching</span></span>
        </Link>

        {showSearch && <div className="mx-5 hidden min-w-0 flex-1 justify-center lg:flex"><div className="w-full max-w-[480px]"><CoachingHeaderSearch /></div></div>}

        <div className="ml-auto flex flex-none items-center gap-2">
          {!loggedIn ? (
            <>
              <Link to={`/connexion?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="inline-flex items-center gap-2 rounded-xl border border-[#DCE7E1] bg-white px-3 py-2 text-sm font-black text-[#002050]">
                <LogIn size={16} /><span className="hidden sm:inline">Connexion</span>
              </Link>
              <LanguageSwitcher compact />
            </>
          ) : <UserAccountMenu dashboardPath={dashboardPath} />}
        </div>
      </header>
      {showSearch && <div className="border-b border-[#DCE7E1] bg-[#FBFCFA] px-4 py-3 lg:hidden"><CoachingHeaderSearch /></div>}
      <CoachingEcosystemNav audience="public" publicMode />
    </>
  );
}
