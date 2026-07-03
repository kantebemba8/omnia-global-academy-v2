import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { MessageCircle, Plus, X, Search, ThumbsUp, MessageSquare, Pin, CheckCircle, Award } from 'lucide-react';

interface Post {
  id: string; title: string; content: string; author_name: string; author_initials: string;
  likes_count: number; replies_count: number; is_pinned: boolean; is_solved: boolean;
  is_instructor: boolean; user_liked: boolean; created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `il y a ${m || 1} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function ForumCours() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const token = localStorage.getItem('omnia_session_token') || '';

  const load = useCallback(async () => {
    if (!courseId || !token) return;
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ course_id: courseId, page: String(page), ...(search ? { search } : {}) });
      const res = await fetch(`${ENDPOINTS.forumCourseList}?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.error === 'NOT_ENROLLED') { setError('not_enrolled'); setLoading(false); return; }
      if (d.error === 'AUTH_REQUIRED') { navigate('/connexion'); return; }
      setPosts(d.posts || []);
      setTotal(d.total || 0);
      setTotalPages(d.total_pages || 1);
      if (d.course_title) setCourseTitle(d.course_title);
    } catch { setError('network'); }
    setLoading(false);
  }, [courseId, page, search, token, navigate]);

  useEffect(() => { load(); }, [load]);

  async function createPost() {
    if (!newTitle.trim() || !newContent.trim()) { setPostError('Titre et contenu requis.'); return; }
    if (newTitle.length < 10) { setPostError('Titre trop court (min 10 caractères).'); return; }
    if (newContent.length < 20) { setPostError('Contenu trop court (min 20 caractères).'); return; }
    setPosting(true); setPostError('');
    try {
      const res = await fetch(ENDPOINTS.forumPostCreate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ space: 'cours', title: newTitle, content: newContent, course_id: courseId }),
      });
      const d = await res.json();
      if (d.success) {
        setShowModal(false); setNewTitle(''); setNewContent('');
        navigate(`/forum/post/${d.post_id}`);
      } else {
        setPostError(d.error || 'Erreur lors de la publication.');
      }
    } catch { setPostError('Erreur réseau.'); }
    setPosting(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link to="/forum" className="hover:text-gray-600 transition-colors">Forum</Link>
            <span>›</span>
            <span className="hover:text-gray-600 transition-colors">Forums des Formations</span>
            {courseTitle && <><span>›</span><span style={{ color: '#002050' }}>{courseTitle}</span></>}
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#002050' }}>
                {courseTitle || 'Forum du cours'}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{total} discussion{total !== 1 ? 's' : ''}</p>
            </div>
            {token && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#002050' }}>
                <Plus className="w-4 h-4" /> Poser une question
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">
        {error === 'not_enrolled' ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-700 font-semibold mb-1">Accès réservé aux apprenants inscrits</p>
            <p className="text-sm text-gray-400 mb-5">Vous devez être inscrit à cette formation pour accéder à son forum.</p>
            <Link to="/catalogue" className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#002050' }}>
              Voir les formations
            </Link>
          </div>
        ) : error === 'network' ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <p className="text-gray-500">Erreur de chargement. <button onClick={load} className="underline">Réessayer</button></p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-5">
              <div className="relative max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Rechercher dans ce forum..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gray-400" />
              </div>
            </div>

            {/* Instructor note */}
            <div className="flex items-start gap-3 p-3 rounded-lg mb-5 border border-amber-200" style={{ backgroundColor: '#FFFBEB' }}>
              <Award className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#BF8813' }} />
              <p className="text-xs" style={{ color: '#92660A' }}>
                Les réponses de l'instructeur sont marquées d'un badge doré. Marquez la meilleure réponse comme solution pour aider les autres apprenants.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">Aucune question pour l'instant</p>
                <p className="text-sm text-gray-400 mt-1">Posez la première question sur ce cours !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => (
                  <Link key={post.id} to={`/forum/post/${post.id}`}
                    className="block bg-white rounded-xl border border-gray-100 hover:border-amber-300 hover:shadow-sm transition-all overflow-hidden">
                    <div className="flex items-start gap-4 p-4">
                      <div className="flex-shrink-0 relative">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: post.is_instructor ? '#BF8813' : '#002050' }}>
                          {post.author_initials}
                        </div>
                        {post.is_instructor && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: '#BF8813' }}>
                            <Award className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap mb-1">
                          {post.is_pinned && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                              style={{ backgroundColor: '#EFF6FF', color: '#002050' }}>
                              <Pin className="w-2.5 h-2.5" /> Épinglé
                            </span>
                          )}
                          {post.is_solved && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                              style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
                              <CheckCircle className="w-2.5 h-2.5" /> Résolu
                            </span>
                          )}
                          {post.is_instructor && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                              style={{ backgroundColor: '#FEF9EE', color: '#BF8813' }}>
                              <Award className="w-2.5 h-2.5" /> Instructeur
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2" style={{ color: '#002050' }}>
                          {post.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{post.content}</p>
                        <p className="text-xs text-gray-400">{post.author_name} · {relativeTime(post.created_at)}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 text-xs text-gray-400 ml-2">
                        <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{post.replies_count}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{post.likes_count}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
                  Précédent
                </button>
                <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <PageFooter />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Poser une question</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Titre <span className="text-gray-400">({newTitle.length}/200)</span>
                </label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value.slice(0, 200))}
                  placeholder="Résumez votre question..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Détails <span className="text-gray-400">({newContent.length}/5000)</span>
                </label>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value.slice(0, 5000))}
                  rows={6} placeholder="Décrivez votre question en détail, mentionnez la leçon ou le concept concerné..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gray-400" />
              </div>
              {postError && <p className="text-red-600 text-sm">{postError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={createPost} disabled={posting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: '#002050' }}>
                  {posting ? 'Publication…' : 'Publier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
