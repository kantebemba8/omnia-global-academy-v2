import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { Wallet, CheckCircle, XCircle, Clock, Search } from 'lucide-react';

interface Payout {
  id: string; user_id: string; amount_xof: number; gateway: string;
  payout_details: Record<string, string>; status: string; admin_note: string | null;
  created_at: string; processed_at: string | null;
  user_name: string; user_email: string; user_type: string;
}
interface Stats { pending: number; total_verse_mois: number; tresorerie: number }

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#BF8813', bg: '#FEF9EE' },
  approved: { label: 'Approuvé', color: '#1E7A52', bg: '#F0FAF5' },
  rejected: { label: 'Rejeté', color: '#dc2626', bg: '#FEF2F2' },
};

function fmt(n: number) { return n.toLocaleString('fr-FR'); }

function monogram(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

export default function AdminRetraits() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [modal, setModal] = useState<{ payout: Payout; action: 'approve' | 'reject' } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  function load() {
    const token = localStorage.getItem('omnia_session_token');
    fetch(`${ENDPOINTS.adminPayoutProcess}?status=${statusFilter}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setPayouts(d.payouts ?? []); setStats(d.stats ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, [statusFilter]);

  async function doAction() {
    if (!modal) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.adminPayoutProcess, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: modal.payout.id, action: modal.action, admin_note: adminNote }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      setToast(modal.action === 'approve' ? 'Retrait approuvé.' : 'Retrait rejeté.');
      setModal(null); setAdminNote('');
      load();
    } else { setToast(d.message ?? 'Erreur.'); }
    setTimeout(() => setToast(''), 4000);
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Gestion des Retraits</h1>
          <p className="text-gray-500 text-sm mt-0.5">Approbation et traitement des demandes de retrait</p>
        </div>

        {/* KPI row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'En attente', value: stats.pending, color: '#BF8813', bg: '#FEF9EE' },
              { label: 'Versé ce mois', value: `${fmt(stats.total_verse_mois)} XOF`, color: '#1E7A52', bg: '#F0FAF5' },
              { label: 'Trésorerie séquestrée', value: `${fmt(stats.tresorerie)} XOF`, color: '#002050', bg: '#EFF6FF' },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-4 border" style={{ backgroundColor: k.bg, borderColor: `${k.color}30` }}>
                <p className="text-xs font-medium" style={{ color: k.color }}>{k.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[{ v: '', l: 'Tous' }, { v: 'pending', l: 'En attente' }, { v: 'approved', l: 'Approuvés' }, { v: 'rejected', l: 'Rejetés' }].map((f) => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === f.v ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={statusFilter === f.v ? { backgroundColor: '#002050' } : {}}>
              {f.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : payouts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">Aucune demande de retrait</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Demandeur', 'Type', 'Montant', 'Canal', 'Demandé le', 'Statut', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payouts.map((p) => {
                  const st = STATUS_STYLES[p.status] ?? { label: p.status, color: '#6b7280', bg: '#f9fafb' };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#002050', color: '#BF8813' }}>
                            {monogram(p.user_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{p.user_name}</p>
                            <p className="text-xs text-gray-400">{p.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">{p.user_type}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: '#002050' }}>{fmt(p.amount_xof)} XOF</td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 capitalize">{p.gateway?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {p.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => { setModal({ payout: p, action: 'approve' }); setAdminNote(''); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                              style={{ backgroundColor: '#1E7A52' }}>
                              <CheckCircle className="w-3.5 h-3.5" /> Approuver
                            </button>
                            <button onClick={() => { setModal({ payout: p, action: 'reject' }); setAdminNote(''); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700">
                              <XCircle className="w-3.5 h-3.5" /> Rejeter
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500">
            Le versement réel est effectué manuellement via FedaPay ou votre interface bancaire après approbation dans ce panneau.
          </p>
        </div>

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>
                {modal.action === 'approve' ? 'Confirmer le versement' : 'Rejeter la demande'}
              </h3>
              {modal.action === 'approve' ? (
                <p className="text-sm text-gray-600">
                  Confirmez-vous le versement de <strong>{fmt(modal.payout.amount_xof)} XOF</strong>{' '}
                  vers <span className="capitalize">{modal.payout.gateway?.replace(/_/g, ' ')}</span> pour <strong>{modal.payout.user_name}</strong> ?
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Raison du rejet (optionnel) :</p>
                  <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    placeholder="Motif du rejet…" />
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setModal(null); setAdminNote(''); }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={doAction} disabled={submitting}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 ${modal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  style={modal.action === 'approve' ? { backgroundColor: '#1E7A52' } : {}}>
                  {submitting ? 'En cours…' : modal.action === 'approve' ? 'Confirmer et approuver' : 'Rejeter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
