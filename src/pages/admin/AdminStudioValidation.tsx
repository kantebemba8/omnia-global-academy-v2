import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import {
  BookOpen, CheckCircle, X, Clock, AlertCircle, Eye,
  RefreshCw, ChevronRight, MessageSquare, Award,
  Users, BarChart2, FileText, Layers, HelpCircle,
  Check, XCircle, Edit2, Archive, Send
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API = `${SUPABASE_URL}/functions/v1/studio-unified`;

interface Course {
  id: string; title: string; studio_status: string;
  category?: string; level?: string; cover_image_url?: string;
  creator_id?: string; submitted_at?: string; updated_at: string;
  admin_comment?: string; word_count?: number;
}

interface CourseDetail {
  id: string; title: string; studio_status: string;
  short_description?: string; long_description?: string;
  category?: string; level?: string; language?: string;
  prerequisites?: string; objectives?: string[];
  cover_image_url?: string; creator_id?: string;
  submitted_at?: string; admin_comment?: string;
  word_count?: number; estimated_read_min?: number;
  template_used?: string;
}

interface Module { id: string; title: string; objective: string; position: number; lessons: Lesson[]; }
interface Lesson { id: string; title: string; position: number; has_blocks: boolean; block_count: number; word_count: number; }

const STUDIO_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:              { label: 'Brouillon',             color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  pending_validation: { label: 'En attente',            color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  changes_requested:  { label: 'Modification demandée', color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  rejected:           { label: 'Refusée',               color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  validated:          { label: 'Validée',               color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  published:          { label: 'Publiée',               color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  archived:           { label: 'Archivée',              color: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
};

type SubTab = 'pending' | 'all' | 'published' | 'rejected';

export default function AdminStudioValidation() {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<SubTab>('pending');
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [selectedModules, setSelectedModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [comment, setComment] = useState('');
  const [showCommentFor, setShowCommentFor] = useState<'changes' | 'reject' | null>(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 4000);
  }

  async function callApi(action: string, body: Record<string, any> = {}) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    return res.json();
  }

  async function loadPending() {
    setLoading(true);
    try {
      const data = await callApi('get_pending_courses');
      if (data.success) setCourses(data.courses || []);
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const data = await callApi('get_my_courses');
      if (data.success) setAllCourses(data.courses || []);
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }

  async function loadDetail(courseId: string) {
    setLoadingDetail(true);
    setSelectedCourse(null);
    setSelectedModules([]);
    try {
      const data = await callApi('get_course', { course_id: courseId });
      if (data.success) {
        setSelectedCourse(data.course);
        setSelectedModules(data.modules || []);
      }
    } catch { showToast('Erreur', 'error'); }
    finally { setLoadingDetail(false); }
  }

  async function loadLogs(courseId: string) {
    const data = await callApi('get_change_logs', { course_id: courseId });
    if (data.success) { setLogs(data.logs || []); setShowLogs(true); }
  }

  useEffect(() => {
    if (subTab === 'pending') loadPending();
    else loadAll();
  }, [subTab]);

  async function doAction(action: string, courseId: string, cmt?: string) {
    setActionLoading(action);
    try {
      const data = await callApi(action, { course_id: courseId, comment: cmt });
      if (data.success) {
        showToast(
          action === 'admin_validate' ? '✅ Formation validée' :
          action === 'admin_publish' ? '✅ Formation publiée' :
          action === 'admin_request_changes' ? '✅ Demande de modification envoyée' :
          action === 'admin_reject' ? '✅ Formation refusée' :
          '✅ Action effectuée'
        );
        setShowCommentFor(null);
        setComment('');
        // Mettre à jour le statut local
        if (selectedCourse?.id === courseId) {
          const newStatus = action === 'admin_validate' ? 'validated' : action === 'admin_publish' ? 'published' : action === 'admin_request_changes' ? 'changes_requested' : action === 'admin_reject' ? 'rejected' : 'archived';
          setSelectedCourse(c => c ? { ...c, studio_status: newStatus } : c);
        }
        // Recharger la liste
        if (subTab === 'pending') loadPending();
        else loadAll();
      } else {
        showToast(data.message || 'Erreur', 'error');
      }
    } catch { showToast('Erreur réseau', 'error'); }
    finally { setActionLoading(''); }
  }

  const displayCourses = subTab === 'pending' ? courses
    : subTab === 'published' ? allCourses.filter(c => c.studio_status === 'published')
    : subTab === 'rejected' ? allCourses.filter(c => ['rejected', 'changes_requested'].includes(c.studio_status))
    : allCourses;

  return (
    <AdminLayout>
      <div className="flex h-screen" style={{ background: '#F8F9FA' }}>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
            style={{ background: toastType === 'success' ? 'white' : '#FEF2F2', borderColor: toastType === 'success' ? '#E4E7EC' : '#FECACA', color: toastType === 'success' ? '#002050' : '#DC2626' }}>
            {toast}
          </div>
        )}

        {/* ── LISTE FORMATIONS ──────────────────────────── */}
        <div className="w-80 bg-white border-r flex flex-col" style={{ borderColor: '#E4E7EC' }}>
          <div className="p-4 border-b" style={{ borderColor: '#E4E7EC' }}>
            <h2 className="font-black text-lg" style={{ color: '#002050' }}>Validation formations</h2>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Studio de Conception de Formation</p>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b" style={{ borderColor: '#E4E7EC' }}>
            {([
              { key: 'pending', label: `En attente (${courses.length})` },
              { key: 'all', label: 'Toutes' },
              { key: 'published', label: 'Publiées' },
              { key: 'rejected', label: 'Refusées' },
            ] as { key: SubTab; label: string }[]).map(t => (
              <button key={t.key} onClick={() => { setSubTab(t.key); setSelectedCourse(null); }}
                className="flex-1 py-2.5 text-xs font-semibold transition-all"
                style={subTab === t.key ? { color: '#002050', borderBottom: '2px solid #BF8813' } : { color: '#9CA3AF' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              </div>
            ) : displayCourses.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={32} className="mx-auto mb-2 opacity-20" style={{ color: '#002050' }} />
                <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune formation</p>
              </div>
            ) : (
              displayCourses.map(course => {
                const sc = STUDIO_STATUS[course.studio_status] || STUDIO_STATUS.draft;
                const isSelected = selectedCourse?.id === course.id;
                return (
                  <button key={course.id} onClick={() => loadDetail(course.id)}
                    className="w-full text-left p-4 border-b transition-all"
                    style={{ borderColor: '#E4E7EC', background: isSelected ? '#EEF2FF' : 'transparent' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#002050' }}>{course.title}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{course.category || 'Sans catégorie'}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                          <span className="text-xs font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                        </div>
                        {course.submitted_at && (
                          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                            Soumis le {new Date(course.submitted_at).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 border-t" style={{ borderColor: '#E4E7EC' }}>
            <button onClick={() => subTab === 'pending' ? loadPending() : loadAll()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>
        </div>

        {/* ── DÉTAIL FORMATION ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedCourse && !loadingDetail && (
            <div className="flex flex-col items-center justify-center h-full">
              <BookOpen size={48} className="mb-3 opacity-10" style={{ color: '#002050' }} />
              <p className="font-semibold" style={{ color: '#9CA3AF' }}>Sélectionnez une formation pour l'examiner</p>
            </div>
          )}

          {loadingDetail && (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
            </div>
          )}

          {selectedCourse && !loadingDetail && (
            <div className="max-w-3xl mx-auto space-y-5">

              {/* Header */}
              <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E4E7EC' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black" style={{ color: '#002050' }}>{selectedCourse.title}</h1>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {(() => { const sc = STUDIO_STATUS[selectedCourse.studio_status] || STUDIO_STATUS.draft; return (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: sc.bg, color: sc.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />{sc.label}
                        </span>
                      ); })()}
                      {selectedCourse.category && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{selectedCourse.category}</span>}
                      {selectedCourse.level && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{selectedCourse.level}</span>}
                      {selectedCourse.word_count && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{selectedCourse.word_count} mots · {selectedCourse.estimated_read_min || 0} min</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => navigate(`/admin/studio/${selectedCourse.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: '#002050', color: '#002050' }}>
                      <Eye size={12} /> Voir dans le Studio
                    </button>
                    <button onClick={() => loadLogs(selectedCourse.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                      <Clock size={12} /> Historique
                    </button>
                  </div>
                </div>

                {/* Commentaire admin existant */}
                {selectedCourse.admin_comment && (
                  <div className="mt-4 p-3 rounded-xl flex items-start gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <MessageSquare size={14} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#1D4ED8' }}>Commentaire précédent</p>
                      <p className="text-sm mt-0.5" style={{ color: '#374151' }}>{selectedCourse.admin_comment}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Informations générales */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: '#002050' }}>
                  <FileText size={15} /> Informations générales
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: 'Titre', value: selectedCourse.title },
                    { label: 'Catégorie', value: selectedCourse.category },
                    { label: 'Niveau', value: selectedCourse.level },
                    { label: 'Langue', value: selectedCourse.language },
                    { label: 'Prérequis', value: selectedCourse.prerequisites },
                    { label: 'Template', value: selectedCourse.template_used },
                  ].map(({ label, value }) => value ? (
                    <div key={label}>
                      <p className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>{label}</p>
                      <p className="mt-0.5" style={{ color: '#374151' }}>{value}</p>
                    </div>
                  ) : null)}
                </div>
                {selectedCourse.short_description && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E4E7EC' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#9CA3AF' }}>Description</p>
                    <p className="text-sm" style={{ color: '#374151' }}>{selectedCourse.short_description}</p>
                  </div>
                )}
                {selectedCourse.objectives && selectedCourse.objectives.length > 0 && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E4E7EC' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#9CA3AF' }}>Objectifs pédagogiques</p>
                    <div className="space-y-1">
                      {selectedCourse.objectives.map((obj, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle size={12} style={{ color: '#1E7A52', flexShrink: 0, marginTop: 2 }} />
                          <p className="text-sm" style={{ color: '#374151' }}>{obj}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Structure : modules et leçons */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: '#002050' }}>
                  <Layers size={15} /> Structure ({selectedModules.length} module{selectedModules.length > 1 ? 's' : ''})
                </h3>
                {selectedModules.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#FEE2E2' }}>
                    <AlertCircle size={14} style={{ color: '#DC2626' }} />
                    <p className="text-sm" style={{ color: '#DC2626' }}>Aucun module créé</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedModules.map((mod, mi) => (
                      <div key={mod.id} className="border rounded-xl overflow-hidden" style={{ borderColor: '#E4E7EC' }}>
                        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#F8F9FA' }}>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: '#002050' }}>Module {mi + 1} : {mod.title}</p>
                            {mod.objective && <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{mod.objective}</p>}
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EEF2FF', color: '#3730A3' }}>
                            {mod.lessons?.length || 0} leçon{(mod.lessons?.length || 0) > 1 ? 's' : ''}
                          </span>
                        </div>
                        {(mod.lessons || []).map((lesson, li) => (
                          <div key={lesson.id} className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: '#F3F4F6' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold" style={{ background: '#EEF2FF', color: '#002050' }}>{li + 1}</span>
                              <p className="text-sm" style={{ color: '#374151' }}>{lesson.title}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                              {lesson.has_blocks ? (
                                <span className="flex items-center gap-1" style={{ color: '#1E7A52' }}>
                                  <CheckCircle size={11} /> {lesson.block_count || 0} blocs
                                </span>
                              ) : (
                                <span style={{ color: '#9CA3AF' }}>Texte simple</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist automatique */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: '#002050' }}>
                  <HelpCircle size={15} /> Checklist automatique
                </h3>
                <div className="space-y-2">
                  {[
                    { check: !!selectedCourse.title && selectedCourse.title.length >= 5, label: 'Titre renseigné (5 car. min)' },
                    { check: !!selectedCourse.short_description && selectedCourse.short_description.length >= 20, label: 'Description renseignée' },
                    { check: !!selectedCourse.category, label: 'Catégorie définie' },
                    { check: !!selectedCourse.level, label: 'Niveau défini' },
                    { check: !!selectedCourse.language, label: 'Langue définie' },
                    { check: !!(selectedCourse.objectives && selectedCourse.objectives.length > 0), label: 'Objectifs pédagogiques présents' },
                    { check: !!selectedCourse.cover_image_url, label: 'Image de couverture', warn: true },
                    { check: selectedModules.length > 0, label: 'Au moins un module' },
                    { check: selectedModules.some(m => (m.lessons || []).length > 0), label: 'Au moins une leçon' },
                  ].map(({ check, label, warn }) => (
                    <div key={label} className="flex items-center gap-2">
                      {check
                        ? <CheckCircle size={14} style={{ color: '#1E7A52', flexShrink: 0 }} />
                        : warn
                        ? <AlertCircle size={14} style={{ color: '#D97706', flexShrink: 0 }} />
                        : <XCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />}
                      <p className="text-sm" style={{ color: check ? '#374151' : warn ? '#92400E' : '#DC2626' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions admin */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold mb-4" style={{ color: '#002050' }}>Actions super-admin</h3>

                {/* Commentaire pour modification/refus */}
                {showCommentFor && (
                  <div className="mb-4 space-y-2">
                    <label className="block text-xs font-semibold" style={{ color: '#002050' }}>
                      {showCommentFor === 'changes' ? 'Commentaire de modification (obligatoire)' : 'Raison du refus (obligatoire)'}
                    </label>
                    <textarea
                      className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:border-[#002050]"
                      style={{ borderColor: '#E4E7EC' }} rows={3}
                      value={comment} onChange={e => setComment(e.target.value)}
                      placeholder={showCommentFor === 'changes' ? 'Expliquez ce qui doit être modifié...' : 'Expliquez la raison du refus...'} />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowCommentFor(null); setComment(''); }}
                        className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                        Annuler
                      </button>
                      <button
                        disabled={!comment.trim() || !!actionLoading}
                        onClick={() => doAction(showCommentFor === 'changes' ? 'admin_request_changes' : 'admin_reject', selectedCourse.id, comment)}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: showCommentFor === 'changes' ? '#1D4ED8' : '#DC2626' }}>
                        {actionLoading ? '⏳...' : showCommentFor === 'changes' ? 'Envoyer la demande' : 'Confirmer le refus'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                {!showCommentFor && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Valider */}
                    {['pending_validation', 'draft'].includes(selectedCourse.studio_status) && (
                      <button
                        onClick={() => doAction('admin_validate', selectedCourse.id)}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white disabled:opacity-50"
                        style={{ background: '#1E7A52' }}>
                        {actionLoading === 'admin_validate' ? '⏳' : <Check size={15} />} Valider
                      </button>
                    )}

                    {/* Publier */}
                    {['validated'].includes(selectedCourse.studio_status) && (
                      <button
                        onClick={() => doAction('admin_publish', selectedCourse.id)}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white disabled:opacity-50"
                        style={{ background: '#002050' }}>
                        {actionLoading === 'admin_publish' ? '⏳' : <Send size={15} />} Publier
                      </button>
                    )}

                    {/* Valider + Publier en une fois */}
                    {['pending_validation'].includes(selectedCourse.studio_status) && (
                      <button
                        onClick={async () => {
                          await doAction('admin_validate', selectedCourse.id);
                          await doAction('admin_publish', selectedCourse.id);
                        }}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white disabled:opacity-50 col-span-2"
                        style={{ background: '#002050' }}>
                        {actionLoading ? '⏳' : <><Check size={15} /> Valider et publier</>}
                      </button>
                    )}

                    {/* Modifier directement */}
                    <button
                      onClick={() => navigate(`/admin/studio/${selectedCourse.id}`)}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border"
                      style={{ borderColor: '#E4E7EC', color: '#374151' }}>
                      <Edit2 size={14} /> Modifier
                    </button>

                    {/* Demander modification */}
                    {!['rejected', 'archived', 'draft'].includes(selectedCourse.studio_status) && (
                      <button
                        onClick={() => setShowCommentFor('changes')}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border"
                        style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
                        <MessageSquare size={14} /> Demander modification
                      </button>
                    )}

                    {/* Refuser */}
                    {!['rejected', 'archived'].includes(selectedCourse.studio_status) && (
                      <button
                        onClick={() => setShowCommentFor('reject')}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border"
                        style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                        <X size={14} /> Refuser
                      </button>
                    )}

                    {/* Archiver */}
                    {selectedCourse.studio_status === 'published' && (
                      <button
                        onClick={() => doAction('admin_archive', selectedCourse.id)}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border disabled:opacity-50"
                        style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                        {actionLoading === 'admin_archive' ? '⏳' : <Archive size={14} />} Archiver
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL HISTORIQUE ──────────────────────────── */}
        {showLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold" style={{ color: '#002050' }}>Historique des modifications</h3>
                <button onClick={() => setShowLogs(false)}><X size={18} style={{ color: '#6B7280' }} /></button>
              </div>
              <div className="p-4 space-y-2">
                {logs.length === 0 && <p className="text-sm text-center py-4" style={{ color: '#9CA3AF' }}>Aucun historique</p>}
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#F8F9FA' }}>
                    <Clock size={12} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#374151' }}>{log.action.replace(/_/g, ' ')}</p>
                      {log.comment && <p className="text-xs mt-0.5 italic" style={{ color: '#6B7280' }}>{log.comment}</p>}
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{new Date(log.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
