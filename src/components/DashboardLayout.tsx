import React, { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';
import {
  LayoutDashboard, BookOpen, Award, FileText, Users, User, LogOut,
  ChevronRight, ChevronDown, Sparkles, Menu, Wallet, BarChart2, MessageSquare, Settings, PlusCircle,
  Building2, Key, Shield, Briefcase, CreditCard, Tag, Monitor, Gift,
  Search, ExternalLink, UserRoundCheck, BadgeCheck, FileCheck2, ClipboardCheck, FolderKanban, Route, X,
} from 'lucide-react';

interface NavItem { path: string; label: string; icon: React.ElementType; exact?: boolean; badge?: string }
interface NavGroup { id: string; label: string; icon: React.ElementType; items: NavItem[] }
interface Props {
  children: ReactNode;
  role?: 'apprenant' | 'professeur' | 'directeur' | 'moderateur' | 'super_admin';
  navItems?: NavItem[];
  navGroups?: NavGroup[];
}




const APPRENANT_NAV = [
  { path: '/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/dashboard/profil', label: 'Mon profil', icon: User },
  { path: '/dashboard/mes-cours', label: 'Mes formations', icon: BookOpen },
  { path: '/dashboard/abonnements', label: 'Abonnements & avantages', icon: CreditCard },
  { path: '/dashboard/evaluations', label: 'Mes évaluations', icon: ClipboardCheck },
  { path: '/dashboard/certificats', label: 'Mes certificats', icon: Award },
  { path: '/dashboard/badges', label: 'Mes badges', icon: BadgeCheck },
  { path: '/dashboard/learning-record', label: 'Learning Record', icon: FileCheck2 },
  { path: '/dashboard/skills-passport', label: 'Skills Passport', icon: Sparkles },
  { path: '/dashboard/project-portfolio', label: 'Portfolio de projets', icon: Briefcase },
  { path: '/dashboard/professional-pathways', label: 'Parcours professionnels', icon: Route },
  { path: '/dashboard/employabilite', label: 'Employabilité intégrée', icon: UserRoundCheck },
  { path: '/dashboard/career-studio', label: 'Omnia Career Studio', icon: FileText },
  { path: '/emploi', label: 'Espace Carrière', icon: Briefcase },
  { path: '/projects/mes-projets', label: 'Omnia Projects', icon: FolderKanban },
  { path: '/talent', label: 'Omnia Talent', icon: Search },
  { path: '/coaching', label: 'Omnia Coaching', icon: UserRoundCheck },
  { path: '/forum', label: 'Omnia Forum', icon: MessageSquare },
  { path: '/dashboard/parrainage', label: 'Parrainage & Gains', icon: Gift },
  { path: '/dashboard/structure', label: 'Ma Structure', icon: Building2 },
];

const PROFESSEUR_NAV = [
  { path: '/professeur/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/professeur/courses', label: 'Mes formations', icon: BookOpen },
  { path: '/professeur/courses/new', label: 'Créer une formation', icon: PlusCircle },
  { path: '/professeur/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
  { path: '/professeur/jurys', label: 'Jurys & révisions', icon: Users },
  { path: '/professeur/projects', label: 'Omnia Projects', icon: FolderKanban },
  { path: '/professeur/payouts', label: 'Mon portefeuille', icon: Wallet },
  { path: '/professeur/analytics', label: 'Analytique élèves', icon: BarChart2 },
  { path: '/talent', label: 'Omnia Talent', icon: Search },
  { path: '/forum', label: 'Forums & Entraide', icon: MessageSquare },
  { path: '/professeur/profile', label: 'Configuration profil', icon: Settings },
  { path: '/professeur/certificats', label: 'Mes Certificats', icon: Award },
];


const APPRENANT_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'learner-account', label: 'Mon espace', icon: User,
    items: [
      { path: '/dashboard/profil', label: 'Mon profil', icon: User },
      { path: '/dashboard/abonnements', label: 'Abonnements & avantages', icon: CreditCard },
      { path: '/dashboard/parrainage', label: 'Parrainage & Gains', icon: Gift },
      { path: '/dashboard/structure', label: 'Ma Structure', icon: Building2 },
    ],
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
      { path: '/dashboard/badges', label: 'Mes badges', icon: BadgeCheck },
      { path: '/dashboard/learning-record', label: 'Learning Record', icon: FileCheck2 },
      { path: '/dashboard/skills-passport', label: 'Skills Passport', icon: Sparkles },
      { path: '/dashboard/project-portfolio', label: 'Portfolio de projets', icon: Briefcase },
      { path: '/dashboard/professional-pathways', label: 'Parcours professionnels', icon: Route },
      { path: '/dashboard/employabilite', label: 'Employabilité intégrée', icon: UserRoundCheck },
    ],
  },
  {
    id: 'learner-career', label: 'Carrière & projets', icon: Briefcase,
    items: [
      { path: '/dashboard/career-studio', label: 'Omnia Career Studio', icon: FileText },
      { path: '/emploi', label: 'Espace Carrière', icon: Briefcase },
      { path: '/projects/mes-projets', label: 'Omnia Projects', icon: FolderKanban },
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/coaching', label: 'Omnia Coaching', icon: UserRoundCheck },
      { path: '/forum', label: 'Omnia Forum', icon: MessageSquare },
    ],
  },
];

