import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { BookOpen, CheckCircle, XCircle, ChevronDown, ChevronUp, DollarSign, AlertTriangle, Send, Upload, FileText, Package } from 'lucide-react';

interface CourseItem {
  id: string; title: string; creator_name: string; score_calcule: number | null;
  prix_provisoire_xof: number | null; category: string; created_at: string;
  establishment_id: string | null; instructor_id: string;
  examen_oral_statut?: string;
}
interface AdminData { cours_a_publier: CourseItem[] }

type ActionModal = { course: CourseItem; action: 'publish' | 'reject' | 'request_modification' | 'school_split' };

export default function AdminCatalogue() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'a_publier' | 'publiees' | 'toutes' | 'assistee'>('a_publier');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<ActionModal | null>(null);
  const [finalPrice, setFinalPrice] = useState('');
  const [comment, setComment] = useState('');
  const [forceCpd, setForceCpd] = useState(false);
  const [cpdHours, setCpdHours] = useState('');
  const [schoolSplit, setSchoolSplit] = useState({ school_percent: 50, platform_percent: 50, school_amount_xof: 0, platform_amount_xof: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  function load() {
    const token = localStorage.getItem('omnia_session_token');
    fetch(`${ENDPOINTS.dashboardAdmin}?period=30d`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function calcSplit(coursePrice: number, schoolPct: number) {
    const schoolAmt = Math.round(coursePrice * schoolPct / 100);
    const platformAmt = coursePrice - schoolAmt;
    setSchoolSplit({ school_percent: schoolPct, platform_percent: 100 - schoolPct, school_amount_xof: schoolAmt, platform_amount_xof: platformAmt });
  }

  async function doPublish(action: string) {
    if (!modal) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');

    if (action === 'school_split') {
      const res = await fetch(ENDPOINTS.adminSchoolSplit, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: modal.course.id, action: 'propose', split_data: schoolSplit }),
      });
      const d = await res.json();
      setSubmitting(false);
      if (d.success) { setToast('Répartition envoyée au Directeur.'); setModal(null); }
      else setToast(d.message ?? 'Erreur.');
      setTimeout(() => setToast(''), 4000);
      return;
    }

    const res = await fetch(ENDPOINTS.adminPublishCourse, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: modal.course.id, action,
        final_price_xof: finalPrice ? parseInt(finalPrice) : undefined,
        comment: comment || undefined,
        cpd_accredited: forceCpd || undefined,
        cpd_hours: forceCpd && cpdHours ? parseFloat(cpdHours) : undefined,
      }),
    });
    const d = await res.json();
    setSubmitting(false);
    const msgs: Record<string, string> = { publish: 'Formation publiée !', reject: 'Formation rejetée.', request_modification: 'Modifications demandées.' };
    if (d.success) { setToast(msgs[action] ?? 'OK'); setModal(null); load(); }
    else setToast(d.message ?? d.error ?? 'Erreur.');
    setTimeout(() => setToast(''), 4000);
  }

  const courses = data?.cours_a_publier ?? [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Catalogue & CPD</h1>
          <p className="text-gray-500 text-sm mt-0.5">Publication et gestion des formations</p>
        </div>

        <div className="flex gap-1 flex-wrap bg-gray-100 p-1 rounded-xl">
          {[{ k: 'a_publier', l: `À publier (${courses.length})` }, { k: 'publiees', l: 'Publiées' }, { k: 'toutes', l: 'Toutes' }, { k: 'assistee', l: 'Saisie Assistée' }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.k ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'a_publier' && (
          loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
              <p className="text-gray-400 text-sm">Aucune formation en attente de publication</p>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((c) => {
                const isOpen = expanded === c.id;
                const isSchool = !!c.establishment_id;
                return (
                  <div key={c.id} className="rounded-xl shadow-sm border overflow-hidden"
                    style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : c.id)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.creator_name} · {c.category}
                          {isSchool && <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">École</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {c.score_calcule != null && (
                          <div className="flex items-center gap-1.5 justify-end">
                            <p className="text-sm font-semibold" style={{ color: '#BF8813' }}>Score: {c.score_calcule}</p>
                            {c.examen_oral_statut === 'confirme' && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F0FDF4', color: '#1E7A52', border: '1px solid #BBF7D0' }}>+6 pts</span>
                            )}
                          </div>
                        )}
                        {c.prix_provisoire_xof != null && (
                          <p className="text-xs text-gray-500">{c.prix_provisoire_xof.toLocaleString('fr-FR')} XOF</p>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                    {isOpen && (
                      <div className="border-t border-orange-100 px-5 py-4 space-y-4 bg-white">
                        <div className="rounded-lg p-3 bg-amber-50 border border-amber-100 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">
                            Seul le Super-admin peut publier. Vérifiez le contenu avant toute action.
                          </p>
                        </div>

                        {/* Independent professor */}
                        {!isSchool && (
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Prix définitif (XOF)</label>
                                <input type="number" placeholder={String(c.prix_provisoire_xof ?? '')}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                                  id={`price-${c.id}`} />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Override commission % plateforme</label>
                                <input type="number" min="0" max="100" placeholder="Ex: 30"
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                                  id={`comm-${c.id}`} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setModal({ course: c, action: 'publish' }); setFinalPrice((document.getElementById(`price-${c.id}`) as HTMLInputElement)?.value ?? ''); setComment(''); setForceCpd(false); setCpdHours(''); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                                style={{ backgroundColor: '#1E7A52' }}>
                                <CheckCircle className="w-4 h-4" /> Publier
                              </button>
                              <button onClick={() => { setModal({ course: c, action: 'request_modification' }); setComment(''); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                                Demander modif.
                              </button>
                              <button onClick={() => { setModal({ course: c, action: 'reject' }); setComment(''); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                                <XCircle className="w-4 h-4" /> Rejeter
                              </button>
                            </div>
                          </div>
                        )}

                        {/* School course */}
                        {isSchool && (
                          <div className="space-y-3">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                              <p className="text-xs font-medium text-blue-700 mb-2">Répartition financière</p>
                              <div className="flex items-center gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">% École</label>
                                  <input type="number" min="0" max="100" value={schoolSplit.school_percent}
                                    onChange={(e) => calcSplit(c.prix_provisoire_xof ?? 0, parseInt(e.target.value) || 0)}
                                    className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center ml-2 focus:outline-none" />
                                </div>
                                <span className="text-gray-400 text-sm">+</span>
                                <div>
                                  <label className="text-xs text-gray-500">% Plateforme</label>
                                  <input type="number" value={schoolSplit.platform_percent} readOnly
                                    className="w-20 border border-gray-100 rounded px-2 py-1 text-sm text-center ml-2 bg-gray-50 text-gray-400" />
                                </div>
                                <span className="text-gray-400 text-sm">= 100%</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                École : {schoolSplit.school_amount_xof.toLocaleString('fr-FR')} XOF · Plateforme : {schoolSplit.platform_amount_xof.toLocaleString('fr-FR')} XOF
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setModal({ course: c, action: 'school_split' })}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                                style={{ backgroundColor: '#002050' }}>
                                <Send className="w-4 h-4" /> Envoyer proposition au Directeur
                              </button>
                              <button onClick={() => { setModal({ course: c, action: 'publish' }); setFinalPrice(''); setComment(''); setForceCpd(false); setCpdHours(''); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                                style={{ backgroundColor: '#1E7A52' }}>
                                <CheckCircle className="w-4 h-4" /> Publier (si accepté)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab !== 'a_publier' && tab !== 'assistee' && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">Aucune formation dans cette catégorie.</p>
          </div>
        )}

        {tab === 'assistee' && (
          <AssisteeTab />
        )}

        {/* Modals */}
        {modal && modal.action !== 'school_split' && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>
                {modal.action === 'publish' ? 'Publier la formation' : modal.action === 'reject' ? 'Rejeter la formation' : 'Demander des modifications'}
              </h3>
              <p className="text-sm text-gray-600 font-medium">{modal.course.title}</p>
              {modal.action === 'publish' && !modal.course.establishment_id && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix final (XOF)</label>
                  <input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)}
                    placeholder={String(modal.course.prix_provisoire_xof ?? '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              )}
              {modal.action === 'publish' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg border transition-colors"
                    style={{ borderColor: forceCpd ? '#1E7A52' : '#E4E7EC', backgroundColor: forceCpd ? '#F0FDF4' : '#F9FAFB' }}>
                    <input type="checkbox" checked={forceCpd} onChange={e => setForceCpd(e.target.checked)}
                      className="w-4 h-4" style={{ accentColor: '#1E7A52' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: forceCpd ? '#1E7A52' : '#374151' }}>Accréditer CPD</p>
                      <p className="text-xs text-gray-400">Marque la formation comme accréditée CPD à la publication</p>
                    </div>
                  </label>
                  {forceCpd && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Heures CPD attribuées</label>
                      <input type="number" min="0.5" max="40" step="0.5" value={cpdHours}
                        onChange={e => setCpdHours(e.target.value)} placeholder="Ex: 3.5"
                        className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                  )}
                </div>
              )}
              {(modal.action === 'reject' || modal.action === 'request_modification') && (
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  placeholder="Commentaire (obligatoire pour rejet)…" />
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setModal(null); }} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={() => doPublish(modal.action)} disabled={submitting || (modal.action === 'reject' && !comment.trim())}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 ${modal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  style={modal.action !== 'reject' ? { backgroundColor: modal.action === 'publish' ? '#1E7A52' : '#BF8813' } : {}}>
                  {submitting ? 'En cours…' : modal.action === 'publish' ? 'Confirmer la publication' : modal.action === 'reject' ? 'Rejeter' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal?.action === 'school_split' && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Confirmer la proposition</h3>
              <p className="text-sm text-gray-600">Envoyer la répartition suivante au Directeur pour approbation :</p>
              <div className="rounded-lg p-3 bg-gray-50 border border-gray-100 space-y-1 text-sm">
                <p>École : <strong>{schoolSplit.school_percent}%</strong> ({schoolSplit.school_amount_xof.toLocaleString('fr-FR')} XOF)</p>
                <p>Plateforme : <strong>{schoolSplit.platform_percent}%</strong> ({schoolSplit.platform_amount_xof.toLocaleString('fr-FR')} XOF)</p>
              </div>
              <p className="text-xs text-gray-400">La formation ne sera publiée qu'après acceptation du Directeur.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={() => doPublish('school_split')} disabled={submitting}
                  className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60"
                  style={{ backgroundColor: '#002050' }}>
                  {submitting ? 'Envoi…' : 'Envoyer au Directeur'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

const CATEGORIES_LIST = ['Finance', 'Comptabilité', 'Marketing', 'Management', 'Tech & Digital', 'Droit', 'RH', 'Santé', 'Education', 'Autre'];
const LEVELS_LIST = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'];

function AssisteeTab() {
  const navigate = useNavigate();
  const [option, setOption] = useState<'none' | 'assisted' | 'platform'>('none');
  const [contentType, setContentType] = useState<'studio' | 'pdf' | 'scorm'>('studio');
  const [professors, setProfessors] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedProf, setSelectedProf] = useState('');
  const [form, setForm] = useState({ title: '', short_description: '', category: '', level: '', price_xof: '', is_free: false });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('omnia_session_token');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${url}/rest/v1/users?select=id,full_name,email&eq.status=actif`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setProfessors(d); }).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function createPlatformCourse() {
    if (!form.title || !form.category || !form.level) { setToast('Titre, catégorie et niveau requis.'); return; }
    setCreating(true);
    const token = localStorage.getItem('omnia_session_token');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/course-create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          short_description: form.short_description,
          category: form.category,
          level: form.level,
          price_xof: form.is_free ? 0 : parseInt(form.price_xof) || 0,
          is_free: form.is_free,
          creator_type: 'plateforme',
        }),
      });
      const d = await res.json();
      if (d.success && d.course_id) {
        if (contentType === 'studio') {
          navigate(`/professeur/courses/${d.course_id}/edit`);
        } else {
          setToast(`Formation créée (ID: ${d.course_id}). Upload du contenu à implémenter.`);
        }
      } else {
        setToast(d.message || d.error || 'Erreur lors de la création.');
      }
    } catch { setToast('Erreur réseau.'); }
    finally { setCreating(false); setTimeout(() => setToast(''), 5000); }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200" style={{ color: '#002050' }}>{toast}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option A */}
        <button
          onClick={() => setOption(option === 'assisted' ? 'none' : 'assisted')}
          className={`text-left p-5 rounded-xl border-2 transition-all ${option === 'assisted' ? 'border-[#BF8813] bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(191,136,19,0.12)' }}>
              <FileText className="w-5 h-5" style={{ color: '#BF8813' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: '#002050' }}>Formation assistée</p>
          </div>
          <p className="text-xs text-gray-500">Au nom d'un professeur avec KYC validé. Commission : 50/50 sans CPD ou 30/70 avec CPD.</p>
        </button>

        {/* Option B */}
        <button
          onClick={() => setOption(option === 'platform' ? 'none' : 'platform')}
          className={`text-left p-5 rounded-xl border-2 transition-all ${option === 'platform' ? 'border-[#002050] bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,32,80,0.08)' }}>
              <Upload className="w-5 h-5" style={{ color: '#002050' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: '#002050' }}>Formation plateforme</p>
          </div>
          <p className="text-xs text-gray-500">Créée directement par Omnia. Publiée sans validation modérateur.</p>
        </button>
      </div>

      {/* Option A: Assisted */}
      {option === 'assisted' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Formation assistée — sélectionner un professeur</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Professeur (KYC validé)</label>
            <select value={selectedProf} onChange={e => setSelectedProf(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">— Choisir un professeur —</option>
              {professors.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
            </select>
          </div>
          <button
            onClick={() => selectedProf && navigate(`/admin/courses/new?assisted=true&creator_id=${selectedProf}`)}
            disabled={!selectedProf}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#BF8813' }}>
            Ouvrir le Studio pour ce professeur →
          </button>
        </div>
      )}

      {/* Option B: Platform course */}
      {option === 'platform' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Formation plateforme — informations</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Titre *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Titre de la formation" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description courte *</label>
              <input value={form.short_description} onChange={e => set('short_description', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Résumé en 1-2 phrases" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">— Catégorie —</option>
                {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Niveau *</label>
              <select value={form.level} onChange={e => set('level', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">— Niveau —</option>
                {LEVELS_LIST.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1 cursor-pointer">
                <input type="checkbox" checked={form.is_free} onChange={e => set('is_free', e.target.checked)} className="w-4 h-4" style={{ accentColor: '#002050' }} />
                Formation gratuite
              </label>
              {!form.is_free && (
                <input type="number" value={form.price_xof} onChange={e => set('price_xof', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Prix en XOF" min="0" />
              )}
            </div>
          </div>

          {/* Content type */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Type de contenu</label>
            {[
              { value: 'studio', icon: FileText, label: 'Saisir le contenu (modules/leçons)', desc: 'Ouvre le Studio avec architecture complète' },
              { value: 'pdf', icon: Upload, label: 'Upload PDF ou Word', desc: 'Le fichier sera affiché dans le lecteur de cours' },
              { value: 'scorm', icon: Package, label: 'Upload SCORM (.zip)', desc: 'Packages SCORM 1.2 et 2004 supportés — max 500 MB' },
            ].map(({ value, icon: Icon, label, desc }) => (
              <label key={value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${contentType === value ? 'border-[#002050] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="contentType" value={value} checked={contentType === value} onChange={() => setContentType(value as typeof contentType)} className="mt-0.5" style={{ accentColor: '#002050' }} />
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: contentType === value ? '#002050' : '#9CA3AF' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#002050' }}>{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                  {contentType === value && value === 'pdf' && (
                    <input type="file" accept=".pdf,.doc,.docx" className="mt-2 text-xs" />
                  )}
                  {contentType === value && value === 'scorm' && (
                    <input type="file" accept=".zip" className="mt-2 text-xs" />
                  )}
                </div>
              </label>
            ))}
          </div>

          <button onClick={createPlatformCourse} disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#002050' }}>
            {creating ? 'Création…' : contentType === 'studio' ? 'Créer et ouvrir le Studio →' : 'Créer la formation'}
          </button>
        </div>
      )}
    </div>
  );
}
