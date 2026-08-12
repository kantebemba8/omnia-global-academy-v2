import { getSessionToken } from '../../lib/session';
import { API_BASE_URL } from '../../lib/config';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, CheckCircle, Edit2, PlusCircle, Trash2, Building2, GitBranch, ShieldCheck } from 'lucide-react';
import { StructureFormationsLayout } from '../../components/formations/FormationsRoleLayout';
import { deleteOrRequestContent } from '../../lib/contentDeletion';

type Formation = {
  id: string;
  title: string;
  studio_status?: string | null;
  category?: string | null;
  level?: string | null;
  cover_image_url?: string | null;
  updated_at?: string | null;
  admin_comment?: string | null;
};

const API = `${API_BASE_URL}/studio-unified`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const gatewayHeaders = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
});
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  pending_validation: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  changes_requested: { label: 'À modifier', color: '#1D4ED8', bg: '#EFF6FF' },
  rejected: { label: 'Refusée', color: '#991B1B', bg: '#FEE2E2' },
  validated: { label: 'Validée', color: '#065F46', bg: '#D1FAE5' },
  published: { label: 'Publiée', color: '#065F46', bg: '#D1FAE5' },
  archived: { label: 'Archivée', color: '#374151', bg: '#F3F4F6' },
};

export default function StructureMesFormations() {
  const navigate = useNavigate();
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      navigate('/connexion', { replace: true });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      let res: Response;
      try {
        res = await fetch(API, {
          method: 'POST',
          headers: gatewayHeaders(),
          body: JSON.stringify({ action: 'get_my_courses', session_token: token, creator_context: 'structure' }),
          cache: 'no-store',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const data = await res.json().catch(() => null);
      if (res.status === 401 || data?.error === 'AUTH_REQUIRED') {
        navigate('/connexion', { replace: true });
        return;
      }
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || 'Impossible de charger les formations.');
      }
      setFormations(data.courses || []);
    } catch (e) {
      const message = e instanceof DOMException && e.name === 'AbortError'
        ? 'Le chargement prend trop de temps. Réessayez dans quelques secondes.'
        : e instanceof TypeError
          ? 'Connexion au service des formations impossible. Vérifiez que la fonction studio-unified est déployée puis réessayez.'
          : e instanceof Error
            ? e.message
            : 'Impossible de charger les formations.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  async function removeFormation(formation: Formation) {
    const status = formation.studio_status || 'draft';
    const important = !['draft', 'changes_requested', 'rejected'].includes(status);
    const confirmation = important
      ? `Demander la suppression de « ${formation.title || 'Formation sans titre'} » ? La confirmation de l’administration sera nécessaire.`
      : `Supprimer « ${formation.title || 'Formation sans titre'} » ? Si aucun historique n’y est lié, la suppression sera immédiate.`;
    if (!window.confirm(confirmation)) return;
    try {
      const result = await deleteOrRequestContent('course', formation.id);
      if (result.deleted) setFormations(items => items.filter(item => item.id !== formation.id));
      setError('');
      window.alert(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  }

  const publishedCount = formations.filter(item => ['published', 'validated'].includes(item.studio_status || '')).length;
  const attentionCount = formations.filter(item => ['changes_requested', 'rejected', 'pending_validation'].includes(item.studio_status || '')).length;
  const draftCount = formations.filter(item => (item.studio_status || 'draft') === 'draft').length;

  return (
    <StructureFormationsLayout>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] border border-[#D6E8E5] bg-[linear-gradient(135deg,#F3FAF9_0%,#FFFFFF_56%,#F5F8FC_100%)] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full border border-[#0B817A]/15" aria-hidden="true" />
          <div className="relative grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B817A]">Portefeuille de formation</p><h1 className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.04em] text-[#002050] sm:text-4xl">Les parcours de votre Structure, avec leur état de gouvernance.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Créez, faites évoluer et suivez les formations portées par votre organisation sans mélanger ce portefeuille avec les autres fonctions Structure.</p><Link to="/structure/courses/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white"><PlusCircle size={16}/> Créer une formation</Link></div>
            <div className="grid grid-cols-3 gap-3 rounded-[24px] bg-white p-4 shadow-[0_20px_50px_rgba(0,70,80,.10)] ring-1 ring-[#D6E8E5]">
              {[{label:'Brouillons',value:draftCount,icon:GitBranch},{label:'À traiter',value:attentionCount,icon:ShieldCheck},{label:'Validées',value:publishedCount,icon:CheckCircle}].map(item => { const Icon=item.icon; return <div key={item.label} className="rounded-2xl bg-[#F6FAFA] p-4"><Icon size={17} className="text-[#0B817A]"/><strong className="mt-4 block text-2xl font-black text-[#002050]">{item.value}</strong><span className="mt-1 block text-[10px] font-black uppercase tracking-[.09em] text-slate-400">{item.label}</span></div>})}
              <div className="col-span-3 flex items-center gap-3 border-t border-slate-100 px-1 pt-4 text-xs text-slate-500"><Building2 size={15} className="text-[#BF8813]"/><span>{formations.length} formation{formations.length !== 1 ? 's' : ''} dans le portefeuille de la Structure</span></div>
            </div>
          </div>
        </section>
        <div className="mt-7">

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div><p>{error}</p><button onClick={load} className="mt-2 font-semibold underline">Réessayer</button></div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div>
        ) : formations.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-200" />
            <h2 className="font-semibold" style={{ color: '#002050' }}>Aucune formation</h2>
            <p className="mt-1 text-sm text-gray-500">Créez votre première formation dans le Studio unifié.</p>
            <Link to="/structure/courses/new" className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Créer une formation
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((formation) => {
              const state = STATUS[formation.studio_status || 'draft'] || STATUS.draft;
              return (
                <article key={formation.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: '#E4E7EC' }}>
                  <div className="relative flex h-32 items-center justify-center" style={{ background: '#F3F6FA' }}>
                    {formation.cover_image_url ? <img src={formation.cover_image_url} alt="" className="h-full w-full object-cover" /> : <BookOpen size={38} style={{ color: '#00205066' }} />}
                    <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: state.color, background: state.bg }}>{state.label}</span>
                  </div>
                  <div className="p-4">
                    <h2 className="line-clamp-2 text-sm font-semibold" style={{ color: '#002050' }}>{formation.title || 'Formation sans titre'}</h2>
                    <p className="mt-2 text-xs text-gray-500">{[formation.category, formation.level].filter(Boolean).join(' · ') || 'Informations à compléter'}</p>
                    {formation.admin_comment && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{formation.admin_comment}</p>}
                    <div className="mt-4 flex gap-2">
                      {['draft', 'changes_requested', 'rejected'].includes(formation.studio_status || 'draft') ? (
                        <Link to={`/structure/studio/${formation.id}`} className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold" style={{ borderColor: '#002050', color: '#002050' }}>
                          <Edit2 size={14} /> Modifier
                        </Link>
                      ) : (
                        <div className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-50 py-2 text-xs text-gray-500"><CheckCircle size={14} /> {state.label}</div>
                      )}
                      <button type="button" onClick={() => removeFormation(formation)}
                        className="flex items-center justify-center rounded-lg border px-2.5 py-2 text-xs font-semibold"
                        style={{ borderColor: '#DC2626', color: '#DC2626' }}
                        title={(formation.studio_status || 'draft') === 'draft' ? 'Supprimer la formation' : 'Demander la suppression'}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </StructureFormationsLayout>
  );
}
