import { getSessionToken } from '../lib/session';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../lib/edgeAuth';
import { Ban, CheckCircle, Flag, MessageSquare, Pin, Send, ThumbsUp, X } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E5E7EB';

interface Post {
  id: string;
  title: string | null;
  content: string;
  user_id: string;
  author_name: string;
  author_initials: string;
  author_avatar_url?: string | null;
  author_badge?: string | null;
  country_code: string | null;
  space: 'general' | 'carriere' | 'cours';
  course_id?: string | null;
  course_title?: string | null;
  likes_count: number;
  replies_count: number;
  is_pinned: boolean;
  is_solved: boolean;
  is_flagged: boolean;
  is_instructor?: boolean;
  solved_reply_id: string | null;
  user_liked: boolean;
  created_at: string;
  parent_id: string | null;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
  { value: 'hors_sujet', label: 'Hors sujet' },
  { value: 'discrimination', label: 'Discrimination ou harcèlement' },
  { value: 'autre', label: 'Autre' },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes || 1} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `il y a ${days} j` : new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function Avatar({ post, size = 46 }: { post: Post; size?: number }) {
  if (post.author_avatar_url) return <img src={post.author_avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * .32, background: post.is_instructor ? GOLD : BLUE }}>{post.author_initials || '?'}</span>;
}

function spacePath(post: Pick<Post, 'space' | 'course_id'>) {
  if (post.space === 'cours' && post.course_id) return `/forum/cours/${post.course_id}`;
  if (post.space === 'carriere') return '/forum/carriere';
  return '/forum/general';
}

function spaceLabel(post: Pick<Post, 'space' | 'course_title'>) {
  if (post.space === 'cours') return post.course_title || 'Forum de formation';
  if (post.space === 'carriere') return 'Conseils carrière';
  return 'Espace général';
}

