import { getSessionToken } from '../lib/session';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { Award, BookOpen as BookOpenCheck, CheckCircle, MessageCircle, MessageSquare, Pin, Plus, Search, ThumbsUp, X } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E5E7EB';

type SortMode = 'recent' | 'popular' | 'unsolved';

interface Post {
  id: string;
  title: string;
  content: string;
  author_name: string;
  author_initials: string;
  author_avatar_url?: string | null;
  author_badge?: string | null;
  likes_count: number;
  replies_count: number;
  is_pinned: boolean;
  is_solved: boolean;
  is_instructor: boolean;
  user_liked: boolean;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes || 1} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function Avatar({ post }: { post: Post }) {
  if (post.author_avatar_url) return <img src={post.author_avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />;
  return <span className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: post.is_instructor ? GOLD : BLUE }}>{post.author_initials || '?'}</span>;
}

export default function ForumCours() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const token = getSessionToken() || '';

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const load = useCallback(async () => {
    if (!courseId) return;
    if (!token) {
      navigate(`/connexion?redirect=${encodeURIComponent(`/forum/cours/${courseId}`)}`, { replace: true });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ space: 'cours', course_id: courseId, page: String(page), sort, ...(search ? { search } : {}) });
      const response = await fetch(`${ENDPOINTS.forumPostsList}&${query}`, { headers: edgeAuthHeaders() });
      const data = await response.json();
      if (data.error === 'NOT_ENROLLED' || data.error === 'FORBIDDEN') { setError('not_enrolled'); return; }
      if (data.error === 'AUTH_REQUIRED' || data.error === 'SESSION_INVALID') { navigate('/connexion', { replace: true }); return; }
      if (!response.ok) throw new Error(data.error || 'Chargement impossible.');
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.total_pages || 1)));
      setCourseTitle(data.course_title || 'Forum de la formation');
      setCanCreate(data.can_create !== false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'network');
    } finally {
      setLoading(false);
    }
  }, [courseId, page, search, sort, token, navigate]);

  useEffect(() => { void load(); }, [load]);

  async function createPost() {
    if (!newTitle.trim() || !newContent.trim()) { setPostError('Titre et contenu requis.'); return; }
    if (newTitle.trim().length < 10) { setPostError('Titre trop court (minimum 10 caractères).'); return; }
    if (newContent.trim().length < 20) { setPostError('Contenu trop court (minimum 20 caractères).'); return; }
    setPosting(true);
    setPostError('');
    try {
      const response = await fetch(ENDPOINTS.forumPostCreate, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ space: 'cours', title: newTitle.trim(), content: newContent.trim(), course_id: courseId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Publication impossible.');
      setShowModal(false);
      setNewTitle('');
      setNewContent('');
      navigate(`/forum/post/${data.post_id}`);
    } catch (cause) {
      setPostError(cause instanceof Error ? cause.message : 'Erreur réseau.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <CommunityLayout>
      <div className="min-h-screen bg-white">
        <section className="border-b border-slate-100 px-4 pb-8 pt-8 md:px-8 md:pb-10">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6 md:p-8" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><Link to="/forum" className="hover:text-slate-600">Omnia Communauté</Link><span>›</span><Link to="/forum/formations" className="hover:text-slate-600">Forums des formations</Link><span>›</span><span className="max-w-[260px] truncate" style={{ color: BLUE }}>{courseTitle || 'Formation'}</span></div>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] shadow-sm" style={{ color: GOLD }}><BookOpenCheck size={15} /> Forum réservé à la formation</div>
                  <h1 className="mt-4 text-3xl font-black md:text-4xl" style={{ color: BLUE }}>{courseTitle || 'Forum de la formation'}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Posez une question liée au contenu de la formation, aux exercices ou aux évaluations. Les réponses du formateur sont identifiées et la meilleure réponse peut être marquée comme solution.</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="rounded-2xl border bg-white px-5 py-4 text-center" style={{ borderColor: BORDER }}><strong className="block text-2xl" style={{ color: BLUE }}>{total}</strong><span className="text-xs text-slate-500">discussion{total === 1 ? '' : 's'}</span></div>
                  {canCreate && <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}><Plus size={16} /> Poser une question</button>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 md:px-8">
          <div className="mx-auto max-w-6xl">
            {error === 'not_enrolled' ? (
              <div className="rounded-3xl border border-dashed bg-white p-12 text-center" style={{ borderColor: BORDER }}><BookOpenCheck size={36} className="mx-auto text-slate-300" /><h2 className="mt-4 text-lg font-bold" style={{ color: BLUE }}>Accès réservé aux participants</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Vous devez être inscrit à cette formation, en être le formateur ou disposer d'une autorisation de modération pour accéder à ce forum.</p><Link to="/catalogue" className="mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}>Voir les formations</Link></div>
            ) : error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">{error} <button onClick={() => void load()} className="font-bold underline">Réessayer</button></div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: BORDER }}>
                  <div className="flex gap-1 rounded-xl bg-slate-50 p-1">{(['recent', 'popular', 'unsolved'] as const).map(value => <button key={value} onClick={() => { setSort(value); setPage(1); }} className="rounded-lg px-3 py-2 text-xs font-semibold" style={sort === value ? { background: BLUE, color: 'white' } : { color: '#64748B' }}>{value === 'recent' ? 'Récents' : value === 'popular' ? 'Populaires' : 'Sans solution'}</button>)}</div>
                  <div className="relative min-w-[240px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher dans ce forum..." className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none" style={{ borderColor: BORDER }} /></div>
                </div>

                <div className="mt-5 flex items-start gap-3 rounded-2xl border bg-amber-50/60 p-4" style={{ borderColor: 'rgba(191,136,19,.25)' }}><Award size={19} color={GOLD} className="mt-0.5 shrink-0" /><p className="text-xs leading-5 text-amber-800">Les formateurs sont identifiés par un badge. La personne qui a posé la question, ainsi que le formateur autorisé, peuvent valider une réponse comme solution.</p></div>

                <div className="mt-6">
                  {loading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border bg-slate-50" style={{ borderColor: BORDER }} />)}</div> : posts.length === 0 ? <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: BORDER }}><MessageCircle size={36} className="mx-auto text-slate-300" /><h2 className="mt-4 text-lg font-bold" style={{ color: BLUE }}>Aucune question pour le moment</h2><p className="mt-2 text-sm text-slate-500">Posez la première question utile sur cette formation.</p></div> : <div className="space-y-3">{posts.map(post => <Link key={post.id} to={`/forum/post/${post.id}`} className="block rounded-2xl border bg-white p-5 transition hover:border-amber-300 hover:shadow-sm" style={{ borderColor: BORDER }}><div className="flex items-start gap-4"><Avatar post={post} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{post.is_pinned && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold" style={{ color: BLUE }}><Pin size={11} /> Épinglé</span>}{post.is_solved && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle size={11} /> Solution trouvée</span>}{(post.is_instructor || post.author_badge) && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold" style={{ color: GOLD }}>{post.author_badge || 'Formateur'}</span>}</div><h3 className="mt-2 line-clamp-2 text-base font-bold" style={{ color: BLUE }}>{post.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{post.content}</p><p className="mt-3 text-xs text-slate-400">{post.author_name} · {relativeTime(post.created_at)}</p></div><div className="flex shrink-0 flex-col items-end gap-2 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {post.replies_count}</span><span className="inline-flex items-center gap-1"><ThumbsUp size={14} /> {post.likes_count}</span></div></div></Link>)}</div>}
                </div>

                {totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><button disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ borderColor: BORDER, color: BLUE }}>Précédent</button><span className="text-sm text-slate-500">Page {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ borderColor: BORDER, color: BLUE }}>Suivant</button></div>}
              </>
            )}
          </div>
        </section>

        <PageFooter />

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: GOLD }}>Forum de formation</p><h2 className="mt-1 text-lg font-black" style={{ color: BLUE }}>Poser une question</h2></div><button onClick={() => setShowModal(false)} className="rounded-xl p-2 hover:bg-slate-100"><X size={18} className="text-slate-500" /></button></div><div className="space-y-4 p-5"><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Titre <span className="font-normal text-slate-400">({newTitle.length}/200)</span></label><input value={newTitle} onChange={event => setNewTitle(event.target.value.slice(0, 200))} placeholder="Exemple : je ne comprends pas l’exercice du module 2" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: BORDER }} /></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Détails <span className="font-normal text-slate-400">({newContent.length}/5000)</span></label><textarea value={newContent} onChange={event => setNewContent(event.target.value.slice(0, 5000))} rows={7} placeholder="Indiquez le module, la leçon, ce que vous avez essayé et le point précis qui vous bloque..." className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: BORDER }} /></div>{postError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{postError}</p>}<div className="flex gap-3"><button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600" style={{ borderColor: BORDER }}>Annuler</button><button onClick={() => void createPost()} disabled={posting} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: BLUE }}>{posting ? 'Publication...' : 'Publier la question'}</button></div></div></div></div>
        )}
      </div>
    </CommunityLayout>
  );
}
