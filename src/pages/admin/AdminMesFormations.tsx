import { getSessionToken } from '../../lib/session';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import {
  BookOpen, PlusCircle, Edit2, Eye, RefreshCw, FileUp,
  Clock, CheckCircle, AlertCircle, Archive,
  BarChart2, Send, XCircle, Trash2, ChevronDown, MapPin, Copy
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API = `${SUPABASE_URL}/functions/v1/studio-unified`;

interface Formation {
  id: string;
  title: string;
  studio_status: string;
  category?: string;
  level?: string;
  cover_image_url?: string;
  created_at: string;
  updated_at: string;
  word_count?: number;
  estimated_read_min?: number;
  calculated_duration_minutes?: number;
  total_duration_seconds?: number;
  last_autosave_at?: string;
  admin_comment?: string;
  template_used?: string;
  module_count?: number;
  lesson_count?: number;
}

const STUDIO_STATUS: Record<string, { label: string; color: string; bg: string; dot: string; icon: typeof Clock }> = {
  draft:              { label: 'Brouillon',             color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF', icon: Clock },
  pending_validation: { label: 'En attente',            color: '#92400E', bg: '#FEF3C7', dot: '#D97706', icon: Clock },
  changes_requested:  { label: 'Modification demandée', color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6', icon: AlertCircle },
  rejected:           { label: 'Refusée',               color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626', icon: XCircle },
  validated:          { label: 'Validée',               color: '#065F46', bg: '#D1FAE5', dot: '#10B981', icon: CheckCircle },
  published:          { label: 'Publiée ✓',             color: '#065F46', bg: '#D1FAE5', dot: '#10B981', icon: CheckCircle },
  archived:           { label: 'Archivée',              color: '#374151', bg: '#F3F4F6', dot: '#6B7280', icon: Archive },
};

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert',
};

function formatLearningDuration(formation: Formation) {
  const seconds = Number(formation.total_duration_seconds || 0);
  const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : Math.max(0, Number(formation.calculated_duration_minutes || 0));
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${minutes} min`;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

export default function AdminMesFormations() {
  const navigate = useNavigate();
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Formation | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [statsTarget, setStatsTarget] = useState<Formation | null>(null);
  const [courseStats, setCourseStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const token = () => getSessionToken() || '';

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_courses', creator_context: 'super_admin' }),
      });
      const data = await res.json();
      if (data.success) setFormations(data.courses || []);
    } catch { showToast('Erreur de chargement'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function deleteDraft(id: string, title: string) {
    setDeletingId(id);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({
          action: 'delete_course',
          course_id: id,
          creator_context: 'super_admin',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Suppression impossible');
      }
      setFormations((current) => current.filter((course) => course.id !== id));
      showToast('Brouillon supprimé');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Suppression impossible');
    } finally {
      setDeletingId(null);
    }
  }


  async function duplicateCourse(course: Formation) {
    if (duplicatingId) return;
    const confirmed = window.confirm(`Dupliquer « ${course.title} » comme nouveau brouillon indépendant ?`);
    if (!confirmed) return;
    setDuplicatingId(course.id);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'duplicate_course', course_id: course.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Duplication impossible');
      const newId = data?.course?.id;
      if (!newId) throw new Error('Le brouillon dupliqué ne possède pas d’identifiant.');
      navigate(`/admin/studio/${newId}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Duplication impossible');
    } finally {
      setDuplicatingId(null);
    }
  }

  async function openStats(course: Formation) {
    setStatsTarget(course); setCourseStats(null); setStatsLoading(true);
    try {
      const res = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'course_stats', course_id: course.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Statistiques indisponibles');
      setCourseStats(data);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Statistiques indisponibles'); }
    finally { setStatsLoading(false); }
  }

  // Stats par statut
  const stats = {
    total: formations.length,
    published: formations.filter(f => f.studio_status === 'published').length,
    draft: formations.filter(f => f.studio_status === 'draft').length,
    pending: formations.filter(f => f.studio_status === 'pending_validation').length,
  };

  // Filtrage
  const filtered = formations.filter(f => {
    const matchFilter = filter === 'all' || f.studio_status === filter;
    const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || (f.category || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Mes formations OGA</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Formations créées au nom de la plateforme Omnia Global Academy
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
              <RefreshCw size={14} /> Actualiser
            </button>
            <button onClick={() => navigate('/admin/courses/import')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white"
              style={{ borderColor: '#BF8813', color: '#9A6D0F' }}>
              <FileUp size={15} /> Importer un fichier
            </button>
            <div className="relative">
              <button
                onClick={() => setCreateMenuOpen(v => !v)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#002050' }}
                aria-haspopup="menu"
                aria-expanded={createMenuOpen}
              >
                <PlusCircle size={15} /> Créer une formation <ChevronDown size={14} />
              </button>

              {createMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fermer le menu de création"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setCreateMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border bg-white shadow-xl"
                    style={{ borderColor: '#E4E7EC' }}
                    role="menu"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        navigate('/admin/studio/new');
                      }}
                      role="menuitem"
                    >
                      <BookOpen size={18} className="mt-0.5 shrink-0" style={{ color: '#002050' }} />
                      <span>
                        <span className="block text-sm font-bold" style={{ color: '#002050' }}>Formation en ligne</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Ouvrir le Builder avec modules, leçons et contenus numériques.</span>
                      </span>
                    </button>

                    <div className="h-px bg-slate-100" />

                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        navigate('/formations/presentiel/nouvelle');
                      }}
                      role="menuitem"
                    >
                      <MapPin size={18} className="mt-0.5 shrink-0" style={{ color: '#0B817A' }} />
                      <span>
                        <span className="block text-sm font-bold" style={{ color: '#0B817A' }}>Formation présentielle</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Créer directement la fiche puis les dates, lieux, places et inscriptions.</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Résumé compact — données réelles de get_my_courses */}
        <div className="flex flex-wrap gap-x-7 gap-y-2 border-y border-gray-200 py-3 text-sm">
          <span><strong style={{ color: '#002050' }}>{stats.total}</strong> Total</span>
          <span><strong style={{ color: '#1E7A52' }}>{stats.published}</strong> Publiées</span>
          <span><strong style={{ color: '#6B7280' }}>{stats.draft}</strong> Brouillons</span>
          <span><strong style={{ color: '#BF8813' }}>{stats.pending}</strong> En attente</span>
        </div>

        {/* Filtres + recherche */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="px-3 py-2 border rounded-xl text-sm flex-1 min-w-48 focus:outline-none focus:border-[#002050]"
            style={{ borderColor: '#E4E7EC' }}
            placeholder="Rechercher par titre ou catégorie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'draft', label: 'Brouillons' },
              { key: 'published', label: 'Publiées' },
              { key: 'pending_validation', label: 'En attente' },
              { key: 'validated', label: 'Validées' },
              { key: 'archived', label: 'Archivées' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={filter === f.key
                  ? { background: '#002050', color: 'white' }
                  : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste formations */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}>
            <BookOpen size={48} className="mx-auto mb-4 opacity-10" style={{ color: '#002050' }} />
            <p className="font-bold text-lg mb-1" style={{ color: '#002050' }}>
              {search || filter !== 'all' ? 'Aucune formation correspondante' : 'Aucune formation créée'}
            </p>
            <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
              {search || filter !== 'all'
                ? 'Modifiez vos filtres ou votre recherche'
                : 'Créez votre première formation au nom d\'Omnia Global Academy'}
            </p>
            {filter === 'all' && !search && (
              <button onClick={() => navigate('/admin/studio/new')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white mx-auto"
                style={{ background: '#002050' }}>
                <PlusCircle size={16} /> Créer ma première formation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(f => {
              const sc = STUDIO_STATUS[f.studio_status] || STUDIO_STATUS.draft;
              const StatusIcon = sc.icon;
              return (
                <div key={f.id} className="bg-white rounded-2xl border p-5 transition-all hover:shadow-sm"
                  style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-center gap-4">

                    {/* Image / Icône */}
                    <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden"
                      style={{ background: '#EEF2FF' }}>
                      {f.cover_image_url
                        ? <img src={f.cover_image_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <BookOpen size={22} style={{ color: '#002050' }} />
                          </div>}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-bold truncate" style={{ color: '#002050' }}>{f.title}</h3>
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: sc.bg, color: sc.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {f.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                            {f.category}
                          </span>
                        )}
                        {f.level && (
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>
                            {LEVEL_LABELS[f.level] || f.level}
                          </span>
                        )}
                        <span className="text-xs font-medium" style={{ color: '#64748B' }}>
                          {f.module_count || 0} module{(f.module_count || 0) !== 1 ? 's' : ''} · {f.lesson_count || 0} leçon{(f.lesson_count || 0) !== 1 ? 's' : ''}
                        </span>
                        {formatLearningDuration(f) && (
                          <span className="text-xs" style={{ color: '#64748B' }}>
                            Durée · {formatLearningDuration(f)}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>
                          Modifié le {new Date(f.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {/* Commentaire admin */}
                      {f.admin_comment && f.studio_status === 'changes_requested' && (
                        <div className="mt-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                          {f.admin_comment}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Voir dans le panneau de validation si soumise */}
                      {f.studio_status === 'pending_validation' && (
                        <button onClick={() => navigate('/admin/quality-center')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                          style={{ borderColor: '#FDE68A', color: '#92400E', background: '#FFFBEB' }}>
                          <Eye size={12} /> Ouvrir le Centre Qualité
                        </button>
                      )}

                      {/* La publication reste tracée dans le Centre Qualité. */}
                      {f.studio_status === 'validated' && (
                        <button onClick={() => navigate('/admin/quality-center')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ background: '#1E7A52' }}>
                          <Send size={12} /> Publier depuis le Centre Qualité
                        </button>
                      )}

                      {/* Statistiques si publiée */}
                      {f.studio_status === 'published' && (
                        <button onClick={() => void openStats(f)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                          style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                          <BarChart2 size={12} /> Stats
                        </button>
                      )}


                      {(f.studio_status === 'draft' || f.studio_status === 'brouillon') && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: f.id, title: f.title })}
                          disabled={deletingId === f.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
                          style={{ borderColor: '#DC2626', color: '#DC2626' }}
                          title="Supprimer le brouillon"
                        >
                          <Trash2 size={12} />
                          {deletingId === f.id ? 'Suppression…' : 'Supprimer'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void duplicateCourse(f)}
                        disabled={duplicatingId === f.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
                        style={{ borderColor: '#CBD5E1', color: '#475569' }}
                        title="Créer un nouveau brouillon indépendant à partir de cette formation"
                      >
                        <Copy size={12} /> {duplicatingId === f.id ? 'Duplication…' : 'Dupliquer'}
                      </button>

                      <button onClick={() => navigate(`/formations/${f.id}/sessions`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: '#0B817A', color: '#0B817A' }}>
                        Sessions
                      </button>

                      <button onClick={() => navigate(`/cours/${f.id}/apprendre?preview=admin`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: '#BF8813', color: '#8A650F' }}>
                        <Eye size={12} /> Prévisualiser
                      </button>

                      {/* Modifier */}
                      <button onClick={() => navigate(`/admin/studio/${f.id}`)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: '#002050' }}>
                        <Edit2 size={12} /> Modifier
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info bas de page */}
        {formations.length > 0 && (
          <p className="text-xs text-center pb-4" style={{ color: '#9CA3AF' }}>
            {filtered.length} formation{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''} sur {formations.length} au total
          </p>
        )}

{statsTarget && (
  <div className="fixed inset-0 z-[110] bg-black/35 flex items-center justify-center p-4">
    <div className="w-full max-w-4xl max-h-[85vh] overflow-auto bg-white rounded-2xl border border-gray-200 shadow-2xl p-5">
      <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-black" style={{color:'#002050'}}>Statistiques — {statsTarget.title}</h3><p className="mt-1 text-xs text-gray-500">Inscriptions et progression réelle des apprenants.</p></div><button type="button" onClick={()=>{setStatsTarget(null);setCourseStats(null)}} className="rounded-lg border px-3 py-1.5 text-sm">Fermer</button></div>
      {statsLoading ? <div className="py-12 text-center text-sm text-gray-500">Chargement des statistiques…</div> : courseStats ? <>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Inscrits",courseStats.summary?.enrolled||0],["Actifs",courseStats.summary?.active||0],["Terminés",courseStats.summary?.completed||0],["Progression moyenne",`${courseStats.summary?.average_progress||0}%`]].map(([label,value])=><div key={String(label)} className="rounded-xl border p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-black text-[#002050]">{value}</p></div>)}</div>
        <div className="mt-5 overflow-x-auto rounded-xl border"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Apprenant</th><th className="px-3 py-2">Progression</th><th className="px-3 py-2">Leçons terminées</th><th className="px-3 py-2">Inscription</th><th className="px-3 py-2">Dernière activité</th></tr></thead><tbody>{(courseStats.learners||[]).map((row:any)=><tr key={row.user_id} className="border-t"><td className="px-3 py-2"><p className="font-semibold text-[#002050]">{row.full_name||'Apprenant'}</p><p className="text-xs text-gray-500">{row.email||''}</p></td><td className="px-3 py-2 font-semibold">{row.progress_percent}%</td><td className="px-3 py-2">{row.completed_lessons}/{row.total_lessons}</td><td className="px-3 py-2 text-xs">{row.enrolled_at?new Date(row.enrolled_at).toLocaleDateString('fr-FR'):'—'}</td><td className="px-3 py-2 text-xs">{row.last_activity_at?new Date(row.last_activity_at).toLocaleString('fr-FR'):'—'}</td></tr>)}{!(courseStats.learners||[]).length&&<tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Aucun apprenant inscrit.</td></tr>}</tbody></table></div>
      </> : null}
    </div>
  </div>
)}

{deleteTarget && (
          <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl p-5">
              <h3 className="text-lg font-black" style={{ color: '#002050' }}>Supprimer définitivement ce brouillon ?</h3>
              <p className="text-sm text-gray-600 mt-2">« {deleteTarget.title} » sera supprimé de la plateforme.</p>
              <div className="flex justify-end gap-3 mt-5">
                <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold">Annuler</button>
                <button type="button" disabled={deletingId === deleteTarget.id} onClick={async () => { const target=deleteTarget; setDeleteTarget(null); await deleteDraft(target.id,target.title); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Supprimer définitivement</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