export default function ForumPost() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const token = getSessionToken() || '';
  const isLoggedIn = Boolean(token);
  const userData = (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}'); } catch { return {}; } })();
  const myId = userData?.id as string | undefined;

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [canMarkSolution, setCanMarkSolution] = useState(false);
  const [showReport, setShowReport] = useState<{ postId: string } | null>(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);

  useEffect(() => { if (postId) void loadPost(); }, [postId, token]);
  useEffect(() => { if (token) void loadBlockedUsers(); }, [token]);

  async function loadBlockedUsers() {
    try {
      const response = await fetch(ENDPOINTS.authUpdateProfile, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'list_blocked_users' }),
      });
      const data = await response.json();
      if (response.ok) setBlockedUserIds(new Set((data.blocked_users || []).map((item: { user_id: string }) => item.user_id)));
    } catch { /* community remains available */ }
  }

  async function loadPost() {
    if (!postId) return;
    setLoading(true);
    setAccessError('');
    try {
      const headers = token ? edgeAuthHeaders() : edgeGatewayHeaders();
      const response = await fetch(`${ENDPOINTS.forumPostDetail}&post_id=${encodeURIComponent(postId)}`, { headers });
      const data = await response.json();
      if (data.error === 'NOT_ENROLLED' || data.error === 'FORBIDDEN') { setAccessError('not_enrolled'); setPost(null); setReplies([]); return; }
      if (data.error === 'AUTH_REQUIRED' && !token) { setAccessError('auth_required'); setPost(null); return; }
      if (!response.ok) throw new Error(data.error || 'Discussion introuvable.');
      setPost(data.post || null);
      setReplies(Array.isArray(data.replies) ? data.replies : []);
      setCanMarkSolution(Boolean(data.can_mark_solution));
    } catch (cause) {
      setAccessError(cause instanceof Error ? cause.message : 'Discussion introuvable.');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }

  async function blockUser(targetUserId: string) {
    if (!token || targetUserId === myId) return;
    if (!window.confirm('Bloquer cet utilisateur ? Ses contenus de la communauté seront masqués pour vous.')) return;
    setBlockingUserId(targetUserId);
    try {
      const response = await fetch(ENDPOINTS.authUpdateProfile, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'block_user', target_user_id: targetUserId, reason: 'community' }),
      });
      if (response.ok) {
        setBlockedUserIds(current => new Set([...current, targetUserId]));
        if (post?.user_id === targetUserId) navigate(spacePath(post));
        else setReplies(current => current.filter(reply => reply.user_id !== targetUserId));
      }
    } finally {
      setBlockingUserId(null);
    }
  }

  async function toggleLike(targetId: string) {
    if (!isLoggedIn) { navigate(`/connexion?redirect=${encodeURIComponent(`/forum/post/${postId}`)}`); return; }
    const response = await fetch(ENDPOINTS.forumPostLike, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ post_id: targetId }),
    });
    const data = await response.json();
    if (!response.ok) return;
    if (targetId === post?.id) setPost(current => current ? { ...current, user_liked: data.liked, likes_count: data.likes_count } : current);
    else setReplies(current => current.map(reply => reply.id === targetId ? { ...reply, user_liked: data.liked, likes_count: data.likes_count } : reply));
  }

  async function submitReply() {
    if (!postId || !replyContent.trim()) return;
    if (replyContent.trim().length < 10) { setReplyError('Réponse trop courte (minimum 10 caractères).'); return; }
    setSubmitting(true);
    setReplyError('');
    try {
      const response = await fetch(ENDPOINTS.forumPostReply, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ parent_id: postId, content: replyContent.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Réponse impossible.');
      setReplyContent('');
      await loadPost();
    } catch (cause) {
      setReplyError(cause instanceof Error ? cause.message : 'Réponse impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReport() {
    if (!showReport) return;
    setReporting(true);
    try {
      await fetch(ENDPOINTS.forumPostReport, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ post_id: showReport.postId, reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      setShowReport(null);
      setReportDetails('');
    } finally {
      setReporting(false);
    }
  }

  async function markSolution(replyId: string) {
    const response = await fetch(ENDPOINTS.forumPostSolve, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ post_id: postId, reply_id: replyId }),
    });
    if (response.ok) await loadPost();
  }

  if (loading) return <CommunityLayout><div className="flex min-h-[70vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: BLUE, borderTopColor: 'transparent' }} /></div></CommunityLayout>;

  if (!post) {
    const message = accessError === 'not_enrolled' ? 'Cette discussion appartient à un forum de formation réservé aux participants autorisés.' : accessError === 'auth_required' ? 'Connectez-vous pour accéder à cette discussion de formation.' : accessError || 'Discussion introuvable.';
    return <CommunityLayout><div className="flex min-h-[70vh] items-center justify-center px-4"><div className="max-w-lg rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: BORDER }}><MessageSquare size={34} className="mx-auto text-slate-300" /><h1 className="mt-4 text-lg font-bold" style={{ color: BLUE }}>Accès indisponible</h1><p className="mt-2 text-sm leading-6 text-slate-500">{message}</p><Link to={accessError === 'auth_required' ? '/connexion' : '/forum'} className="mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}>{accessError === 'auth_required' ? 'Se connecter' : 'Retour à Omnia Communauté'}</Link></div></div></CommunityLayout>;
  }

  const visibleReplies = replies.filter(reply => !blockedUserIds.has(reply.user_id));
  const sortedReplies = [...visibleReplies].sort((a, b) => {
    if (a.id === post.solved_reply_id) return -1;
    if (b.id === post.solved_reply_id) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const backPath = spacePath(post);
  const sectionLabel = spaceLabel(post);

  return (
    <CommunityLayout>
      <div className="min-h-screen bg-white">
        <section className="px-4 pb-10 pt-8 md:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><Link to="/forum" className="hover:text-slate-600">Omnia Communauté</Link><span>›</span><Link to={backPath} className="hover:text-slate-600">{sectionLabel}</Link><span>›</span><span className="max-w-[280px] truncate" style={{ color: BLUE }}>{post.title}</span></div>

            <article className="mt-5 rounded-3xl border bg-white p-6 shadow-sm md:p-8" style={{ borderColor: BORDER, borderLeft: `4px solid ${GOLD}` }}>
              <div className="flex items-start gap-4">
                <Avatar post={post} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Link to={`/profil/${post.user_id}`} className="text-sm font-bold hover:underline" style={{ color: BLUE }}>{post.author_name}</Link>{post.author_badge && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold" style={{ color: GOLD }}>{post.author_badge}</span>}<span className="text-xs text-slate-400">{relativeTime(post.created_at)}</span>{post.is_pinned && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold" style={{ color: BLUE }}><Pin size={11} /> Épinglé</span>}{post.is_solved && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle size={11} /> Solution trouvée</span>}</div>
                  <h1 className="mt-3 text-2xl font-black leading-tight" style={{ color: BLUE }}>{post.title}</h1>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.content}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => void toggleLike(post.id)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" style={post.user_liked ? { background: '#EFF6FF', color: BLUE } : { color: '#64748B' }}><ThumbsUp size={16} /> {post.likes_count} utile{post.likes_count === 1 ? '' : 's'}</button>
                <button onClick={() => replyRef.current?.focus()} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"><MessageSquare size={16} /> Répondre</button>
                {isLoggedIn && <div className="ml-auto flex flex-wrap items-center gap-3">{post.user_id !== myId && !blockedUserIds.has(post.user_id) && <button disabled={blockingUserId === post.user_id} onClick={() => void blockUser(post.user_id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-700 disabled:opacity-50"><Ban size={14} /> Bloquer</button>}<button onClick={() => setShowReport({ postId: post.id })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-600"><Flag size={14} /> Signaler</button></div>}
              </div>
            </article>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black" style={{ color: BLUE }}>{sortedReplies.length} réponse{sortedReplies.length === 1 ? '' : 's'}</h2><Link to={backPath} className="text-xs font-bold" style={{ color: GOLD }}>Retour à {sectionLabel}</Link></div>
              {sortedReplies.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500" style={{ borderColor: BORDER }}>Aucune réponse pour le moment.</div> : <div className="mt-4 space-y-3">{sortedReplies.map(reply => {
                const isSolution = reply.id === post.solved_reply_id;
                return <article key={reply.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: isSolution ? '#34A36F' : BORDER, borderLeft: `3px solid ${isSolution ? '#34A36F' : BORDER}` }}>
                  {isSolution && <div className="mb-4 flex items-center gap-2 border-b border-emerald-100 pb-3 text-xs font-bold text-emerald-700"><CheckCircle size={16} /> Solution acceptée</div>}
                  <div className="flex items-start gap-3"><Avatar post={reply} size={40} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link to={`/profil/${reply.user_id}`} className="text-sm font-bold hover:underline" style={{ color: BLUE }}>{reply.author_name}</Link>{reply.author_badge && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold" style={{ color: GOLD }}>{reply.author_badge}</span>}<span className="text-xs text-slate-400">{relativeTime(reply.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{reply.content}</p><div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={() => void toggleLike(reply.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold" style={reply.user_liked ? { background: '#EFF6FF', color: BLUE } : { color: '#94A3B8' }}><ThumbsUp size={13} /> {reply.likes_count}</button>{isLoggedIn && canMarkSolution && !post.is_solved && <button onClick={() => void markSolution(reply.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle size={13} /> Marquer comme solution</button>}{isLoggedIn && reply.user_id !== myId && !blockedUserIds.has(reply.user_id) && <button disabled={blockingUserId === reply.user_id} onClick={() => void blockUser(reply.user_id)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-300 hover:text-red-600 disabled:opacity-50"><Ban size={12} /> Bloquer</button>}{isLoggedIn && <button onClick={() => setShowReport({ postId: reply.id })} aria-label="Signaler cette réponse" className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-red-500"><Flag size={12} /></button>}</div></div></div>
                </article>;
              })}</div>}
            </section>

            <section className="mt-8 rounded-3xl border bg-slate-50/60 p-5 md:p-6" style={{ borderColor: BORDER }}>
              <h2 className="text-base font-black" style={{ color: BLUE }}>Votre réponse</h2>
              {isLoggedIn ? <><textarea ref={replyRef} value={replyContent} onChange={event => setReplyContent(event.target.value.slice(0, 2000))} rows={5} placeholder="Rédigez une réponse claire, respectueuse et utile..." className="mt-4 w-full resize-none rounded-xl border bg-white px-3 py-3 text-sm outline-none" style={{ borderColor: BORDER }} /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-400">{replyContent.length}/2000</span></div>{replyError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{replyError}</p>}<button onClick={() => void submitReply()} disabled={submitting || !replyContent.trim()} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: BLUE }}><Send size={16} /> {submitting ? 'Publication...' : 'Publier ma réponse'}</button></> : <div className="mt-4 rounded-2xl border bg-white p-6 text-center" style={{ borderColor: BORDER }}><p className="text-sm text-slate-500">Connectez-vous pour participer à la discussion.</p><Link to={`/connexion?redirect=${encodeURIComponent(`/forum/post/${post.id}`)}`} className="mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}>Se connecter</Link></div>}
            </section>
          </div>
        </section>
        <PageFooter />

        {showReport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-black" style={{ color: BLUE }}>Signaler ce contenu</h2><button onClick={() => setShowReport(null)} className="rounded-xl p-2 hover:bg-slate-100"><X size={18} /></button></div><p className="mt-2 text-sm text-slate-500">Le signalement sera transmis aux personnes autorisées à modérer la communauté.</p><select value={reportReason} onChange={event => setReportReason(event.target.value)} className="mt-5 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }}>{REPORT_REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select><textarea value={reportDetails} onChange={event => setReportDetails(event.target.value.slice(0, 1000))} rows={4} placeholder="Précisions facultatives..." className="mt-3 w-full resize-none rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }} /><div className="mt-5 flex gap-3"><button onClick={() => setShowReport(null)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600" style={{ borderColor: BORDER }}>Annuler</button><button disabled={reporting} onClick={() => void submitReport()} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{reporting ? 'Envoi...' : 'Signaler'}</button></div></div></div>}
      </div>
    </CommunityLayout>
  );
}
