import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import {
  LayoutDashboard, BookOpen, Users, MessageSquare, Briefcase, HelpCircle, BarChart2, Shield
} from 'lucide-react';
import { ENDPOINTS } from '../lib/config';

interface ModPerms {
  can_see_pending_courses: boolean;
  can_validate_course_price: boolean;
  can_reject_course: boolean;
  can_transmit_course_to_admin: boolean;
  can_validate_professor_kyc: boolean;
  can_validate_establishment_kyc: boolean;
  can_see_learners_list: boolean;
  can_see_professors_list: boolean;
  can_suspend_account: boolean;
  can_moderate_forum: boolean;
  can_post_job_offers: boolean;
  can_moderate_jobs: boolean;
  can_manage_support: boolean;
  can_view_moderation_log: boolean;
  can_view_analytics: boolean;
  can_view_financial_summary: boolean;
}

function buildModNav(perms: ModPerms) {
  const items = [
    { path: '/moderator/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true, always: true },
  ];
  if (perms.can_see_pending_courses || perms.can_reject_course || perms.can_transmit_course_to_admin) {
    items.push({ path: '/moderator/courses', label: 'Formations', icon: BookOpen, always: false });
  }
  if (perms.can_validate_professor_kyc || perms.can_validate_establishment_kyc) {
    items.push({ path: '/moderator/kyc', label: 'Validation KYC', icon: Shield, always: false });
  }
  if (perms.can_see_learners_list || perms.can_see_professors_list || perms.can_suspend_account) {
    items.push({ path: '/moderator/users', label: 'Consultation utilisateurs', icon: Users, always: false });
  }
  if (perms.can_moderate_forum) {
    items.push({ path: '/moderator/forum', label: 'Forum', icon: MessageSquare, always: false });
  }
  if (perms.can_moderate_jobs || perms.can_post_job_offers) {
    items.push({ path: '/moderator/jobs', label: "Offres d'emploi", icon: Briefcase, always: false });
  }
  if (perms.can_manage_support) {
    items.push({ path: '/moderator/support', label: 'Support', icon: HelpCircle, always: false });
  }
  if (perms.can_view_analytics) {
    items.push({ path: '/moderator/analytics', label: 'Analytique', icon: BarChart2, always: false });
  }
  return items;
}

export function ModerateurLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [navItems, setNavItems] = useState<ReturnType<typeof buildModNav> | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isPreview = searchParams.get('preview') === 'true';
    const stored = localStorage.getItem('omnia_user');
    // Mode aperçu Super-admin : bypass total
    if (isPreview && stored) {
      try {
        const u = JSON.parse(stored);
        if (u?.roles?.includes('super_admin')) {
          setNavItems(buildModNav({
            can_see_pending_courses: true, can_validate_course_price: true,
            can_reject_course: true, can_transmit_course_to_admin: true,
            can_validate_professor_kyc: true, can_validate_establishment_kyc: true,
            can_see_learners_list: true, can_see_professors_list: true,
            can_suspend_account: true, can_moderate_forum: true,
            can_post_job_offers: true, can_moderate_jobs: true,
            can_manage_support: true, can_view_moderation_log: true,
            can_view_analytics: true, can_view_financial_summary: true,
          }));
          return;
        }
      } catch { /* ignore */ }
    }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { navigate(isPreview ? '/admin/dashboard' : '/connexion'); return; }

    const cached = localStorage.getItem('mod_perms');
    if (cached) {
      try {
        const perms = JSON.parse(cached) as ModPerms;
        setNavItems(buildModNav(perms));
        return;
      } catch { /* fetch fresh */ }
    }

    fetch(ENDPOINTS.dashboardModerateur, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.permissions) {
          localStorage.setItem('mod_perms', JSON.stringify(data.permissions));
          setNavItems(buildModNav(data.permissions as ModPerms));
        } else {
          navigate(isPreview ? '/admin/dashboard' : '/connexion');
        }
      })
      .catch(() => navigate(isPreview ? '/admin/dashboard' : '/connexion'));
  }, [navigate]);

  if (!navItems) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: '#002050' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }} />
          <p className="text-white/60 text-sm">Chargement des permissions…</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout role="moderateur" navItems={navItems}>
      {children}
    </DashboardLayout>
  );
}
