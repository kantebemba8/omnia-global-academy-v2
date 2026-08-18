import { getSessionToken } from '../../lib/session';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import {
  BookOpen, PlusCircle, Edit2, Eye, RefreshCw, FileUp,
  Clock, CheckCircle, AlertCircle, Archive,
  BarChart2, Send, XCircle, Trash2
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
  last_autosave_at?: string;
  admin_comment?: string;
  template_used?: string;
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

export default function AdminMesFormations() {
  const navigate = useNavigate();
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

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
            <button onClick={() => navigate('/admin/studio/new')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Créer une formation
            </button>
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
                        {f.word_count && f.word_count > 0 && (
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>
                            {f.word_count} mots · {f.estimated_read_min || Math.ceil(f.word_count / 200)} min
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
                        <button
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
