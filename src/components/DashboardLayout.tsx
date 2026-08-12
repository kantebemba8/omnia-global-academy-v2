import { getSessionToken } from '../lib/session';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';
import { DashboardTopbar } from './DashboardTopbar';
import OmniaBrandLockup from './OmniaBrandLockup';
import { ADMIN_NAV_GROUPS, adminGroupHubPath, adminEcosystemGroupHubPath, adminNavItemMatchesPath, findAdminEcosystem, findAdminEcosystemItem } from '../lib/adminNavigation';
import { PreviewReturnBar } from './PreviewReturnButton';
import { getRoleTheme, type RoleThemeKey } from '../lib/roleTheme';
import {
  LayoutDashboard, BookOpen, Award, FileText, Users,
  ChevronRight, ChevronDown, Sparkles, Wallet, BarChart2, MessageSquare, PlusCircle,
  Building2, Briefcase, CreditCard, Gift, Search, ExternalLink,
  UserRoundCheck, BadgeCheck, FileCheck2, ClipboardCheck, FolderKanban, Route, X,
} from 'lucide-react';

export interface NavItem { path: string; label: string; icon: React.ElementType; exact?: boolean; badge?: string }
export interface NavGroup { id: string; label: string; icon: React.ElementType; items: NavItem[] }

function navigationItemMatchesPath(item: NavItem, pathname: string) {
  const itemPath = item.path.split('?', 1)[0];
  if (item.exact) return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

interface Props {
  children: ReactNode;
  role?: 'apprenant' | 'professeur' | 'directeur' | 'moderateur' | 'super_admin' | 'recruteur' | 'coach' | 'organisateur';
  navItems?: NavItem[];
  navGroups?: NavGroup[];
  headerTitle?: string;
  headerSubtitle?: string;
  headerActions?: ReactNode;
  headerSearch?: ReactNode;
  dashboardPath?: string;
  spaceHomePath?: string;
  spaceHomeLabel?: string;
  brandTitle?: string;
  brandAccent?: string;
  contentClassName?: string;
  ecosystemMode?: boolean;
  roleThemeKey?: RoleThemeKey;
}

const APPRENANT_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'learner-formations', label: 'Formations', icon: BookOpen,
    items: [{ path: '/formations', label: 'Formations', icon: BookOpen }],
  },
  {
    id: 'learner-credentials', label: 'Parcours & employabilité', icon: BadgeCheck,
    items: [
      { path: '/dashboard/project-portfolio', label: 'Portfolio de projets', icon: Briefcase },
      { path: '/dashboard/professional-pathways', label: 'Parcours professionnels', icon: Route },
      { path: '/dashboard/employabilite', label: 'Employabilité', icon: UserRoundCheck },
    ],
  },
  {
    id: 'learner-career', label: 'Carrière & réseau', icon: Briefcase,
    items: [
      { path: '/omnia-career', label: 'Omnia Career', icon: FileText },
      { path: '/projects/mes-projets', label: 'Omnia Projects', icon: FolderKanban },
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/coaching', label: 'Omnia Coaching', icon: UserRoundCheck },
      { path: '/forum', label: 'Omnia Communauté', icon: MessageSquare },
    ],
  },
  {
    id: 'learner-benefits', label: 'Avantages & organisation', icon: CreditCard,
    items: [
      { path: '/dashboard/abonnements', label: 'Abonnements & avantages', icon: CreditCard },
      { path: '/dashboard/structure', label: 'Ma Structure', icon: Building2 },
      { path: '/dashboard/parrainage', label: 'Parrainage & gains', icon: Gift },
    ],
  },
];

const PROFESSEUR_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/professeur/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'professor-formations', label: 'Formations', icon: BookOpen,
    items: [{ path: '/formations', label: 'Formations', icon: BookOpen }],
  },
  {
    id: 'professor-performance', label: 'Projets', icon: FolderKanban,
    items: [{ path: '/professeur/projects', label: 'Omnia Projects', icon: FolderKanban }],
  },
  {
    id: 'professor-revenue', label: 'Revenus', icon: Wallet,
    items: [{ path: '/professeur/payouts', label: 'Mon portefeuille', icon: Wallet }],
  },
  {
    id: 'professor-network', label: 'Réseau & communauté', icon: Users,
    items: [
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/forum', label: 'Omnia Communauté', icon: MessageSquare },
    ],
  },
];

