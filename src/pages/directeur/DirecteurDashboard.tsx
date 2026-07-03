import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { usePreviewMode } from '../../hooks/usePreviewMode';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, Wallet, Users, GraduationCap, PlusCircle, CheckCircle,
  AlertCircle, X, Building2, Clock, BookOpen
} from 'lucide-react';

interface Teacher {
  id: string; full_name: string; email: string; status: string;
  courses_count: number; total_students: number; average_rating: number; created_at: string;
}
interface PendingCourse {
  id: string; title: string; teacher_name: string; submitted_at: string; category: string;
}
interface DashData {
  etablissement: { school_name: string; logo_url: string | null; kyc_status: string };
  kpis: { chiffre_affaires_xof: number; solde_retirable_xof: number; eleves_inscrits: number; enseignants_actifs: number };
  enseignants: Teacher[];
  courses_pending_school: PendingCourse[];
  wallet: { balance_xof: number; total_earned_xof: number };
  recent_activity: unknown[];
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function monogram(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface AddTeacherModalProps { onClose: () => void; onSuccess: () => void }
function AddTeacherModal({ onClose, onSuccess }: AddTeacherModalProps) {
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    if (!form.full_name || !form.email || !form.phone_number) { setMsg({ text: 'Tous les champs sont requis.', ok: false }); return; }
    setSubmitting(true); setMsg(null);
    try {
      const token = localStorage.getItem('omnia_session_token') || '';
      const res = await fetch(`${getApiBase()}/teacher-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) { setMsg({ text: `Compte créé. Email envoyé à ${form.email}.`, ok: true }); setTimeout(() => { onSuccess(); onClose(); }, 2000); }
      else setMsg({ text: json.message || json.error || 'Erreur', ok: false });
    } catch { setMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Créer un compte enseignant</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          {[
            { key: 'full_name', label: 'Prénom et Nom', placeholder: 'Aminata Traoré' },
            { key: 'email', label: 'Email professionnel', placeholder: 'a.traore@ecole.com', type: 'email' },
            { key: 'phone_number', label: 'Téléphone', placeholder: '+223 70 00 00 00', type: 'tel' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input type={f.type || 'text'} value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
            </div>
          ))}
          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {msg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {msg.text}
            </div>
          )}
          <button onClick={submit} disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: '#002050' }}>
            {submitting ? 'Création en cours...' : 'Créer et envoyer les accès'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DirecteurDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [validateModal, setValidateModal] = useState<PendingCourse | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [validating, setValidating] = useState(false);
  const [previewToast, setPreviewToast] = useState(false);
  const navigate = useNavigate();
  const previewMode = usePreviewMode();

  function handlePreviewAction() {
    if (!previewMode) return;
    setPreviewToast(true);
    setTimeout(() => setPreviewToast(false), 3000);
  }

  const load = useCallback(async () => {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { if (!previewMode) navigate('/connexion'); setLoading(false); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-directeur`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) { if (!previewMode) navigate('/connexion'); setLoading(false); return; }
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, previewMode]);

  useEffect(() => { load(); }, [load]);

  async function validateCourse(action: 'approve' | 'reject') {
    if (!validateModal) return;
    if (action === 'reject' && !rejectComment.trim()) return;
    setValidating(true);
    try {
      const token = localStorage.getItem('omnia_session_token') || '';
      const res = await fetch(`${getApiBase()}/school-course-validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: validateModal.id, action, comment: rejectComment }),
      });
      if (res.ok) { setValidateModal(null); setRejectComment(''); load(); }
    } catch { /* ignore */ }
    finally { setValidating(false); }
  }

  // Mock chart data
  const chartData = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (9 - i) * 3);
    return {
      date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      inscriptions: Math.round((data?.kpis.eleves_inscrits ?? 0) / 10 * (i + 1) * 0.9 + Math.random() * 2),
      revenus: Math.round((data?.kpis.chiffre_affaires_xof ?? 0) / 10 * (i + 1)),
    };
  });

  const KPIS = [
    { label: "Chiffre d'affaires", value: `${(data?.kpis.chiffre_affaires_xof ?? 0).toLocaleString()} XOF`, icon: TrendingUp, color: '#BF8813' },
    { label: 'Solde retirable', value: `${(data?.kpis.solde_retirable_xof ?? 0).toLocaleString()} XOF`, icon: Wallet, color: '#1E7A52' },
    { label: 'Élèves inscrits', value: data?.kpis.eleves_inscrits ?? 0, icon: Users, color: '#002050' },
    { label: 'Enseignants actifs', value: data?.kpis.enseignants_actifs ?? 0, icon: GraduationCap, color: '#7C3AED' },
  ];

  return (
    <DashboardLayout role="directeur">
      {previewToast && (
        <div className="fixed top-16 right-4 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg">
          Mode aperçu — Action désactivée
        </div>
      )}
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5" style={{ color: '#002050' }} />
              <h1 className="text-2xl font-bold text-gray-900">{data?.etablissement.school_name || 'Tableau de bord École'}</h1>
            </div>
            <p className="text-gray-500 text-sm">Pilotez votre établissement</p>
          </div>
          <button onClick={() => previewMode ? handlePreviewAction() : setAddModal(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 ${previewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#002050' }}>
            <PlusCircle className="w-4 h-4" /> Nouvel enseignant
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {KPIS.map((k) => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs text-gray-500">{k.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.color + '15' }}>
                      <k.icon className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{k.value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[1fr_360px] gap-6">
              {/* Left column */}
              <div className="space-y-5">
                {/* Chart */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 text-sm mb-4">Performance — 30 jours</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} yAxisId="left" />
                      <YAxis tick={{ fontSize: 9 }} yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="left" type="monotone" dataKey="inscriptions" stroke="#002050" strokeWidth={2} dot={false} name="Inscriptions" />
                      <Line yAxisId="right" type="monotone" dataKey="revenus" stroke="#BF8813" strokeWidth={2} dot={false} name="Revenus XOF" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Pending school validation */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 text-sm">Formations en attente de validation</h2>
                    {(data?.courses_pending_school ?? []).length > 0 && (
                      <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{data!.courses_pending_school.length}</span>
                    )}
                  </div>
                  {(data?.courses_pending_school ?? []).length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">Aucune formation en attente</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {data!.courses_pending_school.map((c) => (
                        <div key={c.id} className="px-5 py-4 rounded-lg mx-3 my-2" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{c.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{c.teacher_name} · {c.category}</p>
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(c.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => { setValidateModal(c); setRejectComment(''); }}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                                style={{ backgroundColor: '#1E7A52' }}>
                                Examiner
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-5">
                {/* Teacher activity */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900 text-sm">Enseignants ({data?.enseignants.length ?? 0})</h2>
                  </div>
                  {(data?.enseignants ?? []).length === 0 ? (
                    <div className="p-6 text-center">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-xs text-gray-400">Invitez votre premier enseignant</p>
                      <button onClick={() => setAddModal(true)}
                        className="mt-3 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                        style={{ backgroundColor: '#002050' }}>
                        Ajouter
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {(data?.enseignants ?? []).slice(0, 5).map((t) => (
                        <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#002050' + '15', color: '#002050' }}>
                            {monogram(t.full_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{t.full_name}</p>
                            <p className="text-xs text-gray-400">{t.courses_count} cours · {t.total_students} élèves</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'actif' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            {t.status === 'actif' ? 'Actif' : 'Suspendu'}
                          </span>
                        </div>
                      ))}
                      {(data?.enseignants ?? []).length > 5 && (
                        <div className="px-5 py-3">
                          <Link to="/school/teachers" className="text-xs font-medium" style={{ color: '#002050' }}>
                            Voir tous les enseignants →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 text-sm mb-3">Actions rapides</h2>
                  <div className="space-y-2">
                    <button onClick={() => setAddModal(true)}
                      className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#002050' }}>
                      <PlusCircle className="w-4 h-4" /> Créer un compte enseignant
                    </button>
                    <Link to="/school/courses"
                      className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border"
                      style={{ borderColor: '#002050', color: '#002050' }}>
                      <BookOpen className="w-4 h-4" /> Voir le catalogue interne
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add teacher modal */}
      {addModal && <AddTeacherModal onClose={() => setAddModal(false)} onSuccess={load} />}

      {/* Validate course modal */}
      {validateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Valider la formation</h2>
              <button onClick={() => setValidateModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
                <p className="text-sm font-semibold text-gray-900">{validateModal.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{validateModal.teacher_name} · {validateModal.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire (requis si rejet)</label>
                <textarea rows={3} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Motif de rejet ou demande de modification..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => validateCourse('reject')} disabled={validating || !rejectComment.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: '#DC2626', color: '#DC2626' }}>
                  Rejeter
                </button>
                <button onClick={() => validateCourse('approve')} disabled={validating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#1E7A52' }}>
                  Approuver et transmettre
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                La formation sera transmise à l'équipe Omnia pour validation finale.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
