import { getSessionToken } from '../lib/session';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';
import { DashboardTopbar } from './DashboardTopbar';
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
    id: 'learner-learning', label: 'Apprentissage', icon: BookOpen,
    items: [
      { path: '/dashboard/mes-cours', label: 'Mes formations', icon: BookOpen },
      { path: '/dashboard/evaluations', label: 'Mes évaluations', icon: ClipboardCheck },
      { path: '/dashboard/certificats', label: 'Mes certificats', icon: Award },
    ],
  },
  {
    id: 'learner-credentials', label: 'Compétences & preuves', icon: BadgeCheck,
    items: [
      { path: '/dashboard/badges', label: 'Badges', icon: BadgeCheck },
      { path: '/dashboard/learning-record', label: 'Learning Record', icon: FileCheck2 },
      { path: '/dashboard/skills-passport', label: 'Skills Passport', icon: Sparkles },
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
    id: 'professor-teaching', label: 'Enseignement', icon: BookOpen,
    items: [
      { path: '/professeur/courses', label: 'Mes formations', icon: BookOpen },
      { path: '/professeur/courses/new', label: 'Créer une formation', icon: PlusCircle },
      { path: '/professeur/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
      { path: '/professeur/jurys', label: 'Jurys & révisions', icon: Users },
      { path: '/professeur/certificats', label: 'Mes certificats', icon: Award },
    ],
  },
  {
    id: 'professor-performance', label: 'Projets & performance', icon: BarChart2,
    items: [
      { path: '/professeur/projects', label: 'Omnia Projects', icon: FolderKanban },
      { path: '/professeur/analytics', label: 'Analytique apprenants', icon: BarChart2 },
    ],
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [referralEnabled, setReferralEnabled] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
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
    // Une prévisualisation conserve la session administrative Omnia sans lui attribuer le rôle affiché.
    if (previewMode && stored) {
      try {
        const u = JSON.parse(stored);
        if (u?.roles?.includes('super_admin')) {
          return; // pas de vérification de rôle
        }
      } catch { /* ignore */ }
    }
    // Mode normal : vérification token
    if (!token) { navigate('/connexion'); return; }
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

  useEffect(() => {
    if (!ACTIVE_NAV_GROUPS?.length) return;
    const activeGroup = ACTIVE_NAV_GROUPS.find(group =>
      group.items.some(item => navigationItemMatchesPath(item, location.pathname))
    );
    if (activeGroup) {
      setExpandedGroups({ [activeGroup.id]: true });
    }
  }, [location.pathname, ACTIVE_NAV_GROUPS]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => (prev[id] ? {} : { [id]: true }));
  };

  const activeNavigation = useMemo(() => {
    const items = ACTIVE_NAV_GROUPS?.flatMap(group => group.items) ?? NAV_ITEMS;
    return items
      .filter(item => navigationItemMatchesPath(item, location.pathname))
      .sort((a, b) => b.path.split('?', 1)[0].length - a.path.split('?', 1)[0].length)[0] || null;
  }, [ACTIVE_NAV_GROUPS, NAV_ITEMS, location.pathname]);

  function isActive(item: NavItem) {
    return activeNavigation?.path === item.path;
  }

  const roleSubtitle = role === 'super_admin'
    ? 'Gestion de la plateforme'
    : role === 'moderateur'
      ? 'Espace de modération'
      : role === 'directeur'
        ? 'Espace Structure'
        : role === 'professeur'
          ? 'Espace Professeur'
          : role === 'recruteur'
            ? 'Espace Recruteur'
            : role === 'coach'
              ? 'Espace Coach'
              : role === 'organisateur'
                ? 'Espace Organisateur'
                : 'Espace Apprenant';

  const contextualTitle = headerTitle
    || (location.pathname === '/mon-profil' ? (role === 'super_admin' ? 'Mon compte' : 'Mon profil') : activeNavigation?.label)
    || 'Tableau de bord';

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden" style={{ backgroundColor: '#002050' }}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="w-10 h-10 object-contain" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-extrabold text-white">{brandTitle}</span>
            <span className="block truncate text-sm font-bold" style={{ color: '#BF8813' }}>{brandAccent}</span>
            <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{roleSubtitle}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] lg:hidden"
          aria-label="Fermer le menu du tableau de bord"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav
        className="oga-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#BF8813 transparent' }}
      >
        {ACTIVE_NAV_GROUPS?.length ? (
          <div className="space-y-1">
            {ACTIVE_NAV_GROUPS.map((group) => {
              const containsActive = group.items.some(item => isActive(item));
              const open = expandedGroups[group.id] ?? containsActive;
              const GroupIcon = group.icon;

              if (group.id === 'dashboard') {
                return (
                  <div key={group.id} className="space-y-1">
                    {group.items.map((item) => {
                      const active = isActive(item);
                      return (
                        <Link
                          key={item.path}
                          to={buildPath(item.path)}
                          onClick={() => setSidebarOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                          style={{
                            backgroundColor: 'transparent',
                            color: active ? '#BF8813' : 'rgba(255,255,255,0.72)'
                          }}
                        >
                          {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: '#BF8813' }} />}
                          <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                          <span className="flex-1 text-sm font-semibold">{item.label}</span>
                          {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                    style={{
                      backgroundColor: containsActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: containsActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)'
                    }}
                  >
                    <GroupIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span className="flex-1 text-left text-sm font-semibold">{group.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                      {group.items.map((item) => {
                        const active = isActive(item);
                        return (
                          <Link
                            key={item.path}
                            to={buildPath(item.path)}
                            onClick={() => setSidebarOpen(false)}
                            aria-current={active ? 'page' : undefined}
                            className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                            style={{
                              backgroundColor: active ? 'rgba(191,136,19,0.10)' : 'transparent',
                              color: active ? '#F4C45E' : 'rgba(255,255,255,0.62)'
                            }}
                          >
                            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: '#BF8813' }} />}
                            <item.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                            <span className="flex-1 text-[13px] font-medium leading-snug">{item.label}</span>
                            {active && <ChevronRight className="w-3 h-3 opacity-60" />}
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
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link key={item.path} to={buildPath(item.path)} onClick={() => setSidebarOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                  style={{ backgroundColor: active ? 'rgba(191,136,19,0.10)' : 'transparent', color: active ? '#F4C45E' : 'rgba(255,255,255,0.65)' }}>
                  {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: '#BF8813' }} />}
                  <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {(item as { badge?: string }).badge && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                      {(item as { badge?: string }).badge}
                    </span>
                  )}
                  {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {spaceHomePath && (
        <div className="flex-shrink-0 border-t border-white/10 px-3 py-3">
          <Link
            to={buildPath(spaceHomePath)}
            onClick={() => setSidebarOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: '#D8B35D' }}
          >
            <ExternalLink style={{ width: 17, height: 17 }} />
            <span>{spaceHomeLabel}</span>
          </Link>
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-gray-50">
      <div className="hidden h-[100dvh] flex-shrink-0 flex-col overflow-hidden lg:flex" style={{ width: 276 }}>{sidebar}</div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation du tableau de bord">
          <button type="button" className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu" />
          <div id="dashboard-mobile-navigation" className="relative z-10 flex h-[100dvh] flex-col overflow-hidden" style={{ width: 276, maxWidth: '88vw' }}>{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar
          title={contextualTitle}
          subtitle={headerSubtitle || roleSubtitle}
          onOpenNavigation={() => setSidebarOpen(true)}
          navigationOpen={sidebarOpen}
          navigationId="dashboard-mobile-navigation"
          actions={headerActions}
          search={headerSearch}
          dashboardPath={dashboardPath}
        />
        <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
