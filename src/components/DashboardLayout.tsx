import React, { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Award, FileText, Users, User, LogOut,
  ChevronRight, Sparkles, Menu, Wallet, BarChart2, MessageSquare, Settings, PlusCircle,
  Building2, Key, Shield, Briefcase, HelpCircle, Flag, CreditCard, Tag, Monitor, Gift,
  ArrowLeft,
} from 'lucide-react';

interface NavItem { path: string; label: string; icon: React.ElementType; exact?: boolean; badge?: string }
interface Props { children: ReactNode; role?: 'apprenant' | 'professeur' | 'directeur' | 'enseignant' | 'moderateur' | 'super_admin'; navItems?: NavItem[] }

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
 { path: '/dashboard/career-studio', label: 'Omnia Career Studio', icon: FileText, badge: 'Nouveau' },
  { path: '/dashboard/parrainage', label: 'Parrainage & Gains', icon: Gift },
  { path: '/forum', label: 'Forum communauté', icon: MessageSquare },
  { path: '/emploi', label: 'Espace Carrière', icon: Briefcase },
  { path: '/dashboard/profil', label: 'Mon profil', icon: User },
];

const PROFESSEUR_NAV = [
  { path: '/professeur/dashboard', label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { path: '/professeur/courses', label: 'Mes formations', icon: BookOpen },
  { path: '/professeur/courses/new', label: 'Créer une formation', icon: PlusCircle },
  { path: '/professeur/payouts', label: 'Mon portefeuille', icon: Wallet },
  { path: '/professeur/analytics', label: 'Analytique élèves', icon: BarChart2 },
  { path: '/forum', label: 'Forums & Entraide', icon: MessageSquare },
  { path: '/professeur/profile', label: 'Configuration profil', icon: Settings },
  { path: '/professeur/certificats', label: 'Mes Certificats', icon: Award },
];

const DIRECTEUR_NAV = [
  { path: '/school/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/school/teachers', label: 'Gestion enseignants', icon: Users },
  { path: '/school/courses', label: 'Catalogue interne', icon: BookOpen },
  { path: '/school/licenses', label: 'Licences B2B', icon: Key },
  { path: '/school/payouts', label: 'Retraits établissement', icon: Wallet },
  { path: '/forum', label: 'Forum école', icon: MessageSquare },
  { path: '/school/certificats', label: 'Certificats', icon: Award },
];

const ENSEIGNANT_NAV = [
  { path: '/staff/dashboard', label: 'Mon espace', icon: LayoutDashboard, exact: true },
  { path: '/staff/courses', label: 'Mes cours', icon: BookOpen },
  { path: '/staff/courses/new', label: 'Créer un cours', icon: PlusCircle },
  { path: '/staff/analytics', label: 'Analytique', icon: BarChart2 },
  { path: '/forum', label: 'Forum école', icon: MessageSquare },
];

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/admin/cms-branding', label: 'Configuration CMS', icon: Settings },
  { path: '/admin/fintech', label: 'Configuration Fintech', icon: CreditCard },
  { path: '/admin/payouts', label: 'Gestion des Retraits', icon: Wallet },
  { path: '/admin/marketing', label: 'Offres & Licences B2B', icon: Tag },
  { path: '/admin/courses', label: 'Catalogue & CPD', icon: BookOpen },
  { path: '/admin/team', label: 'Équipe & Modérateurs', icon: Users },
  { path: '/admin/cpd-credits', label: 'Crédits Open CPD', icon: Award },
  { path: '/admin/certificates', label: 'Certificats délivrés', icon: Award },
  { path: '/admin/certificate-settings', label: 'Paramètres Certificats', icon: Settings },
  { path: '/admin/demo-access', label: 'Accès Démo', icon: Monitor },
];

export function DashboardLayout({ children, role = 'apprenant', navItems }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    const searchParams = new URLSearchParams(window.location.search);
    const isPreview = searchParams.get('preview') === 'true';
    if (isPreview) { navigate('/admin/dashboard'); return; }
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    navigate('/connexion');
  }

  const NAV_ITEMS = navItems ?? (
    role === 'professeur' ? PROFESSEUR_NAV
    : role === 'directeur' ? DIRECTEUR_NAV
    : role === 'enseignant' ? ENSEIGNANT_NAV
    : role === 'super_admin' ? ADMIN_NAV
    : APPRENANT_NAV
  );

  function isActive(item: typeof NAV_ITEMS[0]) {
    if ((item as { exact?: boolean }).exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  const sidebar = (
    <aside className="flex flex-col h-full" style={{ backgroundColor: '#002050' }}>
      <div className="px-6 py-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: '#BF8813' }}>OA</div>
          <span className="text-white font-bold text-base leading-tight">Omnia Global<br />Academy</span>
        </Link>
      </div>

      {user && (
        <div className="px-4 py-4 mx-3 mt-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#BF8813', color: '#002050' }}>
              {monogram(user.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user.full_name}</p>
              <p className="text-white/50 text-xs truncate capitalize">{role}</p>
            </div>
          </div>
          {role === 'apprenant' && user.ai_tokens != null && (
            <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: '#BF8813' }}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{user.ai_tokens} jeton{user.ai_tokens !== 1 ? 's' : ''} IA</span>
            </div>
          )}
          {role === 'professeur' && (
            <Link to={buildPath('/professeur/courses/new')} onClick={() => setSidebarOpen(false)}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2 rounded-lg justify-center hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#BF8813', color: '#002050' }}>
              <PlusCircle className="w-3.5 h-3.5" /> Nouvelle formation
            </Link>
          )}
          {role === 'directeur' && (
            <div className="mt-2">
              <span className="text-white/40 text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Directeur</span>
            </div>
          )}
          {role === 'enseignant' && (
            <Link to={buildPath('/staff/courses/new')} onClick={() => setSidebarOpen(false)}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2 rounded-lg justify-center hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#BF8813', color: '#002050' }}>
              <PlusCircle className="w-3.5 h-3.5" /> Nouvelle formation
            </Link>
          )}
          {role === 'moderateur' && (
            <div className="mt-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3" style={{ color: '#BF8813' }} />
              <span className="text-white/40 text-xs">Modérateur</span>
            </div>
          )}
          {role === 'super_admin' && (
            <div className="mt-2 flex items-center gap-1.5">
              <Monitor className="w-3 h-3" style={{ color: '#BF8813' }} />
              <span className="text-white/40 text-xs">Super-admin</span>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link key={item.path} to={buildPath(item.path)} onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
              style={{ backgroundColor: active ? 'rgba(191,136,19,0.15)' : 'transparent', color: active ? '#BF8813' : 'rgba(255,255,255,0.65)' }}>
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
      </nav>

      <div className="px-3 pb-5">
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
          {previewMode && (
            <div className="flex items-center gap-3 px-5 py-3" style={{ backgroundColor: '#002050' }}>
              <span className="text-white text-xs font-medium flex-1">
                👁 Mode aperçu Super-admin — Tableau de bord {
                  role === 'apprenant' ? 'Apprenant'
                  : role === 'professeur' ? 'Formateur'
                  : role === 'directeur' ? 'École'
                  : role === 'moderateur' ? 'Modérateur'
                  : 'Utilisateur'
                } — Lecture seule
              </span>
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white border border-white/30 hover:bg-white/10 transition-colors flex-shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour au dashboard admin
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
