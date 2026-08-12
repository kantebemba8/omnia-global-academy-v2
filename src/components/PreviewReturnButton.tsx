import { useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
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

const ROLE_LABELS: Record<string, string> = {
  apprenant: 'Apprenant',
  professeur: 'Professeur',
  structure: 'Structure',
  moderateur: 'Modérateur',
  recruteur: 'Recruteur',
  organisateur: 'Organisateur',
  coach: 'Coach',
  enseignant: 'Enseignant',
  talent: 'Talent',
};

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

export function PreviewReturnBar({ label }: { label?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isStoredSuperAdmin();
  const searchParams = new URLSearchParams(location.search);
  const queryPreview = searchParams.get('preview') === 'true';
  const homePreviewRole = location.pathname === '/home' && queryPreview ? searchParams.get('role') : null;
  const currentSpace = useMemo(() => homePreviewRole || previewSpace(location.pathname), [homePreviewRole, location.pathname]);
  const storedSpace = sessionStorage.getItem(PREVIEW_SESSION_KEY);
  const activePreview = Boolean(isAdmin && (queryPreview ? (storedSpace || currentSpace) : (currentSpace && storedSpace === currentSpace)));
  const previewLabel = label || ROLE_LABELS[storedSpace || currentSpace || ''] || 'Rôle';

  useEffect(() => {
    if (!isAdmin) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }

    if (queryPreview && homePreviewRole) {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, homePreviewRole);
      return;
    }

    if (queryPreview && currentSpace && !storedSpace) {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, currentSpace);
      return;
    }

    if (location.pathname.startsWith('/admin/')) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }

    if (storedSpace && currentSpace === storedSpace && !queryPreview) {
      const params = new URLSearchParams(location.search);
      params.set('preview', 'true');
      navigate(`${location.pathname}?${params.toString()}${location.hash}`, { replace: true });
    }
  }, [isAdmin, queryPreview, homePreviewRole, currentSpace, storedSpace, location.pathname, location.search, location.hash, navigate]);

  if (!activePreview) return null;

  return (
    <div className="flex-shrink-0 border-b border-[#D8C08A] bg-[#FFF7E6]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm md:px-6">
        <div className="min-w-0">
          <strong className="text-[#002050]">Prévisualisation Super-admin : {previewLabel}</strong>
          <span className="ml-2 hidden text-slate-600 sm:inline">Votre rôle et vos permissions Super-admin restent inchangés.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(PREVIEW_SESSION_KEY);
            navigate('/admin/dashboard');
          }}
          className="inline-flex items-center gap-2 font-bold text-[#002050] hover:underline"
          aria-label="Retour à l’administration"
        >
          <ArrowLeft size={15} className="text-[#BF8813]" />
          Retour à l’administration
        </button>
      </div>
    </div>
  );
}

// Alias conservé pour compatibilité de code : le rendu n’est plus un bouton flottant.
export const PreviewReturnButton = PreviewReturnBar;
