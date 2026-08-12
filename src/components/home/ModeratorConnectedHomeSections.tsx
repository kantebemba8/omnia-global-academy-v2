import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HelpCircle,
  MessageSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { getSessionToken } from '../../lib/session';
import {
  MODERATOR_PERMISSION_KEYS,
  MODERATOR_PERMISSION_SECTIONS,
  normalizeModeratorPermissions,
  type ModeratorPermissions,
} from '../../lib/moderatorPermissions';

type Props = {
  previewMode: boolean;
  onPermissionsLoaded?: (permissions: ModeratorPermissions) => void;
};

type KPI = { key: string; label: string; value: number };
type QueueItem = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  priority_label: string;
  link: string;
};
type LogItem = { id: string; action_type: string; target_type: string; created_at: string };

type DashboardData = {
  permissions: ModeratorPermissions;
  kpis: KPI[];
  priority_queue: QueueItem[];
  todays_decisions: LogItem[];
  has_any_permission: boolean;
};

type Workspace = {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
  enabled: boolean;
};

type Recommendation = {
  title: string;
  description: string;
  path: string;
  label: string;
  icon: LucideIcon;
};

const SLATE = '#23364D';

const TYPE_META: Record<string, { label: string; accent: string; icon: LucideIcon }> = {
  course: { label: 'Formation', accent: '#315B8A', icon: BookOpen },
  kyc_prof: { label: 'Identité', accent: '#1E7A52', icon: ShieldCheck },
  job: { label: 'Emploi', accent: '#A66E16', icon: Briefcase },
  forum: { label: 'Communauté', accent: '#C45B24', icon: MessageSquare },
  support: { label: 'Support', accent: '#6957A5', icon: HelpCircle },
};

const KPI_META: Record<string, { icon: LucideIcon; path: string; accent: string }> = {
  courses: { icon: BookOpen, path: '/moderator/courses', accent: '#315B8A' },
  professor_kyc: { icon: ShieldCheck, path: '/moderator/kyc', accent: '#1E7A52' },
  learners: { icon: Users, path: '/moderator/users', accent: '#6A59A7' },
  professors: { icon: Users, path: '/moderator/users', accent: '#9A6B22' },
  forum: { icon: MessageSquare, path: '/moderator/forum', accent: '#C45B24' },
  jobs: { icon: Briefcase, path: '/moderator/jobs', accent: '#A66E16' },
  support: { icon: HelpCircle, path: '/moderator/support', accent: '#6957A5' },
};

const ACTION_LABELS: Record<string, string> = {
  course_approved: 'Formation approuvée',
  course_rejected: 'Formation rejetée',
  course_transmitted: 'Formation transmise',
  kyc_approved: 'Identité vérifiée',
  kyc_rejected: 'Vérification d’identité refusée',
  account_suspended: 'Compte suspendu',
  account_reactivated: 'Compte réactivé',
  forum_post_removed: 'Publication masquée',
  forum_post_restored: 'Publication restaurée',
  job_approved: 'Offre approuvée',
  job_rejected: 'Offre rejetée',
};

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function numberValue(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: unknown) {
  return numberValue(value).toLocaleString('fr-FR');
}

function timeAgo(value?: string | null) {
  if (!value) return 'récemment';
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return 'récemment';
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function allPermissionsEnabled(): ModeratorPermissions {
  return Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, true])) as ModeratorPermissions;
}

function noPermissionsEnabled(): ModeratorPermissions {
  return Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, false])) as ModeratorPermissions;
}

function blankNormalData(): DashboardData {
  return { permissions: noPermissionsEnabled(), kpis: [], priority_queue: [], todays_decisions: [], has_any_permission: false };
}

function blankPreviewData(): DashboardData {
  const permissions = allPermissionsEnabled();
  return {
    permissions,
    kpis: [
      { key: 'courses', label: 'Formations en attente', value: 0 },
      { key: 'professor_kyc', label: 'Professeurs à vérifier', value: 0 },
      { key: 'forum', label: 'Signalements Communauté', value: 0 },
      { key: 'jobs', label: 'Offres à valider', value: 0 },
    ],
    priority_queue: [],
    todays_decisions: [],
    has_any_permission: true,
  };
}

function permissionEnabled(permissions: ModeratorPermissions, ...keys: Array<keyof ModeratorPermissions>) {
  return keys.some(key => Boolean(permissions[key]));
}

