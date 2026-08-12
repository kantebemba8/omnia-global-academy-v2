import { getSessionToken } from '../lib/session';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';
import { DashboardTopbar } from './DashboardTopbar';
import OmniaBrandLockup from './OmniaBrandLockup';
import { ADMIN_NAV_GROUPS } from '../lib/adminNavigation';
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
      { path: '/dashboard/career-studio', label: 'Omnia Career Studio', icon: FileText },
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

  const activeNavigation = useMemo(() => {
    return allNavigationItems
      .filter(item => navigationItemMatchesPath(item, location.pathname))
      .sort((a, b) => b.path.length - a.path.length)[0];
  }, [allNavigationItems, location.pathname]);

  const activeGroup = useMemo(
    () => ACTIVE_NAV_GROUPS?.find(group => group.items.some(item => navigationItemMatchesPath(item, location.pathname))),
    [ACTIVE_NAV_GROUPS, location.pathname],
  );

  useEffect(() => {
    if (activeGroup) setExpandedMobileGroups({ [activeGroup.id]: true });
  }, [activeGroup?.id]);

  const isActive = (item: NavItem) => activeNavigation?.path === item.path;
  const roleSubtitle = roleLabel(role);
  const contextualTitle = headerTitle
    || (location.pathname === '/mon-profil' ? (role === 'super_admin' ? 'Mon compte' : 'Mon profil') : activeNavigation?.label)
    || roleSubtitle;

  const adminMode = role === 'super_admin';

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
                  className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${containsActive ? 'border-[#BF8813] text-[#002050]' : 'border-transparent text-slate-600 hover:text-[#002050]'}`}
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
                    className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${containsActive || open ? 'border-[#BF8813] text-[#002050]' : 'border-transparent text-slate-600 hover:text-[#002050]'}`}
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
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${active ? 'bg-slate-50 font-bold text-[#002050]' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-[#002050]'}`}
                            >
                              <ItemIcon size={16} style={{ color: active ? '#BF8813' : '#64748B' }} />
                              <span className="flex-1">{item.label}</span>
                              {item.badge && <span className="text-xs font-bold text-[#BF8813]">{item.badge}</span>}
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
                  <GroupIcon size={17} style={{ color: containsActive ? '#BF8813' : 'rgba(255,255,255,.65)' }} />
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
                          className={`flex items-center gap-3 px-6 py-2.5 text-[13px] ${active ? 'font-bold text-[#F4C45E]' : 'font-medium text-white/65'}`}
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
                  ? `flex items-center gap-3 px-5 py-3 text-sm ${active ? 'font-bold text-[#F4C45E]' : 'font-medium text-white/70'}`
                  : `inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${active ? 'border-[#BF8813] text-[#002050]' : 'border-transparent text-slate-600 hover:text-[#002050]'}`
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
          <OmniaBrandLockup href="/home" inverse compact className="min-w-0 flex-1" />
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
      </nav>
      {spaceHomePath && (
        <div className="border-t border-white/10 p-3">
          <Link
            to={buildPath(spaceHomePath)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-[#D8B35D]"
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
        <aside className="relative z-10 flex h-[100dvh] w-[min(88vw,320px)] flex-col bg-[#002050] shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <OmniaBrandLockup href="/home" inverse compact className="min-w-0 flex-1" />
            <button type="button" onClick={() => setMobileNavigationOpen(false)} className="p-2 text-white/75" aria-label="Fermer la navigation"><X size={19} /></button>
          </div>
          <div className="border-b border-white/10 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#BF8813]">{roleSubtitle}</p>
            <p className="mt-1 text-sm font-semibold text-white">{contextualTitle}</p>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto py-2">{navigationContents(true)}</nav>
          {spaceHomePath && (
            <div className="border-t border-white/10 p-3">
              <Link to={buildPath(spaceHomePath)} onClick={() => setMobileNavigationOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-[#D8B35D]">
                <ExternalLink size={16} />
                {spaceHomeLabel}
              </Link>
            </div>
          )}
        </aside>
      </div>
    )
  );

  if (adminMode) {
    return (
      <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F6F8FC]">
        <DashboardTopbar
          title={contextualTitle}
          subtitle={headerSubtitle || roleSubtitle}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
          navigationOpen={mobileNavigationOpen}
          actions={headerActions}
          search={headerSearch}
          dashboardPath={dashboardPath}
          showBrand
          brandHref="/home"
        />

        <div className="relative z-20 flex-shrink-0 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] items-center overflow-x-auto px-4 md:px-6">
            <nav className="flex min-w-max items-center" aria-label="Domaines de gestion Super-admin">
              {ACTIVE_NAV_GROUPS?.map(group => {
                const GroupIcon = group.icon;
                const containsActive = activeGroup?.id === group.id;
                const destination = buildPath(group.items[0].path);
                return (
                  <Link
                    key={group.id}
                    to={destination}
                    className={`group relative inline-flex min-h-14 items-center gap-2.5 px-3.5 text-[13px] font-bold transition md:px-4 ${containsActive ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
                  >
                    <GroupIcon size={17} style={{ color: containsActive ? '#BF8813' : '#64748B' }} />
                    <span>{group.label}</span>
                    <span className={`absolute inset-x-3 bottom-0 h-[2px] transition ${containsActive ? 'bg-[#BF8813]' : 'bg-transparent group-hover:bg-slate-200'}`} />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {activeGroup && activeGroup.id !== 'dashboard' && (
          <div className="relative z-10 flex-shrink-0 border-b border-slate-200 bg-[#F8FAFD]">
            <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-6">
              {activeGroup.items.map(item => {
                const ItemIcon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.path}
                    to={buildPath(item.path)}
                    className={`inline-flex min-h-9 min-w-max items-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${active ? 'bg-white text-[#002050] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/80 hover:text-[#002050]'}`}
                  >
                    <ItemIcon size={14} style={{ color: active ? '#BF8813' : '#94A3B8' }} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {mobileNavigationOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation administrative">
            <button type="button" className="fixed inset-0 bg-black/60" onClick={() => setMobileNavigationOpen(false)} aria-label="Fermer la navigation" />
            <div className="relative z-10 h-[100dvh] w-[min(88vw,320px)]">{adminSidebar}</div>
          </div>
        )}

        <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F6F8FC] ${contentClassName}`}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white">
      <DashboardTopbar
        title={contextualTitle}
        subtitle={headerSubtitle || roleSubtitle}
        onOpenNavigation={() => setMobileNavigationOpen(true)}
        navigationOpen={mobileNavigationOpen}
        actions={headerActions}
        search={headerSearch}
        dashboardPath={dashboardPath}
        showBrand
        brandHref="/home"
      />

      <div className="relative z-20 hidden flex-shrink-0 border-b border-slate-200 bg-white lg:block">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-visible px-5">
          <nav className="min-w-0 flex-1" aria-label={`Navigation ${roleSubtitle}`}>
            {navigationContents(false)}
          </nav>
          {spaceHomePath && (
            <Link to={buildPath(spaceHomePath)} className="ml-auto inline-flex min-h-11 items-center gap-2 border-l border-slate-200 px-4 text-sm font-semibold text-[#002050] hover:bg-slate-50">
              <ExternalLink size={15} style={{ color: '#BF8813' }} />
              {spaceHomeLabel}
            </Link>
          )}
        </div>
      </div>

      {mobileDrawer}

      <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
