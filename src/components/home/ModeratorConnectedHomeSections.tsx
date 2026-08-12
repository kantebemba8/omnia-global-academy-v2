import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
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
type QueueItem = { id: string; type: string; title: string; created_at: string; priority_label: string; link: string };
type LogItem = { id: string; action_type: string; target_type: string; created_at: string };
type DashboardData = {
  permissions: ModeratorPermissions;
  kpis: KPI[];
  priority_queue: QueueItem[];
  todays_decisions: LogItem[];
  has_any_permission: boolean;
};

type Workspace = { label: string; description: string; path: string; icon: LucideIcon; accent: string; soft: string };
type Action = { title: string; description: string; path: string; label: string; icon: LucideIcon; accent: string };

const BLUE = '#002050';
const SLATE = '#26384D';
const AMBER = '#C66A22';
const GREEN = '#1E7A52';

const TYPE_META: Record<string, { label: string; accent: string; icon: LucideIcon }> = {
  course: { label: 'Formation', accent: '#315B8A', icon: BookOpen },
  kyc_prof: { label: 'Identité', accent: GREEN, icon: ShieldCheck },
  job: { label: 'Emploi', accent: '#A66E16', icon: Briefcase },
  forum: { label: 'Communauté', accent: '#C45B24', icon: MessageSquare },
  support: { label: 'Support', accent: '#6957A5', icon: HelpCircle },
};

const KPI_META: Record<string, { path: string; icon: LucideIcon; accent: string }> = {
  courses: { path: '/moderator/courses', icon: BookOpen, accent: '#315B8A' },
  professor_kyc: { path: '/moderator/kyc', icon: ShieldCheck, accent: GREEN },
  learners: { path: '/moderator/users', icon: Users, accent: '#6A59A7' },
  professors: { path: '/moderator/users', icon: Users, accent: '#9A6B22' },
  forum: { path: '/moderator/forum', icon: MessageSquare, accent: '#C45B24' },
  jobs: { path: '/moderator/jobs', icon: Briefcase, accent: '#A66E16' },
  support: { path: '/moderator/support', icon: HelpCircle, accent: '#6957A5' },
};

const ACTION_LABELS: Record<string, string> = {
  course_approved: 'Formation approuvée', course_rejected: 'Formation rejetée', course_transmitted: 'Formation transmise',
  kyc_approved: 'Identité vérifiée', kyc_rejected: 'Vérification d’identité refusée', account_suspended: 'Compte suspendu',
  account_reactivated: 'Compte réactivé', forum_post_removed: 'Publication masquée', forum_post_restored: 'Publication restaurée',
  job_approved: 'Offre approuvée', job_rejected: 'Offre rejetée',
};

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) { return n(value).toLocaleString('fr-FR'); }

function timeAgo(value?: string | null) {
  if (!value) return 'À l’instant';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'À l’instant';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

function blankPermissions(enabled: boolean) {
  return Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, enabled])) as ModeratorPermissions;
}

function blankData(previewMode: boolean): DashboardData {
  const permissions = blankPermissions(previewMode);
  return { permissions, kpis: [], priority_queue: [], todays_decisions: [], has_any_permission: previewMode };
}

