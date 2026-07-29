import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, PlusCircle, Users, QrCode,
  BarChart2, Bell, Settings, LogOut,
  ChevronRight, ChevronDown, Menu, Building2, UserCheck, Shield, Briefcase, Search,
  CalendarDays, Heart, MessageSquare, UserRoundSearch, Radio, ExternalLink, Layers3, ClipboardCheck, CreditCard, FolderKanban, FileSignature, Network, LineChart,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const STRUCTURE_NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    items: [
      { path: '/structure/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: 'structure-members',
    label: 'Structure & membres',
    icon: Building2,
    items: [
      { path: '/structure/profil', label: 'Profil de la structure', icon: Building2 },
      { path: '/structure/membres', label: 'Membres liés', icon: Users },
      { path: '/structure/organisation', label: 'Organisation & obligations', icon: Network },
      { path: '/structure/suivi-rh', label: 'Suivi RH & conformité', icon: LineChart },
      { path: '/structure/rattachements', label: 'Demandes de rattachement', icon: UserCheck },
      { path: '/structure/codes', label: 'Codes structure', icon: QrCode },
      { path: '/structure/abonnements', label: 'Abonnements & capacités', icon: CreditCard },
      { path: '/structure/commerce-b2b', label: 'Commerce B2B & contrats', icon: FileSignature },
      { path: '/structure/equipe', label: 'Équipe de la structure', icon: Shield },
    ],
  },
  {
    id: 'formations',
    label: 'Formations',
    icon: BookOpen,
    items: [
      { path: '/structure/formations', label: 'Mes formations', icon: BookOpen },
      { path: '/structure/studio/new', label: 'Créer une formation', icon: PlusCircle },
      { path: '/structure/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
      { path: '/structure/jurys', label: 'Jurys & révisions', icon: Users },
      { path: '/structure/projects', label: 'Omnia Projects', icon: FolderKanban },
    ],
  },
  {
    id: 'recruitment',
    label: 'Emploi & recrutement',
    icon: Briefcase,
    items: [
      { path: '/structure/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
      { path: '/structure/recrutement/dashboard', label: 'Vue d’ensemble recrutement', icon: UserRoundSearch, exact: true },
      { path: '/structure/recrutement/talents', label: 'Recherche de talents', icon: Search },
      { path: '/structure/recrutement/favoris', label: 'Talents favoris', icon: Heart },
      { path: '/structure/recrutement/candidats', label: 'Candidats', icon: Users },
      { path: '/structure/recrutement/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/structure/recrutement/messages', label: 'Messages recrutement', icon: MessageSquare },
    ],
  },
  {
    id: 'omnia-services',
    label: 'Services Omnia',
    icon: Layers3,
    items: [
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/omnia-live', label: 'Omnia Live', icon: Radio },
    ],
  },
  {
    id: 'management',
    label: 'Pilotage & réglages',
    icon: Settings,
    items: [
      { path: '/structure/statistiques', label: 'Statistiques', icon: BarChart2 },
      { path: '/structure/notifications', label: 'Notifications', icon: Bell },
      { path: '/structure/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
];

const STRUCTURE_RECRUITER_NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    items: [
      { path: '/structure/recrutement/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: 'recruitment',
    label: 'Recrutement',
    icon: Briefcase,
    items: [
      { path: '/structure/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
      { path: '/structure/recrutement/talents', label: 'Recherche de talents', icon: Search },
      { path: '/structure/recrutement/candidats', label: 'Candidats', icon: Users },
      { path: '/structure/recrutement/favoris', label: 'Talents favoris', icon: Heart },
      { path: '/structure/recrutement/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/structure/recrutement/messages', label: 'Messages', icon: MessageSquare },
      { path: '/structure/recrutement/statistiques', label: 'Statistiques', icon: BarChart2 },
    ],
  },
  {
    id: 'omnia-services',
    label: 'Services Omnia',
    icon: Layers3,
    items: [
      { path: '/talent', label: 'Omnia Talent', icon: Search },
    ],
  },
];

interface Props {
  children: ReactNode;
  displayName?: string;
}

export function StructureLayout({ children, displayName }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ full_name: string; email: string; roles?: string[] } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const previewMode = new URLSearchParams(location.search).get('preview') === 'true' && (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; }
    catch { return false; }
  })();

  const buildPath = (path: string) => previewMode
    ? `${path}${path.includes('?') ? '&' : '?'}preview=true`
    : path;

  useEffect(() => {
    try {
      const stored = localStorage.getItem('omnia_user');
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const recruitmentOnly = Boolean(user?.roles?.includes('recruteur_structure'))
    && !user?.roles?.some(role => ['responsable_structure', 'gestionnaire_partenaire', 'directeur', 'etablissement_directeur', 'super_admin'].includes(role));
  const visibleGroups = recruitmentOnly ? STRUCTURE_RECRUITER_NAV_GROUPS : STRUCTURE_NAV_GROUPS;

  useEffect(() => {
    const activeGroup = visibleGroups.find(group => group.items.some(item => (
      item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
    )));
    if (activeGroup) {
      setExpandedGroups(previous => ({ ...previous, [activeGroup.id]: true }));
    }
  }, [location.pathname, visibleGroups]);

  function handleLogout() {
    if (previewMode) { navigate('/admin/dashboard'); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (token) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    navigate('/connexion');
  }

  function isActive(item: NavItem) {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  const Sidebar = () => (
    <div className="flex h-full flex-col" style={{ background: '#002050' }}>
      <div className="border-b px-5 py-5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <Link to="/" className="flex items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-10 w-10 flex-shrink-0 object-contain" />
          <div className="font-bold leading-tight">
            <div className="text-base text-white">Omnia</div>
            <div className="text-sm" style={{ color: '#BF8813' }}>Global Academy</div>
          </div>
        </Link>
      </div>

      <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-1">
          {visibleGroups.map(group => {
            const containsActive = group.items.some(isActive);
            const isSingleItem = group.items.length === 1;
            const open = Boolean(expandedGroups[group.id]);
            const GroupIcon = group.icon;

            if (isSingleItem) {
              const item = group.items[0];
              const active = isActive(item);
              return (
                <Link
                  key={group.id}
                  to={buildPath(item.path)}
                  onClick={() => setSidebarOpen(false)}
                  className="relative flex w-full items-center gap-3 px-3 py-2.5 transition-all"
                  style={{ color: active ? '#BF8813' : 'rgba(255,255,255,0.72)' }}
                >
                  {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full" style={{ background: '#BF8813' }} />}
                  <GroupIcon size={18} />
                  <span className="flex-1 text-sm font-semibold">{group.label}</span>
                  {active && <ChevronRight size={14} className="opacity-60" />}
                </Link>
              );
            }

            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setExpandedGroups(previous => ({ ...previous, [group.id]: !previous[group.id] }))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 transition-all"
                  style={{ color: containsActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)' }}
                >
                  <GroupIcon size={18} />
                  <span className="flex-1 text-left text-sm font-semibold">{group.label}</span>
                  <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                    {group.items.map(item => {
                      const active = isActive(item);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={buildPath(item.path)}
                          onClick={() => setSidebarOpen(false)}
                          className="relative flex items-center gap-2.5 px-3 py-2 transition-all"
                          style={{ color: active ? '#BF8813' : 'rgba(255,255,255,0.62)' }}
                        >
                          {active && <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full" style={{ background: '#BF8813' }} />}
                          <Icon size={15} />
                          <span className="flex-1 text-[13px] font-medium leading-snug">{item.label}</span>
                          {active && <ChevronRight size={12} className="opacity-60" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t px-3 pb-4 pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <Link
          to="/"
          onClick={() => setSidebarOpen(false)}
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all hover:bg-white/5"
          style={{ color: '#BF8813' }}
        >
          <ExternalLink size={18} />
          <span>Voir Omnia Global Academy</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          <LogOut size={18} />
          <span>{previewMode ? 'Retour au Dashboard' : 'Déconnexion'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <aside className="hidden flex-shrink-0 flex-col md:flex" style={{ width: 260 }}>
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute bottom-0 left-0 top-0 z-50 flex flex-col" style={{ width: 260 }}>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3 md:hidden" style={{ borderColor: '#E4E7EC' }}>
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2" style={{ background: '#F3F4F6' }}>
            <Menu size={18} style={{ color: '#002050' }} />
          </button>
          <div className="flex items-center gap-2">
            <Building2 size={16} style={{ color: '#002050' }} />
            <span className="text-sm font-bold" style={{ color: '#002050' }}>
              {displayName ?? 'Espace Structure'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FA' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
