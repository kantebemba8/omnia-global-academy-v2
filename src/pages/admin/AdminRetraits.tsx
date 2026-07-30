import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { RefreshCw } from 'lucide-react';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

type Payout = {
  id: string;
  user_id: string;
  amount_xof: number;
  channel: string;
  status: string;
  admin_note?: string;
  requested_at: string;
  approved_at?: string;
  paid_at?: string;
  provider?: string;
  provider_reference?: string;
  failure_reason?: string;
  user_name: string;
  user_email: string;
  user_type: string;
  payout_details: Record<string, string>;
};

type Stats = {
  pending: number;
  approved_waiting_payment: number;
  total_verse_mois: number;
  total_a_reverser: number;
  reserved_xof: number;
};

type ModalState = { payout: Payout; action: 'approve' | 'reject' | 'mark_paid' | 'mark_failed' };

const fmt = (value: number) => Number(value || 0).toLocaleString('fr-FR');
const labels: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé — à payer',
  paid: 'Payé',
  rejected: 'Rejeté',
  failed: 'Échec paiement',
};

export default function AdminRetraits() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`${ENDPOINTS.adminPayoutProcess}?status=${filter}`, {
        headers: edgeAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error);
      setPayouts(data.payouts || []);
      setStats(data.stats || null);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filter]);

  function closeModal() {
    setModal(null);
    setNote('');
    setReference('');
  }

  async function act() {
    if (!modal || submitting) return;
    const trimmedNote = note.trim();
    const trimmedReference = reference.trim();

    if (modal.action === 'mark_paid' && !trimmedReference) {
      setToast('La référence réelle du paiement est obligatoire.');
      return;
    }
    if (modal.action === 'reject' && !trimmedNote) {
      setToast('Le motif du rejet est obligatoire.');
      return;
    }
    if (modal.action === 'mark_failed' && !trimmedNote) {
      setToast('Le motif de l’échec est obligatoire.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(ENDPOINTS.adminPayoutProcess, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({
          payout_id: modal.payout.id,
          action: modal.action,
          admin_note: trimmedNote || null,
          provider: modal.action === 'mark_paid' ? 'manual' : null,
          provider_reference: trimmedReference || null,
          failure_reason: modal.action === 'mark_failed' ? trimmedNote : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Erreur');
      setToast('Retrait mis à jour.');
      closeModal();
      await load();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Mise à jour impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  function details(payout: Payout) {
    const details = payout.payout_details || {};
    if (payout.channel === 'mobile_money') return `${details.mm_operator || ''} ${details.mm_phone || ''}`.trim();
    if (payout.channel === 'swift') return `${details.bank_name || ''} · ${details.swift || ''}`.replace(/^ · | · $/g, '');
    return `${details.bank_name || ''} · ${details.account_number || ''}`.replace(/^ · | · $/g, '');
  }

  const modalTitle = modal?.action === 'approve'
    ? 'Approuver la demande'
    : modal?.action === 'mark_paid'
      ? 'Confirmer le paiement réel'
      : modal?.action === 'reject'
        ? 'Rejeter la demande'
        : 'Marquer le paiement en échec';

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {toast && (
          <div role="status" className="fixed right-4 top-4 z-50 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg">
            {toast}
          </div>
        )}

        <header className="flex items-end justify-between border-b border-gray-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{ color: '#BF8813' }}>Finance & Commercial</p>
            <h1 className="mt-1 text-2xl font-black" style={{ color: '#002050' }}>Gestion des retraits</h1>
            <p className="mt-1 text-sm text-gray-500">Validation, paiement réel et traçabilité des retraits Professeur, Structure et Organisateur.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <RefreshCw size={14} /> Actualiser
          </button>
        </header>

        {stats && (
          <div className="flex flex-wrap gap-x-7 gap-y-2 border-y border-gray-200 py-3 text-sm">
            <span><strong style={{ color: '#BF8813' }}>{stats.pending}</strong> en attente</span>
            <span><strong style={{ color: '#002050' }}>{stats.approved_waiting_payment}</strong> approuvés à payer</span>
            <span><strong style={{ color: '#1E7A52' }}>{fmt(stats.total_verse_mois)} XOF</strong> payés ce mois</span>
            <span><strong style={{ color: '#002050' }}>{fmt(stats.total_a_reverser)} XOF</strong> solde total à reverser</span>
            <span><strong>{fmt(stats.reserved_xof)} XOF</strong> réservés</span>
          </div>
        )}

        <div className="flex gap-5 overflow-x-auto border-b border-gray-200">
          {[
            ['', 'Tous'], ['pending', 'En attente'], ['approved', 'À payer'],
            ['paid', 'Payés'], ['rejected', 'Rejetés'], ['failed', 'Échecs'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="min-w-max border-b-2 pb-3 text-sm font-semibold"
              style={{ color: filter === value ? '#002050' : '#667085', borderColor: filter === value ? '#BF8813' : 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Chargement…</div>
        ) : payouts.length === 0 ? (
          <div className="border-y border-gray-200 py-14 text-center text-sm text-gray-500">Aucune demande dans cette vue.</div>
        ) : (
          <div className="overflow-x-auto border-t border-gray-200">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="py-3">Demandeur</th><th>Rôle</th><th>Montant</th><th>Canal</th>
                  <th>Coordonnées</th><th>Date</th><th>Statut</th><th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-100">
                    <td className="py-3"><p className="font-semibold" style={{ color: '#002050' }}>{payout.user_name}</p><p className="text-xs text-gray-400">{payout.user_email}</p></td>
                    <td>{payout.user_type}</td>
                    <td className="font-semibold">{fmt(payout.amount_xof)} XOF</td>
                    <td>{payout.channel.replace(/_/g, ' ')}</td>
                    <td className="text-xs text-gray-500">{details(payout) || '—'}</td>
                    <td className="text-xs text-gray-500">{new Date(payout.requested_at).toLocaleDateString('fr-FR')}</td>
                    <td>{labels[payout.status] || payout.status}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {payout.status === 'pending' && (
                          <>
                            <button onClick={() => setModal({ payout, action: 'approve' })} className="text-xs font-semibold text-emerald-700">Approuver</button>
                            <button onClick={() => setModal({ payout, action: 'reject' })} className="text-xs font-semibold text-red-700">Rejeter</button>
                          </>
                        )}
                        {payout.status === 'approved' && (
                          <>
                            <button onClick={() => setModal({ payout, action: 'mark_paid' })} className="text-xs font-semibold text-emerald-700">Marquer payé</button>
                            <button onClick={() => setModal({ payout, action: 'mark_failed' })} className="text-xs font-semibold text-red-700">Échec</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="payout-dialog-title">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
              <h2 id="payout-dialog-title" className="text-lg font-black" style={{ color: '#002050' }}>{modalTitle}</h2>
              <p className="mt-2 text-sm text-gray-500">{modal.payout.user_name} · {fmt(modal.payout.amount_xof)} XOF</p>
              {modal.action === 'mark_paid' && (
                <label className="mt-4 block text-sm">
                  Référence réelle du paiement <span className="text-red-600">*</span>
                  <input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Référence opérateur / banque" />
                </label>
              )}
              <label className="mt-4 block text-sm">
                {modal.action === 'reject' || modal.action === 'mark_failed' ? 'Motif obligatoire' : 'Note administrative'}
                {(modal.action === 'reject' || modal.action === 'mark_failed') && <span className="text-red-600"> *</span>}
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} />
              </label>
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={closeModal} disabled={submitting} className="rounded-lg border px-4 py-2 text-sm">Annuler</button>
                <button onClick={() => void act()} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#002050' }}>
                  {submitting ? 'Traitement…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
