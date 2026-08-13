import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Home, Languages, Layers3, LogOut, Plus, Settings, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getActivePlatformRole, getDashboardPathForRoles, normalizePlatformRoles, setActivePlatformRole, type CanonicalPlatformRole } from '../lib/session';
import { logoutOmniaSession } from '../lib/authApi';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

const BLUE = '#002050';

const ROLE_LABELS: Partial<Record<CanonicalPlatformRole, string>> = {
  moderateur: 'Modérateur',
  structure: 'Structure',
  gestionnaire_structure: 'Gestionnaire Structure',
  recruteur_structure: 'Recruteur Structure',
  organisateur: 'Organisateur',
  recruteur: 'Recruteur',
  professeur: 'Professeur',
  coach: 'Coach',
  apprenant: 'Apprenant',
};

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

type MenuPosition = { top: number; right: number };

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.name || user?.email || 'Omnia';
  return source.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export default function UserAccountMenu({ dashboardPath, buttonClassName = '' }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 64, right: 16 });
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

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        top: Math.min(window.innerHeight - 12, rect.bottom + 8),
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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
  const switchableRoles = canonicalRoles.filter(role => role !== 'super_admin');
  const activeRole = getActivePlatformRole(user.roles || []) || switchableRoles[0] || null;
  const target = !isAdministration && activeRole ? `/home?role=${encodeURIComponent(activeRole)}` : (dashboardPath || getDashboardPathForRoles(user.roles || []));

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  function switchRole(role: CanonicalPlatformRole) {
    setActivePlatformRole(role);
    setOpen(false);
    navigate(`/home?role=${encodeURIComponent(role)}`);
  }

  async function logout() {
    setOpen(false);
    await logoutOmniaSession();
    navigate('/connexion', { replace: true });
  }

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="fixed z-[500] w-64 overflow-visible rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_24px_70px_rgba(0,32,80,.24)]"
        style={{ top: menuPosition.top, right: menuPosition.right }}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => go(isAdministration ? target : '/home')}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Home size={17} /> {isAdministration ? t('Accueil') : t('Accueil Omnia')}
        </button>
        {!isAdministration && switchableRoles.length > 1 && (
          <>
            <div className="my-1 border-t border-slate-100" />
            <div className="px-4 pb-1 pt-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {t('Mes espaces')}
            </div>
            {switchableRoles.map(role => (
              <button
                key={role}
                type="button"
                role="menuitem"
                onClick={() => switchRole(role)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Layers3 size={16} className="text-slate-500" />
                <span className="flex-1">{t(ROLE_LABELS[role] || role)}</span>
                {role === activeRole && <Check size={15} className="text-[#BF8813]" />}
              </button>
            ))}
          </>
        )}
        {!isAdministration && (
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/inscription?mode=add-role')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={17} /> {t('Ajouter un espace')}
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => go('/mon-profil')}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isAdministration ? <Settings size={17} /> : <UserRound size={17} />}
          {isAdministration ? t('Mon compte') : t('Mon profil')}
        </button>
        <div className="my-1 border-t border-slate-100" />
        <div className="flex items-center gap-3 px-4 py-2" role="none">
          <Languages size={17} className="text-slate-500" />
          <span className="flex-1 text-sm font-semibold text-slate-700">{t('Langue de la plateforme')}</span>
          <LanguageSwitcher compact />
        </div>
        <div className="my-1 border-t border-slate-100" />
        <button
          type="button"
          role="menuitem"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          <LogOut size={17} /> {t('Se déconnecter')}
        </button>
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={rootRef} className="relative" data-no-auto-translate="true">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] ${buttonClassName}`}
        aria-label={t('Ouvrir le menu du compte')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar_url
          ? <img src={user.avatar_url} alt={t('Photo du compte')} className="h-8 w-8 rounded-full object-cover" />
          : <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}
