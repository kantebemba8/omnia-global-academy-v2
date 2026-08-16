import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  HelpCircle,
  Home,
  LayoutDashboard,
  Languages,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react';
import OmniaBrandLockup from './OmniaBrandLockup';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth, type AuthUser } from '../hooks/useAuth';
import { getDashboardPathForRoles, normalizePlatformRoles } from '../lib/session';
import { createDefaultLandingPage, type LandingNavigationConfig } from '../types/landingCms';

type AudienceNavLink = { label: string; href: string };

interface NavbarProps {
  transparent?: boolean;
  navigation?: LandingNavigationConfig;
  showAudienceBar?: boolean;
  audienceLinks?: AudienceNavLink[];
}

type PrimaryNavItem = {
  label: string;
  href: string;
  activePrefixes: string[];
};

const PRIMARY_NAV: PrimaryNavItem[] = [
  { label: 'Formations', href: '/formations', activePrefixes: ['/formations', '/catalogue', '/cours/', '/formation-externe/'] },
  { label: 'Career', href: '/career-studio', activePrefixes: ['/career-studio', '/omnia-career', '/dashboard/career-studio', '/forum/emploi', '/forum/carriere'] },
  { label: 'Projects', href: '/projects', activePrefixes: ['/projects', '/professeur/projects', '/structure/projects'] },
  { label: 'Talent', href: '/talent', activePrefixes: ['/talent'] },
  { label: 'Live', href: '/omnia-live', activePrefixes: ['/omnia-live'] },
  { label: 'Communauté', href: '/forum', activePrefixes: ['/forum'] },
  { label: 'Coaching', href: '/coaching', activePrefixes: ['/coaching', '/coach/', '/dashboard/coaching'] },
];


function userInitials(user: AuthUser) {
  const source = user.full_name || user.email || 'Omnia';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function UserAvatar({ user, size = 'md' }: { user: AuthUser; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={`Photo de profil de ${user.full_name || 'l’utilisateur'}`}
        className={`${sizeClass} rounded-full border border-slate-200 object-cover`}
      />
    );
  }
  return (
    <span className={`flex ${sizeClass} items-center justify-center rounded-full bg-[#002050] text-xs font-bold text-white`} aria-hidden="true">
      {userInitials(user)}
    </span>
  );
}

