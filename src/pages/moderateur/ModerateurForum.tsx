import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CommunityLayout from '../../components/community/CommunityLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  Activity,
  CheckCircle,
  Eye,
  EyeOff,
  Flag,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

interface ForumPost {
  id: string;
  user_id: string;
  space: string;
  title: string | null;
  content: string;
  is_visible: boolean;
  is_flagged: boolean;
  flagged_reason?: string;
  created_at: string;
  author_name: string;
}
interface ForumData {
  flagged_posts: ForumPost[];
  all_posts: ForumPost[];
}

const BLUE = '#002050';
const TEAL = '#0F766E';
const BORDER = '#DDEBE8';

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ModerateurForum() {
  const [params] = useSearchParams();
  const search = (params.get('search') || '').trim().toLocaleLowerCase('fr-FR');
  const [data, setData] = useState<ForumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'flagged' | 'all'>('flagged');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const bypassAuth = params.get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  function load() {
    if (bypassAuth) {
      setData({ flagged_posts: [], all_posts: [] });
      setLoading(false);
      return;
    }
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(ENDPOINTS.moderatorForumAction, { headers: edgeAuthHeaders() })
      .then((response) => response.json())
      .then((payload) => {
        setData({
          flagged_posts: Array.isArray(payload?.flagged_posts) ? payload.flagged_posts : [],
          all_posts: Array.isArray(payload?.all_posts) ? payload.all_posts : [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [bypassAuth]);

  async function doAction(postId: string, action: 'hide' | 'restore' | 'unflag') {
    setSubmitting(postId + action);
    const res = await fetch(ENDPOINTS.moderatorForumAction, {
      method: 'POST',
      headers: { ...edgeAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, action }),
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(null);
    if (payload.success) {
      const messages: Record<string, string> = { hide: 'Publication masquée.', restore: 'Publication restaurée.', unflag: 'Signalement retiré.' };
      setToast(messages[action]);
      load();
    } else {
      setToast(payload.message ?? 'Action impossible.');
    }
    window.setTimeout(() => setToast(''), 3000);
  }

  const source = tab === 'flagged' ? (data?.flagged_posts ?? []) : (data?.all_posts ?? []);
  const posts = useMemo(() => {
    if (!search) return source;
    return source.filter(post => [post.title, post.content, post.author_name, post.space, post.flagged_reason]
      .filter(Boolean)
      .some(value => String(value).toLocaleLowerCase('fr-FR').includes(search)));
  }, [search, source]);

  const hiddenCount = useMemo(() => (data?.all_posts ?? []).filter(post => !post.is_visible).length, [data]);
  const visibleCount = useMemo(() => (data?.all_posts ?? []).filter(post => post.is_visible).length, [data]);

  return (
    <CommunityLayout>
      <main className="min-h-[72vh] bg-[#F8FCFB]">
        {toast && (
          <div className="fixed right-4 top-4 z-[80] rounded-xl border border-[#DDEBE8] bg-white px-5 py-3 text-sm font-bold text-[#002050] shadow-xl">{toast}</div>
        )}

        <section className="border-b border-[#DDEBE8] bg-[#132139] text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#F1B36C]"><ShieldCheck size={14} /> Centre de confiance</div>
              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-.04em] md:text-5xl">Examiner le contexte avant de décider.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">Une file opérationnelle pour traiter les signalements, vérifier la conversation d’origine et garder des décisions cohérentes.</p>
              {search && <p className="mt-4 text-sm font-bold text-[#F1B36C]">Recherche active : « {params.get('search')} »</p>}
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[.06]">
              <div className="p-4"><span className="block text-2xl font-black text-[#F1B36C]">{data?.flagged_posts?.length ?? 0}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-white/45">Signalés</span></div>
              <div className="p-4"><span className="block text-2xl font-black">{visibleCount}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-white/45">Visibles</span></div>
              <div className="p-4"><span className="block text-2xl font-black">{hiddenCount}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-white/45">Masqués</span></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDEBE8] pb-4">
            <div className="flex gap-1 rounded-xl border border-[#DDEBE8] bg-white p-1">
              <button onClick={() => setTab('flagged')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition" style={tab === 'flagged' ? { backgroundColor: '#C56A23', color: 'white' } : { color: '#64748B' }}><Flag size={14} /> À examiner ({data?.flagged_posts?.length ?? 0})</button>
              <button onClick={() => setTab('all')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition" style={tab === 'all' ? { backgroundColor: BLUE, color: 'white' } : { color: '#64748B' }}><MessageSquare size={14} /> Toutes ({data?.all_posts?.length ?? 0})</button>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400"><Activity size={14} style={{ color: TEAL }} /> {posts.length} élément{posts.length === 1 ? '' : 's'} dans la vue</div>
          </div>

          {loading ? (
            <div className="grid h-52 place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#DDEBE8] border-t-[#0F766E]" /></div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center"><ShieldCheck className="mx-auto text-slate-300" size={38} /><h2 className="mt-4 text-lg font-black text-[#002050]">{search ? 'Aucun résultat dans cette file' : tab === 'flagged' ? 'Aucun signalement à examiner' : 'Aucune publication'}</h2><p className="mt-2 text-sm text-slate-500">{search ? 'Modifiez votre recherche depuis l’en-tête.' : 'La file se remplira automatiquement avec l’activité de la Communauté.'}</p></div>
          ) : (
            <div className="divide-y divide-[#E6F0EE] border-b border-[#E6F0EE]">
              {posts.map(post => (
                <article key={post.id} className="grid gap-4 py-6 md:grid-cols-[120px_1fr_auto] md:items-start" style={!post.is_visible ? { opacity: .64 } : undefined}>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[.13em] text-slate-400">{post.space}</span>
                    <span className="mt-2 block text-xs font-semibold text-slate-500">{relativeDate(post.created_at)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.is_flagged && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-amber-700"><Flag size={11} /> Signalé</span>}
                      {!post.is_visible && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-rose-700">Masqué</span>}
                    </div>
                    <h2 className="mt-2 text-base font-black text-[#002050]">{post.title || 'Publication sans titre'}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{post.author_name}</p>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{post.content}</p>
                    {post.flagged_reason && <div className="mt-4 border-l-2 border-amber-400 bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-800"><strong>Contexte du signalement :</strong> {post.flagged_reason}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 md:max-w-[190px] md:justify-end">
                    {post.is_visible ? (
                      <button onClick={() => doAction(post.id, 'hide')} disabled={submitting === post.id + 'hide'} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><EyeOff size={14} /> Masquer</button>
                    ) : (
                      <button onClick={() => doAction(post.id, 'restore')} disabled={submitting === post.id + 'restore'} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50" style={{ backgroundColor: TEAL }}><Eye size={14} /> Restaurer</button>
                    )}
                    {post.is_flagged && <button onClick={() => doAction(post.id, 'unflag')} disabled={submitting === post.id + 'unflag'} className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDEBE8] bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-[#F4FAF8] disabled:opacity-50"><CheckCircle size={14} /> Libérer</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </CommunityLayout>
  );
}
