import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const PREVIEW_SESSION_KEY = 'omnia_admin_role_preview';

const ROLE_SPACE_PREFIXES = [
  ['/dashboard', 'apprenant'],
  ['/professeur', 'professeur'],
  ['/structure', 'structure'],
  ['/staff', 'enseignant'],
  ['/enseignant', 'enseignant'],
  ['/moderateur', 'moderateur'],
  ['/moderator', 'moderateur'],
  ['/partner', 'structure'],
  ['/talent/recruteur', 'recruteur'],
  ['/talent', 'talent'],
  ['/coach', 'coach'],
  ['/omnia-live/organisateur', 'organisateur'],
] as const;

function isStoredSuperAdmin(): boolean {
  try {
    const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
    return Array.isArray(user?.roles) && user.roles.includes('super_admin');
  } catch {
    return false;
  }
}

function previewSpace(pathname: string): string | null {
  const isOrganizerCreatorRoute =
    pathname === '/omnia-live/revenus'
    || pathname === '/omnia-live/proposer'
    || pathname.startsWith('/omnia-live/organisateur')
    || pathname.startsWith('/omnia-live/studio/')
    || /^\/omnia-live\/[^/]+\/(organiser|presence|statistiques)$/.test(pathname);
  if (isOrganizerCreatorRoute) return 'organisateur';

  const match = ROLE_SPACE_PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] || null;
}

export function PreviewReturnButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isStoredSuperAdmin();
  const queryPreview = new URLSearchParams(location.search).get('preview') === 'true';
  const currentSpace = useMemo(() => previewSpace(location.pathname), [location.pathname]);
  const storedSpace = sessionStorage.getItem(PREVIEW_SESSION_KEY);
  const activePreview = Boolean(isAdmin && currentSpace && (queryPreview || storedSpace === currentSpace));

  useEffect(() => {
    if (!isAdmin) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }

    if (queryPreview && currentSpace) {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, currentSpace);
      return;
    }

    if (location.pathname.startsWith('/admin/')) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }

    // Un aperçu est limité à l’espace sélectionné. Il ne peut donc pas
    // transformer la session Super Admin en un autre rôle.
    if (storedSpace && currentSpace === storedSpace && !queryPreview) {
      const params = new URLSearchParams(location.search);
      params.set('preview', 'true');
      navigate(`${location.pathname}?${params.toString()}${location.hash}`, { replace: true });
    }
  }, [isAdmin, queryPreview, currentSpace, storedSpace, location.pathname, location.search, location.hash, navigate]);

  if (!activePreview || currentSpace === 'coach') return null;

  return (
    <button
      type="button"
      onClick={() => {
        sessionStorage.removeItem(PREVIEW_SESSION_KEY);
        navigate('/admin/dashboard');
      }}
      className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl transition-transform hover:-translate-y-0.5"
      style={{ background: '#002050', border: '1px solid rgba(191,136,19,.65)' }}
      aria-label="Retour au tableau de bord Super Admin"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
      <span>Retour au dashboard admin</span>
    </button>
  );
}
