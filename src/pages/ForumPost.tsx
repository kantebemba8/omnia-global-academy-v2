import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ForumHamburgerNav from '../components/forum/ForumHamburgerNav';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { ThumbsUp, Flag, CheckCircle, Pin, ArrowLeft, X, Send, MessageSquare } from 'lucide-react';

interface Post {
  id: string; title: string | null; content: string; user_id: string;
  author_name: string; author_initials: string; country_code: string;
  space: string; likes_count: number; replies_count: number;
  is_pinned: boolean; is_solved: boolean; is_flagged: boolean;
  solved_reply_id: string | null; user_liked: boolean; created_at: string;
  parent_id: string | null;
}

const COUNTRIES = [
  { code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Sénégal' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' }, { code: 'GN', name: 'Guinée' }, { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' }, { code: 'NE', name: 'Niger' }, { code: 'CM', name: 'Cameroun' },
  { code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }, { code: 'MA', name: 'Maroc' },
];

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
  { value: 'hors_sujet', label: 'Hors sujet' },
  { value: 'discrimination', label: 'Discrimination ou harcèlement' },
  { value: 'autre', label: 'Autre' },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `il y a ${m || 1} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `il y a ${d}j` : new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function Monogram({ initials, size = 48, bg = '#002050' }: { initials: string; size?: number; bg?: string }) {
  return (
    <div className="flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function ForumPost() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [showReport, setShowReport] = useState<{ postId: string } | null>(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const isLoggedIn = !!localStorage.getItem('omnia_session_token');
  const token = localStorage.getItem('omnia_session_token') || '';
  const userData = JSON.parse(localStorage.getItem('omnia_user') || '{}');
  const myId = userData?.id;

  useEffect(() => {
    if (!postId) return;
    loadPost();
  }, [postId]);

  async function loadPost() {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Load post + replies via forum-posts-list approach, or just get it from Supabase directly
      const supaUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      if (supaUrl) {
        const [postRes, repliesRes] = await Promise.all([
          fetch(`${supaUrl}/rest/v1/forum_posts?id=eq.${postId}&select=*`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}` },
          }),
          fetch(`${supaUrl}/rest/v1/forum_posts?parent_id=eq.${postId}&is_visible=eq.true&order=created_at.asc&select=*`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}` },
          }),
        ]);
        const [postData, repliesData] = await Promise.all([postRes.json(), repliesRes.json()]);

        // Enrich with author names
        const rawPost = postData[0];
        if (!rawPost) { setLoading(false); return; }

        const userIds = [...new Set([rawPost.user_id, ...(repliesData || []).map((r: Post) => r.user_id)])];
        const usersRes = await fetch(`${supaUrl}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,full_name`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}` },
        });
        const users: Array<{ id: string; full_name: string }> = await usersRes.json();
        const userMap: Record<string, string> = {};
        users.forEach(u => { userMap[u.id] = u.full_name; });

        const authorData = (uid: string) => {
          const name = userMap[uid] || '';
          const parts = name.trim().split(/\s+/);
          return {
            author_name: parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || '?',
            author_initials: ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?',
          };
        };

        // Check liked
        let likedSet = new Set<string>();
        if (myId) {
          const likedRes = await fetch(`${supaUrl}/rest/v1/forum_likes?user_id=eq.${myId}&post_id=in.(${postId},${(repliesData || []).map((r: Post) => r.id).join(',')})&select=post_id`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}` },
          });
          const liked = await likedRes.json();
          likedSet = new Set((liked || []).map((l: { post_id: string }) => l.post_id));
        }

        setPost({ ...rawPost, ...authorData(rawPost.user_id), user_liked: likedSet.has(rawPost.id) });
        setReplies((repliesData || []).map((r: Post) => ({
          ...r, ...authorData(r.user_id), user_liked: likedSet.has(r.id),
        })));
      }
    } catch { /**/ }
    setLoading(false);
  }

  async function toggleLike(targetId: string) {
    if (!isLoggedIn) { navigate('/connexion'); return; }
    const res = await fetch(ENDPOINTS.forumPostLike, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: targetId }),
    });
    const d = await res.json();
    if (targetId === post?.id) {
      setPost(p => p ? { ...p, user_liked: d.liked, likes_count: d.likes_count } : p);
    } else {
      setReplies(rs => rs.map(r => r.id === targetId ? { ...r, user_liked: d.liked, likes_count: d.likes_count } : r));
    }
  }

  async function submitReply() {
    if (!replyContent.trim()) return;
    if (replyContent.length < 10) { setReplyError('Réponse trop courte (min 10 caractères).'); return; }
    setSubmitting(true); setReplyError('');
    const res = await fetch(ENDPOINTS.forumPostReply, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: postId, content: replyContent }),
    });
    const d = await res.json();
    if (d.success) { setReplyContent(''); loadPost(); } else setReplyError(d.error || 'Erreur.');
    setSubmitting(false);
  }

  async function submitReport() {
    if (!showReport) return;
    setReporting(true);
    await fetch(ENDPOINTS.forumPostReport, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: showReport.postId, reason: reportReason, details: reportDetails }),
    });
    setShowReport(null); setReporting(false); setReportDetails('');
  }

  async function markSolution(replyId: string) {
    await fetch(ENDPOINTS.forumPostSolve, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, reply_id: replyId }),
    });
    loadPost();
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col">
      <ForumHamburgerNav />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    </div>
  );

  if (!post) return (
    <div className="min-h-screen flex flex-col">
      <ForumHamburgerNav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Discussion introuvable.</p>
          <Link to="/forum" className="text-sm mt-2 inline-block" style={{ color: '#002050' }}>Retour au forum</Link>
        </div>
      </div>
    </div>
  );

  const countryName = COUNTRIES.find(c => c.code === post.country_code)?.name || post.country_code;
  const sortedReplies = [...replies].sort((a, b) => {
    if (a.id === post.solved_reply_id) return -1;
    if (b.id === post.solved_reply_id) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      <ForumHamburgerNav />

      <div className="max-w-3xl mx-auto px-4 py-6 w-full flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
          <Link to="/forum" className="hover:text-gray-600">Forum</Link>
          <span>›</span>
          <Link to={`/forum/${post.space}`} className="hover:text-gray-600 capitalize">{post.space === 'general' ? 'Espace Général' : post.space}</Link>
          <span>›</span>
          <span className="text-gray-600 truncate max-w-48">{post.title}</span>
        </div>

        {/* Main post */}
        <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #E4E7EC', borderLeft: '4px solid #BF8813' }}>
          <div className="p-6">
            <div className="flex items-start gap-4">
              <Monogram initials={post.author_initials} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-sm" style={{ color: '#002050' }}>{post.author_name}</span>
                  <span className="text-xs text-gray-400">{relativeTime(post.created_at)} · {countryName}</span>
                  {post.is_pinned && (
                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#EFF6FF', color: '#002050' }}>
                      <Pin className="w-2.5 h-2.5" /> Épinglé
                    </span>
                  )}
                  {post.is_solved && (
                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
                      <CheckCircle className="w-2.5 h-2.5" /> Résolu
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold mb-3" style={{ color: '#002050' }}>{post.title}</h1>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
              </div>
            </div>

            {/* Post actions */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => toggleLike(post.id)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
                style={post.user_liked ? { backgroundColor: '#EFF6FF', color: '#002050' } : { color: '#6B7280' }}>
                <ThumbsUp className="w-4 h-4" /> {post.likes_count}
              </button>
              <button onClick={() => replyRef.current?.focus()}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50 transition-all">
                <MessageSquare className="w-4 h-4" /> Répondre
              </button>
              {isLoggedIn && (
                <button onClick={() => setShowReport({ postId: post.id })}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 ml-auto transition-colors">
                  <Flag className="w-3.5 h-3.5" /> Signaler
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Replies */}
        {sortedReplies.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">{sortedReplies.length} réponse{sortedReplies.length !== 1 ? 's' : ''}</h2>
            <div className="space-y-3">
              {sortedReplies.map(reply => {
                const isSolution = reply.id === post.solved_reply_id;
                return (
                  <div key={reply.id} className="bg-white rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${isSolution ? '#1E7A52' : '#E4E7EC'}`, borderLeft: `3px solid ${isSolution ? '#1E7A52' : '#E4E7EC'}` }}>
                    <div className="p-4">
                      {isSolution && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-100">
                          <CheckCircle className="w-4 h-4" style={{ color: '#1E7A52' }} />
                          <span className="text-xs font-semibold" style={{ color: '#1E7A52' }}>Solution acceptée</span>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Monogram initials={reply.author_initials} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: '#002050' }}>{reply.author_name}</span>
                            <span className="text-xs text-gray-400">{relativeTime(reply.created_at)}</span>
                          </div>
                          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                          <div className="flex items-center gap-3 mt-3">
                            <button onClick={() => toggleLike(reply.id)}
                              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-all"
                              style={reply.user_liked ? { backgroundColor: '#EFF6FF', color: '#002050' } : { color: '#9CA3AF' }}>
                              <ThumbsUp className="w-3 h-3" /> {reply.likes_count}
                            </button>
                            {isLoggedIn && myId === post.user_id && !post.is_solved && (
                              <button onClick={() => markSolution(reply.id)}
                                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-all hover:bg-green-50"
                                style={{ color: '#1E7A52' }}>
                                <CheckCircle className="w-3 h-3" /> Marquer comme solution
                              </button>
                            )}
                            {isLoggedIn && (
                              <button onClick={() => setShowReport({ postId: reply.id })}
                                className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-400 ml-auto transition-colors">
                                <Flag className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reply zone */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-sm mb-3" style={{ color: '#002050' }}>Votre réponse</h3>
          {isLoggedIn ? (
            <>
              <textarea ref={replyRef} value={replyContent} onChange={e => setReplyContent(e.target.value.slice(0, 2000))}
                rows={4} placeholder="Rédigez votre réponse... (min 10 caractères)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gray-400 mb-1" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">{replyContent.length}/2000</span>
              </div>
              {replyError && <p className="text-red-600 text-sm mb-3">{replyError}</p>}
              <button onClick={submitReply} disabled={submitting || !replyContent.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#002050' }}>
                <Send className="w-4 h-4" />
                {submitting ? 'Publication…' : 'Publier ma réponse'}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">Connectez-vous pour répondre à cette discussion.</p>
              <Link to="/connexion" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#002050' }}>
                Se connecter
              </Link>
            </div>
          )}
        </div>
      </div>

      <PageFooter />

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Signaler ce contenu</h2>
              <button onClick={() => setShowReport(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                {REPORT_REASONS.map(r => (
                  <label key={r.value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50">
                    <input type="radio" value={r.value} checked={reportReason === r.value}
                      onChange={() => setReportReason(r.value)} className="accent-current" style={{ accentColor: '#002050' }} />
                    <span className="text-sm text-gray-700">{r.label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Détails (optionnel)</label>
                <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} rows={3}
                  placeholder="Précisez si nécessaire..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400" />
              </div>
              <button onClick={submitReport} disabled={reporting}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#DC2626' }}>
                {reporting ? 'Envoi…' : 'Envoyer le signalement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