function buildWorkspaces(p: ModeratorPermissions): Workspace[] {
  const rows: Array<Workspace & { enabled: boolean }> = [
    { label: 'Formations', description: 'Contrôle pédagogique et validation', path: '/formations', icon: BookOpen, accent: '#315B8A', soft: '#EDF4FC', enabled: p.can_see_pending_courses || p.can_review_course_content || p.can_request_course_modification || p.can_reject_course || p.can_recommend_course_price || p.can_approve_transmit_course },
    { label: 'Identité & comptes', description: 'Vérifications et périmètre utilisateurs', path: p.can_validate_professor_kyc ? '/moderator/kyc' : '/moderator/users', icon: ShieldCheck, accent: GREEN, soft: '#EAF7F0', enabled: p.can_validate_professor_kyc || p.can_validate_structure_kyc || p.can_see_learners_list || p.can_see_professors_list || p.can_request_account_suspension },
    { label: 'Communauté', description: 'Signalements et contenus', path: '/moderator/forum', icon: MessageSquare, accent: '#C45B24', soft: '#FFF2E8', enabled: p.can_moderate_forum },
    { label: 'Emploi', description: 'Offres soumises au contrôle', path: '/moderator/jobs', icon: Briefcase, accent: '#A66E16', soft: '#FFF7E6', enabled: p.can_moderate_jobs },
    { label: 'Omnia Live', description: 'Événements, signalements et demandes', path: '/moderator/missions', icon: Radio, accent: '#6556B5', soft: '#F0EEFF', enabled: p.can_review_live_events || p.can_review_live_reports || p.can_review_live_refunds || p.can_review_live_organizers },
    { label: 'Missions', description: 'Contrôles transversaux autorisés', path: '/moderator/missions', icon: ClipboardCheck, accent: '#536579', soft: '#EEF2F6', enabled: p.can_manage_reports || p.can_review_structure_requests || p.can_review_structure_codes || p.can_create_assisted_course || p.can_manage_course_certifications },
    { label: 'Support', description: 'Demandes et assistance', path: '/moderator/support', icon: HelpCircle, accent: '#6957A5', soft: '#F2EFFA', enabled: p.can_manage_support },
    { label: 'Analytique', description: 'Statistiques non financières', path: '/moderator/analytics', icon: BarChart3, accent: '#28727E', soft: '#ECF7F8', enabled: p.can_view_analytics },
  ];
  return rows.filter(item => item.enabled).map(({ enabled: _enabled, ...item }) => item);
}

function buildActions(data: DashboardData, previewMode: boolean): Action[] {
  if (previewMode) return [{ title: 'Qualité de décision', description: 'En utilisation réelle, ces recommandations dépendent de la file, des permissions et des décisions déjà enregistrées.', path: '/moderator/missions', label: 'Voir mes missions', icon: ShieldCheck, accent: GREEN }];
  const p = data.permissions;
  const queue = data.priority_queue || [];
  const actions: Action[] = [];
  const urgent = queue.filter(item => /urgent|critique|haute|high/i.test(item.priority_label || ''));
  if (urgent.length) actions.push({ title: 'Réduire d’abord la file la plus sensible', description: `${urgent.length} dossier${urgent.length > 1 ? 's portent' : ' porte'} une priorité élevée dans votre file actuelle.`, path: urgent[0]?.link || '/moderator/missions', label: 'Ouvrir la priorité', icon: AlertTriangle, accent: '#C44259' });
  if (queue.length >= 8) actions.push({ title: 'Éviter l’accumulation de dossiers', description: `${queue.length} éléments apparaissent dans la file prioritaire. Traiter un domaine à la fois peut rendre la décision plus lisible.`, path: '/moderator/missions', label: 'Voir la file complète', icon: ClipboardCheck, accent: AMBER });
  if (p.can_see_pending_courses && (data.kpis.find(k => k.key === 'courses')?.value || 0) > 0) actions.push({ title: 'Stabiliser la file pédagogique', description: 'Des formations attendent un contrôle. Commencez par les soumissions les plus anciennes ou les plus prioritaires.', path: '/moderator/courses', label: 'Contrôler les formations', icon: BookOpen, accent: '#315B8A' });
  if (p.can_validate_professor_kyc && (data.kpis.find(k => k.key === 'professor_kyc')?.value || 0) > 0) actions.push({ title: 'Sécuriser les vérifications d’identité', description: 'Des dossiers d’identité sont en attente. Vérifiez les pièces avant toute recommandation finale.', path: '/moderator/kyc', label: 'Ouvrir les vérifications', icon: ShieldCheck, accent: GREEN });
  if (p.can_moderate_forum && (data.kpis.find(k => k.key === 'forum')?.value || 0) > 0) actions.push({ title: 'Ramener la Communauté à une file saine', description: 'Des contenus ou signalements Communauté attendent votre intervention.', path: '/moderator/forum', label: 'Traiter la Communauté', icon: MessageSquare, accent: '#C45B24' });
  if (!data.todays_decisions.length && queue.length) actions.push({ title: 'Faire progresser au moins une décision', description: 'La file contient des dossiers mais aucune décision n’est encore enregistrée aujourd’hui.', path: queue[0]?.link || '/moderator/missions', label: 'Commencer un dossier', icon: CheckCircle2, accent: '#536579' });
  if (!actions.length) actions.push({ title: 'Maintenir une file propre', description: 'Aucune alerte particulière n’est détectée. Vous pouvez contrôler les nouvelles entrées ou consulter vos missions actives.', path: '/moderator/missions', label: 'Voir mes missions', icon: Sparkles, accent: GREEN });
  return actions.slice(0, 4);
}

