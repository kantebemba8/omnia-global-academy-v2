import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { Users, Search, PauseCircle, PlayCircle, AlertTriangle } from 'lucide-react';

interface UserRow {
  id: string; full_name: string; email: string; status: string;
  country_code: string; created_at: string; roles: string[];
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  actif: { label: 'Actif', color: '#1E7A52', bg: '#F0FAF5' },
  suspendu: { label: 'Suspendu', color: '#dc2626', bg: '#FEF2F2' },
  en_attente_validation: { label: 'En attente', color: '#BF8813', bg: '#FEF9EE' },
};

export default function ModerateurUtilisateurs() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState<{ user: UserRow; action: 'suspend' | 'reactivate' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  function load() {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    fetch(`${ENDPOINTS.moderatorAccountAction}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [search, statusFilter, typeFilter]);

  async function doAction() {
    if (!modal) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.moderatorAccountAction, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: modal.user.id, action: modal.action }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      setToast(modal.action === 'suspend' ? 'Compte suspendu.' : 'Compte réactivé.');
      setModal(null);
      load();
    } else {
      setToast(d.message ?? 'Erreur.');
    }
    setTimeout(() => setToast(''), 4000);
  }

  function monogram(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Gestion des utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">Suspension et réactivation de comptes uniquement</p>
        </div>

        {/* No delete notice */}
        <div className="rounded-xl p-3 bg-blue-50 border border-blue-100 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">La suppression de comptes est réservée au Super-admin. Vous pouvez uniquement suspendre ou réactiver.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
              className="flex-1 text-sm outline-none bg-transparent" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="en_attente_validation">En attente</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="all">Tous les types</option>
            <option value="apprenant">Apprenants</option>
            <option value="professeur">Professeurs</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Utilisateur</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Rôles</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Inscription</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const st = STATUS_STYLES[u.status] ?? { label: u.status, color: '#6b7280', bg: '#f9fafb' };
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#002050', color: '#BF8813' }}>
                            {monogram(u.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{u.full_name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
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
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          {u.status === 'actif' ? (
                            <button onClick={() => setModal({ user: u, action: 'suspend' })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                              <PauseCircle className="w-3.5 h-3.5" /> Suspendre
                            </button>
                          ) : u.status === 'suspendu' ? (
                            <button onClick={() => setModal({ user: u, action: 'reactivate' })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border text-white transition-colors"
                              style={{ backgroundColor: '#1E7A52', borderColor: '#1E7A52' }}>
                              <PlayCircle className="w-3.5 h-3.5" /> Réactiver
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Confirm modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>
                {modal.action === 'suspend' ? 'Suspendre le compte' : 'Réactiver le compte'}
              </h3>
              <p className="text-sm text-gray-600">
                {modal.action === 'suspend'
                  ? `Suspendre le compte de <strong>${modal.user.full_name}</strong> ? Toutes les sessions actives seront invalidées immédiatement.`
                  : `Réactiver le compte de ${modal.user.full_name} ?`}
              </p>
              {modal.action === 'suspend' && (
                <div className="rounded-lg p-3 bg-red-50 border border-red-100">
                  <p className="text-xs text-red-600">
                    Cette action ne supprime pas le compte. Seul le Super-admin peut supprimer définitivement un compte.
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={doAction} disabled={submitting}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 ${modal.action === 'suspend' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  style={modal.action === 'reactivate' ? { backgroundColor: '#1E7A52' } : {}}>
                  {submitting ? 'En cours…' : modal.action === 'suspend' ? 'Suspendre' : 'Réactiver'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
