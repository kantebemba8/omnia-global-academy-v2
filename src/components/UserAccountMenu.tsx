import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Settings, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getDashboardPathForRoles, normalizePlatformRoles } from '../lib/session';

const BLUE = '#002050';

type StoredUser = {
  full_name?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
  roles?: string[];
};

type Props = {
  dashboardPath?: string;
  buttonClassName?: string;
};

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.name || user?.email || 'Omnia';
  return source.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export default function UserAccountMenu({ dashboardPath, buttonClassName = '' }: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(() => {
    try { const raw = localStorage.getItem('omnia_user'); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  });

  useEffect(() => {
    const refresh = () => {
      try { const raw = localStorage.getItem('omnia_user'); setUser(raw ? JSON.parse(raw) : null); }
      catch { setUser(null); }
    };
    window.addEventListener('omnia:profile-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omnia:profile-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOutside);
    };
  }, [open]);

  if (!user) return null;

  const canonicalRoles = normalizePlatformRoles(user.roles || []);
  const isAdministration = canonicalRoles.includes('super_admin');
  const target = dashboardPath || getDashboardPathForRoles(user.roles || []);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  function logout() {
    setOpen(false);
    sessionStorage.removeItem('omnia_admin_role_preview');
    clearSession();
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  return (
    <div ref={rootRef} className="relative" data-no-auto-translate="true">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] ${buttonClassName}`}
        aria-label="Ouvrir le menu du compte"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar_url
          ? <img src={user.avatar_url} alt="Photo du compte" className="h-8 w-8 rounded-full object-cover" />
          : <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/mon-profil')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isAdministration ? <Settings size={17} /> : <UserRound size={17} />}
            {isAdministration ? 'Mon compte' : 'Mon profil'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => go(target)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LayoutDashboard size={17} /> Retour au Dashboard
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut size={17} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
