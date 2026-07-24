import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink, LayoutDashboard, LogIn, UserRoundCheck } from 'lucide-react';
import { isCoachPreviewMode, withCoachPreview } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type StoredUser = { roles?: string[] };

function dashboardPathForRoles(roles: string[]): string {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('coach')) return '/coach/dashboard';
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur') || roles.includes('gestionnaire_partenaire')) return '/structure/dashboard';
  if (roles.includes('recruteur_independant') || roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('recruteur_structure')) return '/structure/recrutement/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/professeur/dashboard';
  if (roles.includes('enseignant') || roles.includes('etablissement_enseignant')) return '/staff/dashboard';
  if (roles.includes('moderateur')) return '/moderator/dashboard';
  return '/dashboard';
}

export default function CoachingHeader() {
  const location = useLocation();
  const loggedIn = Boolean(localStorage.getItem('omnia_session_token'));
  let user: StoredUser | null = null;
  try { user = JSON.parse(localStorage.getItem('omnia_user') || 'null') as StoredUser | null; } catch { user = null; }

  const roles = user?.roles || [];
  const isCoach = roles.includes('coach');
  const previewMode = isCoachPreviewMode();
  const isCoachWorkspace = location.pathname.startsWith('/coach/');
  const isCoachingLanding = location.pathname === '/coaching';
  const dashboardPath = dashboardPathForRoles(roles);

  const nav = isCoachWorkspace
    ? []
    : [
        { path: '/coaching', label: 'Trouver un coach' },
        { path: '/coaching/solutions', label: 'Packs et groupes' },
        ...(loggedIn ? [{ path: '/dashboard/coaching', label: 'Mes sessions' }] : []),
        { path: '/coaching/devenir-coach', label: 'Devenir coach' },
      ];

  const coachSpaceTarget = loggedIn ? dashboardPath : '/connexion';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[72px] max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link to={isCoachWorkspace ? '/coaching' : previewMode ? withCoachPreview('/coach/dashboard') : '/coaching'} className="flex items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-11 w-11 rounded-xl object-contain" />
          <div>
            <div className="text-lg font-semibold leading-none" style={{ color: BLUE }}>Omnia <span style={{ color: GOLD }}>Coaching</span></div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Accompagnement 1-on-1</div>
          </div>
        </Link>

        {nav.length > 0 && (
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-2 md:w-auto">
            {nav.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold"
                  style={{ color: active ? GOLD : BLUE, background: active ? 'rgba(191,136,19,.10)' : 'transparent' }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="order-2 flex items-center gap-2 md:order-3">
          {isCoachWorkspace && (
            <Link to="/coaching" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
              <ExternalLink size={16}/>
              Voir Omnia Coaching
            </Link>
          )}

          {isCoachingLanding && (
            <Link to={coachSpaceTarget} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
              {loggedIn ? <LayoutDashboard size={16}/> : <LogIn size={16}/>}
              Espace coach
            </Link>
          )}

          {!loggedIn && !isCoachingLanding && !isCoachWorkspace && (
            <Link to={`/connexion?redirect=${encodeURIComponent(location.pathname)}`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
              <LogIn size={16}/>
              Connexion
            </Link>
          )}

          {loggedIn && !isCoach && !previewMode && !isCoachWorkspace && (
            <Link to="/coaching/devenir-coach" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white sm:inline-flex" style={{ background: BLUE }}>
              <UserRoundCheck size={16}/>
              Candidater
            </Link>
          )}

          {!previewMode && !isCoachWorkspace && (
            <Link to="/accueil" className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 lg:inline-flex">
              <ArrowLeft size={15}/>
              OGA
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
