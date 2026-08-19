import { getSessionToken } from '../../lib/session';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProfessorFormationsLayout } from '../../components/formations/FormationsRoleLayout';
import { CourseLiveLinksManager } from '../../components/formations/CourseLiveLinksManager';
import { PlusCircle, BookOpen, AlertCircle, CheckCircle, Eye, Edit2, Trash2, Layers3, Users, ClipboardCheck, Radio } from 'lucide-react';
import { deleteOrRequestContent } from '../../lib/contentDeletion';

interface Formation {
  id: string; title: string; status: string;
  cover_image_url: string | null; category: string | null;
  total_students: number; average_rating: number;
  projets_a_corriger: number; created_at: string;
  pricing_recommended_xof?: number | null; price_xof: number | null;
  is_catalog_active?: boolean; is_published?: boolean; version_number?: number; course_code?: string | null;
  module_count?: number; lesson_count?: number;
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
  const [liveCourse, setLiveCourse] = useState<Formation | null>(null);
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = getSessionToken();
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
          pricing_recommended_xof: course.pricing_recommended_xof ?? null,
          price_xof: course.price_xof || null,
        })));
      }
    } catch { /* conserver la session et afficher simplement une liste vide */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);
  useEffect(() => { load(); }, [load]);



  const callStudio = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`, {
      method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Action impossible');
    return data;
  }, []);

  async function toggleCatalogue(formation: Formation) {
    const active = formation.is_catalog_active === false;
    const label = active ? 'activer' : 'désactiver';
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} « ${formation.title} » dans le catalogue ? ${active ? 'La formation redeviendra disponible aux nouvelles inscriptions.' : 'Les apprenants déjà inscrits conserveront leur accès.'}`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`, {
        method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'toggle_catalog_active', course_id: formation.id, active }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Modification impossible');
      setFormations(items => items.map(item => item.id === formation.id ? { ...item, is_catalog_active: active } : item));
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Modification impossible'); }
  }

  async function createMajorVersion(formation: Formation) {
    if (!window.confirm(`Créer une nouvelle version pédagogique de « ${formation.title} » ? La version actuelle restera accessible aux apprenants déjà inscrits.`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`, {
        method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'create_major_version', course_id: formation.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Création de version impossible');
      if (data?.course?.id) navigate(`/professeur/studio/${data.course.id}`); else await load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Création de version impossible'); }
  }

  async function removeFormation(formation: Formation) {
    const important = !['brouillon', 'draft', 'rejetee', 'rejected', 'modification_demandee', 'changes_requested'].includes(formation.status);
    const confirmation = important
      ? `Demander la suppression de « ${formation.title} » ? Cette formation possède un statut important et devra être confirmée par l’administration.`
      : `Supprimer « ${formation.title} » ? Si aucun historique n’y est lié, la suppression sera immédiate.`;
    if (!window.confirm(confirmation)) return;
    try {
      const result = await deleteOrRequestContent('course', formation.id);
      if (result.deleted) setFormations(items => items.filter(item => item.id !== formation.id));
      alert(result.message);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible');
    }
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

  const publishedCount = formations.filter(f => ['published', 'publiee'].includes(f.status)).length;
  const draftCount = formations.filter(f => ['draft', 'brouillon'].includes(f.status)).length;
  const reviewCount = formations.filter(f => ['pending_validation', 'soumise', 'en_attente_validation_manuelle', 'changes_requested', 'modification_demandee'].includes(f.status)).length;
  const learnerCount = formations.reduce((sum, f) => sum + Number(f.total_students || 0), 0);
  const correctionsCount = formations.reduce((sum, f) => sum + Number(f.projets_a_corriger || 0), 0);

  const FILTERS = [
    { key: '', label: `Toutes (${formations.length})` },
    { key: 'published', label: 'Publiées' },
    { key: 'pending_validation', label: 'En attente' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'rejected', label: 'Rejetées' },
    { key: 'changes_requested', label: 'À modifier' },
  ];

  return (
    <ProfessorFormationsLayout>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-[#DDE1F3] bg-[linear-gradient(135deg,#F7F7FE_0%,#FFFFFF_55%,#F5F8FF_100%)]">
          <div className="grid lg:grid-cols-[1.25fr_.75fr]">
            <div className="p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5966C5]">Portfolio pédagogique</p>
              <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.04em] text-[#002050] sm:text-4xl">Pilotez chaque formation comme un produit pédagogique vivant.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Brouillon, validation, publication et suivi restent visibles au même endroit. Le Studio sert à concevoir ; ce portfolio sert à décider quoi faire ensuite.</p>
              <div className="mt-6 flex flex-wrap gap-2"><Link to="/professeur/courses/new" className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white shadow-sm"><PlusCircle className="h-4 w-4" /> Nouvelle formation en ligne</Link><Link to="/formations/presentiel/nouvelle" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black" style={{borderColor:"#0B817A",color:"#0B817A"}}>Formation présentielle</Link></div>
            </div>
            <div className="bg-[#101B4B] p-6 text-white sm:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#AEB7F7]">Cycle de production</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[{label:'Brouillons',value:draftCount},{label:'À revoir',value:reviewCount},{label:'Publiées',value:publishedCount}].map(item => <div key={item.label} className="rounded-2xl bg-white/[.07] p-4"><strong className="text-2xl font-black text-[#F0C568]">{item.value}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.08em] text-white/55">{item.label}</span></div>)}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs"><span className="inline-flex items-center gap-2 text-white/60"><Users size={14}/> {learnerCount} apprenant{learnerCount !== 1 ? 's' : ''}</span><span className="inline-flex items-center gap-2 text-white/60"><ClipboardCheck size={14}/> {correctionsCount} à corriger</span></div>
            </div>
          </div>
        </section>

        <div className="mt-7 flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Bibliothèque de conception</p><h2 className="mt-1 text-xl font-black text-[#002050]">{formations.length} formation{formations.length !== 1 ? 's' : ''}</h2></div><Layers3 size={22} className="text-[#5966C5]" /></div>

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
          <Link to="/professeur/courses/new"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#002050' }}>
              <PlusCircle className="w-4 h-4" /> Créer une formation
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f) => {
              const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.brouillon;
              const price = ['publiee', 'published'].includes(f.status) ? f.price_xof : f.pricing_recommended_xof;
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
                    <div className="mb-2 flex items-start justify-between gap-2"><p className="font-semibold text-gray-900 text-sm line-clamp-2">{f.title}</p>{['validated','published','validee','publiee'].includes(f.status) && <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${f.is_catalog_active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{f.is_catalog_active === false ? 'Désactivée' : 'Active'}</span>}</div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Layers3 className="h-3.5 w-3.5" />
                      <span>{f.module_count || 0} module{(f.module_count || 0) !== 1 ? 's' : ''} · {f.lesson_count || 0} leçon{(f.lesson_count || 0) !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>{f.total_students} élève{f.total_students !== 1 ? 's' : ''}</span>
                      {f.average_rating > 0 && <span>★ {f.average_rating}/5</span>}
                      {price && <span className="font-semibold" style={{ color: '#BF8813' }}>{price.toLocaleString()} XOF</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => navigate(`/cours/${f.id}?preview=visitor`)} className="py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center gap-1" style={{ borderColor: '#BF8813', color: '#8A650F' }}>
                        <Eye className="w-3.5 h-3.5" /> Prévisualiser
                      </button>
                      {['brouillon', 'rejetee', 'modification_demandee', 'draft', 'rejected', 'changes_requested'].includes(f.status) && (
                        <Link to={`/professeur/studio/${f.id}`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-lg border flex items-center justify-center gap-1"
                          style={{ borderColor: '#002050', color: '#002050' }}>
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </Link>
                      )}
                      {['validated','published','validee','publiee'].includes(f.status) && (<>
                        <button type="button" onClick={() => toggleCatalogue(f)} className="py-2 px-2.5 text-xs font-semibold rounded-lg border" style={{ borderColor: f.is_catalog_active === false ? '#1E7A52' : '#64748B', color: f.is_catalog_active === false ? '#1E7A52' : '#475569' }}>
                          {f.is_catalog_active === false ? 'Activer' : 'Désactiver'}
                        </button>
                        <button type="button" onClick={() => navigate(`/formations/${f.id}/sessions`)} className="py-2 px-2.5 text-xs font-semibold rounded-lg border" style={{ borderColor: '#0B817A', color: '#0B817A' }}>Présentiel / Sessions</button>
                        <button type="button" onClick={() => setLiveCourse(f)} className="py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center gap-1" style={{ borderColor: '#0B817A', color: '#0B817A' }} title="Ajouter ou retirer un Live, Replay ou vidéo complémentaire"><Radio className="w-3.5 h-3.5"/> Live/Replays</button>
                        <button type="button" onClick={() => createMajorVersion(f)} className="py-2 px-2.5 text-xs font-semibold rounded-lg border" style={{ borderColor: '#BF8813', color: '#8A650F' }} title="Créer une nouvelle version pédagogique sans modifier les apprenants de la version actuelle">Nouvelle version</button>
                      </>)}
                      <button type="button" onClick={() => removeFormation(f)}
                        className="py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center"
                        style={{ borderColor: '#DC2626', color: '#DC2626' }}
                        title={['brouillon', 'draft'].includes(f.status) ? 'Supprimer la formation' : 'Demander la suppression'}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
      {liveCourse && <CourseLiveLinksManager courseId={liveCourse.id} courseTitle={liveCourse.title} call={callStudio} onClose={() => setLiveCourse(null)} />}
    </ProfessorFormationsLayout>
  );
}