function buildWorkspaces(permissions: ModeratorPermissions): Workspace[] {
  return [
    {
      label: 'Formations', description: 'Contrôle pédagogique, demandes de modification et transmission', path: '/moderator/courses', icon: BookOpen,
      accent: '#315B8A', soft: '#EEF4FB', enabled: permissionEnabled(permissions, 'can_see_pending_courses', 'can_review_course_content', 'can_request_course_modification', 'can_reject_course', 'can_recommend_course_price', 'can_approve_transmit_course'),
    },
    {
      label: 'Identité & comptes', description: 'Vérifications KYC et contrôles utilisateurs autorisés', path: '/moderator/kyc', icon: ShieldCheck,
      accent: '#1E7A52', soft: '#EAF7F0', enabled: permissionEnabled(permissions, 'can_validate_professor_kyc', 'can_see_learners_list', 'can_see_professors_list', 'can_request_account_suspension'),
    },
    {
      label: 'Communauté', description: 'Contenus, échanges et signalements du forum', path: '/moderator/forum', icon: MessageSquare,
      accent: '#C45B24', soft: '#FFF2E8', enabled: permissionEnabled(permissions, 'can_moderate_forum'),
    },
    {
      label: 'Emploi', description: 'Contrôle des offres soumises à modération', path: '/moderator/jobs', icon: Briefcase,
      accent: '#A66E16', soft: '#FFF7E6', enabled: permissionEnabled(permissions, 'can_moderate_jobs'),
    },
    {
      label: 'Omnia Live', description: 'Événements, organisateurs, signalements et remboursements à examiner', path: '/moderator/missions', icon: Radio,
      accent: '#6155A6', soft: '#F1EFFF', enabled: permissionEnabled(permissions, 'can_review_live_events', 'can_review_live_reports', 'can_review_live_refunds', 'can_review_live_organizers'),
    },
    {
      label: 'Missions', description: 'Structures, certifications, signalements et contrôles complémentaires', path: '/moderator/missions', icon: ClipboardCheck,
      accent: '#5F6C7B', soft: '#F2F4F7', enabled: permissionEnabled(permissions, 'can_manage_course_certifications', 'can_create_assisted_course', 'can_see_structures_list', 'can_see_organizers_list', 'can_validate_structure_kyc', 'can_view_ai_conversations', 'can_manage_reports', 'can_review_structure_requests', 'can_review_structure_codes'),
    },
    {
      label: 'Support', description: 'Demandes de support relevant de votre périmètre', path: '/moderator/support', icon: HelpCircle,
      accent: '#6957A5', soft: '#F1EFFF', enabled: permissionEnabled(permissions, 'can_manage_support'),
    },
    {
      label: 'Analytique', description: 'Indicateurs non financiers de votre activité de modération', path: '/moderator/analytics', icon: BarChart3,
      accent: '#296B75', soft: '#EAF6F7', enabled: permissionEnabled(permissions, 'can_view_analytics'),
    },
  ].filter(item => item.enabled);
}

