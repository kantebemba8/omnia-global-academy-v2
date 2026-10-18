import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { HelpCircle, UserCheck, MessageSquare, CheckCircle, Clock } from 'lucide-react';

interface Ticket {
  id: string; user_id: string; subject: string; message: string; status: string;
  assigned_to: string | null; resolution: string | null; created_at: string; updated_at: string;
  user_name: string; user_email: string; assigned_name: string | null;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: '#BF8813', bg: '#FEF9EE' },
  in_progress: { label: 'En traitement', color: '#002050', bg: '#EFF6FF' },
  resolved: { label: 'Résolu', color: '#1E7A52', bg: '#F0FAF5' },
  closed: { label: 'Fermé', color: '#6b7280', bg: '#f9fafb' },
};

export default function ModerateurSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState('');
  const [_resolveAction, setResolveAction] = useState<'resolve' | 'keep_open' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  function load() {
    if (bypassAuth) { setLoading(false); return; }
    const token = getSessionToken();
    fetch(ENDPOINTS.moderatorSupportAction, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setTickets(d.tickets ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function doAction(ticketId: string, action: string, extra?: Record<string, unknown>) {
    setSubmitting(true);
    const token = getSessionToken();
    const res = await fetch(ENDPOINTS.moderatorSupportAction, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, action, ...extra }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      const msgs: Record<string, string> = { take_charge: 'Ticket pris en charge.', resolve: 'Ticket résolu.', keep_open: 'Réponse enregistrée.' };
      setToast(msgs[action] ?? 'Action effectuée.');
      setSelected(null); setResponse(''); setResolveAction(null);
      load();
    } else {
      setToast(d.message ?? 'Erreur.');
    }
    setTimeout(() => setToast(''), 4000);
  }

  const filtered = tickets.filter((t) => !statusFilter || t.status === statusFilter);

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Support utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">{tickets.length} ticket(s) au total</p>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['open', 'in_progress', 'resolved', 'closed', ''].map((s) => {
            const st = s ? STATUS_STYLES[s] : null;
            const isActive = statusFilter === s;
            return (
              <button key={s || 'all'} onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                style={isActive ? { backgroundColor: st?.color ?? '#002050' } : {}}>
                {s ? st?.label : 'Tous'} ({s ? tickets.filter((t) => t.status === s).length : tickets.length})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#7c3aed' }} />
            <p className="text-gray-400 text-sm">Aucun ticket</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const st = STATUS_STYLES[t.status] ?? { label: t.status, color: '#6b7280', bg: '#f9fafb' };
              return (
                <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelected(t)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.user_name} · {t.user_email}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{t.message}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
                    {t.assigned_name && <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />Assigné à {t.assigned_name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ticket detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-lg" style={{ color: '#002050' }}>{selected.subject}</h3>
                <button onClick={() => { setSelected(null); setResponse(''); setResolveAction(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Message de l'utilisateur</p>
                <p className="text-sm text-gray-700">{selected.message}</p>
                <p className="text-xs text-gray-400 mt-2">{selected.user_name} · {selected.user_email}</p>
              </div>

              {selected.resolution && (
                <div className="rounded-lg p-3 border border-green-100 bg-green-50">
                  <p className="text-xs font-medium text-green-700 mb-1">Résolution enregistrée</p>
                  <p className="text-sm text-green-800">{selected.resolution}</p>
                </div>
              )}

              {/* Take charge */}
              {selected.status === 'open' && !selected.assigned_to && (
                <button onClick={() => doAction(selected.id, 'take_charge')} disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#002050' }}>
                  <UserCheck className="w-4 h-4" />
                  {submitting ? 'En cours…' : 'Prendre en charge'}
                </button>
              )}

              {/* Response area */}
              {(selected.status === 'open' || selected.status === 'in_progress') && (
                <div className="space-y-3">
                  <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                    placeholder="Réponse / résolution…" />
                  <div className="flex gap-2">
                    <button onClick={() => doAction(selected.id, 'keep_open', { resolution: response })} disabled={submitting || !response.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-60">
                      <MessageSquare className="w-3.5 h-3.5" /> Répondre (garder ouvert)
                    </button>
                    <button onClick={() => doAction(selected.id, 'resolve', { resolution: response })} disabled={submitting || !response.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
                      style={{ backgroundColor: '#1E7A52' }}>
                      <CheckCircle className="w-3.5 h-3.5" /> Résoudre
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
