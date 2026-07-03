import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { Briefcase, CheckCircle, XCircle, ChevronDown, ChevronUp, MapPin, Clock, Tag } from 'lucide-react';

interface JobOffer {
  id: string; title: string; description: string; location: string;
  contract_type: string; category: string; deadline: string; status: string;
  posted_by_id: string; establishment_id: string | null; created_at: string;
  school_name: string | null;
}
interface JobsData {
  pending_jobs: JobOffer[];
  approved_jobs: { id: string; title: string; contract_type: string; category: string; status: string; moderated_at: string }[];
  rejected_jobs: { id: string; title: string; status: string; moderated_at: string }[];
}

const CONTRACT_LABELS: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance', alternance: 'Alternance',
};

export default function ModerateurOffresEmploi() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<{ job: JobOffer; action: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  function load() {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.moderatorJobAction, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function doAction() {
    if (!modal) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.moderatorJobAction, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: modal.job.id, action: modal.action, reason }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      setToast(modal.action === 'approve' ? 'Offre approuvée.' : 'Offre rejetée.');
      setModal(null); setReason('');
      load();
    } else {
      setToast(d.message ?? 'Erreur.');
    }
    setTimeout(() => setToast(''), 4000);
  }

  const pending = data?.pending_jobs ?? [];

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Offres d'emploi</h1>
          <p className="text-gray-500 text-sm mt-1">{pending.length} offre(s) en attente de modération</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#BF8813' }} />
            <p className="text-gray-400 text-sm">Aucune offre en attente de modération</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((j) => {
              const isOpen = expanded === j.id;
              return (
                <div key={j.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : j.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{j.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {j.school_name ?? 'Particulier'} · {CONTRACT_LABELS[j.contract_type] ?? j.contract_type}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700">En attente</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                      <p className="text-sm text-gray-700 leading-relaxed">{j.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{j.location}</span>
                        <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{j.category}</span>
                        {j.deadline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Limite : {new Date(j.deadline).toLocaleDateString('fr-FR')}</span>}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setModal({ job: j, action: 'approve' })}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                          style={{ backgroundColor: '#1E7A52' }}>
                          <CheckCircle className="w-3.5 h-3.5" /> Approuver
                        </button>
                        <button onClick={() => { setModal({ job: j, action: 'reject' }); setReason(''); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Rejeter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recent approved/rejected */}
        {((data?.approved_jobs?.length ?? 0) > 0 || (data?.rejected_jobs?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.approved_jobs?.length ?? 0) > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-sm mb-3" style={{ color: '#002050' }}>Récemment approuvées</h3>
                <div className="space-y-2">
                  {data?.approved_jobs?.map((j) => (
                    <div key={j.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{j.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(data?.rejected_jobs?.length ?? 0) > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-sm mb-3" style={{ color: '#002050' }}>Récemment rejetées</h3>
                <div className="space-y-2">
                  {data?.rejected_jobs?.map((j) => (
                    <div key={j.id} className="flex items-center gap-2 text-sm">
                      <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{j.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>
                {modal.action === 'approve' ? "Approuver l'offre" : "Rejeter l'offre"}
              </h3>
              <p className="text-sm text-gray-600">{modal.job.title}</p>
              {modal.action === 'reject' && (
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                  placeholder="Motif du rejet (optionnel)…" />
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setModal(null); setReason(''); }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={doAction} disabled={submitting}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 ${modal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  style={modal.action === 'approve' ? { backgroundColor: '#1E7A52' } : {}}>
                  {submitting ? 'En cours…' : modal.action === 'approve' ? 'Approuver' : 'Rejeter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
