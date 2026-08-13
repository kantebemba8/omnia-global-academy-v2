import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Eye, Flag, Send, ShieldCheck } from 'lucide-react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  MODERATOR_PERMISSION_KEYS,
  MODERATOR_PERMISSION_SECTIONS,
  ModeratorPermissions,
  normalizeModeratorPermissions,
} from '../../lib/moderatorPermissions';
import { getSessionToken } from '../../lib/session';

type Mission = {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  priority: string;
  status: string;
  starts_at: string;
  due_at?: string | null;
};

type Delegation = {
  id: string;
  permissions?: Record<string, boolean>;
  reason: string;
  starts_at: string;
  expires_at: string;
};

type Conflict = { id: string; target_type: string; target_id: string; reason: string; created_at: string };

type QueueItem = {
  id: string;
  target_type: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  created_at?: string | null;
  permission_key: string;
  decision_mode: 'read_only' | 'operational' | 'recommendation';
  metadata?: Record<string, unknown>;
};

type Recommendation = {
  id: string;
  target_type: string;
  target_id: string;
  recommendation: string;
  note?: string | null;
  status: string;
  created_at: string;
};

type DashboardData = {
  moderator?: { id?: string; full_name?: string } | null;
  profile?: { internal_title?: string; team_area?: string | null; primary_mission?: string | null } | null;
  permissions?: Record<string, boolean>;
  permanent_permissions?: Record<string, boolean>;
  delegations?: Delegation[];
  missions?: Mission[];
  conflicts?: Conflict[];
  control_queues?: Record<string, QueueItem[]>;
  review_recommendations?: Recommendation[];
};

function allPermissionsEnabled(): ModeratorPermissions {
  return Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, true])) as ModeratorPermissions;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function permissionLabel(key: string) {
  for (const section of MODERATOR_PERMISSION_SECTIONS) {
    const item = section.permissions.find(permission => permission.key === key);
    if (item) return item.label;
  }
  return key;
}

const queueLabels: Record<string, string> = {
  course_certifications: 'Certifications & badges',
  assisted_course_requests: 'Saisie assistée',
  structures: 'Structures',
  structure_codes: 'Codes Structure',
  organizers: 'Organisateurs Omnia Live',
  live_organizer_applications: 'Demandes Organisateur',
  live_events: 'Événements Omnia Live',
  live_reports: 'Signalements Omnia Live',
  live_refunds: 'Dossiers de remboursement',
  general_reports: 'Signalements généraux',
  ai_conversations: 'Conversations IA autorisées',
};

