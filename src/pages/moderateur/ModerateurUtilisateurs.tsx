import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { Users, Search, Send, CheckCircle, AlertTriangle } from 'lucide-react';

interface UserRow {
  id: string;
  full_name: string; // already masked server-side: "Jean B."
  status: string;
  country_code: string;
  created_at: string;
  roles: string[];
}

interface ModPerms {
  can_see_learners_list?: boolean;
  can_see_professors_list?: boolean;
}

type TabKey = 'apprenants' | 'professeurs';

interface RequestModal {
  user: UserRow;
  actionType: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  actif: { label: 'Actif', color: '#1E7A52', bg: '#F0FAF5' },
  suspendu: { label: 'Suspendu', color: '#dc2626', bg: '#FEF2F2' },
  en_attente_validation: { label: 'En attente', color: '#BF8813', bg: '#FEF9EE' },
};

function monogram(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function UserTable({
  users,
  loading,
  onRequest,
}: {
  users: UserRow[];
  loading: boolean;
  onRequest: (user: UserRow, actionType: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    );
  }
  // Frontend double-protection: strip any protected accounts that slipped through
  const safeUsers = users.filter(
    (u) => !u.roles?.includes('super_admin') && !u.roles?.includes('moderateur')
  );
  if (safeUsers.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
        <p className="text-gray-400 text-sm">Aucun utilisateur trouvé</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Nom</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Rôles</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Statut</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Pays</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Inscription</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {safeUsers.map((u) => {
            const st = STATUS_STYLES[u.status] ?? { label: u.status, color: '#6b7280', bg: '#f9fafb' };
            return (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: '#002050', color: '#BF8813' }}>
                      {monogram(u.full_name)}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{u.full_name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{r}</span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-500 uppercase">
                  {u.country_code || '—'}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-2">
                    {u.status === 'actif' && (
                      <button
                        onClick={() => onRequest(u, 'suspend')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> Soumettre au Super-admin
                      </button>
                    )}
                    {u.status === 'suspendu' && (
                      <button
                        onClick={() => onRequest(u, 'reactivate')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> Soumettre au Super-admin
                      </button>
                    )}
                    {u.status === 'en_attente_validation' && (
                      <button
                        onClick={() => onRequest(u, 'validate_kyc')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> Soumettre au Super-admin
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ModerateurUtilisateurs() {
  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const perms: ModPerms = (() => {
    if (bypassAuth) return { can_see_learners_list: true, can_see_professors_list: true };
    try { return JSON.parse(localStorage.getItem('mod_perms') || '{}') as ModPerms; } catch { return {}; }
  })();

  const tabs: { key: TabKey; label: string; type: string }[] = [
    ...(perms.can_see_learners_list ? [{ key: 'apprenants' as TabKey, label: 'Apprenants', type: 'apprenant' }] : []),
    ...(perms.can_see_professors_list ? [{ key: 'professeurs' as TabKey, label: 'Professeurs', type: 'professeur' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0]?.key ?? 'apprenants');
  const [users, setUsers] = useState<Record<string, UserRow[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [requestModal, setRequestModal] = useState<RequestModal | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  function loadTab(tabKey: TabKey) {
    if (bypassAuth) {
      setUsers((prev) => ({ ...prev, [tabKey]: prev[tabKey] ?? [] }));
      return;
    }
    const tabDef = tabs.find((t) => t.key === tabKey);
    if (!tabDef) return;
    setLoading((prev) => ({ ...prev, [tabKey]: true }));
    const token = localStorage.getItem('omnia_session_token');
    const params = new URLSearchParams({ type: tabDef.type });
    if (search) params.set('search', search);
    fetch(`${ENDPOINTS.moderatorAccountAction}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setUsers((prev) => ({ ...prev, [tabKey]: d.users ?? [] }));
        setLoading((prev) => ({ ...prev, [tabKey]: false }));
      })
      .catch(() => setLoading((prev) => ({ ...prev, [tabKey]: false })));
  }

  useEffect(() => { loadTab(activeTab); }, [activeTab, search]);

  async function submitRequest() {
    if (!requestModal || !reason.trim()) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const moderatorRaw = localStorage.getItem('omnia_user');
    let moderatorId = '';
    try { moderatorId = JSON.parse(moderatorRaw || '{}')?.id ?? ''; } catch { /* */ }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/moderator_action_requests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          moderator_id: moderatorId,
          action_type: requestModal.actionType,
          target_user_id: requestModal.user.id,
          reason: reason.trim(),
          status: 'pending',
        }),
      }
    );
    setSubmitting(false);
    if (res.ok || res.status === 201) {
      setRequestModal(null);
      setReason('');
      showToast('Votre demande a été soumise au Super-admin pour validation.');
    } else {
      showToast('Erreur lors de la soumission. Réessayez.', false);
    }
  }

  const ACTION_LABELS: Record<string, string> = {
    suspend: 'Suspension du compte',
    reactivate: 'Réactivation du compte',
    validate_kyc: 'Validation du compte',
  };

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 shadow-lg rounded-xl px-5 py-3 text-sm font-medium border flex items-center gap-2 ${toast.ok ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-600'}`}>
            {toast.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Consultation des utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">Consultation uniquement — les actions sont soumises au Super-admin pour validation</p>
        </div>

        <div className="rounded-xl p-3 bg-blue-50 border border-blue-100 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Aucune action directe n'est possible sur les comptes. Utilisez "Soumettre au Super-admin" pour proposer une action. Elle sera exécutée uniquement après validation du Super-admin.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un utilisateur…"
            className="flex-1 text-sm outline-none bg-transparent" />
        </div>

        {tabs.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">Aucune permission de consultation accordée</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={activeTab === tab.key ? { color: '#002050' } : {}}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <UserTable
              users={users[activeTab] ?? []}
              loading={loading[activeTab] ?? false}
              onRequest={(user, actionType) => { setRequestModal({ user, actionType }); setReason(''); }}
            />
          </>
        )}
      </div>

      {/* Request modal */}
      {requestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>
                Soumettre une demande au Super-admin
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Action proposée : <strong>{ACTION_LABELS[requestModal.actionType] ?? requestModal.actionType}</strong> pour{' '}
                <strong>{requestModal.user.full_name}</strong>
              </p>
            </div>

            <div className="rounded-lg p-3 bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-700">
                Cette action ne sera pas exécutée immédiatement. Elle sera soumise au Super-admin qui décidera de l'approuver ou de la rejeter.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Motif de la demande <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Expliquez la raison de cette demande…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-300 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRequestModal(null); setReason(''); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={submitRequest}
                disabled={submitting || !reason.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#002050' }}
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Envoi…' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModerateurLayout>
  );
}
