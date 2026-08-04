import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import {
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  MessageSquare,
  Pin,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { omniaDialog } from '../../lib/omniaDialog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

interface ForumPost {
  id: string;
  user_id: string;
  space: string;
  title: string | null;
  content: string;
  is_visible: boolean;
  is_flagged: boolean;
  is_pinned?: boolean;
  flagged_reason?: string | null;
  created_at: string;
  author_name: string;
}

interface ForumData {
  flagged_posts: ForumPost[];
  all_posts: ForumPost[];
}

type Tab = 'flagged' | 'all';

const SPACE_LABELS: Record<string, string> = {
  general: 'Espace général',
  carriere: 'Carrière & Emploi',
  cours: 'Forum de formation',
};

function apiMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message && value.message !== '[object Object]') return value.message;
  if (typeof value === 'string' && value.trim() && value.trim() !== '[object Object]') return value;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'details', 'hint']) {
      const nested = row[key];
      if (typeof nested === 'string' && nested.trim() && nested.trim() !== '[object Object]') return nested;
      if (nested && typeof nested === 'object') {
        const text = apiMessage(nested, '');
        if (text) return text;
      }
    }
  }
  return fallback;
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default function AdminForum() {
  const [data, setData] = useState<ForumData>({ flagged_posts: [], all_posts: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('flagged');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [loadError, setLoadError] = useState('');

  const token = () => getSessionToken() || '';

  function showNotice(text: string, error = false) {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      if (!SUPABASE_URL) throw new Error('Configuration Supabase indisponible.');
      const response = await fetch(`${SUPABASE_URL}/functions/v1/moderator-forum-action`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(apiMessage(payload, 'Impossible de charger le forum.'));
      setData({
        flagged_posts: Array.isArray(payload.flagged_posts) ? payload.flagged_posts : [],
        all_posts: Array.isArray(payload.all_posts) ? payload.all_posts : [],
      });
    } catch (error) {
      setLoadError(apiMessage(error, 'Impossible de charger le forum.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doModAction(postId: string, action: 'hide' | 'restore' | 'unflag') {
    setSubmitting(`${postId}:${action}`);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/moderator-forum-action`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, action }),
      });
      const payload = await readResponse(response);
      if (!response.ok || !payload.success) throw new Error(apiMessage(payload, 'Action impossible.'));
      const messages: Record<typeof action, string> = {
        hide: 'Publication masquée.',
        restore: 'Publication restaurée.',
        unflag: 'Signalement retiré.',
      };
      showNotice(messages[action]);
      await load();
    } catch (error) {
      showNotice(apiMessage(error, 'Action impossible.'), true);
    } finally {
      setSubmitting(null);
    }
  }

  async function doAdminAction(postId: string, action: 'delete' | 'pin' | 'unpin') {
    if (action === 'delete') {
      const confirmation = await omniaDialog({
        title: 'Supprimer définitivement la publication',
        message: 'La publication et ses réponses seront supprimées. Cette action est irréversible.',
        confirmLabel: 'Supprimer définitivement',
        danger: true,
      });
      if (!confirmation.confirmed) return;
    }

    setSubmitting(`${postId}:${action}`);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-forum-action`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, action }),
      });
      const payload = await readResponse(response);
      if (!response.ok || !payload.success) throw new Error(apiMessage(payload, 'Action impossible.'));
      const messages: Record<typeof action, string> = {
        delete: 'Publication supprimée définitivement.',
        pin: 'Publication épinglée.',
        unpin: 'Publication désépinglée.',
      };
      showNotice(messages[action]);
      await load();
    } catch (error) {
      showNotice(apiMessage(error, 'Action impossible.'), true);
    } finally {
      setSubmitting(null);
    }
  }

  const posts = useMemo(
    () => (tab === 'flagged' ? data.flagged_posts : data.all_posts),
    [data, tab],
  );

  const hiddenCount = data.all_posts.filter((post) => !post.is_visible).length;
  const pinnedCount = data.all_posts.filter((post) => post.is_pinned).length;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {notice && (
          <div
            className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-5 py-3 text-sm font-semibold shadow-xl"
            style={{
              borderColor: notice.error ? '#FECACA' : '#BBF7D0',
              color: notice.error ? '#B91C1C' : '#166534',
            }}
          >
            {notice.text}
          </div>
        )}

        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Communauté & Live</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>Communauté & Modération</h1>
            <p className="mt-1 text-sm text-gray-500">Modérez les publications, traitez les signalements et contrôlez les contenus épinglés.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/forum"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: BLUE }}
            >
              <ExternalLink size={15} /> Ouvrir Omnia Communauté
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: BORDER, color: BLUE }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-x-8 gap-y-3 border-y py-4 text-sm" style={{ borderColor: BORDER }}>
          <span><strong style={{ color: '#B91C1C' }}>{data.flagged_posts.length}</strong> signalée(s)</span>
          <span><strong style={{ color: BLUE }}>{data.all_posts.length}</strong> publication(s)</span>
          <span><strong style={{ color: '#B45309' }}>{hiddenCount}</strong> masquée(s)</span>
          <span><strong style={{ color: GOLD }}>{pinnedCount}</strong> épinglée(s)</span>
        </section>

        {loadError && (
          <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: BORDER }}>
          <button
            type="button"
            onClick={() => setTab('flagged')}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            style={tab === 'flagged'
              ? { background: '#B91C1C', color: 'white' }
              : { border: `1px solid ${BORDER}`, color: '#667085', background: 'white' }}
          >
            <Flag size={14} /> Signalements ({data.flagged_posts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('all')}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            style={tab === 'all'
              ? { background: BLUE, color: 'white' }
              : { border: `1px solid ${BORDER}`, color: '#667085', background: 'white' }}
          >
            <MessageSquare size={14} /> Toutes les publications ({data.all_posts.length})
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Chargement de la communauté…</div>
        ) : posts.length === 0 ? (
          <div className="border-y py-14 text-center" style={{ borderColor: BORDER }}>
            <MessageSquare size={34} className="mx-auto opacity-25" style={{ color: BLUE }} />
            <p className="mt-3 text-sm text-gray-500">
              {tab === 'flagged' ? 'Aucun signalement à traiter.' : 'Aucune publication enregistrée.'}
            </p>
          </div>
        ) : (
          <section className="border-t" style={{ borderColor: BORDER }}>
            {posts.map((post) => (
              <article
                key={post.id}
                className="border-b py-5"
                style={{ borderColor: BORDER, opacity: post.is_visible ? 1 : 0.68 }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold" style={{ color: BLUE }}>{post.title || 'Publication sans titre'}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {SPACE_LABELS[post.space] || post.space}
                      </span>
                      {!post.is_visible && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Masquée</span>}
                      {post.is_flagged && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Signalée</span>}
                      {post.is_pinned && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Épinglée</span>}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {post.author_name || 'Utilisateur'} · {new Date(post.created_at).toLocaleString('fr-FR')}
                    </p>
                    <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-gray-700">{post.content}</p>
                    {post.flagged_reason && (
                      <p className="mt-3 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <strong>Motif du signalement :</strong> {post.flagged_reason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {post.is_visible ? (
                    <button
                      type="button"
                      onClick={() => doModAction(post.id, 'hide')}
                      disabled={Boolean(submitting)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      <EyeOff size={13} /> Masquer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => doModAction(post.id, 'restore')}
                      disabled={Boolean(submitting)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: '#18794E' }}
                    >
                      <Eye size={13} /> Restaurer
                    </button>
                  )}

                  {post.is_flagged && (
                    <button
                      type="button"
                      onClick={() => doModAction(post.id, 'unflag')}
                      disabled={Boolean(submitting)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
                      style={{ borderColor: BORDER }}
                    >
                      <CheckCircle size={13} /> Retirer le signalement
                    </button>
                  )}

                  {post.is_pinned ? (
                    <button
                      type="button"
                      onClick={() => doAdminAction(post.id, 'unpin')}
                      disabled={Boolean(submitting)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                      style={{ borderColor: '#BFDBFE', background: '#EFF6FF' }}
                    >
                      <Pin size={13} /> Désépingler
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => doAdminAction(post.id, 'pin')}
                      disabled={Boolean(submitting)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                      style={{ borderColor: '#BFDBFE', background: '#EFF6FF' }}
                    >
                      <Pin size={13} /> Épingler
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => doAdminAction(post.id, 'delete')}
                    disabled={Boolean(submitting)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Supprimer définitivement
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
