import { getSessionToken } from '../lib/session';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import CareerPublicLayout from '../components/career/CareerPublicLayout';
import { ENDPOINTS } from '../lib/config';
import { COUNTRIES as COUNTRY_OPTIONS } from '../lib/countries';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../lib/edgeAuth';
import { ArrowRight, Briefcase, CheckCircle, Globe2, MessageCircle, MessageSquare, Pin, Plus, ThumbsUp, X } from 'lucide-react';

const BLUE = '#002050';
const TEAL = '#0F766E';
const GOLD = '#BF8813';
const BORDER = '#DDEBE8';
const COUNTRIES = COUNTRY_OPTIONS.map(country => ({ code: country.code, name: country.label }));

interface Post {
  id: string; title: string; content: string; author_name: string; author_initials: string;
  author_avatar_url?: string | null; author_badge?: string | null; country_code: string;
  likes_count: number; replies_count: number; is_pinned: boolean; is_solved: boolean;
  is_flagged: boolean; user_liked: boolean; created_at: string;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000); if (m < 60) return `il y a ${m || 1} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24); if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function Avatar({ post }: { post: Post }) {
  if (post.author_avatar_url) return <img src={post.author_avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />;
  return <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0F766E] text-sm font-bold text-white">{post.author_initials || '?'}</span>;
}

export default function ForumGeneral() {
  const navigate = useNavigate();
  const location = useLocation();
  const isCarriere = location.pathname.includes('/forum/carriere');
  const space = isCarriere ? 'carriere' : 'general';
  const spaceLabel = isCarriere ? 'Conseils carrière' : 'Espace général';
  const description = isCarriere
    ? 'Questions sur le CV, les entretiens, la recherche d’emploi et l’évolution professionnelle.'
    : 'Questions, expériences et entraide autour de l’apprentissage, de l’orientation et de la vie dans Omnia.';
  const Layout = isCarriere ? CareerPublicLayout : CommunityLayout;

  const params = new URLSearchParams(location.search);
  const search = (params.get('search') || '').trim();
  const [country, setCountry] = useState(params.get('country_code') || localStorage.getItem('user_country') || '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<'recent' | 'popular' | 'unsolved'>('recent');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const token = getSessionToken() || '';
  const isLoggedIn = Boolean(token);

  useEffect(() => setPage(1), [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ space, country_code: country, page: String(page), sort, ...(search ? { search } : {}) });
      const headers = token ? edgeAuthHeaders() : edgeGatewayHeaders();
      const response = await fetch(`${ENDPOINTS.forumPostsList}&${q}`, { headers });
      const data = await response.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.total_pages || 1)));
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }, [space, country, page, sort, search, token]);

  useEffect(() => { void load(); }, [load]);

  async function createPost() {
    if (!newTitle.trim() || !newContent.trim()) { setPostError('Titre et contenu requis.'); return; }
    if (newTitle.trim().length < 10) { setPostError('Titre trop court (minimum 10 caractères).'); return; }
    if (newContent.trim().length < 20) { setPostError('Contenu trop court (minimum 20 caractères).'); return; }
    setPosting(true); setPostError('');
    try {
      const response = await fetch(ENDPOINTS.forumPostCreate, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ space, title: newTitle.trim(), content: newContent.trim(), country_code: country }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Publication impossible.');
      setShowModal(false); setNewTitle(''); setNewContent(''); navigate(`/forum/post/${data.post_id}`);
    } catch (cause) { setPostError(cause instanceof Error ? cause.message : 'Erreur réseau.'); }
    finally { setPosting(false); }
  }

  return (
    <Layout>
      <main className={isCarriere ? 'min-h-screen bg-white' : 'min-h-screen bg-[#F8FCFB]'}>
        <section className={`border-b ${isCarriere ? 'border-slate-100' : 'border-[#DDEBE8]'} bg-white`}>
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Link to={isCarriere ? '/career-studio' : '/forum'} className="hover:text-slate-600">{isCarriere ? 'Omnia Career' : 'Omnia Communauté'}</Link><span>›</span><span style={{ color: isCarriere ? GOLD : TEAL }}>{spaceLabel}</span></div>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[.17em]" style={{ color: isCarriere ? GOLD : TEAL }}>{isCarriere ? 'Questions professionnelles' : 'Le fil commun'}</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#002050] md:text-5xl">{spaceLabel}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
                {search && <p className="mt-4 text-sm font-semibold" style={{ color: isCarriere ? GOLD : TEAL }}>Recherche active : « {search} »</p>}
                {isCarriere && <Link to="/forum/emploi" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#002050]"><Briefcase size={16} /> Voir les opportunités <ArrowRight size={15} /></Link>}
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <div className="border-l-2 pl-4" style={{ borderColor: isCarriere ? GOLD : TEAL }}><strong className="block text-3xl font-black text-[#002050]">{total}</strong><span className="text-xs font-semibold text-slate-400">discussion{total === 1 ? '' : 's'}</span></div>
                {isLoggedIn ? <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-black text-white"><Plus size={16} /> Nouvelle discussion</button> : <Link to="/connexion" className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-black text-white"><Plus size={16} /> Se connecter pour publier</Link>}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: isCarriere ? '#E5E7EB' : BORDER }}>
            <div className="flex gap-1 rounded-xl border bg-white p-1" style={{ borderColor: isCarriere ? '#E5E7EB' : BORDER }}>
              {(['recent', 'popular', 'unsolved'] as const).map(value => (
                <button key={value} onClick={() => { setSort(value); setPage(1); }} className="rounded-lg px-3 py-2 text-xs font-bold" style={sort === value ? { background: isCarriere ? BLUE : TEAL, color: 'white' } : { color: '#64748B' }}>
                  {value === 'recent' ? 'Récents' : value === 'popular' ? 'Populaires' : 'Sans solution'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5" style={{ borderColor: isCarriere ? '#E5E7EB' : BORDER }}><Globe2 size={15} className="text-slate-400" /><select value={country} onChange={event => { setCountry(event.target.value); setPage(1); }} className="bg-transparent text-xs font-semibold text-slate-600 outline-none"><option value="">Tous les pays</option>{COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
          </div>

          <div className="mt-2 divide-y" style={{ borderColor: isCarriere ? '#E5E7EB' : BORDER }}>
            {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse py-4"><div className="h-full rounded-xl bg-slate-100" /></div>) : posts.length === 0 ? (
              <div className="py-16 text-center"><MessageCircle size={34} className="mx-auto text-slate-300" /><h2 className="mt-4 text-lg font-black text-[#002050]">Aucune discussion trouvée</h2><p className="mt-2 text-sm text-slate-500">Modifiez les filtres ou lancez la première discussion utile.</p></div>
            ) : posts.map(post => (
              <Link key={post.id} to={`/forum/post/${post.id}`} className="group grid gap-3 py-5 sm:grid-cols-[48px_1fr_auto] sm:items-start">
                <Avatar post={post} />
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{post.is_pinned && <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#002050]"><Pin size={11} /> Épinglé</span>}{post.is_solved && <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700"><CheckCircle size={11} /> Solution trouvée</span>}{post.author_badge && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-[#BF8813]">{post.author_badge}</span>}</div><h3 className="mt-2 line-clamp-2 text-base font-black text-[#002050] transition group-hover:text-[#0F766E]">{post.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{post.content}</p><p className="mt-3 text-xs text-slate-400">{post.author_name} · {relativeTime(post.created_at)} · {COUNTRIES.find(item => item.code === post.country_code)?.name || post.country_code}</p></div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-slate-400 sm:pt-2"><span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {post.replies_count}</span><span className="inline-flex items-center gap-1"><ThumbsUp size={14} /> {post.likes_count}</span><ArrowRight size={14} className="opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" style={{ color: isCarriere ? GOLD : TEAL }} /></div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><button disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ borderColor: isCarriere ? '#E5E7EB' : BORDER, color: BLUE }}>Précédent</button><span className="text-sm text-slate-500">Page {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40" style={{ borderColor: isCarriere ? '#E5E7EB' : BORDER, color: BLUE }}>Suivant</button></div>}
        </section>


        {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: isCarriere ? GOLD : TEAL }}>{spaceLabel}</p><h2 className="mt-1 text-lg font-black text-[#002050]">Nouvelle discussion</h2></div><button onClick={() => setShowModal(false)} className="rounded-xl p-2 hover:bg-slate-100"><X size={18} className="text-slate-500" /></button></div><div className="space-y-4 p-5"><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Titre <span className="font-normal text-slate-400">({newTitle.length}/200)</span></label><input value={newTitle} onChange={event => setNewTitle(event.target.value.slice(0, 200))} placeholder="Résumez clairement votre question ou sujet..." className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: BORDER }} /></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Contenu <span className="font-normal text-slate-400">({newContent.length}/5000)</span></label><textarea value={newContent} onChange={event => setNewContent(event.target.value.slice(0, 5000))} rows={7} placeholder="Ajoutez le contexte et les informations nécessaires pour obtenir des réponses utiles..." className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: BORDER }} /></div>{postError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{postError}</p>}<div className="flex gap-3"><button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600" style={{ borderColor: BORDER }}>Annuler</button><button onClick={() => void createPost()} disabled={posting} className="flex-1 rounded-xl bg-[#002050] py-2.5 text-sm font-bold text-white disabled:opacity-60">{posting ? 'Publication...' : 'Publier'}</button></div></div></div></div>}
      </main>
    </Layout>
  );
}