const PROFESSEUR_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/professeur/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'professor-account', label: 'Mon espace', icon: User,
    items: [{ path: '/professeur/profile', label: 'Configuration profil', icon: Settings }],
  },
  {
    id: 'professor-courses', label: 'Formations', icon: BookOpen,
    items: [
      { path: '/professeur/courses', label: 'Mes formations', icon: BookOpen },
      { path: '/professeur/courses/new', label: 'Créer une formation', icon: PlusCircle },
      { path: '/professeur/certificats', label: 'Mes certificats', icon: Award },
    ],
  },
  {
    id: 'professor-assessments', label: 'Évaluations & suivi', icon: ClipboardCheck,
    items: [
      { path: '/professeur/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
      { path: '/professeur/jurys', label: 'Jurys & révisions', icon: Users },
      { path: '/professeur/analytics', label: 'Analytique élèves', icon: BarChart2 },
    ],
  },
  {
    id: 'professor-activity', label: 'Projets & revenus', icon: FolderKanban,
    items: [
      { path: '/professeur/projects', label: 'Omnia Projects', icon: FolderKanban },
      { path: '/professeur/payouts', label: 'Mon portefeuille', icon: Wallet },
    ],
  },
  {
    id: 'professor-network', label: 'Réseau & communauté', icon: Users,
    items: [
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/forum', label: 'Forums & Entraide', icon: MessageSquare },
    ],
  },
];

const PARTNER_NAV = [
  { path: '/partner/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/partner/dashboard', label: 'Organisation', icon: Building2 },
  { path: '/partner/dashboard', label: 'Codes & PIN', icon: Key },
  { path: '/partner/dashboard', label: 'Membres', icon: Users },
  { path: '/partner/recognitions', label: 'Reconnaissances', icon: BadgeCheck },
  { path: '/structure/teachers', label: 'Enseignants', icon: Users },
  { path: '/structure/courses', label: 'Catalogue interne', icon: BookOpen },
  { path: '/structure/payouts', label: 'Retraits', icon: Wallet },
  { path: '/structure/certificats', label: 'Certificats', icon: Award },
];





const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/admin/cms-branding', label: 'Configuration CMS', icon: Settings },
  { path: '/admin/fintech', label: 'Configuration Fintech', icon: CreditCard },
  { path: '/admin/payouts', label: 'Gestion des Retraits', icon: Wallet },
  { path: '/admin/marketing', label: 'Offres & Licences B2B', icon: Tag },
  { path: '/admin/courses', label: 'Catalogue & CPD', icon: BookOpen },
  { path: '/admin/assisted-courses', label: 'Saisie assistée & certifications', icon: FileText },
  { path: '/admin/team', label: 'Équipe & Modérateurs', icon: Users },
  { path: '/admin/cpd-credits', label: 'Crédits Open CPD', icon: Award },
  { path: '/admin/certificates', label: 'Documents délivrés', icon: Award },
  { path: '/admin/certificate-settings', label: 'Paramètres', icon: Settings },
  { path: '/talent', label: 'Omnia Talent', icon: Search },
  { path: '/admin/talent', label: 'Supervision Omnia Talent', icon: Shield },
  { path: '/admin/demo-access', label: 'Accès Démo', icon: Monitor },
];

