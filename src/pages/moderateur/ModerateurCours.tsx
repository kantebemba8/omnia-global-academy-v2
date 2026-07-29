import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle, XCircle, Send, DollarSign, BookOpen, Clock, Mic } from 'lucide-react';

interface CourseItem {
  id: string; title: string; description: string; status: string;
  instructor_name: string; instructor_email: string; price: number | null;
  category: string; created_at: string; modules_count: number; lessons_count: number;
  examen_oral_statut?: string;
}
interface CoursesData {
  courses: CourseItem[];
  permissions: { can_see_pending_courses: boolean; can_review_course_content: boolean; can_recommend_course_price: boolean; can_reject_course: boolean; can_approve_transmit_course: boolean };
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente_validation_manuelle: { label: 'En attente', color: '#BF8813', bg: '#FEF9EE' },
  validee: { label: 'Validée', color: '#1E7A52', bg: '#F0FAF5' },
  rejetee: { label: 'Rejetée', color: '#dc2626', bg: '#FEF2F2' },
  modification_demandee: { label: 'Correction demandée', color: '#7c3aed', bg: '#F5F3FF' },
};

export default function ModerateurCours() {
  const [data, setData] = useState<CoursesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<{ course: CourseItem; action: 'reject' | 'transmit' | 'price' | 'oral_recommend' } | null>(null);
  const [reason, setReason] = useState('');
  const [price, setPrice] = useState('');
  const [oralJustification, setOralJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  async function load() {
    if (bypassAuth) { setLoading(false); return; }
    try {
      setLoading(true);
      const token = localStorage.getItem('omnia_session_token');
      const response = await fetch(ENDPOINTS.moderatorCourseAction, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || 'Impossible de charger les formations');
      setData(result as CoursesData);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function doAction(courseId: string, action: string, extra?: Record<string, unknown>) {
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.moderatorCourseAction, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (d.error === 'CONFLICT_OF_INTEREST') {
      setToast(d.message || "Conflit d'intérêt détecté.");
    } else if (res.ok && d.success) {
      setToast(d.message ?? 'Action effectuée.');
      setModal(null);
      setReason('');
      setPrice('');
      setOralJustification('');
      load();
    } else {
      setToast(d.message || d.error || "Erreur lors de l'action.");
    }
    setTimeout(() => setToast(''), 4000);
  }

  if (loading) {
    return (
      <ModerateurLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </ModerateurLayout>
    );
  }

  const courses = data?.courses ?? [];
  const perms = data?.permissions;

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Modération des formations</h1>
            <p className="text-gray-500 text-sm mt-1">{courses.length} formation(s) à traiter</p>
          </div>
        </div>

        {/* Never publishes notice */}
        <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Vous ne publiez jamais directement. Approuver = transmettre au Super-admin qui décide de la publication finale.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">Aucune formation à modérer</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((c) => {
              const st = STATUS_LABELS[c.status] ?? { label: c.status, color: '#6b7280', bg: '#f9fafb' };
              const isOpen = expanded === c.id;
              return (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : c.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{c.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.instructor_name} • {c.category}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                    <span className="text-gray-400">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                      <p className="text-sm text-gray-600 leading-relaxed">{c.description}</p>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{c.modules_count} modules, {c.lessons_count} leçons</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Soumis {new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                        {c.price != null && (
                          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Prix actuel : {c.price.toLocaleString('fr-FR')} XOF</span>
                        )}
                      </div>

                      {/* Anti-conflict notice */}
                      <div className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                        <p className="text-xs text-gray-500">
                          Instructeur : <strong>{c.instructor_name}</strong> ({c.instructor_email})
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Si cette formation vous appartient, le système bloquera automatiquement l'action.
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {perms?.can_recommend_course_price && (
                          <button onClick={() => { setModal({ course: c, action: 'price' }); setPrice(String(c.price ?? '')); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
                            <DollarSign className="w-3.5 h-3.5" style={{ color: '#BF8813' }} /> Modifier le prix
                          </button>
                        )}
                        {perms?.can_approve_transmit_course && c.status === 'en_attente_validation_manuelle' && (
                          <button onClick={() => setModal({ course: c, action: 'transmit' })}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                            style={{ backgroundColor: '#1E7A52' }}>
                            <Send className="w-3.5 h-3.5" /> Transmettre au Super-admin
                          </button>
                        )}
                        {perms?.can_reject_course && c.status === 'en_attente_validation_manuelle' && (
                          <button onClick={() => { setModal({ course: c, action: 'reject' }); setReason(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Rejeter
                          </button>
                        )}
                      </div>

                      {/* Oral exam workflow */}
                      {perms?.can_review_course_content && c.category === 'Langues & Linguistique' && c.examen_oral_statut && c.examen_oral_statut !== 'non_propose' && (
                        <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <Mic className="w-4 h-4" style={{ color: '#1E7A52' }} />
                            <p className="text-sm font-semibold" style={{ color: '#166534' }}>Examen oral</p>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto" style={{
                              backgroundColor: c.examen_oral_statut === 'confirme' ? '#BBF7D0' : '#FEF9EE',
                              color: c.examen_oral_statut === 'confirme' ? '#166534' : '#BF8813',
                            }}>
                              {c.examen_oral_statut === 'propose_par_professeur' ? 'Proposé' : c.examen_oral_statut === 'recommande_par_moderateur' ? 'Recommandé' : 'Confirmé'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {c.examen_oral_statut === 'propose_par_professeur' && (
                              <button
                                onClick={() => doAction(c.id, 'confirm_oral_exam')}
                                disabled={submitting}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                                style={{ backgroundColor: '#1E7A52' }}>
                                <CheckCircle className="w-3.5 h-3.5" /> Confirmer l'examen oral
                              </button>
                            )}
                            {c.examen_oral_statut !== 'confirme' && (
                              <button
                                onClick={() => { setModal({ course: c, action: 'oral_recommend' }); setOralJustification(''); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-green-200 hover:bg-green-50 transition-colors"
                                style={{ color: '#166534' }}>
                                <Send className="w-3.5 h-3.5" /> Recommander au Super-admin
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              {modal.action === 'transmit' && (
                <>
                  <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Transmettre au Super-admin</h3>
                  <p className="text-sm text-gray-600">La formation <strong>{modal.course.title}</strong> sera transmise au Super-admin pour approbation finale et publication. Vous ne pouvez pas publier directement.</p>
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                    <button onClick={() => doAction(modal.course.id, 'transmit_to_admin')} disabled={submitting}
                      className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60"
                      style={{ backgroundColor: '#1E7A52' }}>
                      {submitting ? 'En cours…' : 'Confirmer la transmission'}
                    </button>
                  </div>
                </>
              )}
              {modal.action === 'reject' && (
                <>
                  <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Rejeter la formation</h3>
                  <p className="text-sm text-gray-600">Motif de rejet (obligatoire) :</p>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                    style={{ '--tw-ring-color': '#002050' } as React.CSSProperties}
                    placeholder="Expliquez les raisons du rejet…" />
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                    <button onClick={() => doAction(modal.course.id, 'reject', { comment: reason })} disabled={submitting || !reason.trim()}
                      className="px-4 py-2 text-sm rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 disabled:opacity-60">
                      {submitting ? 'En cours…' : 'Rejeter'}
                    </button>
                  </div>
                </>
              )}
              {modal.action === 'price' && (
                <>
                  <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Modifier le prix</h3>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': '#002050' } as React.CSSProperties}
                    placeholder="Prix en XOF" />
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                    <button onClick={() => doAction(modal.course.id, 'set_price', { price_xof: Number(price) })} disabled={submitting || !price}
                      className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60"
                      style={{ backgroundColor: '#BF8813' }}>
                      {submitting ? 'En cours…' : 'Enregistrer le prix'}
                    </button>
                  </div>
                </>
              )}
              {modal.action === 'oral_recommend' && (
                <>
                  <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5" style={{ color: '#1E7A52' }} />
                    <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Recommander l'examen oral</h3>
                  </div>
                  <p className="text-sm text-gray-600">Transmettez votre recommandation au Super-admin pour validation finale de l'examen oral de <strong>{modal.course.title}</strong>.</p>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Justification (optionnel)</label>
                    <textarea value={oralJustification} onChange={(e) => setOralJustification(e.target.value)} rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                      style={{ '--tw-ring-color': '#1E7A52' } as React.CSSProperties}
                      placeholder="Expliquez pourquoi vous recommandez cet examen oral…" />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                    <button onClick={() => doAction(modal.course.id, 'recommend_oral_exam', { justification: oralJustification })} disabled={submitting}
                      className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60"
                      style={{ backgroundColor: '#1E7A52' }}>
                      {submitting ? 'En cours…' : 'Recommander'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
