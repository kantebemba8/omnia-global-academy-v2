import { getSessionToken } from '../../lib/session';
import { API_BASE_URL } from '../../lib/config';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, CheckCircle, Edit2, PlusCircle, Trash2 } from 'lucide-react';
import { StructureLayout } from '../../components/StructureLayout';

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

  async function deleteDraft(id: string, title: string) {
    if (!window.confirm(`Supprimer définitivement le brouillon « ${title} » ?`)) return;
    const token = getSessionToken();
    if (!token) return navigate('/connexion', { replace: true });
    try {
      const res = await fetch(API, {
        method: 'POST', headers: gatewayHeaders(),
        body: JSON.stringify({ action: 'delete_course', course_id: id, creator_context: 'structure', session_token: token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Suppression impossible');
      setFormations(items => items.filter(item => item.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible'); }
  }


  return (
    <StructureLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Mes formations</h1>
            <p className="text-sm text-gray-500 mt-1">{formations.length} formation{formations.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/structure/studio/new" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: '#002050' }}>
            <PlusCircle size={16} /> Créer une formation
          </Link>
        </div>

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
            <Link to="/structure/studio/new" className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}>
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
                      {(formation.studio_status || 'draft') === 'draft' && (
                        <button type="button" onClick={() => deleteDraft(formation.id, formation.title || 'Formation sans titre')}
                          className="flex items-center justify-center rounded-lg border px-2.5 py-2 text-xs font-semibold"
                          style={{ borderColor: '#DC2626', color: '#DC2626' }} title="Supprimer le brouillon">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </StructureLayout>
  );
}
