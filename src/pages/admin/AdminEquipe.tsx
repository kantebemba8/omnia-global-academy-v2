import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Trash2,
  UserRoundCog,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { MODERATOR_PERMISSION_KEYS, MODERATOR_PERMISSION_SECTIONS } from '../../lib/moderatorPermissions';
import { getSessionToken } from '../../lib/session';

type PermissionMap = Record<string, boolean>;

type TeamProfile = {
  moderator_user_id?: string;
  internal_title?: string;
  team_area?: string | null;
  status?: 'active' | 'suspended' | 'ended';
  joined_at?: string;
  primary_mission?: string | null;
  admin_notes?: string | null;
};

type Mission = {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  starts_at: string;
  due_at?: string | null;
  created_at?: string;
};

type Delegation = {
  id: string;
  permissions?: PermissionMap;
  reason: string;
  starts_at: string;
  expires_at: string;
  status: 'active' | 'revoked';
};

type Conflict = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: 'active' | 'resolved';
  created_at: string;
};

type Moderator = {
  id: string;
  full_name?: string;
  email?: string;
  status?: string;
  last_login_at?: string | null;
  permissions?: PermissionMap;
  permissions_count?: number;
  team_profile?: TeamProfile | null;
  missions?: Mission[];
  delegations?: Delegation[];
  conflicts?: Conflict[];
};

type ActionRequest = {
  id: string;
  action_type: string;
  reason?: string | null;
  created_at: string;
  moderator?: { full_name?: string; email?: string } | null;
  target_user?: { id?: string; full_name?: string; email?: string } | null;
};

type ReviewRecommendation = {
  id: string;
  moderator_user_id: string;
  permission_key: string;
  target_type: string;
  target_id: string;
  recommendation: string;
  note?: string | null;
  created_at: string;
  moderator?: { full_name?: string; email?: string } | null;
};

type Invitation = {
  id: string;
  email: string;
  full_name?: string | null;
  internal_role?: string | null;
  permissions?: PermissionMap;
  created_at: string;
  expires_at: string;
};

type AuditRow = {
  id: string;
  actor_user_id: string;
  moderator_user_id?: string | null;
  action: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type OverviewResponse = {
  moderators?: Moderator[];
  requests?: ActionRequest[];
  invitations?: Invitation[];
  audit?: AuditRow[];
  recommendations?: ReviewRecommendation[];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const REQUEST_TIMEOUT_MS = 20_000;
const emptyPermissions = () => Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, false])) as PermissionMap;