export function DashboardLayout({ children, role = 'apprenant', navItems, navGroups }: Props) {
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
    const token = localStorage.getItem('omnia_session_token');
    const stored = localStorage.getItem('omnia_user');
    // Une prévisualisation conserve la session Super Admin sans lui attribuer le rôle affiché.
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

  function handleLogout() {
    sessionStorage.removeItem('omnia_admin_role_preview');
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  const filterReferralItems = (items: NavItem[]) =>
    role === 'apprenant' && !referralEnabled
      ? items.filter(item => item.path !== '/dashboard/parrainage')
      : items;

  const NAV_ITEMS = filterReferralItems(navItems ?? (
    role === 'professeur' ? PROFESSEUR_NAV
      : role === 'directeur' ? PARTNER_NAV
        : role === 'super_admin' ? ADMIN_NAV
          : APPRENANT_NAV
  ));

  const rawNavGroups = navGroups ?? (
    role === 'professeur' ? PROFESSEUR_GROUPS
      : role === 'apprenant' ? APPRENANT_GROUPS
        : undefined
  );

  const ACTIVE_NAV_GROUPS = rawNavGroups?.map(group => ({
    ...group,
    items: filterReferralItems(group.items),
  })).filter(group => group.items.length > 0);

  useEffect(() => {
    if (!ACTIVE_NAV_GROUPS?.length) return;
    const activeGroup = ACTIVE_NAV_GROUPS.find(group =>
      group.items.some(item => item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path))
    );
    if (activeGroup) {
      setExpandedGroups(prev => ({ ...prev, [activeGroup.id]: true }));
    }
  }, [location.pathname, ACTIVE_NAV_GROUPS]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  function isActive(item: NavItem) {
    if ((item as { exact?: boolean }).exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  const sidebar = (
    <aside className="flex flex-col h-full min-h-0 overflow-hidden" style={{ backgroundColor: '#002050' }}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="w-10 h-10 object-contain" />
          <span className="font-bold leading-tight">
            <span className="block text-white text-base">Omnia</span>
            <span className="block text-sm" style={{ color: '#BF8813' }}>Global Academy</span>
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
        className="oga-sidebar-scroll flex-1 min-h-0 px-3 py-4 overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#BF8813 transparent' }}
      >
        {ACTIVE_NAV_GROUPS?.length ? (
          <div className="space-y-1">
            {ACTIVE_NAV_GROUPS.map((group) => {
              const containsActive = group.items.some(item => isActive(item));
              const open = expandedGroups[group.id] ?? containsActive;
              const GroupIcon = group.icon;

              if (group.id === 'dashboard' && group.items.length === 1) {
                const item = group.items[0];
                const active = isActive(item);
                return (
                  <Link
                    key={group.id}
                    to={buildPath(item.path)}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className="relative flex items-center gap-3 px-3 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                    style={{
                      backgroundColor: 'transparent',
                      color: active ? '#BF8813' : 'rgba(255,255,255,0.72)'
                    }}
                  >
                    {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: '#BF8813' }} />}
                    <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span className="flex-1 text-sm font-semibold">{group.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                  </Link>
                );
              }

              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                    style={{
                      backgroundColor: 'transparent',
                      color: containsActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)'
                    }}
                  >
                    <GroupIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span className="flex-1 text-left text-sm font-semibold">{group.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="ml-5 mt-1 mb-2 pl-3 border-l border-white/10 space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item);
                        return (
                          <Link
                            key={item.path}
                            to={buildPath(item.path)}
                            onClick={() => setSidebarOpen(false)}
                            aria-current={active ? 'page' : undefined}
                            className="relative flex items-center gap-2.5 px-3 py-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                            style={{
                              backgroundColor: 'transparent',
                              color: active ? '#BF8813' : 'rgba(255,255,255,0.62)'
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
                  className="relative flex items-center gap-3 px-3 py-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
                  style={{ backgroundColor: 'transparent', color: active ? '#BF8813' : 'rgba(255,255,255,0.65)' }}>
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

      <div className="px-3 pt-2 pb-5 border-t border-white/10 flex-shrink-0">
        <Link
          to={buildPath('/')}
          onClick={() => setSidebarOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all"
          style={{ color: '#BF8813' }}
        >
          <ExternalLink style={{ width: 18, height: 18 }} />
          <span>Retour à Omnia Global Academy</span>
        </Link>
        <button type="button" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm">
          <LogOut style={{ width: 18, height: 18 }} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 260 }}>{sidebar}</div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation du tableau de bord">
          <button type="button" className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu" />
          <div id="dashboard-mobile-navigation" className="relative z-10 flex flex-col" style={{ width: 260 }}>{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
            aria-label="Ouvrir le menu du tableau de bord"
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-mobile-navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm" style={{ color: '#002050' }}>Omnia Academy</span>
        </div>
        <main className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
