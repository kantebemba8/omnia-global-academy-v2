import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings, UserRound, X } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth, type AuthUser } from '../hooks/useAuth';
import { getDashboardPathForRoles, normalizePlatformRoles } from '../lib/session';
import {
  createDefaultLandingPage,
  type LandingLinkItem,
  type LandingNavigationConfig,
} from '../types/landingCms';

interface NavbarProps {
  transparent?: boolean;
  navigation?: LandingNavigationConfig;
}

type MenuKey = 'explore' | 'professionals';

function safeInternalHref(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/accueil';
}

function visibleLinks(items: LandingLinkItem[]) {
  return items
    .filter(item => item.enabled !== false && item.label.trim() && item.href.trim().startsWith('/') && !item.href.trim().startsWith('//'))
    .sort((a, b) => a.order - b.order);
}

function userInitials(user: AuthUser) {
  const source = user.full_name || user.email || 'Omnia';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function profilePathForUser(user: AuthUser) {
  const roles = normalizePlatformRoles(user.roles);
  if (roles.includes('super_admin')) return '/mon-profil';
  if (roles.includes('structure')) return '/mon-profil';
  if (roles.includes('recruteur_structure') || roles.includes('recruteur')) return '/mon-profil';
  if (roles.includes('professeur')) return '/mon-profil';
  return '/mon-profil';
}

function settingsPathForUser(user: AuthUser) {
  const roles = normalizePlatformRoles(user.roles);
  if (roles.includes('super_admin')) return '/mon-profil';
  if (roles.includes('structure')) return '/mon-profil';
  if (roles.includes('recruteur_structure')) return '/mon-profil?tab=notifications';
  if (roles.includes('recruteur')) return '/talent/recruteur/parametres';
  if (roles.includes('organisateur')) return '/omnia-live/organisateur/parametres';
  if (roles.includes('professeur')) return '/mon-profil';
  if (roles.includes('moderateur')) return '/moderateur/dashboard';
  return '/mon-profil?tab=visibilite';
}

function UserAvatar({ user, size = 'md' }: { user: AuthUser; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={`Photo de profil de ${user.full_name || 'l’utilisateur'}`} className={`${sizeClass} rounded-full border border-slate-200 object-cover`} />;
  }
  return (
    <span className={`flex ${sizeClass} items-center justify-center rounded-full bg-[#002050] text-xs font-bold text-white`} aria-hidden="true">
      {userInitials(user)}
    </span>
  );
}

export function Navbar({ transparent = false, navigation }: NavbarProps) {
  const fallback = useMemo(() => createDefaultLandingPage().navigation, []);
  const config = navigation || fallback;
  const directLinks = useMemo(() => visibleLinks(config.direct_links || fallback.direct_links), [config.direct_links, fallback.direct_links]);
  const exploreLinks = useMemo(() => visibleLinks(config.explore_links || fallback.explore_links), [config.explore_links, fallback.explore_links]);
  const professionalLinks = useMemo(() => visibleLinks(config.professional_links || fallback.professional_links), [config.professional_links, fallback.professional_links]);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);

  const dashboardPath = user ? getDashboardPathForRoles(user.roles) : '/accueil';
  const profilePath = user ? profilePathForUser(user) : '/connexion';
  const settingsPath = user ? settingsPathForUser(user) : '/connexion';
  const isAdministration = user ? normalizePlatformRoles(user.roles).includes('super_admin') : false;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
    setProfileOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
        setProfileOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusableElements = (): HTMLElement[] => Array.from<HTMLElement>(
      mobilePanelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') || [],
    ).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => getFocusableElements()[0]?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      (previousActiveElement || mobileTriggerRef.current)?.focus();
    };
  }, [mobileOpen]);

  async function handleLogout() {
    setProfileOpen(false);
    setMobileOpen(false);
    await logout();
    navigate('/accueil', { replace: true });
  }

  const isScrolledOrSolid = !transparent || scrolled || openMenu !== null || profileOpen;

  const dropdown = (key: MenuKey, label: string, items: LandingLinkItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="relative">
        <button type="button" onClick={() => setOpenMenu(current => current === key ? null : key)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]" id={`omnia-menu-trigger-${key}`} aria-expanded={openMenu === key} aria-controls={`omnia-menu-${key}`}>
          {label}<ChevronDown className={`h-4 w-4 transition-transform ${openMenu === key ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {openMenu === key && (
          <div id={`omnia-menu-${key}`} aria-labelledby={`omnia-menu-trigger-${key}`} className="absolute left-1/2 top-[calc(100%+18px)] w-[420px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
            <div className="grid gap-1">
              {items.map(item => <Link key={item.id} to={safeInternalHref(item.href)} className="rounded-xl px-4 py-3 transition-colors hover:bg-slate-50"><span className="block text-sm font-semibold text-[#002050]">{item.label}</span>{item.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>}</Link>)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const authenticatedActions = user && (
    <div className="relative">
      <button type="button" onClick={() => setProfileOpen(value => !value)} className="flex items-center gap-1 rounded-xl p-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]" aria-label="Ouvrir le menu du profil" aria-expanded={profileOpen}>
        <UserAvatar user={user} />
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
      </button>
      {profileOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-[#002050]">{user.full_name || 'Utilisateur Omnia'}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button type="button" onClick={() => navigate(dashboardPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><LayoutDashboard size={17} /> Retour au Dashboard</button>
          <button type="button" onClick={() => navigate(profilePath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserRound size={17} /> {isAdministration ? 'Mon compte' : 'Mon profil'}</button>
          <button type="button" onClick={() => navigate(settingsPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Settings size={17} /> Paramètres</button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} /> Se déconnecter</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <nav ref={navRef} aria-label="Navigation principale" className="fixed left-0 right-0 top-0 z-50 transition-all duration-200" style={{ backgroundColor: isScrolledOrSolid ? '#FFFFFF' : 'transparent', borderBottom: isScrolledOrSolid ? '1px solid #E4E7EC' : 'none', boxShadow: scrolled ? '0 2px 14px rgba(15,23,42,0.08)' : 'none' }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link to="/accueil" className="flex flex-shrink-0 items-center gap-2.5" aria-label="Accueil Omnia Global Academy"><img src="/IMG_0349.png" alt="" className="h-9 w-auto object-contain" /><div><div className="text-[15px] font-bold leading-none tracking-[0.09em] text-[#002050]">OMNIA</div><div className="mt-0.5 text-[8px] font-semibold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div></div></Link>
          <div className="hidden items-center gap-7 lg:flex">
            {directLinks.slice(0, 1).map(item => <Link key={item.id} to={safeInternalHref(item.href)} className="text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]">{item.label}</Link>)}
            {dropdown('explore', config.explore_label || fallback.explore_label, exploreLinks)}
            {dropdown('professionals', config.professionals_label || fallback.professionals_label, professionalLinks)}
            {directLinks.slice(1).map(item => <Link key={item.id} to={safeInternalHref(item.href)} className="text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]">{item.label}</Link>)}
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher compact />
            {!authLoading && (user ? authenticatedActions : <>
              <button type="button" onClick={() => navigate('/connexion')} className="rounded-xl border border-[#002050] px-4 py-2 text-sm font-semibold text-[#002050] transition-colors hover:bg-slate-50">{config.login_label || fallback.login_label}</button>
              <button type="button" onClick={() => navigate('/inscription')} className="rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#00183E]">{config.register_label || fallback.register_label}</button>
            </>)}
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher compact />
            {user && authenticatedActions}
            <button ref={mobileTriggerRef} type="button" className="min-h-11 min-w-11 rounded-lg p-2 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen} aria-controls="omnia-mobile-navigation">{mobileOpen ? <X size={22} color="#002050" /> : <Menu size={22} color="#002050" />}</button>
          </div>
        </div>
      </nav>
      {mobileOpen && <><button type="button" className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu de navigation" /><aside ref={mobilePanelRef} id="omnia-mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation mobile" className="fixed right-0 top-0 z-50 flex h-full w-[min(92vw,360px)] flex-col bg-white shadow-2xl lg:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><Link to="/accueil" onClick={() => setMobileOpen(false)} className="flex items-center gap-2" aria-label="Accueil Omnia Global Academy"><img src="/IMG_0349.png" alt="" className="h-8 w-auto object-contain" /><div><div className="text-[13px] font-bold leading-none tracking-[0.09em] text-[#002050]">OMNIA</div><div className="mt-0.5 text-[7px] font-semibold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div></div></Link><button type="button" onClick={() => setMobileOpen(false)} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]" aria-label="Fermer le menu"><X size={20} color="#64748B" /></button></div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-1">{directLinks.map(item => <Link key={item.id} to={safeInternalHref(item.href)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50">{item.label}</Link>)}</div>
          {exploreLinks.length > 0 && <div className="mt-6 border-t border-slate-100 pt-5"><p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A6A08]">{config.explore_label || fallback.explore_label}</p><div className="mt-2 space-y-1">{exploreLinks.map(item => <Link key={item.id} to={safeInternalHref(item.href)} className="block rounded-lg px-3 py-2.5 hover:bg-slate-50"><span className="block text-sm font-semibold text-[#002050]">{item.label}</span>{item.description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>}</Link>)}</div></div>}
          {professionalLinks.length > 0 && <div className="mt-6 border-t border-slate-100 pt-5"><p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A6A08]">{config.professionals_label || fallback.professionals_label}</p><div className="mt-2 space-y-1">{professionalLinks.map(item => <Link key={item.id} to={safeInternalHref(item.href)} className="block rounded-lg px-3 py-2.5 hover:bg-slate-50"><span className="block text-sm font-semibold text-[#002050]">{item.label}</span>{item.description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>}</Link>)}</div></div>}
        </div>
        <div className="space-y-2 border-t border-slate-100 px-5 pb-7 pt-5">
          {user ? <>
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><UserAvatar user={user} /><div className="min-w-0"><p className="truncate text-sm font-bold text-[#002050]">{user.full_name || 'Utilisateur Omnia'}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div></div>
            <button type="button" onClick={() => navigate(dashboardPath)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50"><LayoutDashboard size={17} /> Retour au Dashboard</button>
            <button type="button" onClick={() => navigate(profilePath)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50"><UserRound size={17} /> {isAdministration ? 'Mon compte' : 'Mon profil'}</button>
            <button type="button" onClick={() => navigate(settingsPath)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50"><Settings size={17} /> Paramètres</button>
            <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} /> Se déconnecter</button>
          </> : !authLoading ? <>
            <button type="button" onClick={() => navigate('/connexion')} className="w-full rounded-xl border border-[#002050] py-3 text-sm font-semibold text-[#002050]">{config.login_label || fallback.login_label}</button>
            <button type="button" onClick={() => navigate('/inscription')} className="w-full rounded-xl bg-[#002050] py-3 text-sm font-semibold text-white">{config.register_label || fallback.register_label}</button>
          </> : null}
        </div>
      </aside></>}
    </>
  );
}
