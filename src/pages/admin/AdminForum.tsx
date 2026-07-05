import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  MessageSquare, Flag, Eye, EyeOff, CheckCircle, Trash2, Pin, RefreshCw
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ForumPost {
  id: string;
  user_id: string;
  space: string;
  title: string | null;
  content: string;
  is_visible: boolean;
  is_flagged: boolean;
  is_pinned?: boolean;
  flagged_reason?: string;
  created_at: string;
  author_name: string;
}

interface ForumData {
  flagged_posts: ForumPost[];
  all_posts: ForumPost[];
}

type Tab = 'flagged' | 'all';

const SPACE_LABELS: Record<string, string> = {
  general: 'Forum Général',
  carriere: 'Carrière',
  cours: 'Forum de cours',
};

export default function AdminForum() {
  const [data, setData] = useState<ForumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('flagged');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(msg: string, error = false) {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 3000);
  }

  function load() {
    setLoading(true);
    fetch(`${SUPABASE_URL}/functions/v1/moderator-forum-action`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Actions modérateur (masquer, restaurer, désignaler)
  async function doModAction(postId: string, action: 'hide' | 'restore' | 'unflag') {
    setSubmitting(postId + action);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/moderator-forum-action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, action }),
    });
    const d = await res.json();
    setSubmitting(null);
    if (d.success) {
      const msgs: Record<string, string> = { hide: 'Post masqué.', restore: 'Post restauré.', unflag: 'Signalement retiré.' };
      showToast(msgs[action]);
      load();
    } else {
      showToast(d.message ?? 'Erreur.', true);
    }
  }

  // Actions super-admin (supprimer définitivement, épingler)
  async function doAdminAction(postId: string, action: 'delete' | 'pin' | 'unpin') {
    setSubmitting(postId + action);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-forum-action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, action }),
    });
    const d = await res.json();
    setSubmitting(null);
    if (d.success) {
      const msgs: Record<string, string> = {
        delete: '🗑️ Post supprimé définitivement.',
        pin: '📌 Post épinglé.',
        unpin: 'Post désépinglé.',
      };
      showToast(msgs[action]);
      load();
    } else {
      showToast(d.message ?? 'Erreur.', true);
    }
  }

  const posts = tab === 'flagged' ? (data?.flagged_posts ?? []) : (data?.all_posts ?? []);

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 shadow-lg rounded-xl px-5 py-3 text-sm font-medium border"
            style={{
              backgroundColor: toastError ? '#FEF2F2' : 'white',
              borderColor: toastError ? '#FECACA' : '#E4E7EC',
              color: toastError ? '#DC2626' : '#002050',
            }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Gestion du Forum</h1>
            <p className="text-gray-500 text-sm mt-1">Modérez les publications · Supprimez · Épinglez</p>
          </div>
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Posts signalés', value: data?.flagged_posts?.length ?? 0, color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Total posts', value: data?.all_posts?.length ?? 0, color: '#002050', bg: '#EEF2FF' },
            { label: 'Posts masqués', value: (data?.all_posts ?? []).filter(p => !p.is_visible).length, color: '#D97706', bg: '#FFFBEB' },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC', backgroundColor: stat.bg }}>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('flagged')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={tab === 'flagged' ? { backgroundColor: '#c2410c', color: 'white' } : { backgroundColor: 'white', border: '1px solid #E4E7EC', color: '#6B7280' }}>
            <Flag size={14} /> Signalés ({data?.flagged_posts?.length ?? 0})
          </button>
          <button onClick={() => setTab('all')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={tab === 'all' ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: 'white', border: '1px solid #E4E7EC', color: '#6B7280' }}>
            <MessageSquare size={14} /> Tous les posts ({data?.all_posts?.length ?? 0})
          </button>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">{tab === 'flagged' ? 'Aucun post signalé' : 'Aucun post'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(p => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border overflow-hidden"
                style={{ borderColor: p.is_flagged ? '#FED7AA' : '#E4E7EC', opacity: p.is_visible ? 1 : 0.65 }}>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {p.title && <p className="font-semibold text-gray-800">{p.title}</p>}
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs text-gray-400">{p.author_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#002050' }}>
                          {SPACE_LABELS[p.space] || p.space}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {!p.is_visible && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Masqué</span>
                      )}
                      {p.is_flagged && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium flex items-center gap-1">
                          <Flag size={10} /> Signalé
                        </span>
                      )}
                      {p.is_pinned && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex items-center gap-1">
                          <Pin size={10} /> Épinglé
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{p.content}</p>

                  {p.flagged_reason && (
                    <div className="rounded-lg p-2.5 bg-orange-50 border border-orange-100">
                      <p className="text-xs text-orange-700"><strong>Raison :</strong> {p.flagged_reason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Actions modérateur */}
                    {p.is_visible ? (
                      <button onClick={() => doModAction(p.id, 'hide')} disabled={!!submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                        <EyeOff size={12} /> Masquer
                      </button>
                    ) : (
                      <button onClick={() => doModAction(p.id, 'restore')} disabled={!!submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: '#1E7A52' }}>
                        <Eye size={12} /> Restaurer
                      </button>
                    )}
                    {p.is_flagged && (
                      <button onClick={() => doModAction(p.id, 'unflag')} disabled={!!submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        <CheckCircle size={12} /> Retirer le signalement
                      </button>
                    )}

                    {/* Séparateur visuel */}
                    <div className="w-px bg-gray-200 self-stretch mx-1" />

                    {/* Actions super-admin exclusives */}
                    {p.is_pinned ? (
                      <button onClick={() => doAdminAction(p.id, 'unpin')} disabled={!!submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                        style={{ borderColor: '#BFDBFE', color: '#1D4ED8', backgroundColor: '#EFF6FF' }}>
                        <Pin size={12} /> Désépingler
                      </button>
                    ) : (
                      <button onClick={() => doAdminAction(p.id, 'pin')} disabled={!!submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                        style={{ borderColor: '#BFDBFE', color: '#1D4ED8', backgroundColor: '#EFF6FF' }}>
                        <Pin size={12} /> Épingler
                      </button>
                    )}
                    <button onClick={() => {
                      if (confirm('Supprimer définitivement ce post ? Cette action est irréversible.')) {
                        doAdminAction(p.id, 'delete');
                      }
                    }} disabled={!!submitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                      <Trash2 size={12} /> Supprimer définitivement
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