function TrustHero({ data, loading, previewMode }: { data: DashboardData; loading: boolean; previewMode: boolean }) {
  const queue = data.priority_queue || [];
  const top = queue.slice(0, 3);
  const first = top[0];
  const activeDomains = MODERATOR_PERMISSION_SECTIONS.filter(section => section.permissions.some(permission => data.permissions[permission.key])).length;
  return <section className="relative overflow-hidden bg-[#172536] text-white"><div className="pointer-events-none absolute inset-0" aria-hidden="true"><div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '46px 46px' }}/><div className="absolute -right-40 -top-56 h-[600px] w-[600px] rounded-full border border-[#C66A22]/20"/><div className="absolute bottom-[-200px] left-[18%] h-[380px] w-[380px] rounded-full bg-[#315B8A]/20 blur-3xl"/></div><div className="relative mx-auto grid min-h-[520px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-16"><div><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#F0A05E]"><ShieldCheck size={15}/> Centre de confiance</p><h1 className="mt-5 max-w-[680px] text-4xl font-black leading-[1.01] tracking-[-0.05em] sm:text-5xl lg:text-[3.7rem]">Voir la priorité avant de voir le volume.</h1><p className="mt-6 max-w-xl text-base leading-7 text-white/62 sm:text-lg">Votre accueil Modérateur résume uniquement les dossiers, décisions et domaines que vos permissions vous autorisent à traiter.</p><div className="mt-8 flex flex-wrap gap-3"><Link to={withPreview(first?.link || '/moderator/missions', previewMode)} className="inline-flex items-center gap-2 rounded-xl bg-[#F0A05E] px-5 py-3 text-sm font-black text-[#172536]">{previewMode ? 'Explorer la modération' : first ? 'Traiter la priorité' : 'Ouvrir ma file'}<ArrowRight size={16}/></Link><Link to={withPreview('/moderator/missions', previewMode)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-black">Mes missions<ClipboardCheck size={16}/></Link></div><div className="mt-8 flex gap-7 text-xs text-white/48"><span><strong className="block text-xl font-black text-white">{loading ? '…' : formatNumber(queue.length)}</strong>dossiers prioritaires</span><span><strong className="block text-xl font-black text-white">{previewMode ? '—' : formatNumber(data.todays_decisions.length)}</strong>décisions aujourd’hui</span><span><strong className="block text-xl font-black text-white">{formatNumber(activeDomains)}</strong>domaines actifs</span></div></div><div className="relative"><div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/45"><span>File prioritaire</span><span>Trust & Safety</span></div><div className="space-y-3">{previewMode ? [0,1,2].map((i)=><div key={i} className="grid grid-cols-[42px_1fr_72px] items-center gap-4 rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-4"><span className="text-sm font-black text-[#F0A05E]">0{i+1}</span><span><strong className="block text-sm text-white">Dossier de prévisualisation</strong><span className="mt-1 block text-xs text-white/40">Les données privées sont masquées</span></span><span className="rounded-full border border-white/10 px-2 py-1 text-center text-[9px] font-black text-white/45">APERÇU</span></div>) : top.length ? top.map((item,index)=>{const meta=TYPE_META[item.type]||{label:'Contrôle',accent:'#8AA1B8',icon:ClipboardCheck};return <Link key={item.id} to={item.link || '/moderator/missions'} className="group grid grid-cols-[42px_1fr_82px] items-center gap-4 rounded-[18px] border border-white/10 bg-white/[0.055] px-4 py-4 transition hover:bg-white/[0.09]"><span className="text-sm font-black text-[#F0A05E]">0{index+1}</span><span className="min-w-0"><strong className="block truncate text-sm text-white">{item.title}</strong><span className="mt-1 block text-xs text-white/40">{meta.label} · {timeAgo(item.created_at)}</span></span><span className="rounded-full px-2 py-1 text-center text-[9px] font-black" style={{background:`${meta.accent}28`,color:'#fff'}}>{item.priority_label || 'À traiter'}</span></Link>}) : <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-300/[0.07] px-5 py-8"><CheckCircle2 size={22} className="text-[#7CD6AD]"/><strong className="mt-4 block text-lg text-white">File prioritaire vide</strong><p className="mt-2 text-sm leading-6 text-white/45">Les nouvelles entrées apparaîtront ici automatiquement.</p></div>}</div></div></div></section>;
}