export function Navbar({ transparent = false, navigation, showAudienceBar = false, audienceLinks }: NavbarProps) {
  const fallbackPage = useMemo(() => createDefaultLandingPage(), []);
  const fallback = fallbackPage.navigation;
  const config = navigation || fallback;
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const dashboardPath = user ? getDashboardPathForRoles(user.roles) : '/accueil';
  const profilePath = '/home?section=profil';
  const settingsPath = '/home?section=profil&tab=notifications';
  const isAdministration = user ? normalizePlatformRoles(user.roles).includes('super_admin') : false;
  const brandHomePath = user ? '/home' : '/accueil';
  const audienceNavLinks = audienceLinks && audienceLinks.length > 0
    ? audienceLinks
    : Object.values(fallbackPage.audience_pages).filter(page => page.enabled).map(page => ({ label: page.nav_label, href: page.route }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
        setMoreOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setMoreOpen(false);
        setMobileOpen(false);
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
      mobilePanelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])') || [],
    );
    const onKeyDown = (event: KeyboardEvent) => {
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

  const isActive = (item: PrimaryNavItem) => {
    if (item.href === '/forum' && (pathname.startsWith('/forum/emploi') || pathname.startsWith('/forum/carriere'))) return false;
    return item.activePrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = searchQuery.trim();
    navigate(value ? `/catalogue?q=${encodeURIComponent(value)}` : '/catalogue');
  };

  async function handleLogout() {
    setProfileOpen(false);
    setMobileOpen(false);
    await logout();
    navigate('/accueil', { replace: true });
  }

  const authenticatedActions = user && (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setProfileOpen(value => !value); setMoreOpen(false); }}
        className="flex items-center gap-1 rounded-xl p-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
        aria-label="Ouvrir le menu du profil"
        aria-expanded={profileOpen}
      >
        <UserAvatar user={user} />
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
      </button>
      {profileOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-72 overflow-visible rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-[#002050]">{user.full_name || 'Utilisateur Omnia'}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button type="button" onClick={() => navigate('/home')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Home size={17} /> Accueil Omnia</button>
          <button type="button" onClick={() => navigate(dashboardPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><LayoutDashboard size={17} /> Mon espace</button>
          <button type="button" onClick={() => navigate(profilePath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserRound size={17} /> {isAdministration ? 'Mon compte' : 'Mon profil'}</button>
          <button type="button" onClick={() => navigate(settingsPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Settings size={17} /> Paramètres</button>
          <div className="my-1 border-t border-slate-100" />
          <div className="flex items-center gap-3 px-4 py-2" role="none">
            <Languages size={17} className="text-slate-500" />
            <span className="flex-1 text-sm font-semibold text-slate-700">Langue de la plateforme</span>
            <LanguageSwitcher compact />
          </div>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} /> Se déconnecter</button>
        </div>
      )}
    </div>
  );

  const solid = !transparent || scrolled || profileOpen || moreOpen || mobileOpen;

  return (
    <>
      {showAudienceBar && (
        <div className="fixed left-0 right-0 top-0 z-40 h-9 border-b border-white/10 bg-[#002050] text-white">
          <nav aria-label="Accès par profil" className="mx-auto flex h-full max-w-[1440px] items-center justify-center gap-1 overflow-x-auto px-3 sm:gap-3 lg:gap-7">
            {audienceNavLinks.map(item => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} to={item.href} className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold transition sm:text-xs ${active ? 'text-[#F2C45D]' : 'text-white/80 hover:text-white'}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      <nav
        ref={navRef}
        aria-label="Navigation principale"
        className={`fixed left-0 right-0 z-50 transition-all duration-200 ${showAudienceBar ? 'top-9' : 'top-0'}`}
        style={{
          backgroundColor: solid ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.94)',
          borderBottom: '1px solid #E4E7EC',
          boxShadow: scrolled ? '0 2px 16px rgba(15,23,42,0.07)' : 'none',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-4 px-5 sm:px-6 lg:px-8">
          <OmniaBrandLockup href={brandHomePath} className="flex-shrink-0" showSlogan={false} />

          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 lg:flex lg:max-w-[330px] xl:max-w-[390px]">
            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition focus-within:border-[#BF8813] focus-within:ring-2 focus-within:ring-[#BF8813]/15">
              <Search size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Rechercher une formation, compétence ou métier</span>
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                type="search"
                placeholder="Rechercher une formation, compétence, métier..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
          </form>

          <div className="hidden flex-1 items-center justify-center gap-4 xl:flex 2xl:gap-5">
            {PRIMARY_NAV.map(item => (
              <Link
                key={item.href}
                to={item.href}
                aria-current={isActive(item) ? 'page' : undefined}
                className={`relative whitespace-nowrap py-7 text-sm font-semibold transition-colors ${isActive(item) ? 'text-[#002050]' : 'text-slate-600 hover:text-[#002050]'}`}
              >
                {item.label}
                {isActive(item) && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#BF8813]" />}
              </Link>
            ))}
          </div>

          <div className="ml-auto hidden flex-shrink-0 items-center gap-2 xl:flex">
            {!authLoading && (user ? authenticatedActions : (
              <>
                <button type="button" onClick={() => navigate('/connexion')} className="h-10 rounded-xl border border-[#CCD4E0] bg-white px-4 text-sm font-semibold text-[#002050] transition hover:border-[#002050] hover:bg-slate-50">{config.login_label || fallback.login_label}</button>
                <button type="button" onClick={() => navigate('/inscription')} className="h-10 rounded-xl bg-[#002050] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00183E]">{config.register_label || fallback.register_label}</button>
              </>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setMoreOpen(value => !value); setProfileOpen(false); }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#002050] transition hover:bg-slate-50"
                aria-label="Plus d’options"
                aria-expanded={moreOpen}
              >
                <Menu size={18} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
                  <Link to="/a-propos" className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><HelpCircle size={16} /> À propos</Link>
                  <Link to="/contact" className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserRound size={16} /> Contact</Link>
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 xl:hidden">
            {user && authenticatedActions}
            <button
              ref={mobileTriggerRef}
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
              onClick={() => setMobileOpen(value => !value)}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileOpen}
              aria-controls="omnia-mobile-navigation"
            >
              {mobileOpen ? <X size={21} color="#002050" /> : <Menu size={21} color="#002050" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40 xl:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu de navigation" />
          <aside ref={mobilePanelRef} id="omnia-mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation mobile" className="fixed right-0 top-0 z-50 flex h-full w-[min(92vw,390px)] flex-col bg-white shadow-2xl xl:hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <OmniaBrandLockup href={brandHomePath} compact showSlogan={false} />
              <button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100" aria-label="Fermer le menu"><X size={20} color="#64748B" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <form onSubmit={submitSearch} className="mb-5">
                <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3">
                  <Search size={17} className="text-slate-400" />
                  <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Rechercher..." />
                </label>
              </form>
              <nav className="space-y-1" aria-label="Navigation mobile principale">
                {PRIMARY_NAV.map(item => (
                  <Link key={item.href} to={item.href} aria-current={isActive(item) ? 'page' : undefined} className={`block rounded-xl px-3 py-3 text-sm font-semibold ${isActive(item) ? 'bg-[#FFF7E7] text-[#002050]' : 'text-slate-700 hover:bg-slate-50'}`}>{item.label}</Link>
                ))}
              </nav>
              <div className="mt-5 border-t border-slate-100 pt-5">
                <Link to="/a-propos" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">À propos</Link>
                <Link to="/contact" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Contact</Link>
              </div>
            </div>
            {!user && !authLoading && (
              <div className="space-y-2 border-t border-slate-100 px-5 pb-7 pt-5">
                <button type="button" onClick={() => navigate('/connexion')} className="w-full rounded-xl border border-[#002050] py-3 text-sm font-semibold text-[#002050]">{config.login_label || fallback.login_label}</button>
                <button type="button" onClick={() => navigate('/inscription')} className="w-full rounded-xl bg-[#002050] py-3 text-sm font-semibold text-white">{config.register_label || fallback.register_label}</button>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