function buildRecommendations(data: DashboardData, previewMode: boolean): Recommendation[] {
  if (previewMode) {
    return [{
      title: 'Aperçu des recommandations Modérateur',
      description: 'En utilisation réelle, cette zone se base sur la file de priorité, vos permissions et les contrôles réellement en attente.',
      path: '/moderator/dashboard', label: 'Voir le tableau de bord', icon: Sparkles,
    }];
  }

  const recommendations: Recommendation[] = [];
  const queue = data.priority_queue || [];
  const kpis = Object.fromEntries((data.kpis || []).map(kpi => [kpi.key, numberValue(kpi.value)]));

  if (!data.has_any_permission) {
    recommendations.push({
      title: 'Votre périmètre doit être configuré',
      description: 'Aucune permission de modération n’est actuellement active. Vos espaces resteront limités tant que l’Administration Omnia ne vous aura pas attribué de mission.',
      path: '/mon-profil', label: 'Voir mon profil', icon: ShieldCheck,
    });
    return recommendations;
  }

  if (queue.length > 0) {
    recommendations.push({
      title: 'Commencer par la file de priorité',
      description: `${queue.length} élément${queue.length > 1 ? 's demandent' : ' demande'} actuellement votre attention. Traitez d’abord les dossiers les plus urgents.`,
      path: queue[0]?.link || '/moderator/dashboard', label: 'Traiter la priorité', icon: Clock3,
    });
  }
  if (numberValue(kpis.courses) > 0) recommendations.push({
    title: 'Réduire l’attente sur les formations',
    description: `${formatNumber(kpis.courses)} formation${numberValue(kpis.courses) > 1 ? 's sont' : ' est'} en attente de contrôle dans votre périmètre.`,
    path: '/moderator/courses', label: 'Examiner les formations', icon: BookOpen,
  });
  if (numberValue(kpis.professor_kyc) > 0) recommendations.push({
    title: 'Finaliser les vérifications d’identité',
    description: `${formatNumber(kpis.professor_kyc)} dossier${numberValue(kpis.professor_kyc) > 1 ? 's professeur attendent' : ' professeur attend'} une vérification.`,
    path: '/moderator/kyc', label: 'Ouvrir les vérifications', icon: BadgeCheck,
  });
  if (numberValue(kpis.forum) > 0) recommendations.push({
    title: 'Traiter les signalements Communauté',
    description: `${formatNumber(kpis.forum)} signalement${numberValue(kpis.forum) > 1 ? 's sont' : ' est'} actuellement visible${numberValue(kpis.forum) > 1 ? 's' : ''} dans votre activité.`,
    path: '/moderator/forum', label: 'Ouvrir la modération', icon: MessageSquare,
  });
  if (numberValue(kpis.jobs) > 0) recommendations.push({
    title: 'Examiner les offres d’emploi',
    description: `${formatNumber(kpis.jobs)} offre${numberValue(kpis.jobs) > 1 ? 's attendent' : ' attend'} un contrôle avant la suite du processus.`,
    path: '/moderator/jobs', label: 'Contrôler les offres', icon: Briefcase,
  });
  if (numberValue(kpis.support) > 0) recommendations.push({
    title: 'Répondre au support attribué',
    description: `${formatNumber(kpis.support)} demande${numberValue(kpis.support) > 1 ? 's sont' : ' est'} actuellement en attente dans votre périmètre.`,
    path: '/moderator/support', label: 'Ouvrir le support', icon: HelpCircle,
  });

  if (!recommendations.length) recommendations.push({
    title: 'Votre file immédiate est à jour',
    description: 'Aucune priorité n’apparaît actuellement. Vous pouvez vérifier votre centre de missions ou consulter l’analytique si cette permission vous est attribuée.',
    path: '/moderator/missions', label: 'Voir mes missions', icon: CheckCircle2,
  });

  return recommendations.slice(0, 4);
}

