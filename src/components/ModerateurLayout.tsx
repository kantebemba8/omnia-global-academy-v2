import { getSessionToken } from '../lib/session';
import { ElementType, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  MessageSquare,
  Briefcase,
  HelpCircle,
  BarChart2,
  Shield,
  ClipboardCheck,
} from 'lucide-react';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import {
  MODERATOR_PERMISSION_KEYS,
  ModeratorPermissionKey,
  ModeratorPermissions,
  moderatorHasAnyPermission,
  normalizeModeratorPermissions,
} from '../lib/moderatorPermissions';

type ModeratorNavItem = {
  path: string;
  label: string;
  icon: ElementType;
  exact?: boolean;
};

type ModeratorNavGroup = {
  id: string;
  label: string;
  icon: ElementType;
  items: ModeratorNavItem[];
};

const COURSE_WORKSPACE_KEYS: ModeratorPermissionKey[] = [
  'can_see_pending_courses',
  'can_review_course_content',
  'can_request_course_modification',
  'can_reject_course',
  'can_recommend_course_price',
  'can_approve_transmit_course',
];

const USER_WORKSPACE_KEYS: ModeratorPermissionKey[] = [
  'can_see_learners_list',
  'can_see_professors_list',
  'can_request_account_suspension',
];

const COMPLEMENTARY_KEYS: ModeratorPermissionKey[] = [
  'can_manage_course_certifications',
  'can_create_assisted_course',
  'can_see_structures_list',
  'can_see_organizers_list',
  'can_validate_structure_kyc',
  'can_view_ai_conversations',
  'can_manage_reports',
  'can_review_live_events',
  'can_review_live_reports',
  'can_review_live_refunds',
  'can_review_live_organizers',
  'can_review_structure_requests',
  'can_review_structure_codes',
  'can_review_structure_benefits',
];

function buildModeratorNavGroups(permissions: ModeratorPermissions): ModeratorNavGroup[] {
  const groups: ModeratorNavGroup[] = [
    {
      id: 'dashboard',
      label: 'Accueil',
      icon: LayoutDashboard,
      items: [{ path: '/moderator/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
    },
  ];

  if (moderatorHasAnyPermission(permissions, COURSE_WORKSPACE_KEYS)) {
    groups.push({
      id: 'courses',
      label: 'Formations',
      icon: BookOpen,
      items: [{ path: '/moderator/courses', label: 'Contrôle des formations', icon: BookOpen }],
    });
  }

  const userItems: ModeratorNavItem[] = [];
  if (permissions.can_validate_professor_kyc) {
    userItems.push({ path: '/moderator/kyc', label: 'Validation KYC', icon: Shield });
  }
  if (moderatorHasAnyPermission(permissions, USER_WORKSPACE_KEYS)) {
    userItems.push({ path: '/moderator/users', label: 'Consultation utilisateurs', icon: Users });
  }
  if (userItems.length) {
    groups.push({ id: 'users', label: 'Utilisateurs & KYC', icon: Users, items: userItems });
  }

  const moderationItems: ModeratorNavItem[] = [];
  if (permissions.can_moderate_forum) {
    moderationItems.push({ path: '/moderator/forum', label: 'Communauté', icon: MessageSquare });
  }
  if (permissions.can_moderate_jobs) {
    moderationItems.push({ path: '/moderator/jobs', label: "Offres d'emploi", icon: Briefcase });
  }
  if (permissions.can_manage_support) {
    moderationItems.push({ path: '/moderator/support', label: 'Support', icon: HelpCircle });
  }
  if (moderationItems.length) {
    groups.push({ id: 'moderation', label: 'Modération & support', icon: MessageSquare, items: moderationItems });
  }

  if (moderatorHasAnyPermission(permissions, COMPLEMENTARY_KEYS)) {
    groups.push({
      id: 'missions',
      label: 'Contrôles complémentaires',
      icon: ClipboardCheck,
      items: [{ path: '/moderator/missions', label: 'Centre de missions', icon: ClipboardCheck }],
    });
  }

  if (permissions.can_view_analytics) {
    groups.push({
      id: 'analytics',
      label: 'Pilotage',
      icon: BarChart2,
      items: [{ path: '/moderator/analytics', label: 'Analytique', icon: BarChart2 }],
    });
  }

  return groups;
}

function allPermissionsEnabled(): ModeratorPermissions {
  return Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, true])) as ModeratorPermissions;
}

export function ModerateurLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [navGroups, setNavGroups] = useState<ModeratorNavGroup[] | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isPreview = searchParams.get('preview') === 'true';
    const stored = localStorage.getItem('omnia_user');

    if (isPreview && stored) {
      try {
        const user = JSON.parse(stored);
        if (user?.roles?.includes('super_admin')) {
          setNavGroups(buildModeratorNavGroups(allPermissionsEnabled()));
          return;
        }
      } catch {
        // Le mode normal vérifiera la session.
      }
    }

    if (!getSessionToken()) {
      navigate(isPreview ? '/admin/dashboard' : '/connexion', { replace: true });
      return;
    }

    const cached = localStorage.getItem('mod_perms');
    if (cached) {
      try {
        const normalized = normalizeModeratorPermissions(JSON.parse(cached));
        setNavGroups(buildModeratorNavGroups(normalized));
      } catch {
        localStorage.removeItem('mod_perms');
      }
    }

    fetch(ENDPOINTS.dashboardModerateur, { headers: edgeAuthHeaders() })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || payload.error || 'Permissions indisponibles');
        }
        return payload;
      })
      .then(payload => {
        if (!payload.permissions) throw new Error('Permissions absentes');
        const normalized = normalizeModeratorPermissions(payload.permissions);
        localStorage.setItem('mod_perms', JSON.stringify(normalized));
        setNavGroups(buildModeratorNavGroups(normalized));
      })
      .catch(() => navigate(isPreview ? '/admin/dashboard' : '/connexion', { replace: true }));
  }, [navigate]);

  if (!navGroups) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: '#002050' }}>
        <div className="text-center">
          <div
            className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-white/60">Chargement des permissions…</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout role="moderateur" navGroups={navGroups}>
      {children}
    </DashboardLayout>
  );
}
