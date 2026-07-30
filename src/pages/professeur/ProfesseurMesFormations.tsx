import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { PlusCircle, BookOpen, AlertCircle, CheckCircle, Eye, Edit2, Trash2 } from 'lucide-react';

interface Formation {
  id: string; title: string; status: string;
  cover_image_url: string | null; category: string | null;
  total_students: number; average_rating: number;
  projets_a_corriger: number; created_at: string;
  prix_provisoire_xof: number | null; price_xof: number | null;
}


const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:                      { label: 'Brouillon', color: '#9CA3AF', bg: '#F3F4F6' },
  soumise:                        { label: 'Soumise', color: '#3B82F6', bg: '#EFF6FF' },
  en_attente_validation_manuelle: { label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  validee:                        { label: 'Validée', color: '#16A34A', bg: '#F0FDF4' },
  publiee:                        { label: 'Publiée', color: '#1E7A52', bg: '#ECFDF5' },
  rejetee:                        { label: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' },
  modification_demandee:          { label: 'À modifier', color: '#EA580C', bg: '#FFF7ED' },
  suspendue:                      { label: 'Suspendue', color: '#6B7280', bg: '#F9FAFB' },
  draft:                          { label: 'Brouillon', color: '#9CA3AF', bg: '#F3F4F6' },
  pending_validation:             { label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  validated:                      { label: 'Validée', color: '#16A34A', bg: '#F0FDF4' },
  published:                      { label: 'Publiée', color: '#1E7A52', bg: '#ECFDF5' },
  rejected:                       { label: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' },
  changes_requested:              { label: 'À modifier', color: '#EA580C', bg: '#FFF7ED' },
};

export function ProfesseurMesFormations() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { navigate('/connexion', { replace: true }); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_courses', creator_context: 'professeur' }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || json?.error === 'AUTH_REQUIRED') {
        navigate('/connexion', { replace: true });
        return;
      }
      if (res.ok && json?.success !== false) {
        setFormations((json.courses ?? []).map((course: any) => ({
          ...course,
          status: course.status || course.studio_status || 'brouillon',
          total_students: course.total_students || 0,
          average_rating: course.average_rating || 0,
          projets_a_corriger: course.projets_a_corriger || 0,
          prix_provisoire_xof: course.prix_provisoire_xof || null,
          price_xof: course.price_xof || null,
        })));
      }
    } catch { /* conserver la session et afficher simplement une liste vide */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);
  useEffect(() => { load(); }, [load]);


  async function deleteDraft(id: string, title: string) {
    if (!window.confirm(`Supprimer définitivement le brouillon « ${title} » ?`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`, {
        method: 'POST', headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'delete_course', course_id: id, creator_context: 'professeur' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Suppression impossible');
      setFormations(items => items.filter(item => item.id !== id));
    } catch (e) { alert(e instanceof Error ? e.message : 'Suppression impossible'); }
  }

  const statusAliases: Record<string, string[]> = {
    published: ['published', 'publiee'],
    pending_validation: ['pending_validation', 'soumise', 'en_attente_validation_manuelle'],
    draft: ['draft', 'brouillon'],
    rejected: ['rejected', 'rejetee'],
    changes_requested: ['changes_requested', 'modification_demandee'],
  };
  const filtered = filter
    ? formations.filter((formation) => (statusAliases[filter] || [filter]).includes(formation.status))
    : formations;

  const FILTERS = [
    { key: '', label: `Toutes (${formations.length})` },
    { key: 'published', label: 'Publiées' },
    { key: 'pending_validation', label: 'En attente' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'rejected', label: 'Rejetées' },
    { key: 'changes_requested', label: 'À modifier' },
  ];

  return (
    <DashboardLayout role="professeur">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes formations</h1>
            <p className="text-gray-500 text-sm mt-1">{formations.length} formation{formations.length !== 1 ? 's' : ''}</p>
          </div>
        <Link to="/professeur/studio/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#002050' }}>
            <PlusCircle className="w-4 h-4" /> Nouvelle formation
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={filter === f.key ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb' }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-100 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500">Aucune formation</p>
          <Link to="/professeur/studio/new"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#002050' }}>
              <PlusCircle className="w-4 h-4" /> Créer une formation
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f) => {
              const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.brouillon;
              const price = ['publiee', 'published'].includes(f.status) ? f.price_xof : f.prix_provisoire_xof;
              return (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-28 relative flex items-center justify-center" style={{ backgroundColor: '#002050' + '10' }}>
                    {f.cover_image_url
                      ? <img src={f.cover_image_url} alt="" className="w-full h-full object-cover" />
                      : <BookOpen className="w-10 h-10" style={{ color: '#002050' + '60' }} />}
                    <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    {f.projets_a_corriger > 0 && (
                      <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {f.projets_a_corriger}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">{f.title}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>{f.total_students} élève{f.total_students !== 1 ? 's' : ''}</span>
                      {f.average_rating > 0 && <span>★ {f.average_rating}/5</span>}
                      {price && <span className="font-semibold" style={{ color: '#BF8813' }}>{price.toLocaleString()} XOF</span>}
                    </div>
                    <div className="flex gap-2">
                      {['brouillon', 'rejetee', 'modification_demandee', 'draft', 'rejected', 'changes_requested'].includes(f.status) && (
                        <Link to={`/professeur/studio/${f.id}`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-lg border flex items-center justify-center gap-1"
                          style={{ borderColor: '#002050', color: '#002050' }}>
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </Link>
                      )}
                      {['brouillon', 'draft'].includes(f.status) && (
                        <button type="button" onClick={() => deleteDraft(f.id, f.title)}
                          className="py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center"
                          style={{ borderColor: '#DC2626', color: '#DC2626' }} title="Supprimer le brouillon">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {['publiee', 'published'].includes(f.status) && (
                        <Link to="/professeur/analytics"
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-lg flex items-center justify-center gap-1 text-white"
                          style={{ backgroundColor: '#002050' }}>
                          <Eye className="w-3.5 h-3.5" /> Analytique
                        </Link>
                      )}
                      {['soumise', 'en_attente_validation_manuelle', 'validee', 'pending_validation', 'validated'].includes(f.status) && (
                        <div className="flex-1 py-2 text-xs text-center rounded-lg" style={{ backgroundColor: '#f9fafb', color: '#9ca3af' }}>
                          <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> En attente
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