function Hero({ data, loading, previewMode }: { data: DashboardData; loading: boolean; previewMode: boolean }) {
  const queue = data.priority_queue || [];
  const top = queue[0] || null;
  const activePermissions = MODERATOR_PERMISSION_KEYS.filter(key => data.permissions[key]).length;
  const decisions = data.todays_decisions?.length || 0;

  let eyebrow = 'File opérationnelle à jour';
  let title = 'Maintenir une plateforme fiable, contrôle après contrôle.';
  let description = 'Votre accueil Modérateur réunit vos priorités, votre périmètre actif et vos décisions récentes sans mélanger les outils de l’Administration Omnia.';
  let path = '/moderator/missions';
  let label = 'Ouvrir mes missions';

  if (top) {
    eyebrow = top.priority_label || 'Priorité à traiter';
    title = top.title;
    description = `${TYPE_META[top.type]?.label || 'Contrôle'} · ${timeAgo(top.created_at)} · cet élément apparaît en tête de votre file actuelle.`;
    path = top.link || '/moderator/dashboard';
    label = 'Traiter maintenant';
  } else if (!data.has_any_permission && !previewMode) {
    eyebrow = 'Périmètre non configuré';
    title = 'Vos missions de modération ne sont pas encore attribuées.';
    description = 'L’Administration Omnia doit activer au moins une permission avant que vos files et espaces de contrôle deviennent disponibles.';
    path = '/mon-profil';
    label = 'Voir mon profil';
  }

  return (
    <section className="relative overflow-hidden bg-[#14263B] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.065]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="absolute -right-52 -top-56 h-[650px] w-[650px] rounded-full border border-white/10" />
        <div className="absolute -right-16 -top-20 h-[420px] w-[420px] rounded-full border border-[#E09A55]/20" />
        <div className="absolute bottom-[-210px] right-[17%] h-[430px] w-[430px] rounded-full bg-[#C66A22]/20 blur-3xl" />
        <div className="absolute left-[38%] top-[26%] h-px w-[54%] -rotate-6 bg-gradient-to-r from-transparent via-[#E9B477]/35 to-transparent" />
      </div>

      <div className="relative mx-auto grid min-h-[520px] max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/55">
            <span className="h-2 w-2 rounded-full bg-[#E09A55] shadow-[0_0_0_5px_rgba(224,154,85,.12)]" />
            Centre de confiance
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[10px] tracking-[0.12em] text-[#F0C18C]">{activePermissions} permission{activePermissions > 1 ? 's' : ''} active{activePermissions > 1 ? 's' : ''}</span>
          </div>
          <h1 className="mt-6 max-w-[760px] text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.55rem]">Protéger la qualité sans perdre de vue la priorité.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/66 sm:text-lg">Une vue d’accueil opérationnelle pour savoir quoi examiner, où intervenir et ce qui a déjà été décidé aujourd’hui.</p>

          <div className="mt-9 max-w-2xl rounded-[28px] border border-white/12 bg-white/[0.06] p-5 shadow-[0_24px_80px_rgba(0,0,0,.17)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F0B777]">{previewMode ? 'Aperçu Modérateur' : loading ? 'Chargement de votre activité…' : eyebrow}</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-white sm:text-2xl">{previewMode ? 'Une priorité déterminée par les missions réelles' : title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">{previewMode ? 'En prévisualisation, les données privées ne sont pas chargées. La structure montre uniquement comment la file et les permissions organisent l’accueil.' : description}</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#C66A22]/25 text-[#F0B777]"><ShieldCheck size={22} /></span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link to={withPreview(path, previewMode)} className="inline-flex items-center gap-2 rounded-full bg-[#F0B777] px-5 py-2.5 text-xs font-black text-[#19283A] transition hover:-translate-y-0.5">{label}<ArrowRight size={14} /></Link>
              <span className="text-xs font-bold text-white/50">{decisions} décision{decisions > 1 ? 's' : ''} enregistrée{decisions > 1 ? 's' : ''} aujourd’hui</span>
            </div>
          </div>
        </div>

        <div className="relative min-h-[400px]">
          <div className="absolute inset-x-[8%] top-[8%] rounded-[30px] border border-white/10 bg-[#0D1D2D]/82 p-5 shadow-[0_36px_90px_rgba(0,0,0,.25)] backdrop-blur-sm sm:inset-x-[14%]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">File de traitement</p><p className="mt-1 text-lg font-black">{queue.length ? `${queue.length} élément${queue.length > 1 ? 's' : ''}` : 'Aucune urgence'}</p></div>
              <Clock3 size={20} className="text-[#E09A55]" />
            </div>
            <div className="mt-3 divide-y divide-white/10">
              {(queue.length ? queue.slice(0, 4) : [
                { id: 'empty-1', type: 'course', title: 'Formations à contrôler', created_at: '', priority_label: 'À jour', link: '/moderator/courses' },
                { id: 'empty-2', type: 'forum', title: 'Signalements Communauté', created_at: '', priority_label: 'À jour', link: '/moderator/forum' },
                { id: 'empty-3', type: 'job', title: 'Offres d’emploi', created_at: '', priority_label: 'À jour', link: '/moderator/jobs' },
              ]).map((item, index) => {
                const meta = TYPE_META[item.type] || { label: 'Contrôle', accent: '#9AA7B6', icon: ClipboardCheck };
                const Icon = meta.icon;
                return (
                  <div key={item.id || index} className="flex items-center gap-3 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.accent}24`, color: '#FFFFFF' }}><Icon size={16} /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-white/90">{item.title}</p><p className="mt-1 text-[11px] text-white/35">{queue.length ? `${meta.label} · ${timeAgo(item.created_at)}` : meta.label}</p></div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-black text-white/50">{item.priority_label || 'À traiter'}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute bottom-[4%] right-[4%] w-[46%] rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm sm:right-[8%]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Principe de décision</p>
            <p className="mt-2 text-sm font-black text-white">Examiner → décider → tracer</p>
            <p className="mt-2 text-xs leading-5 text-white/40">La publication finale reste du ressort de l’Administration Omnia lorsque le workflow l’exige.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ModeratorConnectedHomeSections({ previewMode, onPermissionsLoaded }: Props) {
  const [data, setData] = useState<DashboardData>(() => previewMode ? blankPreviewData() : blankNormalData());
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (previewMode) {
      const preview = blankPreviewData();
      setData(preview);
      onPermissionsLoaded?.(preview.permissions);
      setLoading(false);
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }

    let active = true;
    fetch(ENDPOINTS.dashboardModerateur, { headers: edgeAuthHeaders() })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || 'Accueil Modérateur indisponible.');
        return payload;
      })
      .then(payload => {
        if (!active) return;
        const permissions = normalizeModeratorPermissions(payload.permissions);
        const next: DashboardData = {
          permissions,
          kpis: Array.isArray(payload.kpis) ? payload.kpis : [],
          priority_queue: Array.isArray(payload.priority_queue) ? payload.priority_queue : [],
          todays_decisions: Array.isArray(payload.todays_decisions) ? payload.todays_decisions : [],
          has_any_permission: MODERATOR_PERMISSION_KEYS.some(key => permissions[key]),
        };
        localStorage.setItem('mod_perms', JSON.stringify(permissions));
        setData(next);
        onPermissionsLoaded?.(permissions);
      })
      .catch(requestError => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : 'Accueil Modérateur indisponible.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [previewMode, onPermissionsLoaded]);

  const workspaces = useMemo(() => buildWorkspaces(data.permissions), [data.permissions]);
  const recommendations = useMemo(() => buildRecommendations(data, previewMode), [data, previewMode]);
  const visibleKpis = useMemo(() => [...(data.kpis || [])].slice(0, 4), [data.kpis]);
  const activeSections = useMemo(() => MODERATOR_PERMISSION_SECTIONS.map(section => ({
    ...section,
    activeCount: section.permissions.filter(permission => data.permissions[permission.key]).length,
  })).filter(section => section.activeCount > 0), [data.permissions]);

  return (
    <>
      <Hero data={data} loading={loading} previewMode={previewMode} />

      {error && !previewMode && (
        <section className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-5 py-4 text-sm text-amber-800 sm:px-6 lg:px-8"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><strong>Informations de modération indisponibles.</strong><p className="mt-1 text-xs leading-5 text-amber-700">{error} Les accès existants restent disponibles via vos pages de modération.</p></div></div>
        </section>
      )}

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">Vos espaces de contrôle</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Aller directement là où vous devez intervenir.</h2></div>
            <p className="max-w-xl text-sm leading-6 text-slate-500">Cette bande n’affiche que les domaines compatibles avec vos permissions. Les sous-fonctions restent dans leurs pages dédiées afin d’éviter les doublons.</p>
          </div>

          {workspaces.length > 0 ? (
            <div className="mt-7 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {workspaces.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.label}-${item.path}`} to={withPreview(item.path, previewMode)} className="group min-w-[220px] flex-1 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,32,80,.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,32,80,.08)]">
                    <div className="flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: item.soft, color: item.accent }}><Icon size={18} /></span><ArrowRight size={15} className="mt-1 text-slate-300 transition group-hover:translate-x-1" /></div>
                    <h3 className="mt-5 text-sm font-black text-[#002050]">{item.label}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 border-y border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-800">Aucun espace de contrôle n’est actuellement activé pour votre compte.</div>
          )}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#F7F9FC]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">Situation actuelle</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Lire la charge avant d’ouvrir un dossier.</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">Les indicateurs proviennent du tableau de bord Modérateur existant et restent limités à votre périmètre.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[24px] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
              {(visibleKpis.length ? visibleKpis : [
                { key: 'courses', label: 'Formations en attente', value: 0 },
                { key: 'professor_kyc', label: 'Professeurs à vérifier', value: 0 },
                { key: 'forum', label: 'Signalements Communauté', value: 0 },
                { key: 'jobs', label: 'Offres à valider', value: 0 },
              ]).map(kpi => {
                const meta = KPI_META[kpi.key] || { icon: ClipboardCheck, path: '/moderator/dashboard', accent: SLATE };
                const Icon = meta.icon;
                return (
                  <Link key={kpi.key} to={withPreview(meta.path, previewMode)} className="group bg-white p-5 transition hover:bg-slate-50">
                    <div className="flex items-center justify-between"><Icon size={18} style={{ color: meta.accent }} /><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1" /></div>
                    <div className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#002050]">{formatNumber(kpi.value)}</div>
                    <div className="mt-2 text-xs font-bold leading-5 text-slate-500">{kpi.label}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr]">
            <div>
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">À traiter maintenant</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Votre file de priorité</h2></div><Link to={withPreview('/moderator/dashboard', previewMode)} className="text-xs font-black text-[#002050] hover:underline">Voir le tableau de bord</Link></div>
              <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
                {(data.priority_queue || []).length ? data.priority_queue.slice(0, 6).map(item => {
                  const meta = TYPE_META[item.type] || { label: 'Contrôle', accent: SLATE, icon: ClipboardCheck };
                  const Icon = meta.icon;
                  return (
                    <Link key={item.id} to={withPreview(item.link || '/moderator/dashboard', previewMode)} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.accent}12`, color: meta.accent }}><Icon size={17} /></span>
                      <div className="min-w-0"><div className="truncate text-sm font-black text-[#002050]">{item.title}</div><div className="mt-1 text-xs text-slate-500">{meta.label} · {timeAgo(item.created_at)}</div></div>
                      <div className="flex items-center gap-3"><span className="hidden rounded-full px-2.5 py-1 text-[10px] font-black sm:inline" style={{ backgroundColor: `${meta.accent}10`, color: meta.accent }}>{item.priority_label}</span><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" /></div>
                    </Link>
                  );
                }) : (
                  <div className="flex items-center gap-4 py-8"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF7F0] text-[#1E7A52]"><CheckCircle2 size={19} /></span><div><p className="text-sm font-black text-[#002050]">Aucune priorité immédiate</p><p className="mt-1 text-xs leading-5 text-slate-500">Votre file actuelle ne contient aucun élément prioritaire.</p></div></div>
                )}
              </div>
            </div>

            <div className="rounded-[26px] bg-[#F7F9FC] p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#1E7A52]">Traçabilité</p><h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#002050]">Décisions aujourd’hui</h2></div><CheckCircle2 size={20} className="text-[#1E7A52]" /></div>
              <div className="mt-5 divide-y divide-slate-200">
                {(data.todays_decisions || []).length ? data.todays_decisions.slice(0, 6).map(log => (
                  <div key={log.id} className="flex items-center gap-3 py-3.5"><span className="h-2 w-2 rounded-full bg-[#1E7A52]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#002050]">{ACTION_LABELS[log.action_type] || log.action_type?.replace(/_/g, ' ') || 'Décision enregistrée'}</p><p className="mt-1 text-xs text-slate-400">{timeAgo(log.created_at)}</p></div></div>
                )) : <p className="py-7 text-sm leading-6 text-slate-500">Aucune décision n’est encore enregistrée aujourd’hui dans votre activité.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#F7F9FC]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">Votre périmètre actif</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Des permissions lisibles, pas un menu rempli inutilement.</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">Chaque domaine ci-contre correspond aux permissions réellement attribuées à votre compte. Aucun accès non autorisé n’est ajouté à la homepage.</p>
              <Link to={withPreview('/moderator/missions', previewMode)} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#002050] hover:underline">Ouvrir le centre de missions <ArrowRight size={15} /></Link>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {activeSections.length ? activeSections.map(section => (
                <div key={section.id} className="flex items-center gap-4 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#C66A22] shadow-sm"><ClipboardCheck size={17} /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-[#002050]">{section.title}</p><p className="mt-1 text-xs text-slate-500">{section.activeCount} permission{section.activeCount > 1 ? 's' : ''} active{section.activeCount > 1 ? 's' : ''}</p></div><span className="text-lg font-black text-slate-300">{String(section.activeCount).padStart(2, '0')}</span></div>
              )) : <div className="py-8 text-sm text-slate-500">Aucun domaine de modération n’est actuellement actif.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
          <div className="mb-7 max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">Améliorer votre activité</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Des propositions liées à votre charge réelle.</h2><p className="mt-3 text-sm leading-7 text-slate-600">Ces suggestions ne créent aucune nouvelle fonction : elles redirigent vers les espaces déjà disponibles selon vos données et permissions.</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map(item => {
              const Icon = item.icon;
              return <Link key={`${item.title}-${item.path}`} to={withPreview(item.path, previewMode)} className="group rounded-[24px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,32,80,.07)]"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF2E8] text-[#C66A22]"><Icon size={19} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-black text-[#002050]">{item.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#002050]">{item.label}<ArrowRight size={13} className="transition group-hover:translate-x-1" /></span></div></div></Link>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#14263B] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#E5A55F]" /><div><p className="text-sm font-black">Règle de gouvernance</p><p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">Le rôle Modérateur contrôle, recommande et transmet selon les permissions attribuées. Il ne remplace pas les décisions finales réservées à l’Administration Omnia.</p></div></div>
          <Link to={withPreview('/moderator/missions', previewMode)} className="inline-flex shrink-0 items-center gap-2 text-xs font-black text-[#F0B777] hover:underline">Consulter mes missions <ArrowRight size={13} /></Link>
        </div>
      </section>
    </>
  );
}
