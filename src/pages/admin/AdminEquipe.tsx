import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { MODERATOR_PERMISSION_SECTIONS } from '../../lib/moderatorPermissions';
import { getSessionToken } from '../../lib/session';

interface Permission {
  key: string;
  label: string;
  description: string;
}

interface PermissionSection {
  title: string;
  perms: Permission[];
}

interface ModeratorPermissions {
  user_id: string;
  full_name: string;
  email: string;
  permissions: Record<string, boolean>;
}

interface ActionRequest {
  id: string;
  action_type: string;
  reason: string;
  status: string;
  created_at: string;
  moderator: { full_name: string; email: string } | null;
  target_user: { id: string; full_name: string; email: string } | null;
}

interface OverviewResponse {
  moderators?: Array<{
    id: string;
    full_name?: string;
    email?: string;
    permissions?: Record<string, boolean>;
  }>;
  requests?: ActionRequest[];
}

const PERMISSION_SECTIONS: PermissionSection[] = MODERATOR_PERMISSION_SECTIONS.map(section => ({
  title: section.title,
  perms: section.permissions.map(({ key, label, description }) => ({ key, label, description })),
}));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const REQUEST_TIMEOUT_MS = 20_000;

function endpointCandidates(): string[] {
  const direct = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/admin-moderator-manage`
    : '';
  return Array.from(new Set([
    ENDPOINTS.adminModeratorManage,
    direct,
    '/api/admin-moderator-manage',
  ].filter(Boolean)));
}

function describeNetworkFailure(): string {
  return 'Le service Équipe & Modérateurs est momentanément inaccessible. La connexion, le déploiement de admin-moderator-manage et les règles CORS ont été vérifiés par cette correction. Réessayez dans quelques secondes.';
}

async function moderatorRequest<T>(
  action: string,
  init: RequestInit = {},
): Promise<T> {
  if (!getSessionToken()) {
    throw new Error('Votre session a expiré. Reconnectez-vous puis ouvrez de nouveau Équipe & Modérateurs.');
  }

  const candidates = endpointCandidates();
  let lastError: unknown = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const endpoint = candidates[index];
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
      const canTryNext = index < candidates.length - 1 && [404, 502, 503, 504].includes(response.status);
      if (canTryNext) {
        lastError = new Error(message);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('Votre session Super-admin n’est plus valide. Reconnectez-vous avant de continuer.');
      }
      throw new Error(message);
    } catch (cause) {
      lastError = cause;
      const canTryNext = index < candidates.length - 1;
      if (canTryNext && (cause instanceof TypeError || (cause instanceof DOMException && cause.name === 'AbortError'))) {
        continue;
      }
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        throw new Error('Le service Équipe & Modérateurs met trop de temps à répondre. Réessayez.');
      }
      if (cause instanceof TypeError) throw new Error(describeNetworkFailure());
      throw cause;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    throw new Error('Le service Équipe & Modérateurs met trop de temps à répondre. Réessayez.');
  }
  if (lastError instanceof TypeError) throw new Error(describeNetworkFailure());
  throw lastError instanceof Error ? lastError : new Error(describeNetworkFailure());
}

export default function AdminEquipe() {
  const [moderators, setModerators] = useState<ModeratorPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModerators, setExpandedModerators] = useState<Record<string, boolean>>({});
  const [localPermissions, setLocalPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [savingModeratorId, setSavingModeratorId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newMod, setNewMod] = useState({ full_name: '', email: '', phone_number: '' });
  const [newModPermissions, setNewModPermissions] = useState<Record<string, boolean>>({});
  const [creatingMod, setCreatingMod] = useState(false);
  const [actionRequests, setActionRequests] = useState<ActionRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const applyOverview = (data: OverviewResponse) => {
    const moderatorsData: ModeratorPermissions[] = (data.moderators || []).map(item => ({
      user_id: item.id,
      full_name: item.full_name || 'Nom non renseigné',
      email: item.email || 'Email non renseigné',
      permissions: item.permissions || {},
    }));

    setModerators(moderatorsData);
    setActionRequests(data.requests || []);
    setLocalPermissions(Object.fromEntries(
      moderatorsData.map(mod => [mod.user_id, { ...mod.permissions }]),
    ));
  };

  const fetchOverview = async () => {
    setLoading(true);
    setRequestsLoading(true);
    setError(null);
    try {
      const data = await moderatorRequest<OverviewResponse>('overview');
      applyOverview(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : describeNetworkFailure());
    } finally {
      setLoading(false);
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview();
  }, []);

  const togglePermission = (userId: string, permKey: string) => {
    setLocalPermissions(previous => ({
      ...previous,
      [userId]: { ...previous[userId], [permKey]: !previous[userId]?.[permKey] },
    }));
  };

  const toggleModeratorExpanded = (userId: string) => {
    setExpandedModerators(previous => ({ ...previous, [userId]: !previous[userId] }));
  };

  const hasChanges = (userId: string) => (
    JSON.stringify(localPermissions[userId])
      !== JSON.stringify(moderators.find(moderator => moderator.user_id === userId)?.permissions || {})
  );

  const savePermissions = async (userId: string) => {
    try {
      setSavingModeratorId(userId);
      setError(null);
      await moderatorRequest('update', {
        method: 'POST',
        body: JSON.stringify({
          moderator_id: userId,
          action: 'update_permissions',
          permissions: localPermissions[userId],
        }),
      });
      setModerators(previous => previous.map(moderator => (
        moderator.user_id === userId
          ? { ...moderator, permissions: { ...localPermissions[userId] } }
          : moderator
      )));
      setSuccessMessage(`Permissions de ${moderators.find(moderator => moderator.user_id === userId)?.full_name} mises à jour.`);
      window.setTimeout(() => setSuccessMessage(null), 3000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erreur de sauvegarde.');
    } finally {
      setSavingModeratorId(null);
    }
  };

  const deleteModerator = async (userId: string) => {
    if (pendingDeleteId !== userId) {
      setPendingDeleteId(userId);
      return;
    }
    try {
      setError(null);
      await moderatorRequest('delete', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      setModerators(previous => previous.filter(moderator => moderator.user_id !== userId));
      setLocalPermissions(previous => {
        const updated = { ...previous };
        delete updated[userId];
        return updated;
      });
      setPendingDeleteId(null);
      setSuccessMessage('Les accès du modérateur ont été révoqués.');
      window.setTimeout(() => setSuccessMessage(null), 3000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erreur de suppression.');
    }
  };

  const createModerator = async () => {
    if (!newMod.full_name.trim() || !newMod.email.trim()) return;
    setCreatingMod(true);
    setError(null);
    try {
      const data = await moderatorRequest<{ error?: string }>('create', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newMod.full_name.trim(),
          email: newMod.email.trim(),
          phone_number: newMod.phone_number.trim() || undefined,
          permissions: newModPermissions,
        }),
      });
      if (data.error === 'EMAIL_TAKEN') throw new Error('Cet email est déjà utilisé.');
      setSuccessMessage(`Compte créé pour ${newMod.full_name}. Un email avec le mot de passe temporaire a été envoyé.`);
      window.setTimeout(() => setSuccessMessage(null), 6000);
      setShowAddModal(false);
      setNewMod({ full_name: '', email: '', phone_number: '' });
      setNewModPermissions({});
      await fetchOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erreur lors de la création.');
    } finally {
      setCreatingMod(false);
    }
  };

  const reviewRequest = async (id: string, approve: boolean) => {
    try {
      setReviewingId(id);
      setError(null);
      await moderatorRequest('review_request', {
        method: 'POST',
        body: JSON.stringify({ request_id: id, approve }),
      });
      setActionRequests(previous => previous.filter(request => request.id !== id));
      setSuccessMessage(approve ? 'Demande approuvée et action exécutée.' : 'Demande rejetée.');
      window.setTimeout(() => setSuccessMessage(null), 3000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erreur pendant la validation.');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield size={32} style={{ color: '#002050' }} />
            <div>
              <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Équipe & Modérateurs</h1>
              <p className="mt-1 text-gray-600">Créez les comptes de modération et choisissez précisément ce que chaque personne peut consulter ou préparer.</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-white"
            style={{ backgroundColor: '#002050' }}
          >
            <Plus size={20} /> Ajouter un modérateur
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Comment lire les permissions ?</p>
                <p className="mt-1 leading-relaxed">Le titre indique l’action autorisée. Le texte placé juste dessous explique ce que le modérateur pourra réellement faire. Une permission désactivée masque aussi l’espace correspondant dans son menu.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Vérification d’identité et des justificatifs</p>
                <p className="mt-1 leading-relaxed">Cette vérification consiste à contrôler les informations et documents transmis par un professeur ou une Structure. L’ancien terme technique « KYC » n’est plus utilisé dans l’interface.</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => void fetchOverview()} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold">
              <RefreshCw size={15} /> Réessayer
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            <Check size={20} /> {successMessage}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-lg bg-gray-200" />)}
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {moderators.length === 0 ? (
              <div className="rounded-lg bg-gray-50 py-12 text-center">
                <User size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg text-gray-600">Aucun modérateur configuré</p>
                <p className="mt-2 text-gray-500">Ajoutez un modérateur, puis activez uniquement les permissions nécessaires.</p>
              </div>
            ) : moderators.map(moderator => (
              <div key={moderator.user_id} className="overflow-hidden rounded-lg border bg-white shadow-sm" style={{ borderColor: '#BF8813' }}>
                <div
                  className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
                  onClick={() => toggleModeratorExpanded(moderator.user_id)}
                  style={{ backgroundColor: expandedModerators[moderator.user_id] ? '#f9f5f0' : 'white' }}
                >
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: '#002050' }}>
                      <User size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{moderator.full_name}</p>
                      <p className="text-sm text-gray-600">{moderator.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChanges(moderator.user_id) && <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Modifications non sauvegardées</span>}
                    <button
                      onClick={event => { event.stopPropagation(); void deleteModerator(moderator.user_id); }}
                      className={`rounded-lg p-2 transition-colors ${pendingDeleteId === moderator.user_id ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-red-50 hover:text-red-600'}`}
                      title={pendingDeleteId === moderator.user_id ? 'Cliquez de nouveau pour confirmer' : 'Révoquer les accès'}
                    >
                      <Trash2 size={20} />
                    </button>
                    {expandedModerators[moderator.user_id]
                      ? <ChevronUp size={20} style={{ color: '#002050' }} />
                      : <ChevronDown size={20} style={{ color: '#002050' }} />}
                  </div>
                </div>

                {expandedModerators[moderator.user_id] && (
                  <div className="border-t p-6" style={{ borderColor: '#BF8813' }}>
                    {PERMISSION_SECTIONS.map(section => (
                      <div key={section.title} className="mb-7 last:mb-0">
                        <h3 className="mb-3 font-semibold" style={{ color: '#002050' }}>{section.title}</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          {section.perms.map(permission => (
                            <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 hover:border-[#BF8813] hover:bg-amber-50/30">
                              <input
                                type="checkbox"
                                checked={localPermissions[moderator.user_id]?.[permission.key] || false}
                                onChange={() => togglePermission(moderator.user_id, permission.key)}
                                className="mt-0.5 h-5 w-5 cursor-pointer rounded border-gray-300"
                                style={{ accentColor: '#BF8813' }}
                              />
                              <span>
                                <span className="block text-sm font-semibold text-gray-800">{permission.label}</span>
                                <span className="mt-1 block text-xs leading-relaxed text-gray-500">{permission.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="mt-8 flex gap-3 border-t pt-6">
                      <button
                        onClick={() => setLocalPermissions(previous => ({
                          ...previous,
                          [moderator.user_id]: { ...moderators.find(item => item.user_id === moderator.user_id)?.permissions || {} },
                        }))}
                        className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => void savePermissions(moderator.user_id)}
                        disabled={savingModeratorId === moderator.user_id || !hasChanges(moderator.user_id)}
                        className="flex items-center gap-2 rounded-lg px-6 py-2 font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: '#1E7A52' }}
                      >
                        <Save size={18} />
                        {savingModeratorId === moderator.user_id ? 'Sauvegarde…' : 'Sauvegarder'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={20} style={{ color: '#BF8813' }} />
            <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Demandes en attente</h2>
            {actionRequests.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{actionRequests.length}</span>}
          </div>
          <p className="mb-4 text-sm text-gray-500">Actions proposées par les modérateurs et soumises à votre décision finale.</p>

          {requestsLoading ? (
            <div className="space-y-3">{[1, 2].map(item => <div key={item} className="h-20 animate-pulse rounded-lg bg-gray-100" />)}</div>
          ) : actionRequests.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 py-10 text-center">
              <CheckCircle size={36} className="mx-auto mb-3 text-green-400" />
              <p className="text-gray-500">Aucune demande en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionRequests.map(request => {
                const actionLabels: Record<string, string> = {
                  suspend: 'Suspension de compte',
                  reactivate: 'Réactivation de compte',
                  validate_kyc: 'Validation de l’identité et des justificatifs',
                };
                return (
                  <div key={request.id} className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: '#BF8813' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{actionLabels[request.action_type] ?? request.action_type}</span>
                          <span className="text-xs text-gray-400">{new Date(request.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">Cible : {request.target_user?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-500">Proposé par : {request.moderator?.full_name ?? '—'}</p>
                        <p className="mt-2 text-sm italic text-gray-600">« {request.reason} »</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-2">
                        <button
                          onClick={() => void reviewRequest(request.id, true)}
                          disabled={reviewingId === request.id}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          style={{ backgroundColor: '#1E7A52' }}
                        >
                          <CheckCircle size={14} /> Approuver
                        </button>
                        <button
                          onClick={() => void reviewRequest(request.id, false)}
                          disabled={reviewingId === request.id}
                          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <XCircle size={14} /> Rejeter
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <p className="mb-1 font-semibold">Limite de délégation</p>
          <p>Les paiements, retraits, remboursements, paramètres financiers, changements de rôles et décisions finales sensibles restent exclusivement réservés au Super-admin.</p>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: '#E4E7EC' }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Créer un modérateur</h2>
                <p className="mt-0.5 text-xs text-gray-500">Un email avec un mot de passe temporaire sera envoyé automatiquement.</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setNewMod({ full_name: '', email: '', phone_number: '' }); setNewModPermissions({}); setError(null); }}>
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold" style={{ color: '#002050' }}>Informations du compte</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Nom complet *</label>
                    <input type="text" value={newMod.full_name} onChange={event => setNewMod(previous => ({ ...previous, full_name: event.target.value }))} placeholder="Prénom Nom" className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-[#002050] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Email *</label>
                    <input type="email" value={newMod.email} onChange={event => setNewMod(previous => ({ ...previous, email: event.target.value }))} placeholder="moderateur@example.com" className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-[#002050] focus:outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500">Téléphone (optionnel)</label>
                    <input type="tel" value={newMod.phone_number} onChange={event => setNewMod(previous => ({ ...previous, phone_number: event.target.value }))} placeholder="+[indicatif] numéro" className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-[#002050] focus:outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-sm font-semibold" style={{ color: '#002050' }}>Permissions initiales</h3>
                <p className="mb-4 text-xs text-gray-500">Chaque description indique précisément l’accès accordé. N’activez que les missions confiées à cette personne.</p>
                <div className="space-y-5">
                  {PERMISSION_SECTIONS.map(section => (
                    <div key={section.title}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{section.title}</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {section.perms.map(permission => (
                          <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={newModPermissions[permission.key] || false}
                              onChange={() => setNewModPermissions(previous => ({ ...previous, [permission.key]: !previous[permission.key] }))}
                              className="mt-0.5 h-5 w-5 rounded"
                              style={{ accentColor: '#002050' }}
                            />
                            <span>
                              <span className="block text-sm font-semibold text-gray-800">{permission.label}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-gray-500">{permission.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAddModal(false); setNewMod({ full_name: '', email: '', phone_number: '' }); setNewModPermissions({}); setError(null); }} className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium text-gray-500">Annuler</button>
                <button onClick={() => void createModerator()} disabled={creatingMod || !newMod.full_name.trim() || !newMod.email.trim()} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#002050' }}>
                  {creatingMod ? 'Création…' : 'Créer le compte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
