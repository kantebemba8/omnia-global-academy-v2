import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { BookOpen, CheckCircle, AlertCircle, Info, X, Clock } from 'lucide-react';

interface PendingCourse {
  id: string; title: string; teacher_name: string; submitted_at: string; category: string;
}
interface PublishedCourse {
  id: string; title: string; total_students: number; average_rating: number; price_xof: number; cpd_accredited: boolean;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

type Tab = 'pending' | 'published' | 'all';

export function DirecteurCatalogueInterne() {
  const [pending, setPending] = useState<PendingCourse[]>([]);
  const [published, setPublished] = useState<PublishedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [validateModal, setValidateModal] = useState<PendingCourse | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [validating, setValidating] = useState(false);
  const [validMsg, setValidMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token && !bypassAuth) { navigate('/connexion'); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-directeur`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403 && !bypassAuth) { navigate('/connexion'); return; }
      const json = await res.json();
      if (res.ok) {
        setPending(json.courses_pending_school ?? []);
        setPublished(json.courses_published ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  async function validateCourse(action: 'approve' | 'reject') {
    if (!validateModal) return;
    if (action === 'reject' && !rejectComment.trim()) { setValidMsg({ text: 'Un commentaire est requis.', ok: false }); return; }
    setValidating(true); setValidMsg(null);
    try {
      const token = localStorage.getItem('omnia_session_token') || '';
      const res = await fetch(`${getApiBase()}/school-course-validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: validateModal.id, action, comment: rejectComment }),
      });
      const json = await res.json();
      if (res.ok) {
        setValidMsg({ text: action === 'approve' ? 'Formation transmise à Omnia.' : 'Modification demandée à l\'enseignant.', ok: true });
        setTimeout(() => { setValidateModal(null); setRejectComment(''); setValidMsg(null); load(); }, 2000);
      } else setValidMsg({ text: json.message || json.error || 'Erreur', ok: false });
    } catch { setValidMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setValidating(false); }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'En attente de validation', count: pending.length },
    { key: 'published', label: 'Publiées', count: published.length },
    { key: 'all', label: 'Toutes', count: pending.length + published.length },
  ];

  const displayList = tab === 'pending' ? pending : tab === 'published' ? published : [...pending, ...published];

  return (
    <DashboardLayout role="directeur">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Catalogue interne</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les formations de votre établissement</p>
        </div>

        {/* Info card */}
        <div className="flex items-start gap-3 p-4 rounded-xl mb-5 text-sm" style={{ backgroundColor: '#F8F9FA', border: '1px solid #e5e7eb' }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
          <p className="text-gray-600">
            Les formations validées ici sont ensuite examinées par l'équipe Omnia Global Academy avant publication.
            L'approbation finale appartient toujours au Super-admin.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="text-sm px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
              style={tab === t.key ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb' }}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : displayList.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-100 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500">{tab === 'pending' ? 'Aucune formation en attente' : 'Aucune formation publiée'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tab === 'pending' && pending.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
                        En attente
                      </span>
                      <span className="text-xs text-gray-400">{c.category}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{c.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{c.teacher_name}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Soumis le {new Date(c.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => { setValidateModal(c); setRejectComment(''); setValidMsg(null); }}
                    className="flex-shrink-0 text-sm px-4 py-2 rounded-lg font-semibold text-white"
                    style={{ backgroundColor: '#002050' }}>
                    Examiner
                  </button>
                </div>
              </div>
            ))}
            {tab === 'published' && published.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{c.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{c.total_students} élève{c.total_students !== 1 ? 's' : ''}</span>
                    {c.average_rating > 0 && <span>★ {c.average_rating}/5</span>}
                    {c.cpd_accredited && <span className="text-green-600 font-medium">CPD</span>}
                  </div>
                </div>
                {c.price_xof > 0 && (
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#BF8813' }}>{c.price_xof.toLocaleString()} XOF</span>
                )}
              </div>
            ))}
            {tab === 'all' && (
              <>
                {pending.length > 0 && <p className="text-xs font-semibold text-gray-400 px-1">En attente de validation</p>}
                {pending.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full mr-2" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>En attente</span>
                      <span className="text-sm font-medium text-gray-900">{c.title}</span>
                    </div>
                    <button onClick={() => { setValidateModal(c); setRejectComment(''); setValidMsg(null); }}
                      className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#002050' }}>
                      Examiner
                    </button>
                  </div>
                ))}
                {published.length > 0 && <p className="text-xs font-semibold text-gray-400 px-1 mt-3">Publiées</p>}
                {published.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{c.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 flex-shrink-0">Publiée</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Validate modal */}
      {validateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Examiner la formation</h2>
              <button onClick={() => setValidateModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
                <p className="text-sm font-semibold text-gray-900">{validateModal.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{validateModal.teacher_name} · {validateModal.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison (requis si modification demandée)</label>
                <textarea rows={3} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Motif ou demande de modification..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
              {validMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${validMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {validMsg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {validMsg.text}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => validateCourse('reject')} disabled={validating || !rejectComment.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: '#DC2626', color: '#DC2626' }}>
                  Demander modifications
                </button>
                <button onClick={() => validateCourse('approve')} disabled={validating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#1E7A52' }}>
                  Approuver et transmettre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