export default function ModerateurMissions() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; }
  })();
  const bypassAuth = isPreview && isSuperAdmin;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    if (bypassAuth) {
      setData({ permissions: allPermissionsEnabled(), permanent_permissions: allPermissionsEnabled(), missions: [], delegations: [], conflicts: [], control_queues: {}, review_recommendations: [] });
      setLoading(false);
      return;
    }
    if (!getSessionToken()) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(ENDPOINTS.dashboardModerateur, { headers: edgeAuthHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || 'Centre de missions indisponible.');
      setData(payload as DashboardData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Centre de missions indisponible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [bypassAuth]);

  const post = async (action: string, body: Record<string, unknown>, message: string) => {
    if (bypassAuth) return;
    setError('');
    try {
      const response = await fetch(ENDPOINTS.dashboardModerateur, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action, ...body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || 'Action impossible.');
      setToast(message);
      window.setTimeout(() => setToast(''), 3500);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
    }
  };

  const permissions = normalizeModeratorPermissions(data?.permissions || {});
  const permanentPermissions = normalizeModeratorPermissions(data?.permanent_permissions || {});
  const activeSections = useMemo(() => MODERATOR_PERMISSION_SECTIONS
    .map(section => ({ ...section, permissions: section.permissions.filter(permission => permissions[permission.key]) }))
    .filter(section => section.permissions.length > 0), [permissions]);
  const activeCount = MODERATOR_PERMISSION_KEYS.filter(key => permissions[key]).length;
  const permanentCount = MODERATOR_PERMISSION_KEYS.filter(key => permanentPermissions[key]).length;
  const queueGroups = Object.entries(data?.control_queues || {}).filter(([, items]) => items.length > 0);

  const recommend = async (item: QueueItem, recommendation: 'approve' | 'reject' | 'changes_requested' | 'reviewed' | 'escalate') => {
    const note = window.prompt('Note de contrôle / recommandation (facultatif) :') || '';
    await post('create_review_recommendation', { target_type: item.target_type, target_id: item.id, recommendation, note }, 'Recommandation transmise à l’Administration Omnia.');
  };

  const declareConflict = async (item: QueueItem) => {
    const reason = window.prompt('Expliquez brièvement le conflit d’intérêts :');
    if (!reason?.trim()) return;
    await post('declare_conflict', { target_type: item.target_type, target_id: item.id, reason }, 'Conflit d’intérêts déclaré. Le dossier est bloqué pour votre compte.');
  };

  if (loading) return <ModerateurLayout><div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div></ModerateurLayout>;

  return (
    <ModerateurLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {toast && <div className="fixed right-4 top-4 z-50 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">{toast}</div>}
        <header>
          <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Centre de missions</h1>
          <p className="mt-1 text-sm text-gray-500">Vos missions, autorisations effectives, délégations temporaires et files de contrôle sont regroupées ici.</p>
        </header>
        {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle size={18} className="mt-0.5" />{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold text-gray-500">Fonction interne</p><p className="mt-1 font-black text-[#002050]">{data?.profile?.internal_title || 'Modérateur'}</p><p className="text-xs text-gray-400">{data?.profile?.team_area || 'Équipe Omnia'}</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold text-gray-500">Permissions effectives</p><p className="mt-1 text-2xl font-black text-[#002050]">{activeCount}/27</p><p className="text-xs text-gray-400">{permanentCount} permanente(s)</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold text-gray-500">Missions ouvertes</p><p className="mt-1 text-2xl font-black text-[#002050]">{(data?.missions || []).filter(item => !['completed', 'cancelled'].includes(item.status)).length}</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold text-gray-500">Délégations actives</p><p className="mt-1 text-2xl font-black text-[#002050]">{(data?.delegations || []).length}</p></div>
        </div>

        {data?.profile?.primary_mission && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Mission principale</p><p className="mt-1 text-sm font-semibold text-[#002050]">{data.profile.primary_mission}</p></div>}

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2"><ClipboardCheck size={19} style={{ color: '#BF8813' }} /><h2 className="font-black text-[#002050]">Mes missions attribuées</h2></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{(data?.missions || []).length === 0 ? <p className="text-sm text-gray-500">Aucune mission attribuée actuellement.</p> : (data?.missions || []).map(mission => <article key={mission.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gray-800">{mission.title}</p><p className="mt-1 text-xs text-gray-500">{mission.domain || 'Général'} · priorité {mission.priority}</p></div><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold">{mission.status}</span></div>{mission.description && <p className="mt-2 text-sm text-gray-600">{mission.description}</p>}<p className="mt-2 flex items-center gap-1 text-xs text-gray-400"><Clock3 size={13} /> Échéance : {formatDate(mission.due_at)}</p>{!['completed', 'cancelled'].includes(mission.status) && !bypassAuth && <div className="mt-3 flex gap-2">{mission.status === 'todo' && <button onClick={() => void post('update_mission_status', { mission_id: mission.id, status: 'in_progress' }, 'Mission démarrée.')} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700">Commencer</button>}<button onClick={() => void post('update_mission_status', { mission_id: mission.id, status: 'completed' }, 'Mission terminée.')} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">Terminer</button></div>}</article>)}</div>
        </section>

        {(data?.delegations || []).length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5"><div className="flex items-center gap-2"><Clock3 size={19} className="text-amber-700" /><h2 className="font-black text-[#002050]">Mes délégations temporaires</h2></div><div className="mt-3 space-y-3">{(data?.delegations || []).map(item => <div key={item.id} className="rounded-lg bg-white p-3"><p className="text-sm font-bold text-amber-900">Expire le {formatDate(item.expires_at)}</p><p className="mt-1 text-xs text-gray-600">{item.reason}</p><p className="mt-1 text-[11px] text-gray-500">{Object.entries(item.permissions || {}).filter(([, enabled]) => enabled).map(([key]) => permissionLabel(key)).join(' · ')}</p></div>)}</div></section>}

        {queueGroups.length > 0 && <section className="space-y-4"><div><h2 className="text-lg font-black text-[#002050]">Files de contrôle</h2><p className="text-sm text-gray-500">Les actions directes sont limitées aux tâches opérationnelles. Les dossiers sensibles produisent une recommandation, jamais une décision finale.</p></div>{queueGroups.map(([queueKey, items]) => <div key={queueKey} className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3"><h3 className="font-bold text-[#002050]">{queueLabels[queueKey] || queueKey}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-600">{items.length}</span></div><div className="divide-y divide-gray-100">{items.map(item => <div key={`${item.target_type}:${item.id}`} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-gray-800">{item.title}</p>{item.status && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{item.status}</span>}</div>{item.subtitle && <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>}<p className="mt-1 text-[11px] text-gray-400">{permissionLabel(item.permission_key)} · {formatDate(item.created_at)}</p></div><div className="flex flex-wrap gap-2">{item.decision_mode === 'read_only' && <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"><Eye size={13} /> Consultation</span>}{item.target_type === 'assisted_course_request' && item.decision_mode === 'operational' && <>{String(item.metadata?.assigned_to || '') ? String(item.metadata?.assigned_to) === String(data?.moderator?.id || '') && <button onClick={() => void post('complete_assisted_request', { request_id: item.id }, 'Brouillon assisté transmis au propriétaire pour validation.')} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">Brouillon prêt</button> : <button onClick={() => void post('take_assisted_request', { request_id: item.id }, 'Saisie assistée prise en charge.')} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700">Prendre en charge</button>}</>}{item.target_type === 'forum_report' && item.decision_mode === 'operational' && <button onClick={() => void post('triage_forum_report', { report_id: item.id }, 'Signalement trié.')} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">Marquer examiné</button>}{item.decision_mode === 'recommendation' && <><button onClick={() => void recommend(item, 'approve')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700"><Send size={12} /> Recommander validation</button><button onClick={() => void recommend(item, 'changes_requested')} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">Demander correction</button><button onClick={() => void recommend(item, 'reject')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Recommander rejet</button></>} {item.decision_mode !== 'read_only' && <button onClick={() => void declareConflict(item)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600"><Flag size={12} /> Conflit</button>}</div></div>)}</div></div>)}</section>}

        {(data?.conflicts || []).length > 0 && <section className="rounded-xl border border-red-200 bg-red-50/40 p-5"><div className="flex items-center gap-2"><Flag size={18} className="text-red-700" /><h2 className="font-black text-[#002050]">Conflits d’intérêts déclarés</h2></div><div className="mt-3 space-y-2">{(data?.conflicts || []).map(item => <div key={item.id} className="rounded-lg bg-white p-3"><p className="text-sm font-bold text-red-800">{item.target_type} · {item.target_id}</p><p className="text-xs text-gray-600">{item.reason}</p></div>)}</div></section>}

        {(data?.review_recommendations || []).length > 0 && <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-black text-[#002050]">Mes recommandations transmises</h2><div className="mt-3 divide-y divide-gray-100">{(data?.review_recommendations || []).slice(0, 30).map(item => <div key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{item.target_type} · {item.recommendation}</p><span className="text-xs text-gray-400">{item.status}</span></div>{item.note && <p className="mt-1 text-xs text-gray-500">{item.note}</p>}</div>)}</div></section>}

        <section className="rounded-xl border border-gray-200 bg-white p-5"><div className="flex items-center gap-2"><ShieldCheck size={19} style={{ color: '#BF8813' }} /><h2 className="font-black text-[#002050]">Mes autorisations effectives</h2></div><div className="mt-4 space-y-4">{activeSections.map(section => <div key={section.id}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{section.title}</p><div className="grid gap-2 md:grid-cols-2">{section.permissions.map(permission => <div key={permission.key} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3"><CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" /><div><p className="text-xs font-bold text-gray-800">{permission.label}</p><p className="mt-1 text-[11px] leading-4 text-gray-500">{permission.description}</p>{!permanentPermissions[permission.key] && <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Délégation temporaire</span>}</div></div>)}</div></div>)}</div></section>
      </div>
    </ModerateurLayout>
  );
}