function Workspaces({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const workspaces = buildWorkspaces(data.permissions);
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">Votre périmètre</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Des accès qui suivent vos permissions.</h2></div><p className="max-w-lg text-xs leading-5 text-slate-500">Aucun domaine non autorisé n’est ajouté, et les sous-menus restent dans leurs pages dédiées.</p></div>{workspaces.length ? <div className="mt-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{workspaces.map(space=>{const Icon=space.icon;return <Link key={`${space.label}-${space.path}`} to={withPreview(space.path,previewMode)} className="group min-w-[205px] flex-1 border-b-2 bg-white p-4 transition hover:bg-slate-50" style={{borderColor:space.accent}}><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{background:space.soft,color:space.accent}}><Icon size={18}/></span><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1"/></div><strong className="mt-4 block text-sm font-black text-[#002050]">{space.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{space.description}</span></Link>})}</div>:<div className="mt-6 border-y border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-800">Aucun espace de contrôle n’est actuellement activé.</div>}</div></section>;
}

function OperationalDigest({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const visibleKpis = (data.kpis || []).slice(0, 6);
  return <section className="bg-[#F6F8FB]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C66A22]">Résumé opérationnel</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Ce qui existe dans votre périmètre remonte ici.</h2></div><p className="max-w-xl text-sm leading-6 text-slate-500">Les volumes restent des résumés : le traitement détaillé continue dans les espaces de modération.</p></div>{visibleKpis.length ? <div className="mt-7 grid gap-px overflow-hidden rounded-[24px] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{visibleKpis.map(kpi=>{const meta=KPI_META[kpi.key]||{path:'/moderator/missions',icon:ClipboardCheck,accent:SLATE};const Icon=meta.icon;return <Link key={kpi.key} to={withPreview(meta.path,previewMode)} className="group bg-white p-5 transition hover:bg-slate-50"><div className="flex items-center justify-between"><Icon size={18} style={{color:meta.accent}}/><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1"/></div><div className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#002050]">{previewMode?'—':formatNumber(kpi.value)}</div><div className="mt-2 text-xs font-bold text-slate-500">{kpi.label}</div></Link>})}</div>:<div className="mt-7 rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-7 text-sm text-slate-500">Dès que votre périmètre contient des dossiers ou volumes mesurables, leur résumé apparaîtra automatiquement ici.</div>}<div className="mt-9 grid gap-8 lg:grid-cols-[1.12fr_0.88fr]"><div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#C66A22]">File en cours</p><h3 className="mt-1 text-xl font-black text-[#002050]">Dossiers à traiter</h3></div><ClipboardCheck size={19} className="text-[#C66A22]"/></div><div className="mt-5 divide-y divide-slate-100">{previewMode?<p className="py-7 text-sm text-slate-500">Les dossiers privés sont masqués dans l’aperçu.</p>:(data.priority_queue||[]).length?(data.priority_queue||[]).slice(0,6).map(item=>{const meta=TYPE_META[item.type]||{label:'Contrôle',accent:SLATE,icon:ClipboardCheck};const Icon=meta.icon;return <Link key={item.id} to={item.link||'/moderator/missions'} className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{background:`${meta.accent}12`,color:meta.accent}}><Icon size={16}/></span><span className="min-w-0"><strong className="block truncate text-sm font-black text-[#002050]">{item.title}</strong><span className="mt-1 block text-xs text-slate-500">{meta.label} · {timeAgo(item.created_at)}</span></span><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1"/></Link>}):<p className="py-7 text-sm text-slate-500">Aucun dossier prioritaire pour le moment.</p>}</div></div><div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#1E7A52]">Traçabilité</p><h3 className="mt-1 text-xl font-black text-[#002050]">Décisions du jour</h3></div><CheckCircle2 size={19} className="text-[#1E7A52]"/></div><div className="mt-5 divide-y divide-slate-100">{previewMode?<p className="py-7 text-sm text-slate-500">La traçabilité privée est masquée dans l’aperçu.</p>:(data.todays_decisions||[]).length?(data.todays_decisions||[]).slice(0,6).map(log=><div key={log.id} className="flex items-center gap-3 py-3.5"><span className="h-2 w-2 rounded-full bg-[#1E7A52]"/><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-bold text-[#002050]">{ACTION_LABELS[log.action_type]||log.action_type?.replace(/_/g,' ')||'Décision enregistrée'}</strong><span className="mt-1 block text-xs text-slate-400">{timeAgo(log.created_at)}</span></span></div>):<p className="py-7 text-sm text-slate-500">Aucune décision enregistrée aujourd’hui.</p>}</div></div></div></div></section>;
}

function QualityActions({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const actions = buildActions(data, previewMode);
  const activeSections = MODERATOR_PERMISSION_SECTIONS.map(section => ({ ...section, count: section.permissions.filter(permission => data.permissions[permission.key]).length })).filter(section => section.count > 0);
  return <section className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="grid gap-10 xl:grid-cols-[0.7fr_1.3fr]"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#1E7A52]">Qualité de décision</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Faire progresser la file sans perdre la qualité de décision.</h2><p className="mt-4 text-sm leading-7 text-slate-600">Les recommandations évoluent avec la charge réelle, vos permissions et les décisions déjà prises.</p>{activeSections.length>0&&<div className="mt-6 flex flex-wrap gap-2">{activeSections.map(section=><span key={section.id} className="rounded-full bg-[#F1F4F7] px-3 py-1.5 text-[10px] font-black text-slate-600">{section.title} · {section.count}</span>)}</div>}</div><div className="divide-y divide-slate-200 border-y border-slate-200">{actions.map(action=>{const Icon=action.icon;return <Link key={`${action.title}-${action.path}`} to={withPreview(action.path,previewMode)} className="group grid grid-cols-[auto_1fr_auto] gap-4 py-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{background:`${action.accent}12`,color:action.accent}}><Icon size={18}/></span><span><strong className="block text-sm font-black text-[#002050]">{action.title}</strong><span className="mt-1.5 block text-xs leading-5 text-slate-500">{action.description}</span><span className="mt-2 block text-xs font-black" style={{color:action.accent}}>{action.label}</span></span><ArrowRight size={15} className="mt-1 text-slate-300 transition group-hover:translate-x-1"/></Link>})}</div></div></div></section>;
}

export default function ModeratorConnectedHomeSections({ previewMode, onPermissionsLoaded }: Props) {
  const [data, setData] = useState<DashboardData>(() => blankData(previewMode));
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (previewMode) {
      const preview = blankData(true);
      setData(preview);
      onPermissionsLoaded?.(preview.permissions);
      setLoading(false);
      setError('');
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
        setError('');
      })
      .catch(requestError => { if (active) setError(requestError instanceof Error ? requestError.message : 'Accueil Modérateur indisponible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [previewMode, onPermissionsLoaded]);

  const hasContent = useMemo(() => Boolean(data.kpis.length || data.priority_queue.length || data.todays_decisions.length), [data]);

  return <>
    <TrustHero data={data} loading={loading} previewMode={previewMode}/>
    {error && !previewMode && <section className="border-b border-amber-200 bg-amber-50"><div className="mx-auto flex max-w-7xl items-start gap-3 px-5 py-4 text-sm text-amber-800 sm:px-6 lg:px-8"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><div><strong>Informations de modération indisponibles.</strong><p className="mt-1 text-xs leading-5 text-amber-700">{error} Les accès existants restent disponibles.</p></div></div></section>}
    <Workspaces data={data} previewMode={previewMode}/>
    <OperationalDigest data={data} previewMode={previewMode}/>
    {!previewMode && !loading && !hasContent && <section className="bg-[#F6F8FB]"><div className="mx-auto max-w-7xl px-5 pb-10 sm:px-6 lg:px-8"><div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-5 py-4 text-xs leading-5 text-slate-500">Dès que des dossiers, signalements ou décisions existent dans votre périmètre, leur résumé apparaîtra automatiquement sur cet accueil.</div></div></section>}
    <QualityActions data={data} previewMode={previewMode}/>
  </>;
}
