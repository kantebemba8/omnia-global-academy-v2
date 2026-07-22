import React, { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Award, FileText, Users, User, LogOut,
  ChevronRight, ChevronDown, Sparkles, Menu, Wallet, BarChart2, MessageSquare, Settings, PlusCircle,
  Building2, Key, Shield, Briefcase, HelpCircle, Flag, CreditCard, Tag, Monitor, Gift,
  Search, Radio, ExternalLink,
} from 'lucide-react';
import { ADMIN_NAV_GROUPS, type AdminNavGroup, type AdminNavItem } from '../lib/adminNavigation';

type NavItem = AdminNavItem;
type NavEntry = NavItem | AdminNavGroup;
interface Props { children: ReactNode; role?: 'apprenant' | 'professeur' | 'directeur' | 'enseignant' | 'moderateur' | 'super_admin'; navItems?: NavEntry[] }

interface StoredUser {
  id: string; full_name: string; email: string;
  country_code?: string; ai_tokens?: number;
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const APPRENANT_NAV = [
  { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/dashboard/mes-cours', label: 'Mes formations', icon: BookOpen },
  { path: '/dashboard/certificats', label: 'Certificats', icon: Award },
 { path: '/dashboard/career-studio', label: 'Omnia Career Studio', icon: FileText },
  { path: '/talent', label: 'Talent Omnia', icon: Search },
  { path: '/omnia-live', label: 'Omnia Live', icon: Radio },
  { path: '/dashboard/parrainage', label: 'Parrainage & Gains', icon: Gift },
  { path: '/forum', label: 'Forum communauté', icon: MessageSquare },
  { path: '/emploi', label: 'Espace Carrière', icon: Briefcase },
  { path: '/dashboard/profil', label: 'Mon profil', icon: User },
  { path: '/dashboard/structure', label: 'Ma Structure', icon: Building2 },
];

const PROFESSEUR_NAV = [
  { path: '/professeur/dashboard', label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { path: '/professeur/courses', label: 'Mes formations', icon: BookOpen },
  { path: '/professeur/courses/new', label: 'Créer une formation', icon: PlusCircle },
  { path: '/professeur/payouts', label: 'Mon portefeuille', icon: Wallet },
  { path: '/professeur/analytics', label: 'Analytique élèves', icon: BarChart2 },
  { path: '/talent', label: 'Talent Omnia', icon: Search },
  { path: '/omnia-live', label: 'Omnia Live', icon: Radio },
  { path: '/forum', label: 'Forums & Entraide', icon: MessageSquare },
  { path: '/professeur/profile', label: 'Configuration profil', icon: Settings },
  { path: '/professeur/certificats', label: 'Mes Certificats', icon: Award },
];

const PARTNER_NAV = [
  { path: '/partner/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/partner/dashboard', label: 'Organisation', icon: Building2 },
  { path: '/partner/dashboard', label: 'Codes & PIN', icon: Key },
  { path: '/partner/dashboard', label: 'Membres', icon: Users },
  { path: '/structure/teachers', label: 'Enseignants', icon: Users },
  { path: '/structure/courses', label: 'Catalogue interne', icon: BookOpen },
  { path: '/structure/payouts', label: 'Retraits', icon: Wallet },
  { path: '/structure/certificats', label: 'Certificats', icon: Award },
];

const DIRECTEUR_NAV = [
  { path: '/structure/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/structure/teachers', label: 'Gestion enseignants', icon: Users },
  { path: '/structure/courses', label: 'Catalogue interne', icon: BookOpen },
  { path: '/structure/licenses', label: 'Licences B2B', icon: Key },
  { path: '/structure/payouts', label: 'Retraits établissement', icon: Wallet },
  { path: '/forum', label: 'Forum école', icon: MessageSquare },
  { path: '/structure/certificats', label: 'Certificats', icon: Award },
];

const ENSEIGNANT_NAV = [
  { path: '/staff/dashboard', label: 'Mon espace', icon: LayoutDashboard, exact: true },
  { path: '/staff/courses', label: 'Mes cours', icon: BookOpen },
  { path: '/staff/courses/new', label: 'Créer un cours', icon: PlusCircle },
  { path: '/staff/analytics', label: 'Analytique', icon: BarChart2 },
  { path: '/forum', label: 'Forum école', icon: MessageSquare },
];

export function DashboardLayout({ children, role = 'apprenant', navItems }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; }
    catch { return false; }
  })();
  const previewMode = isPreview && isSuperAdmin;
  const buildPath = (path: string) => previewMode ? `${path}?preview=true` : path;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isPreview = searchParams.get('preview') === 'true';
    const token = localStorage.getItem('omnia_session_token');
    const stored = localStorage.getItem('omnia_user');
    // Mode aperçu Super-admin : bypass total
    if (isPreview && stored) {
      try {
        const u = JSON.parse(stored);
        if (u?.roles?.includes('super_admin')) {
          setUser(u);
          return; // pas de vérification de rôle
        }
      } catch { /* ignore */ }
    }
    // Mode normal : vérification token
    if (!token) { navigate('/connexion'); return; }
    if (stored) { try { setUser(JSON.parse(stored)); } catch { /* ignore */ } }
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('omnia_admin_role_preview');
    navigate('/connexion');
  }

  const NAV_ITEMS: NavEntry[] = navItems ?? (
    role === 'professeur' ? PROFESSEUR_NAV
    : role === 'directeur' ? PARTNER_NAV
    : role === 'enseignant' ? ENSEIGNANT_NAV
    : role === 'super_admin' ? ADMIN_NAV_GROUPS
    : APPRENANT_NAV
  );

  const isGroup = (entry: NavEntry): entry is AdminNavGroup =>
    'items' in entry && Array.isArray(entry.items);

  function isActive(item: NavItem) {
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  }

  function isGroupActive(group: AdminNavGroup) {
    return group.items.some(isActive);
  }

  useEffect(() => {
    const activeGroups: Record<string, boolean> = {};
    NAV_ITEMS.forEach(entry => {
      if (isGroup(entry) && isGroupActive(entry)) activeGroups[entry.id] = true;
    });
    if (Object.keys(activeGroups).length) {
      setOpenGroups(prev => ({ ...prev, ...activeGroups }));
    }
  }, [location.pathname]);

  const sidebar = (
    <aside className="flex flex-col h-full" style={{ backgroundColor: '#002050' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="leading-tight font-bold">
            <div className="text-white text-base">Omnia</div>
            <div className="text-sm" style={{ color: '#BF8813' }}>Global Academy</div>
          </div>
        </Link>
      </div>

      <nav className="sidebar-scrollbar flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((entry) => {
          if (!isGroup(entry)) {
            const active = isActive(entry);
            return (
              <Link key={entry.path} to={buildPath(entry.path)} onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
                style={{ backgroundColor: active ? 'rgba(191,136,19,0.15)' : 'transparent', color: active ? '#BF8813' : 'rgba(255,255,255,0.65)' }}>
                <entry.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span className="flex-1 text-sm font-medium">{entry.label}</span>
                {entry.badge && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                    {entry.badge}
                  </span>
                )}
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </Link>
            );
          }

          const groupActive = isGroupActive(entry);
          const expanded = openGroups[entry.id] ?? groupActive ?? false;
          const onlyOne = entry.items.length === 1;

          if (onlyOne) {
            const item = entry.items[0];
            const active = isActive(item);
            return (
              <Link key={entry.id} to={buildPath(item.path)} onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
                style={{ backgroundColor: active ? 'rgba(191,136,19,0.15)' : 'transparent', color: active ? '#BF8813' : 'rgba(255,255,255,0.72)' }}>
                <entry.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span className="flex-1 text-sm font-medium">{entry.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </Link>
            );
          }

          return (
            <div key={entry.id} className="space-y-1">
              <button
                type="button"
                onClick={() => setOpenGroups(prev => ({ ...prev, [entry.id]: !expanded }))}
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                style={{
                  backgroundColor: groupActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color: groupActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)'
                }}
              >
                <entry.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span className="flex-1 text-sm font-medium">{entry.label}</span>
                <ChevronDown
                  className="w-3.5 h-3.5 opacity-60 transition-transform duration-150"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {expanded && (
                <div className="ml-4 border-l border-white/10 pl-2 space-y-0.5">
                  {entry.items.map(item => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.path}
                        to={buildPath(item.path)}
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150"
                        style={{
                          backgroundColor: active ? 'rgba(191,136,19,0.14)' : 'transparent',
                          color: active ? '#BF8813' : 'rgba(255,255,255,0.58)'
                        }}
                      >
                        <item.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                        <span className="flex-1 text-[13px] font-medium leading-tight">{item.label}</span>
                        {active && <span className="h-1.5 w-1.5 rounded-full" style={{backgroundColor:'#BF8813'}} />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 pb-5 border-t border-white/10 pt-3">
        <Link to="/" onClick={() => setSidebarOpen(false)}
          className="mb-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-white/5"
          style={{ color: '#BF8813' }}>
          <ExternalLink style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span>Voir Omnia Global Academy</span>
        </Link>
        <button onClick={handleLogout}
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
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col" style={{ width: 260 }}>{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm" style={{ color: '#002050' }}>Omnia Academy</span>
          {user && (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: '#BF8813', color: '#002050' }}>
              {monogram(user.full_name)}
            </div>
          )}
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