function roleLabel(role: Props['role']) {
  if (role === 'super_admin') return 'Administration';
  if (role === 'directeur') return 'Espace Structure';
  if (role === 'professeur') return 'Espace Professeur';
  if (role === 'moderateur') return 'Espace Modération';
  if (role === 'recruteur') return 'Espace Recruteur';
  if (role === 'coach') return 'Espace Coach';
  if (role === 'organisateur') return 'Espace Organisateur';
  return 'Espace Apprenant';
}

function themeKeyForRole(role: Props['role']): RoleThemeKey {
  if (role === 'directeur') return 'structure';
  if (role === 'professeur') return 'professeur';
  if (role === 'moderateur') return 'moderateur';
  if (role === 'recruteur') return 'recruteur';
  if (role === 'coach') return 'coach';
  if (role === 'organisateur') return 'organisateur';
  return 'apprenant';
}

export function DashboardLayout({
  children,
  role = 'apprenant',
  navItems,
  navGroups,
  headerTitle,
  headerSubtitle,
  headerActions,
  headerSearch,
  dashboardPath,
  spaceHomePath,
  spaceHomeLabel = 'Retour à Omnia Global Academy',
  brandTitle = 'Omnia',
  brandAccent = 'Global Academy',
  contentClassName = '',
  ecosystemMode = false,
  roleThemeKey,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<Record<string, boolean>>({});
  const [referralEnabled, setReferralEnabled] = useState(false);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavigationOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavigationOpen]);

  useEffect(() => {
    setMobileNavigationOpen(false);
    setOpenDesktopGroup(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (role !== 'apprenant') {
      setReferralEnabled(false);
      return;
    }
    let active = true;
    getPublicSiteSettings()
      .then(settings => {
        if (active) setReferralEnabled(settings.referral_enabled === true || settings.referral_enabled === 'true');
      })
      .catch(() => {
        if (active) setReferralEnabled(false);
      });
    return () => { active = false; };
  }, [role]);

  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; }
    catch { return false; }
  })();
  const previewRole = role === 'directeur' ? 'structure' : role;
  const storedPreviewRole = typeof window !== 'undefined' ? sessionStorage.getItem('omnia_admin_role_preview') : null;
  const previewMode = isSuperAdmin && (isPreview || storedPreviewRole === previewRole);

  const buildPath = (path: string) => {
    if (!previewMode) return path;
    const [withoutHash, hash = ''] = path.split('#', 2);
    const [pathname, query = ''] = withoutHash.split('?', 2);
    const params = new URLSearchParams(query);
    params.set('preview', 'true');
    return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
  };

  useEffect(() => {
    const token = getSessionToken();
    const stored = localStorage.getItem('omnia_user');
    if (previewMode && stored) {
      try {
        const user = JSON.parse(stored);
        if (user?.roles?.includes('super_admin')) return;
      } catch {
        // La vérification normale de session s'applique.
      }
    }
    if (!token) navigate('/connexion');
  }, [navigate, previewMode]);

  const NAV_ITEMS = useMemo(() => {
    const source = navItems ?? [];
    return role === 'apprenant' && !referralEnabled
      ? source.filter(item => item.path !== '/dashboard/parrainage')
      : source;
  }, [navItems, referralEnabled, role]);

  const ACTIVE_NAV_GROUPS = useMemo(() => {
    const source = navGroups ?? (
      role === 'professeur' ? PROFESSEUR_GROUPS
        : role === 'apprenant' ? APPRENANT_GROUPS
          : role === 'super_admin' ? ADMIN_NAV_GROUPS
            : undefined
    );
    if (!source) return undefined;
    return source
      .map(group => ({
        ...group,
        items: role === 'apprenant' && !referralEnabled
          ? group.items.filter(item => item.path !== '/dashboard/parrainage')
          : group.items,
      }))
      .filter(group => group.items.length > 0);
  }, [navGroups, referralEnabled, role]);

  const allNavigationItems = useMemo(
    () => ACTIVE_NAV_GROUPS?.flatMap(group => group.items) ?? NAV_ITEMS,
    [ACTIVE_NAV_GROUPS, NAV_ITEMS],
  );

  const activeAdminEcosystem = role === 'super_admin' ? findAdminEcosystem(location.pathname) : null;
  const activeAdminEcosystemItem = role === 'super_admin' ? findAdminEcosystemItem(location.pathname) : null;

  const activeNavigation = useMemo(() => {
    const main = allNavigationItems
      .filter(item => role === 'super_admin' ? adminNavItemMatchesPath(item, location.pathname) : navigationItemMatchesPath(item, location.pathname))
      .sort((a, b) => b.path.length - a.path.length)[0];
    return activeAdminEcosystemItem || main;
  }, [allNavigationItems, location.pathname, role, activeAdminEcosystemItem]);

  const activeGroup = useMemo(() => {
    if (role === 'super_admin') {
      if (activeAdminEcosystem || location.pathname === '/admin/ecosystemes') return ACTIVE_NAV_GROUPS?.find(group => group.id === 'ecosystems');
      if (location.pathname.startsWith('/admin/section/utilisateurs-acces')) return ACTIVE_NAV_GROUPS?.find(group => group.id === 'users-access');
      if (location.pathname.startsWith('/admin/section/commerce-finance')) return ACTIVE_NAV_GROUPS?.find(group => group.id === 'commerce-finance');
      if (location.pathname.startsWith('/admin/section/plateforme-gouvernance')) return ACTIVE_NAV_GROUPS?.find(group => group.id === 'platform-governance');
    }
    return ACTIVE_NAV_GROUPS?.find(group => group.items.some(item => role === 'super_admin' ? adminNavItemMatchesPath(item, location.pathname) : navigationItemMatchesPath(item, location.pathname)));
  }, [ACTIVE_NAV_GROUPS, location.pathname, role, activeAdminEcosystem]);

  useEffect(() => {
    if (activeGroup) setExpandedMobileGroups({ [activeGroup.id]: true });
  }, [activeGroup?.id]);

  const isActive = (item: NavItem) => role === 'super_admin' ? adminNavItemMatchesPath(item, location.pathname) : activeNavigation?.path === item.path;
  const roleSubtitle = roleLabel(role);
  const contextualTitle = headerTitle
    || (location.pathname === '/mon-profil' ? (role === 'super_admin' ? 'Mon compte' : 'Mon profil') : activeNavigation?.label)
    || roleSubtitle;

  const adminMode = role === 'super_admin';
  const roleTheme = getRoleTheme(roleThemeKey || themeKeyForRole(role));
  const roleAccent = roleTheme.accent;
  const roleSoft = roleTheme.soft;
  const roleSecondary = roleTheme.secondary;
  const hasNavigation = Boolean((ACTIVE_NAV_GROUPS && ACTIVE_NAV_GROUPS.length > 0) || NAV_ITEMS.length > 0 || spaceHomePath);
  const roleStyle = {
    '--oga-role-accent': roleAccent,
    '--oga-role-soft': roleSoft,
    '--oga-role-secondary': roleSecondary,
  } as React.CSSProperties;

  const navigationContents = (mobile = false) => (
    <>
      {ACTIVE_NAV_GROUPS?.length ? (
        <div className={mobile ? 'space-y-1' : 'flex items-center gap-1'}>
          {ACTIVE_NAV_GROUPS.map(group => {
            const GroupIcon = group.icon;
            const containsActive = group.items.some(item => isActive(item));
            const isDashboardGroup = group.id === 'dashboard' && group.items.length === 1;
            const directItem = group.items[0];

            if (!mobile && isDashboardGroup) {
              return (
                <Link
                  key={group.id}
                  to={buildPath(directItem.path)}
                  className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${containsActive ? 'text-[#002050]' : 'border-transparent text-slate-600 hover:text-[#002050]'}`}
                  style={{ borderColor: containsActive ? roleAccent : 'transparent' }}
                >
                  <GroupIcon size={16} />
                  {group.label}
                </Link>
              );
            }

            if (!mobile) {
              const open = openDesktopGroup === group.id;
              return (
                <div key={group.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDesktopGroup(current => current === group.id ? null : group.id)}
                    className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${containsActive || open ? 'text-[#002050]' : 'border-transparent text-slate-600 hover:text-[#002050]'}`}
                    style={{ borderColor: containsActive || open ? roleAccent : 'transparent' }}
                    aria-expanded={open}
                  >
                    <GroupIcon size={16} />
                    <span>{group.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <>
                      <button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpenDesktopGroup(null)} aria-label="Fermer le menu" />
                      <div className="absolute left-0 top-[calc(100%+8px)] z-40 min-w-[270px] border border-slate-200 bg-white py-2 shadow-xl">
                        {group.items.map(item => {
                          const ItemIcon = item.icon;
                          const active = isActive(item);
                          return (
                            <Link
                              key={item.path}
                              to={buildPath(item.path)}
                              onClick={() => setOpenDesktopGroup(null)}
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${active ? 'font-bold text-[#002050]' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-[#002050]'}`}
                              style={active ? { backgroundColor: roleSoft } : undefined}
                            >
                              <ItemIcon size={16} style={{ color: active ? roleAccent : '#64748B' }} />
                              <span className="flex-1">{item.label}</span>
                              {item.badge && <span className="text-xs font-bold" style={{ color: roleAccent }}>{item.badge}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            }

            const open = expandedMobileGroups[group.id] ?? containsActive;
            return (
              <div key={group.id} className="border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setExpandedMobileGroups(current => ({ ...current, [group.id]: !open }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-white/80"
                  aria-expanded={open}
                >
                  <GroupIcon size={17} style={{ color: containsActive ? roleSoft : 'rgba(255,255,255,.65)' }} />
                  <span className="flex-1">{group.label}</span>
                  <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="pb-2">
                    {group.items.map(item => {
                      const ItemIcon = item.icon;
                      const active = isActive(item);
                      return (
                        <Link
                          key={item.path}
                          to={buildPath(item.path)}
                          onClick={() => setMobileNavigationOpen(false)}
                          className={`flex items-center gap-3 border-l-2 px-6 py-2.5 text-[13px] ${active ? 'font-bold text-white' : 'border-transparent font-medium text-white/65'}`}
                          style={active ? { borderColor: roleAccent, backgroundColor: 'rgba(255,255,255,.08)' } : undefined}
                        >
                          <ItemIcon size={15} />
                          <span className="flex-1">{item.label}</span>
                          {active && <ChevronRight size={13} />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={mobile ? 'space-y-1' : 'flex items-center gap-1'}>
          {NAV_ITEMS.map(item => {
            const ItemIcon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={buildPath(item.path)}
                onClick={() => mobile && setMobileNavigationOpen(false)}
                className={mobile
                  ? `flex items-center gap-3 border-l-2 px-5 py-3 text-sm ${active ? 'font-bold text-white' : 'border-transparent font-medium text-white/70'}`
                  : `inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${active ? 'text-[#002050]' : 'border-transparent text-slate-600 hover:text-[#002050]'}`
                }
                style={mobile
                  ? (active ? { borderColor: roleAccent, backgroundColor: 'rgba(255,255,255,.08)' } : undefined)
                  : { borderColor: active ? roleAccent : 'transparent' }
                }
              >
                <ItemIcon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );

  const adminSidebar = (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-[#002050]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <OmniaBrandLockup href="/admin/dashboard" inverse compact className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => setMobileNavigationOpen(false)}
            className="p-2 text-white/75 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fermer la navigation"
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#BF8813]">{brandTitle}</p>
          <p className="mt-1 text-sm font-semibold text-white/75">{brandAccent === 'Global Academy' ? roleSubtitle : brandAccent}</p>
        </div>
      </div>
      <nav className="oga-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
        {navigationContents(true)}
        {adminMode && activeAdminEcosystem && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: activeAdminEcosystem.accent }}>Omnia {activeAdminEcosystem.label}</p>
            {activeAdminEcosystem.groups.map(group => (
              <div key={group.id} className="border-b border-white/10">
                <p className="px-4 py-2 text-xs font-bold text-white/60">{group.label}</p>
                {group.items.map(item => {
                  const ItemIcon = item.icon;
                  const active = adminNavItemMatchesPath(item, location.pathname);
                  return (
                    <Link
                      key={item.path}
                      to={buildPath(item.path)}
                      onClick={() => setMobileNavigationOpen(false)}
                      className={`flex items-center gap-3 border-l-2 px-6 py-2.5 text-[13px] ${active ? 'font-bold text-white' : 'border-transparent font-medium text-white/65'}`}
                      style={active ? { borderColor: activeAdminEcosystem.accent, backgroundColor: 'rgba(255,255,255,.08)' } : undefined}
                    >
                      <ItemIcon size={15} style={{ color: active ? activeAdminEcosystem.accent : undefined }} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </nav>
      {spaceHomePath && (
        <div className="border-t border-white/10 p-3">
          <Link
            to={buildPath(spaceHomePath)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold" style={{ color: roleSoft }}
          >
            <ExternalLink size={16} />
            {spaceHomeLabel}
          </Link>
        </div>
      )}
    </aside>
  );

  const mobileDrawer = (
    mobileNavigationOpen && (
      <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation de l’espace">
        <button type="button" className="fixed inset-0 bg-black/50" onClick={() => setMobileNavigationOpen(false)} aria-label="Fermer la navigation" />
        <aside className="relative z-10 flex h-[100dvh] w-[min(88vw,320px)] flex-col shadow-2xl" style={{ backgroundColor: roleSecondary }}>
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <OmniaBrandLockup href="/home" inverse compact className="min-w-0 flex-1" />
            <button type="button" onClick={() => setMobileNavigationOpen(false)} className="p-2 text-white/75" aria-label="Fermer la navigation"><X size={19} /></button>
          </div>
          <div className="border-b border-white/10 px-5 py-3">
            <p className="text-sm font-semibold text-white">{contextualTitle}</p>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto py-2">{navigationContents(true)}</nav>
          {spaceHomePath && (
            <div className="border-t border-white/10 p-3">
              <Link to={buildPath(spaceHomePath)} onClick={() => setMobileNavigationOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold" style={{ color: roleSoft }}>
                <ExternalLink size={16} />
                {spaceHomeLabel}
              </Link>
            </div>
          )}
        </aside>
      </div>
    )
  );

  if (ecosystemMode && !adminMode) {
    return (
      <div className="h-[100dvh] min-h-0 overflow-hidden bg-white">
        {children}
      </div>
    );
  }

  if (adminMode) {
    const adminAccent = activeAdminEcosystem?.accent || '#BF8813';
    const adminSoft = activeAdminEcosystem?.soft || '#F6F8FC';
    return (
      <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#EEF3F8]">
        <DashboardTopbar
          title="Omnia Administration"
          subtitle={activeAdminEcosystem ? `Omnia ${activeAdminEcosystem.label} · ${contextualTitle}` : contextualTitle}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
          navigationOpen={mobileNavigationOpen}
          actions={headerActions}
          search={headerSearch}
          dashboardPath={dashboardPath}
          showBrand
          brandHref="/admin/dashboard"
          accentColor={adminAccent}
        />

        <div className="relative z-40 flex-shrink-0 border-b border-slate-200 bg-white" onMouseLeave={() => setOpenDesktopGroup(null)}>
          <div className="mx-auto max-w-[1600px] px-4 md:px-6">
            <nav className="flex min-w-max items-center" aria-label="Navigation principale Super-admin">
              {ACTIVE_NAV_GROUPS?.map((group, groupIndex) => {
                const GroupIcon = group.icon;
                const containsActive = activeGroup?.id === group.id;
                const destination = buildPath(adminGroupHubPath(group.id));
                const hasPreview = group.id !== 'dashboard' && group.items.length > 0;
                const open = openDesktopGroup === group.id;
                return (
                  <div key={group.id} className="relative" onMouseEnter={() => hasPreview && setOpenDesktopGroup(group.id)} onFocus={() => hasPreview && setOpenDesktopGroup(group.id)}>
                    <Link
                      to={destination}
                      className={`group relative inline-flex min-h-14 items-center gap-2.5 px-3.5 text-[13px] font-bold transition md:px-4 ${containsActive || open ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
                    >
                      <GroupIcon size={17} style={{ color: containsActive || open ? adminAccent : '#64748B' }} />
                      <span>{group.label}</span>
                      {hasPreview && <ChevronDown size={13} style={{ color: containsActive || open ? adminAccent : '#94A3B8' }} />}
                      <span className="absolute inset-x-3 bottom-0 h-[2px] transition" style={{ background: containsActive || open ? adminAccent : 'transparent' }} />
                    </Link>
                    {hasPreview && open && (
                      <div className={`absolute top-full z-[100] w-[min(680px,calc(100vw-32px))] border border-slate-200 bg-white p-5 shadow-[0_26px_70px_rgba(0,32,80,.18)] ${groupIndex >= (ACTIVE_NAV_GROUPS?.length || 0) - 2 ? 'right-0' : 'left-0'}`}>
                        <div className="flex items-end justify-between gap-6 border-b border-slate-200 pb-4">
                          <div><p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: adminAccent }}>Omnia Administration</p><h3 className="mt-1 text-lg font-black text-[#002050]">{group.label}</h3></div>
                          <Link to={destination} onClick={() => setOpenDesktopGroup(null)} className="text-xs font-black" style={{ color: adminAccent }}>Ouvrir la page →</Link>
                        </div>
                        <div className="grid gap-x-8 gap-y-1 pt-3 sm:grid-cols-2">
                          {group.items.map(item => {
                            const ItemIcon = item.icon;
                            const ecosystemForItem = 'ecosystemId' in item && item.ecosystemId ? findAdminEcosystem(item.path) : null;
                            const itemAccent = ecosystemForItem?.accent || adminAccent;
                            return (
                              <Link key={item.path} to={buildPath(item.path)} onClick={() => setOpenDesktopGroup(null)} className="flex items-center gap-3 border-b border-slate-100 px-1 py-3 text-sm font-semibold text-slate-600 transition hover:text-[#002050]">
                                <ItemIcon size={16} style={{ color: itemAccent }} />
                                <span className="flex-1">{item.label}</span>
                                <ChevronRight size={13} style={{ color: itemAccent }} />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>



        {mobileNavigationOpen && (
          <div className="fixed inset-0 z-[120] flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation administration">
            <button type="button" className="fixed inset-0 bg-black/50" onClick={() => setMobileNavigationOpen(false)} aria-label="Fermer la navigation" />
            <aside className="relative z-10 flex h-[100dvh] w-[min(90vw,350px)] flex-col bg-[#002050] shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <OmniaBrandLockup href="/admin/dashboard" inverse compact className="min-w-0 flex-1" />
                <button type="button" onClick={() => setMobileNavigationOpen(false)} className="p-2 text-white/75" aria-label="Fermer"><X size={19} /></button>
              </div>
              <div className="border-b border-white/10 px-5 py-3"><p className="text-sm font-bold text-white">Omnia Administration</p><p className="mt-1 text-xs text-white/50">{contextualTitle}</p></div>
              <nav className="min-h-0 flex-1 overflow-y-auto py-2">
                {ACTIVE_NAV_GROUPS?.map(group => {
                  const GroupIcon = group.icon;
                  const containsActive = activeGroup?.id === group.id;
                  return (
                    <Link key={group.id} to={buildPath(adminGroupHubPath(group.id))} onClick={() => setMobileNavigationOpen(false)} className="flex items-center gap-3 border-l-2 px-5 py-3 text-sm font-semibold" style={{ borderColor: containsActive ? adminAccent : 'transparent', color: containsActive ? '#fff' : 'rgba(255,255,255,.72)', background: containsActive ? 'rgba(255,255,255,.08)' : 'transparent' }}>
                      <GroupIcon size={17} style={{ color: containsActive ? adminAccent : undefined }} /><span className="flex-1">{group.label}</span><ChevronRight size={13}/>
                    </Link>
                  );
                })}
                {activeAdminEcosystem && <div className="mx-4 my-3 border-t border-white/10" />}
                {activeAdminEcosystem?.groups.map(group => {
                  const MobileGroupIcon = group.icon;
                  return <Link key={group.id} to={buildPath(adminEcosystemGroupHubPath(activeAdminEcosystem.id, group.id))} onClick={() => setMobileNavigationOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-[13px] font-semibold text-white/70"><MobileGroupIcon size={15} style={{ color: activeAdminEcosystem.accent }} />{group.label}</Link>;
                })}
              </nav>
            </aside>
          </div>
        )}

        <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName}`} style={{ background: `radial-gradient(circle at 8% 0%, ${adminSoft} 0, transparent 30%), linear-gradient(180deg,#F4F7FB 0%,#EEF3F8 100%)` }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="oga-role-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden" data-role-theme={roleTheme.key} style={roleStyle}>
      <DashboardTopbar
        title={contextualTitle}
        subtitle={headerSubtitle}
        onOpenNavigation={hasNavigation ? () => setMobileNavigationOpen(true) : undefined}
        navigationOpen={mobileNavigationOpen}
        actions={headerActions}
        search={headerSearch}
        dashboardPath={dashboardPath}
        showBrand
        brandHref="/home"
        accentColor={roleAccent}
      />

      <PreviewReturnBar label={roleSubtitle} />

      {hasNavigation && <div className="relative z-20 hidden flex-shrink-0 border-b border-slate-200 bg-white lg:block">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-visible px-5">
          <nav className="min-w-0 flex-1" aria-label={`Navigation ${roleSubtitle}`}>
            {navigationContents(false)}
          </nav>
          {spaceHomePath && (
            <Link to={buildPath(spaceHomePath)} className="ml-auto inline-flex min-h-11 items-center gap-2 border-l border-slate-200 px-4 text-sm font-semibold text-[#002050] hover:bg-slate-50">
              <ExternalLink size={15} style={{ color: roleAccent }} />
              {spaceHomeLabel}
            </Link>
          )}
        </div>
      </div>}

      {mobileDrawer}

      <main className={`oga-role-content min-h-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
