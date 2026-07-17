import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, PlusCircle, Users, QrCode,
  Gift, BarChart2, Bell, Settings, User, LogOut,
  ChevronRight, Menu, X, Building2, UserCheck, Shield, Briefcase, Search,
  CalendarDays, Heart, MessageSquare, UserRoundSearch,
} from 'lucide-react';

interface NavItem { path: string; label: string; icon: React.ElementType; exact?: boolean; badge?: string }

const STRUCTURE_NAV: NavItem[] = [
  { path: '/structure/dashboard',           label: 'Tableau de bord',          icon: LayoutDashboard, exact: true },
  { path: '/structure/profil',              label: 'Profil de la structure',    icon: Building2 },
  { path: '/structure/formations',          label: 'Formations',                icon: BookOpen },
  { path: '/structure/studio/new',           label: 'Créer une formation',       icon: PlusCircle },
  { path: '/structure/membres',             label: 'Membres liés',              icon: Users },
  { path: '/structure/rattachements',       label: 'Demandes de rattachement',  icon: UserCheck },
  { path: '/structure/codes',               label: 'Codes structure',           icon: QrCode },
  { path: '/structure/avantages',           label: 'Avantages structure',       icon: Gift },
  { path: '/structure/offres-emploi',       label: 'Offres d’emploi',           icon: Briefcase },
  { path: '/structure/recrutement/dashboard',label: 'Recrutement',               icon: UserRoundSearch },
  { path: '/structure/recrutement/talents',  label: 'Recherche de talents',      icon: Search },
  { path: '/structure/recrutement/favoris',  label: 'Talents favoris',           icon: Heart },
  { path: '/structure/recrutement/candidats',label: 'Candidats',                 icon: Users },
  { path: '/structure/recrutement/entretiens',label:'Entretiens',                icon: CalendarDays },
  { path: '/structure/recrutement/messages', label: 'Messages recrutement',      icon: MessageSquare },
  { path: '/talent',                         label: 'Talent Omnia',              icon: Search },
  { path: '/structure/equipe',              label: 'Équipe de la structure',    icon: Shield },
  { path: '/structure/statistiques',        label: 'Statistiques',              icon: BarChart2 },
  { path: '/structure/notifications',       label: 'Notifications',             icon: Bell },
  { path: '/structure/parametres',          label: 'Paramètres',                icon: Settings },
];

function monogram(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface Props { children: ReactNode; displayName?: string }

export function StructureLayout({ children, displayName }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ full_name: string; email: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex flex-col h-full" style={{ background: '#002050' }}>
      {/* Logo + nom espace */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#BF8813' }}>
            <Building2 size={18} color="white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {displayName ?? 'Espace Structure'}
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Omnia Global Academy
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {STRUCTURE_NAV.map(item => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={buildPath(item.path)}
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{
                background: active ? 'rgba(191,136,19,0.18)' : 'transparent',
                color: active ? '#BF8813' : 'rgba(255,255,255,0.65)',
              }}
            >
              <Icon size={16} />
              <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#BF8813', color: 'white', fontSize: 9 }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 pb-4 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 px-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: '#BF8813', color: 'white' }}>
              {monogram(user.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Responsable de structure
              </p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-red-500/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col flex-shrink-0" style={{ width: 240 }}>
        <Sidebar />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 flex flex-col" style={{ width: 260, zIndex: 50 }}>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar mobile */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: '#E4E7EC', background: 'white' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg"
            style={{ background: '#F3F4F6' }}>
            <Menu size={18} style={{ color: '#002050' }} />
          </button>
          <div className="flex items-center gap-2">
            <Building2 size={16} style={{ color: '#002050' }} />
            <span className="font-bold text-sm" style={{ color: '#002050' }}>
              {displayName ?? 'Espace Structure'}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#F8F9FA' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
