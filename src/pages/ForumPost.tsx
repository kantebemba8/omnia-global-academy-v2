import { getSessionToken } from '../lib/session';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import CareerPublicLayout from '../components/career/CareerPublicLayout';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../lib/edgeAuth';
import { Ban, CheckCircle, Flag, MessageSquare, Pin, Send, ThumbsUp, X } from 'lucide-react';

const BLUE = '#002050';
const TEAL = '#0F766E';
const GOLD = '#BF8813';
const BORDER = '#DDEBE8';

interface Post {
  id: string; title: string | null; content: string; user_id: string; author_name: string; author_initials: string;
  author_avatar_url?: string | null; author_badge?: string | null; country_code: string | null;
  space: 'general' | 'carriere' | 'cours'; course_id?: string | null; course_title?: string | null;
  likes_count: number; replies_count: number; is_pinned: boolean; is_solved: boolean; is_flagged: boolean;
  is_instructor?: boolean; solved_reply_id: string | null; user_liked: boolean; created_at: string; parent_id: string | null;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
  { value: 'hors_sujet', label: 'Hors sujet' },
  { value: 'discrimination', label: 'Discrimination ou harcèlement' },
  { value: 'autre', label: 'Autre' },
];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime(); const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes || 1} min`; const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`; const days = Math.floor(hours / 24);
  return days < 30 ? `il y a ${days} j` : new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function Avatar({ post, size = 46 }: { post: Post; size?: number }) {
  if (post.author_avatar_url) return <img src={post.author_avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * .32, background: post.is_instructor ? GOLD : TEAL }}>{post.author_initials || '?'}</span>;
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
      const response = await fetch(ENDPOINTS.authUpdateProfile, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'list_blocked_users' }) });
      const data = await response.json();
      if (response.ok) setBlockedUserIds(new Set((data.blocked_users || []).map((item: { user_id: string }) => item.user_id)));
    } catch { /* keep community available */ }
  }

  async function loadPost() {
    if (!postId) return;
    setLoading(true); setAccessError('');
    try {
      const headers = token ? edgeAuthHeaders() : edgeGatewayHeaders();
      const response = await fetch(`${ENDPOINTS.forumPostDetail}&post_id=${encodeURIComponent(postId)}`, { headers });
      const data = await response.json();
      if (data.error === 'NOT_ENROLLED' || data.error === 'FORBIDDEN') { setAccessError('not_enrolled'); setPost(null); setReplies([]); return; }
      if (data.error === 'AUTH_REQUIRED' && !token) { setAccessError('auth_required'); setPost(null); return; }
      if (!response.ok) throw new Error(data.error || 'Discussion introuvable.');
      setPost(data.post || null); setReplies(Array.isArray(data.replies) ? data.replies : []); setCanMarkSolution(Boolean(data.can_mark_solution));
    } catch (cause) { setAccessError(cause instanceof Error ? cause.message : 'Discussion introuvable.'); setPost(null); }
    finally { setLoading(false); }
  }

  async function blockUser(targetUserId: string) {
    if (!token || targetUserId === myId) return;
    if (!window.confirm('Bloquer cet utilisateur ? Ses contenus de la communauté seront masqués pour vous.')) return;
    setBlockingUserId(targetUserId);
    try {
      const response = await fetch(ENDPOINTS.authUpdateProfile, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'block_user', target_user_id: targetUserId, reason: 'community' }) });
      if (response.ok) { setBlockedUserIds(current => new Set([...current, targetUserId])); if (post?.user_id === targetUserId) navigate(spacePath(post)); else setReplies(current => current.filter(reply => reply.user_id !== targetUserId)); }
    } finally { setBlockingUserId(null); }
  }

  async function toggleLike(targetId: string) {
    if (!isLoggedIn) { navigate(`/connexion?redirect=${encodeURIComponent(`/forum/post/${postId}`)}`); return; }
    const response = await fetch(ENDPOINTS.forumPostLike, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ post_id: targetId }) });
    const data = await response.json(); if (!response.ok) return;
    if (targetId === post?.id) setPost(current => current ? { ...current, user_liked: data.liked, likes_count: data.likes_count } : current);
    else setReplies(current => current.map(reply => reply.id === targetId ? { ...reply, user_liked: data.liked, likes_count: data.likes_count } : reply));
  }

  async function submitReply() {
    if (!postId || !replyContent.trim()) return;
    if (replyContent.trim().length < 10) { setReplyError('Réponse trop courte (minimum 10 caractères).'); return; }
    setSubmitting(true); setReplyError('');
    try {
      const response = await fetch(ENDPOINTS.forumPostReply, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ parent_id: postId, content: replyContent.trim() }) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'Réponse impossible.');
      setReplyContent(''); await loadPost();
    } catch (cause) { setReplyError(cause instanceof Error ? cause.message : 'Réponse impossible.'); }
    finally { setSubmitting(false); }
  }

  async function submitReport() {
    if (!showReport) return; setReporting(true);
    try { await fetch(ENDPOINTS.forumPostReport, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ post_id: showReport.postId, reason: reportReason, details: reportDetails.trim() || undefined }) }); setShowReport(null); setReportDetails(''); }
    finally { setReporting(false); }
  }

  async function markSolution(replyId: string) {
    const response = await fetch(ENDPOINTS.forumPostSolve, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ post_id: postId, reply_id: replyId }) });
    if (response.ok) await loadPost();
  }

  if (loading) return <CommunityLayout><div className="flex min-h-[70vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#DDEBE8] border-t-[#0F766E]" /></div></CommunityLayout>;
  if (!post) {
    const message = accessError === 'not_enrolled' ? 'Cette discussion appartient à un forum de formation réservé aux participants autorisés.' : accessError === 'auth_required' ? 'Connectez-vous pour accéder à cette discussion de formation.' : accessError || 'Discussion introuvable.';
    return <CommunityLayout><div className="flex min-h-[70vh] items-center justify-center px-4"><div className="max-w-lg rounded-[28px] border border-dashed border-[#DDEBE8] bg-white p-10 text-center"><MessageSquare size={34} className="mx-auto text-slate-300" /><h1 className="mt-4 text-lg font-black text-[#002050]">Accès indisponible</h1><p className="mt-2 text-sm leading-6 text-slate-500">{message}</p><Link to={accessError === 'auth_required' ? '/connexion' : '/forum'} className="mt-5 inline-flex rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-bold text-white">{accessError === 'auth_required' ? 'Se connecter' : 'Retour à Omnia Communauté'}</Link></div></div></CommunityLayout>;
  }

  const visibleReplies = replies.filter(reply => !blockedUserIds.has(reply.user_id));
  const sortedReplies = [...visibleReplies].sort((a, b) => { if (a.id === post.solved_reply_id) return -1; if (b.id === post.solved_reply_id) return 1; return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); });
  const backPath = spacePath(post); const sectionLabel = spaceLabel(post); const isCareer = post.space === 'carriere';
  const Layout = isCareer ? CareerPublicLayout : CommunityLayout;
  const accent = isCareer ? GOLD : TEAL;

  return (
    <Layout>
      <main className={isCareer ? 'min-h-screen bg-white' : 'min-h-screen bg-[#F8FCFB]'}>
        <section className="mx-auto max-w-5xl px-5 py-9 md:px-8 md:py-12">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><Link to={isCareer ? '/career-studio' : '/forum'} className="hover:text-slate-600">{isCareer ? 'Omnia Career' : 'Omnia Communauté'}</Link><span>›</span><Link to={backPath} className="hover:text-slate-600">{sectionLabel}</Link><span>›</span><span className="max-w-[280px] truncate" style={{ color: accent }}>{post.title}</span></div>

          <article className="mt-7 border-y py-7 md:py-9" style={{ borderColor: isCareer ? '#E5E7EB' : BORDER }}>
            <div className="grid gap-5 md:grid-cols-[58px_1fr]"><Avatar post={post} size={52} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to={`/profil/${post.user_id}`} className="text-sm font-black text-[#002050] hover:underline">{post.author_name}</Link>{post.author_badge && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-[#BF8813]">{post.author_badge}</span>}<span className="text-xs text-slate-400">{relativeTime(post.created_at)}</span>{post.is_pinned && <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#002050]"><Pin size={11} /> Épinglé</span>}{post.is_solved && <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700"><CheckCircle size={11} /> Solution trouvée</span>}</div><h1 className="mt-4 max-w-4xl text-2xl font-black leading-tight tracking-[-.025em] text-[#002050] md:text-4xl">{post.title}</h1><p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700 md:text-[15px]">{post.content}</p></div></div>
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: isCareer ? '#F1F5F9' : '#E8F1EF' }}><button onClick={() => void toggleLike(post.id)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" style={post.user_liked ? { background: isCareer ? '#FFF8E8' : '#E8F6F3', color: accent } : { color: '#64748B' }}><ThumbsUp size={16} /> {post.likes_count} utile{post.likes_count === 1 ? '' : 's'}</button><button onClick={() => replyRef.current?.focus()} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"><MessageSquare size={16} /> Répondre</button>{isLoggedIn && <div className="ml-auto flex flex-wrap items-center gap-3">{post.user_id !== myId && !blockedUserIds.has(post.user_id) && <button disabled={blockingUserId === post.user_id} onClick={() => void blockUser(post.user_id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-700 disabled:opacity-50"><Ban size={14} /> Bloquer</button>}<button onClick={() => setShowReport({ postId: post.id })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-600"><Flag size={14} /> Signaler</button></div>}</div>
          </article>

          <section className="mt-9">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color: accent }}>Fil de réponses</p><h2 className="mt-1 text-xl font-black text-[#002050]">{sortedReplies.length} réponse{sortedReplies.length === 1 ? '' : 's'}</h2></div><Link to={backPath} className="text-xs font-black" style={{ color: accent }}>Retour à {sectionLabel}</Link></div>
            {sortedReplies.length === 0 ? <div className="mt-5 border-y py-10 text-center text-sm text-slate-500" style={{ borderColor: isCareer ? '#E5E7EB' : BORDER }}>Aucune réponse pour le moment.</div> : <div className="relative mt-6 before:absolute before:bottom-0 before:left-[21px] before:top-0 before:w-px before:bg-[#DDEBE8]">{sortedReplies.map(reply => { const isSolution = reply.id === post.solved_reply_id; return <article key={reply.id} className="relative grid gap-4 py-5 pl-0 sm:grid-cols-[44px_1fr]"> <div className="relative z-10"><Avatar post={reply} size={42} /></div><div className={`rounded-2xl border bg-white p-5 ${isSolution ? 'border-emerald-300 shadow-[0_8px_26px_rgba(16,185,129,.08)]' : 'border-[#DDEBE8]'}`}>{isSolution && <div className="mb-4 flex items-center gap-2 border-b border-emerald-100 pb-3 text-xs font-black text-emerald-700"><CheckCircle size={16} /> Solution acceptée</div>}<div className="flex flex-wrap items-center gap-2"><Link to={`/profil/${reply.user_id}`} className="text-sm font-black text-[#002050] hover:underline">{reply.author_name}</Link>{reply.author_badge && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-[#BF8813]">{reply.author_badge}</span>}<span className="text-xs text-slate-400">{relativeTime(reply.created_at)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{reply.content}</p><div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={() => void toggleLike(reply.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold" style={reply.user_liked ? { background: '#E8F6F3', color: TEAL } : { color: '#94A3B8' }}><ThumbsUp size={13} /> {reply.likes_count}</button>{isLoggedIn && canMarkSolution && !post.is_solved && <button onClick={() => void markSolution(reply.id)} className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle size={13} /> Marquer comme solution</button>}{isLoggedIn && reply.user_id !== myId && !blockedUserIds.has(reply.user_id) && <button disabled={blockingUserId === reply.user_id} onClick={() => void blockUser(reply.user_id)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-300 hover:text-red-600 disabled:opacity-50"><Ban size={12} /> Bloquer</button>}{isLoggedIn && <button onClick={() => setShowReport({ postId: reply.id })} aria-label="Signaler cette réponse" className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-red-500"><Flag size={12} /></button>}</div></div></article>; })}</div>}
          </section>

          <section className="mt-9 rounded-[28px] border bg-white p-5 md:p-7" style={{ borderColor: isCareer ? '#E5E7EB' : BORDER }}><p className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color: accent }}>Participer</p><h2 className="mt-1 text-lg font-black text-[#002050]">Votre réponse</h2>{isLoggedIn ? <><textarea ref={replyRef} value={replyContent} onChange={event => setReplyContent(event.target.value.slice(0, 2000))} rows={5} placeholder="Rédigez une réponse claire, respectueuse et utile..." className="mt-4 w-full resize-none rounded-xl border bg-white px-3 py-3 text-sm outline-none" style={{ borderColor: isCareer ? '#E5E7EB' : BORDER }} /><div className="mt-2 text-right text-xs text-slate-400">{replyContent.length}/2000</div>{replyError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{replyError}</p>}<button onClick={() => void submitReply()} disabled={submitting || !replyContent.trim()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={16} /> {submitting ? 'Publication...' : 'Publier ma réponse'}</button></> : <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center"><p className="text-sm text-slate-500">Connectez-vous pour participer à la discussion.</p><Link to={`/connexion?redirect=${encodeURIComponent(`/forum/post/${post.id}`)}`} className="mt-4 inline-flex rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-bold text-white">Se connecter</Link></div>}</section>
        </section>

        {showReport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#002050]">Signaler ce contenu</h2><button onClick={() => setShowReport(null)} className="rounded-xl p-2 hover:bg-slate-100"><X size={18} /></button></div><p className="mt-2 text-sm text-slate-500">Le signalement sera transmis aux personnes autorisées à modérer la communauté.</p><select value={reportReason} onChange={event => setReportReason(event.target.value)} className="mt-5 w-full rounded-xl border border-[#DDEBE8] px-3 py-2.5 text-sm">{REPORT_REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select><textarea value={reportDetails} onChange={event => setReportDetails(event.target.value.slice(0,1000))} rows={4} placeholder="Précisions facultatives..." className="mt-3 w-full resize-none rounded-xl border border-[#DDEBE8] px-3 py-2.5 text-sm"/><div className="mt-5 flex gap-3"><button onClick={() => setShowReport(null)} className="flex-1 rounded-xl border border-[#DDEBE8] py-2.5 text-sm font-semibold text-slate-600">Annuler</button><button disabled={reporting} onClick={() => void submitReport()} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{reporting ? 'Envoi...' : 'Signaler'}</button></div></div></div>}
      </main>
    </Layout>
  );
}