function endpointCandidates() {
  const direct = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/admin-moderator-manage` : '';
  return Array.from(new Set([ENDPOINTS.adminModeratorManage, direct, '/api/admin-moderator-manage'].filter(Boolean)));
}

async function moderatorRequest<T>(action: string, init: RequestInit = {}): Promise<T> {
  if (!getSessionToken()) throw new Error('Votre session a expiré. Reconnectez-vous avant de continuer.');
  let lastError: unknown = null;
  for (const [index, endpoint] of endpointCandidates().entries()) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await fetch(`${endpoint}${separator}action=${encodeURIComponent(action)}`, {
        ...init,
        headers: edgeAuthHeaders(init.headers as Record<string, string> | undefined),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.ok) return payload as T;
      const message = String(payload.message || payload.error || `Erreur HTTP ${response.status}`);
      if (index < endpointCandidates().length - 1 && [404, 502, 503, 504].includes(response.status)) {
        lastError = new Error(message);
        continue;
      }
      throw new Error(message);
    } catch (error) {
      lastError = error;
      if (index < endpointCandidates().length - 1 && (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError'))) continue;
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Le service Équipe & Modérateurs met trop de temps à répondre.');
      if (error instanceof TypeError) throw new Error('Le service Équipe & Modérateurs est momentanément inaccessible.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Service indisponible.');
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

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    invitation_created: 'Invitation créée',
    invitation_revoked: 'Invitation annulée',
    member_joined: 'Entrée dans l’équipe',
    member_suspended: 'Accès suspendu',
    member_reactivated: 'Accès réactivé',
    member_ended: 'Fin de fonction',
    profile_updated: 'Fiche interne modifiée',
    permissions_updated: 'Permissions modifiées',
    mission_created: 'Mission attribuée',
    mission_status_updated: 'Mission mise à jour',
    delegation_created: 'Délégation créée',
    delegation_revoked: 'Délégation révoquée',
    conflict_resolved: 'Conflit résolu',
    moderator_request_reviewed: 'Demande sensible examinée',
    review_recommendation_reviewed: 'Recommandation examinée',
  };
  return labels[action] || action.replace(/_/g, ' ');
}

export default function AdminEquipe() {
  const [overview, setOverview] = useState<OverviewResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, PermissionMap>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, TeamProfile>>({});
  const [busyKey, setBusyKey] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [invite, setInvite] = useState({ full_name: '', email: '', internal_title: 'Modérateur', message: '' });
  const [invitePermissions, setInvitePermissions] = useState<PermissionMap>(emptyPermissions());
  const [missionTarget, setMissionTarget] = useState<string | null>(null);
  const [missionDraft, setMissionDraft] = useState({ title: '', description: '', domain: '', priority: 'normal', due_at: '' });
  const [delegationTarget, setDelegationTarget] = useState<string | null>(null);
  const [delegationDraft, setDelegationDraft] = useState({ reason: '', expires_at: '', permissions: emptyPermissions() });

  const moderators = overview.moderators || [];
  const invitations = overview.invitations || [];
  const requests = overview.requests || [];
  const recommendations = overview.recommendations || [];
  const audit = overview.audit || [];

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await moderatorRequest<OverviewResponse>('overview');
      setOverview(data);
      const nextPermissions: Record<string, PermissionMap> = {};
      const nextProfiles: Record<string, TeamProfile> = {};
      for (const moderator of data.moderators || []) {
        nextPermissions[moderator.id] = { ...emptyPermissions(), ...(moderator.permissions || {}) };
        nextProfiles[moderator.id] = {
          internal_title: moderator.team_profile?.internal_title || 'Modérateur',
          team_area: moderator.team_profile?.team_area || '',
          primary_mission: moderator.team_profile?.primary_mission || '',
          admin_notes: moderator.team_profile?.admin_notes || '',
        };
      }
      setPermissionDrafts(nextPermissions);
      setProfileDrafts(nextProfiles);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const stats = useMemo(() => ({
    active: moderators.filter(item => (item.team_profile?.status || 'active') === 'active').length,
    invitations: invitations.length,
    missions: moderators.flatMap(item => item.missions || []).filter(item => !['completed', 'cancelled'].includes(item.status)).length,
    delegations: moderators.flatMap(item => item.delegations || []).filter(item => item.status === 'active' && new Date(item.expires_at) > new Date()).length,
  }), [moderators, invitations]);

  const notify = (message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), 3500);
  };

  const post = async (action: string, body: Record<string, unknown>, successMessage: string) => {
    setBusyKey(`${action}:${String(body.moderator_id || body.mission_id || body.delegation_id || body.conflict_id || body.request_id || body.recommendation_id || body.invitation_id || '')}`);
    setError('');
    try {
      await moderatorRequest(action, { method: 'POST', body: JSON.stringify(body) });
      notify(successMessage);
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action impossible.');
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const saveProfile = async (moderatorId: string) => {
    const draft = profileDrafts[moderatorId] || {};
    await post('update_profile', { moderator_id: moderatorId, ...draft }, 'Fiche interne enregistrée.');
  };

  const savePermissions = async (moderatorId: string) => {
    const reason = window.prompt('Motif administratif de cette modification de permissions (facultatif) :') || '';
    await post('update_permissions', { moderator_id: moderatorId, permissions: permissionDrafts[moderatorId] || emptyPermissions(), reason }, 'Permissions enregistrées.');
  };

  const setMemberStatus = async (moderator: Moderator, status: 'active' | 'suspended') => {
    const reason = window.prompt(status === 'suspended' ? 'Motif de la suspension interne :' : 'Motif de la réactivation :');
    if (!reason?.trim()) return;
    await post('set_member_status', { moderator_id: moderator.id, status, reason }, status === 'suspended' ? 'Accès interne suspendu.' : 'Accès interne réactivé.');
  };

  const endMembership = async (moderator: Moderator) => {
    if (!window.confirm(`Mettre fin aux accès de ${moderator.full_name || moderator.email} ? Le compte utilisateur ne sera pas supprimé.`)) return;
    const reason = window.prompt('Motif de la fin de fonction :') || 'Fin de fonction décidée par l’Administration Omnia';
    await post('delete', { user_id: moderator.id, reason }, 'Fonction de modération terminée.');
  };

  const createMission = async () => {
    if (!missionTarget || !missionDraft.title.trim()) return;
    const ok = await post('create_mission', {
      moderator_id: missionTarget,
      title: missionDraft.title,
      description: missionDraft.description,
      domain: missionDraft.domain,
      priority: missionDraft.priority,
      due_at: missionDraft.due_at ? new Date(missionDraft.due_at).toISOString() : null,
    }, 'Mission attribuée.');
    if (ok) {
      setMissionTarget(null);
      setMissionDraft({ title: '', description: '', domain: '', priority: 'normal', due_at: '' });
    }
  };

  const createDelegation = async () => {
    if (!delegationTarget || !delegationDraft.reason.trim() || !delegationDraft.expires_at) return;
    const ok = await post('create_delegation', {
      moderator_id: delegationTarget,
      reason: delegationDraft.reason,
      permissions: delegationDraft.permissions,
      expires_at: new Date(delegationDraft.expires_at).toISOString(),
    }, 'Délégation temporaire créée.');
    if (ok) {
      setDelegationTarget(null);
      setDelegationDraft({ reason: '', expires_at: '', permissions: emptyPermissions() });
    }
  };

  const createInvitation = async () => {
    if (!invite.full_name.trim() || !invite.email.trim()) return;
    setBusyKey('create');
    setError('');
    try {
      const result = await moderatorRequest<{ invitation_url?: string; email_sent?: boolean }>('create', {
        method: 'POST',
        body: JSON.stringify({ ...invite, permissions: invitePermissions }),
      });
      setShareLink(!result.email_sent && result.invitation_url ? result.invitation_url : '');
      notify(result.email_sent ? 'Invitation envoyée.' : 'Invitation créée. Le lien personnel peut être transmis manuellement.');
      setShowInvite(false);
      setInvite({ full_name: '', email: '', internal_title: 'Modérateur', message: '' });
      setInvitePermissions(emptyPermissions());
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation impossible.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-1" size={30} style={{ color: '#002050' }} />
            <div>
              <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Équipe & Modérateurs</h1>
              <p className="mt-1 max-w-3xl text-sm text-gray-600">Gérez la fonction interne, les 27 permissions, les missions, les délégations temporaires, les conflits d’intérêts et l’historique de chaque membre.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050]"><RefreshCw size={16} /> Actualiser</button>
            <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}><Plus size={17} /> Inviter un membre</button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Membres actifs', value: stats.active, Icon: Users },
            { label: 'Invitations en attente', value: stats.invitations, Icon: Clock },
            { label: 'Missions ouvertes', value: stats.missions, Icon: Clock },
            { label: 'Délégations actives', value: stats.delegations, Icon: UserRoundCog },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-gray-600">{label}</p><Icon size={18} style={{ color: '#BF8813' }} /></div>
              <p className="mt-2 text-2xl font-black" style={{ color: '#002050' }}>{value}</p>
            </div>
          ))}
        </div>

        {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5" />{error}</div>}
        {success && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><Check size={18} />{success}</div>}
        {shareLink && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-[#002050]">Lien personnel d’invitation</p><div className="mt-2 flex gap-2"><input value={shareLink} readOnly className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs" /><button onClick={() => void navigator.clipboard.writeText(shareLink)} className="inline-flex items-center gap-2 rounded-lg bg-[#002050] px-3 py-2 text-xs font-bold text-white"><Copy size={14} /> Copier</button><button onClick={() => setShareLink('')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold">Masquer</button></div></div>}

        {invitations.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h2 className="font-bold text-[#002050]">Invitations en attente</h2>
          <div className="mt-3 divide-y divide-amber-200">
            {invitations.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{item.full_name || 'Personne invitée'} · {item.internal_role || 'Modérateur'}</p><p className="text-xs text-gray-600">{item.email} · expire {formatDate(item.expires_at)}</p></div><button onClick={() => void post('revoke_invitation', { invitation_id: item.id }, 'Invitation annulée.')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Annuler l’invitation</button></div>)}
          </div>
        </section>}

        <section className="space-y-3">
          <div><h2 className="text-lg font-black text-[#002050]">Membres de l’équipe</h2><p className="text-sm text-gray-500">Le rôle système reste « moderateur » ; la fonction interne et les droits sont gérés séparément.</p></div>
          {loading ? <div className="h-40 animate-pulse rounded-xl bg-gray-100" /> : moderators.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Aucun membre de modération actif.</div> : moderators.map(moderator => {
            const profile = moderator.team_profile || {};
            const activeMissions = (moderator.missions || []).filter(item => !['completed', 'cancelled'].includes(item.status));
            const activeDelegations = (moderator.delegations || []).filter(item => item.status === 'active' && new Date(item.expires_at) > new Date());
            const activeConflicts = (moderator.conflicts || []).filter(item => item.status === 'active');
            return <article key={moderator.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <button onClick={() => setExpanded(previous => ({ ...previous, [moderator.id]: !previous[moderator.id] }))} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-[#002050]">{moderator.full_name || 'Nom non renseigné'}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${profile.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{profile.status === 'suspended' ? 'Accès suspendu' : 'Actif'}</span></div><p className="text-xs text-gray-500">{moderator.email} · {profile.internal_title || 'Modérateur'}{profile.team_area ? ` · ${profile.team_area}` : ''}</p><p className="mt-1 text-xs text-gray-400">{moderator.permissions_count || 0}/27 permissions · {activeMissions.length} mission(s) · {activeDelegations.length} délégation(s){activeConflicts.length ? ` · ${activeConflicts.length} conflit(s)` : ''}</p></div>
                {expanded[moderator.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {expanded[moderator.id] && <div className="space-y-6 border-t border-gray-100 p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-xl bg-gray-50 p-4"><h3 className="font-bold text-[#002050]">Fiche interne privée</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Fonction interne<input value={profileDrafts[moderator.id]?.internal_title || ''} onChange={event => setProfileDrafts(prev => ({ ...prev, [moderator.id]: { ...prev[moderator.id], internal_title: event.target.value } }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-xs font-semibold text-gray-600">Pôle / équipe<input value={profileDrafts[moderator.id]?.team_area || ''} onChange={event => setProfileDrafts(prev => ({ ...prev, [moderator.id]: { ...prev[moderator.id], team_area: event.target.value } }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal" /></label></div><label className="block text-xs font-semibold text-gray-600">Mission principale<textarea rows={2} value={profileDrafts[moderator.id]?.primary_mission || ''} onChange={event => setProfileDrafts(prev => ({ ...prev, [moderator.id]: { ...prev[moderator.id], primary_mission: event.target.value } }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal" /></label><label className="block text-xs font-semibold text-gray-600">Notes administratives privées<textarea rows={2} value={profileDrafts[moderator.id]?.admin_notes || ''} onChange={event => setProfileDrafts(prev => ({ ...prev, [moderator.id]: { ...prev[moderator.id], admin_notes: event.target.value } }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal" /></label><div className="flex flex-wrap gap-2"><button onClick={() => void saveProfile(moderator.id)} className="inline-flex items-center gap-2 rounded-lg bg-[#002050] px-3 py-2 text-xs font-bold text-white"><Save size={14} /> Enregistrer la fiche</button>{profile.status === 'suspended' ? <button onClick={() => void setMemberStatus(moderator, 'active')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">Réactiver</button> : <button onClick={() => void setMemberStatus(moderator, 'suspended')} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800">Suspendre l’accès</button>}<button onClick={() => void endMembership(moderator)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Trash2 size={13} /> Fin de fonction</button></div></div>

                  <div className="rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-[#002050]">Situation opérationnelle</h3><ShieldAlert size={18} style={{ color: '#BF8813' }} /></div><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-gray-500">Entrée dans l’équipe</dt><dd className="font-semibold">{formatDate(profile.joined_at)}</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Dernière connexion</dt><dd className="font-semibold">{formatDate(moderator.last_login_at)}</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Missions ouvertes</dt><dd className="font-semibold">{activeMissions.length}</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Conflits actifs</dt><dd className={activeConflicts.length ? 'font-bold text-red-700' : 'font-semibold'}>{activeConflicts.length}</dd></div></dl></div>
                </div>

                <div><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold text-[#002050]">Permissions permanentes</h3><p className="text-xs text-gray-500">Les délégations temporaires sont ajoutées au calcul serveur sans modifier ces droits.</p></div><button onClick={() => void savePermissions(moderator.id)} className="inline-flex items-center gap-2 rounded-lg bg-[#1E7A52] px-3 py-2 text-xs font-bold text-white"><Save size={14} /> Sauvegarder</button></div><div className="space-y-4">{MODERATOR_PERMISSION_SECTIONS.map(section => <div key={section.id}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{section.title}</p><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{section.permissions.map(permission => <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3"><input type="checkbox" checked={Boolean(permissionDrafts[moderator.id]?.[permission.key])} onChange={() => setPermissionDrafts(prev => ({ ...prev, [moderator.id]: { ...(prev[moderator.id] || emptyPermissions()), [permission.key]: !prev[moderator.id]?.[permission.key] } }))} className="mt-0.5 h-4 w-4" style={{ accentColor: '#002050' }} /><span><span className="block text-xs font-bold text-gray-800">{permission.label}</span><span className="mt-1 block text-[11px] leading-4 text-gray-500">{permission.description}</span></span></label>)}</div></div>)}</div></div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-[#002050]">Missions</h3><button onClick={() => setMissionTarget(moderator.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold"><Plus size={13} className="mr-1 inline" />Attribuer</button></div><div className="mt-3 space-y-2">{(moderator.missions || []).length === 0 ? <p className="text-xs text-gray-500">Aucune mission attribuée.</p> : (moderator.missions || []).slice(0, 8).map(mission => <div key={mission.id} className="rounded-lg bg-gray-50 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{mission.title}</p><p className="text-xs text-gray-500">{mission.domain || 'Général'} · {mission.priority} · échéance {formatDate(mission.due_at)}</p></div><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold">{mission.status}</span></div>{!['completed', 'cancelled'].includes(mission.status) && <div className="mt-2 flex gap-2"><button onClick={() => void post('update_mission', { mission_id: mission.id, status: 'completed' }, 'Mission clôturée.')} className="text-xs font-bold text-emerald-700">Terminer</button><button onClick={() => void post('update_mission', { mission_id: mission.id, status: 'cancelled' }, 'Mission annulée.')} className="text-xs font-bold text-red-700">Annuler</button></div>}</div>)}</div></section>

                  <section className="rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-[#002050]">Délégations temporaires</h3><button onClick={() => setDelegationTarget(moderator.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold"><Plus size={13} className="mr-1 inline" />Déléguer</button></div><div className="mt-3 space-y-2">{activeDelegations.length === 0 ? <p className="text-xs text-gray-500">Aucune délégation active.</p> : activeDelegations.map(item => <div key={item.id} className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Jusqu’au {formatDate(item.expires_at)}</p><p className="mt-1 text-xs text-gray-600">{item.reason}</p><p className="mt-1 text-[11px] text-gray-500">{Object.entries(item.permissions || {}).filter(([, enabled]) => enabled).map(([key]) => permissionLabel(key)).join(' · ')}</p><button onClick={() => { const reason = window.prompt('Motif de révocation :'); if (reason?.trim()) void post('revoke_delegation', { delegation_id: item.id, reason }, 'Délégation révoquée.'); }} className="mt-2 text-xs font-bold text-red-700">Révoquer</button></div>)}</div></section>
                </div>

                <section className="rounded-xl border border-gray-200 p-4"><h3 className="font-bold text-[#002050]">Conflits d’intérêts</h3>{activeConflicts.length === 0 ? <p className="mt-2 text-xs text-gray-500">Aucun conflit actif déclaré.</p> : <div className="mt-3 space-y-2">{activeConflicts.map(conflict => <div key={conflict.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3"><div><p className="text-sm font-semibold text-red-900">{conflict.target_type} · {conflict.target_id}</p><p className="text-xs text-red-700">{conflict.reason}</p></div><button onClick={() => { const note = window.prompt('Note de résolution :'); if (note?.trim()) void post('resolve_conflict', { conflict_id: conflict.id, resolution_note: note }, 'Conflit résolu.'); }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700">Résoudre</button></div>)}</div>}</section>
              </div>}
            </article>;
          })}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-black text-[#002050]">Demandes sensibles</h2><p className="mt-1 text-xs text-gray-500">Suspensions, réactivations et vérifications d’identité proposées par les modérateurs.</p><div className="mt-4 space-y-3">{requests.length === 0 ? <p className="text-sm text-gray-500">Aucune demande en attente.</p> : requests.map(request => <div key={request.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3"><p className="text-sm font-bold">{request.action_type === 'kyc_approve' ? 'Recommandation : identité conforme' : request.action_type === 'kyc_reject' ? 'Recommandation : identité à rejeter' : request.action_type}</p><p className="text-xs text-gray-600">{request.target_user?.full_name || 'Compte'} · proposé par {request.moderator?.full_name || 'modérateur'}</p>{request.reason && <p className="mt-1 text-xs italic text-gray-600">{request.reason}</p>}<div className="mt-2 flex gap-2"><button onClick={() => void post('review_request', { request_id: request.id, approve: true }, 'Demande approuvée et décision administrative appliquée.')} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} /> Approuver</button><button onClick={() => void post('review_request', { request_id: request.id, approve: false }, 'Demande rejetée.')} className="inline-flex items-center gap-1 text-xs font-bold text-red-700"><XCircle size={13} /> Rejeter</button></div></div>)}</div></section>

          <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-black text-[#002050]">Recommandations de contrôle</h2><p className="mt-1 text-xs text-gray-500">Avis préparatoires sur certifications, Structures et Omnia Live. La décision métier reste dans l’espace Administration concerné.</p><div className="mt-4 space-y-3">{recommendations.length === 0 ? <p className="text-sm text-gray-500">Aucune recommandation en attente.</p> : recommendations.map(item => <div key={item.id} className="rounded-lg border border-blue-100 bg-blue-50/40 p-3"><p className="text-sm font-bold">{item.target_type} · {item.recommendation}</p><p className="text-xs text-gray-600">Dossier {item.target_id} · {item.moderator?.full_name || 'Modérateur'}</p>{item.note && <p className="mt-1 text-xs italic text-gray-600">{item.note}</p>}<div className="mt-2 flex gap-2"><button onClick={() => void post('review_recommendation', { recommendation_id: item.id, status: 'reviewed' }, 'Recommandation marquée comme examinée.')} className="text-xs font-bold text-emerald-700">Marquer examinée</button><button onClick={() => void post('review_recommendation', { recommendation_id: item.id, status: 'dismissed' }, 'Recommandation classée sans suite.')} className="text-xs font-bold text-gray-600">Classer sans suite</button></div></div>)}</div></section>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-black text-[#002050]">Journal d’audit de l’équipe</h2><p className="mt-1 text-xs text-gray-500">Historique append-only des accès, permissions, missions, délégations et décisions administratives.</p><div className="mt-4 divide-y divide-gray-100">{audit.length === 0 ? <p className="py-4 text-sm text-gray-500">Aucun événement enregistré.</p> : audit.slice(0, 40).map(row => <div key={row.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">{actionLabel(row.action)}</p><span className="text-xs text-gray-400">{formatDate(row.created_at)}</span></div>{row.reason && <p className="mt-1 text-xs text-gray-600">{row.reason}</p>}</div>)}</div></section>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-bold">Limite de délégation</p><p className="mt-1">Les paiements, remboursements effectifs, paramètres financiers, attribution du rôle Super-admin et décisions finales sensibles restent exclusivement réservés à l’Administration Omnia.</p></div>
      </div>

      {showInvite && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-black text-[#002050]">Inviter un membre de l’équipe</h2><p className="text-xs text-gray-500">La fonction interne ne crée pas de nouveau rôle global.</p></div><button onClick={() => setShowInvite(false)}><X /></button></div><div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2"><input placeholder="Nom complet" value={invite.full_name} onChange={event => setInvite(prev => ({ ...prev, full_name: event.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" /><input type="email" placeholder="Email" value={invite.email} onChange={event => setInvite(prev => ({ ...prev, email: event.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" /><input placeholder="Fonction interne" value={invite.internal_title} onChange={event => setInvite(prev => ({ ...prev, internal_title: event.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2" /><textarea placeholder="Message facultatif" value={invite.message} onChange={event => setInvite(prev => ({ ...prev, message: event.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2" /></div><div><h3 className="mb-3 text-sm font-bold text-[#002050]">Permissions initiales</h3><div className="space-y-4">{MODERATOR_PERMISSION_SECTIONS.map(section => <div key={section.id}><p className="mb-2 text-xs font-bold uppercase text-gray-400">{section.title}</p><div className="grid gap-2 md:grid-cols-2">{section.permissions.map(permission => <label key={permission.key} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3"><input type="checkbox" checked={Boolean(invitePermissions[permission.key])} onChange={() => setInvitePermissions(prev => ({ ...prev, [permission.key]: !prev[permission.key] }))} style={{ accentColor: '#002050' }} /><span><span className="block text-xs font-bold">{permission.label}</span><span className="block text-[11px] text-gray-500">{permission.description}</span></span></label>)}</div></div>)}</div></div><div className="flex justify-end gap-2"><button onClick={() => setShowInvite(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">Annuler</button><button disabled={busyKey === 'create' || !invite.full_name.trim() || !invite.email.trim()} onClick={() => void createInvitation()} className="rounded-lg bg-[#002050] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Envoyer l’invitation</button></div></div></div></div>}

      {missionTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#002050]">Attribuer une mission</h2><button onClick={() => setMissionTarget(null)}><X /></button></div><div className="mt-4 space-y-3"><input placeholder="Titre de la mission" value={missionDraft.title} onChange={event => setMissionDraft(prev => ({ ...prev, title: event.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /><textarea placeholder="Description" value={missionDraft.description} onChange={event => setMissionDraft(prev => ({ ...prev, description: event.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><input placeholder="Domaine" value={missionDraft.domain} onChange={event => setMissionDraft(prev => ({ ...prev, domain: event.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" /><select value={missionDraft.priority} onChange={event => setMissionDraft(prev => ({ ...prev, priority: event.target.value }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div><label className="block text-xs font-semibold text-gray-600">Échéance facultative<input type="datetime-local" value={missionDraft.due_at} onChange={event => setMissionDraft(prev => ({ ...prev, due_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label><button onClick={() => void createMission()} className="w-full rounded-lg bg-[#002050] px-4 py-2 text-sm font-bold text-white">Attribuer la mission</button></div></div></div>}

      {delegationTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#002050]">Délégation temporaire</h2><button onClick={() => setDelegationTarget(null)}><X /></button></div><div className="mt-4 space-y-3"><textarea placeholder="Motif obligatoire" value={delegationDraft.reason} onChange={event => setDelegationDraft(prev => ({ ...prev, reason: event.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /><label className="block text-xs font-semibold text-gray-600">Expiration<input type="datetime-local" value={delegationDraft.expires_at} onChange={event => setDelegationDraft(prev => ({ ...prev, expires_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label><div className="grid gap-2 md:grid-cols-2">{MODERATOR_PERMISSION_SECTIONS.flatMap(section => section.permissions).map(permission => <label key={permission.key} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3"><input type="checkbox" checked={Boolean(delegationDraft.permissions[permission.key])} onChange={() => setDelegationDraft(prev => ({ ...prev, permissions: { ...prev.permissions, [permission.key]: !prev.permissions[permission.key] } }))} style={{ accentColor: '#BF8813' }} /><span className="text-xs font-semibold">{permission.label}</span></label>)}</div><button onClick={() => void createDelegation()} className="w-full rounded-lg bg-[#BF8813] px-4 py-2 text-sm font-bold text-white">Créer la délégation</button></div></div></div>}
    </AdminLayout>
  );
}
