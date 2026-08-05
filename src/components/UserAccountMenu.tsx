import { useEffect, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearSession } from '../lib/session';
import { getDashboardPath } from './SubspaceHamburgerLayout';

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

  if (!user) return null;
  const target = dashboardPath || getDashboardPath(user.roles || []);

  function logout() {
    clearSession();
    localStorage.removeItem('omnia_user');
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} className={`flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 transition hover:bg-slate-50 ${buttonClassName}`} aria-label="Ouvrir le menu du profil" aria-expanded={open}>
        {user.avatar_url ? <img src={user.avatar_url} alt="Photo de profil" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>}
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && <>
        <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="Fermer le menu du profil" />
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
          <button type="button" onClick={() => navigate('/mon-profil')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"><UserRound size={17} /> Mon profil</button>
          <button type="button" onClick={() => navigate(target)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"><LayoutDashboard size={17} /> Mon espace</button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} /> Se déconnecter</button>
        </div>
      </>}
    </div>
  );
}
