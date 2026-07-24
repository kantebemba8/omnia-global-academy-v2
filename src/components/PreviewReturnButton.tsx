import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PREVIEW_SESSION_KEY = 'omnia_admin_role_preview';
const ROLE_SPACE_PREFIXES = [
  '/dashboard',
  '/professeur',
  '/structure',
  '/staff',
  '/enseignant',
  '/moderateur',
  '/moderator',
  '/partner',
  '/talent',
  '/coach',
];

function isStoredSuperAdmin(): boolean {
  try {
    const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
    return Array.isArray(user?.roles) && user.roles.includes('super_admin');
  } catch {
    return false;
  }
}

function isRoleSpace(pathname: string): boolean {
  return ROLE_SPACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function PreviewReturnButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isStoredSuperAdmin();
  const queryPreview = new URLSearchParams(location.search).get('preview') === 'true';
  const roleSpace = useMemo(() => isRoleSpace(location.pathname), [location.pathname]);
  const storedPreview = sessionStorage.getItem(PREVIEW_SESSION_KEY) === 'true';
  const activePreview = isAdmin && roleSpace && (queryPreview || storedPreview);

  useEffect(() => {
    if (!isAdmin) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }

    if (queryPreview && roleSpace) {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, 'true');
      return;
    }

    if (location.pathname.startsWith('/admin/')) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }

    // Si un lien interne a perdu ?preview=true, on le rétablit afin que les
    // protections de rôle restent en mode aperçu Super Admin.
    if (storedPreview && roleSpace && !queryPreview) {
      const params = new URLSearchParams(location.search);
      params.set('preview', 'true');
      navigate(`${location.pathname}?${params.toString()}${location.hash}`, { replace: true });
    }
  }, [isAdmin, queryPreview, roleSpace, storedPreview, location.pathname, location.search, location.hash, navigate]);

  if (!activePreview) return null;

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
      <ArrowLeft size={17} />
      <span>Retour au dashboard admin</span>
    </button>
  );
}
