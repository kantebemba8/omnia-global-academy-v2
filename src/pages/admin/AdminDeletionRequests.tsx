import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  listContentDeletionRequests,
  reviewContentDeletionRequest,
  type ContentDeletionRequest,
} from '../../lib/contentDeletion';

const BLUE = '#002050';
const GOLD = '#BF8813';

const TYPE_LABELS: Record<string, string> = {
  course: 'Formation',
  project: 'Projet',
  live_event: 'Événement Omnia Live',
  job_offer: 'Offre d’emploi',
};

export default function AdminDeletionRequests() {
  const [items, setItems] = useState<ContentDeletionRequest[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listContentDeletionRequests(status);
      setItems(result.requests || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    pending: items.filter(item => item.status === 'pending').length,
    important: items.filter(item => item.requires_admin_confirmation).length,
  }), [items]);

  async function decide(item: ContentDeletionRequest, decision: 'approve' | 'reject') {
    const verb = decision === 'approve' ? 'confirmer' : 'refuser';
    if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} la suppression de « ${item.content_title} » ?`)) return;
    const note = window.prompt('Note administrative facultative :', '') || '';
    setBusy(item.id);
    setError('');
    setMessage('');
    try {
      const result = await reviewContentDeletionRequest(item.id, decision, note);
      setMessage(result.message);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Décision impossible.');
    } finally {
      setBusy('');
    }
  }

  return (
    <AdminLayout>
      <main className="mx-auto max-w-7xl p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: GOLD }}>Gouvernance des contenus</p>
            <h1 className="mt-1 text-2xl font-extrabold" style={{ color: BLUE }}>Demandes de suppression</h1>
            <p className="mt-1 text-sm text-slate-500">Les brouillons sans activité sont supprimés directement. Les contenus importants nécessitent votre confirmation.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3"><AlertTriangle size={19} style={{ color: GOLD }} /><div><p className="text-xs text-slate-500">En attente</p><p className="text-2xl font-extrabold" style={{ color: BLUE }}>{status === 'pending' ? counts.pending : items.length}</p></div></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3"><Archive size={19} style={{ color: GOLD }} /><div><p className="text-xs text-slate-500">Avec historique à préserver</p><p className="text-2xl font-extrabold" style={{ color: BLUE }}>{counts.important}</p></div></div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['pending', 'En attente'],
            ['executed', 'Confirmées'],
            ['rejected', 'Refusées'],
            ['all', 'Toutes'],
          ].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setStatus(value)} className="rounded-xl px-3 py-2 text-sm font-semibold" style={status === value ? { background: BLUE, color: 'white' } : { background: 'white', color: BLUE, border: '1px solid #E2E8F0' }}>
              {label}
            </button>
          ))}
        </div>

        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
              <p className="mt-3 font-semibold" style={{ color: BLUE }}>Aucune demande dans cette catégorie</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map(item => (
                <article key={item.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{TYPE_LABELS[item.content_type] || item.content_type}</span>
                        {item.requires_admin_confirmation && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Confirmation requise</span>}
                        <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString('fr-FR')}</span>
                      </div>
                      <h2 className="mt-2 text-base font-bold" style={{ color: BLUE }}>{item.content_title || 'Contenu sans titre'}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Créateur : {item.creator?.full_name || item.creator?.email || 'Compte utilisateur'}
                      </p>
                      {item.importance_reason && <p className="mt-2 text-sm text-amber-800">{item.importance_reason}</p>}
                      {item.reason && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Motif : {item.reason}</p>}
                      {item.review_note && <p className="mt-2 text-sm text-slate-500">Décision : {item.review_note}</p>}
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex flex-none gap-2">
                        <button disabled={busy === item.id} type="button" onClick={() => void decide(item, 'reject')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                          <XCircle size={16} /> Refuser
                        </button>
                        <button disabled={busy === item.id} type="button" onClick={() => void decide(item, 'approve')} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          <Trash2 size={16} /> Confirmer
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AdminLayout>
  );
}
