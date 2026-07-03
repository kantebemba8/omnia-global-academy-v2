import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { MessageSquare, Flag, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface ForumPost {
  id: string; user_id: string; space: string; title: string | null; content: string;
  is_visible: boolean; is_flagged: boolean; flagged_reason?: string;
  created_at: string; author_name: string;
}
interface ForumData {
  flagged_posts: ForumPost[];
  all_posts: ForumPost[];
}

export default function ModerateurForum() {
  const [data, setData] = useState<ForumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'flagged' | 'all'>('flagged');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  function load() {
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.moderatorForumAction, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function doAction(postId: string, action: 'hide' | 'restore' | 'unflag') {
    setSubmitting(postId + action);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.moderatorForumAction, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, action }),
    });
    const d = await res.json();
    setSubmitting(null);
    if (d.success) {
      const msgs: Record<string, string> = { hide: 'Post masqué.', restore: 'Post restauré.', unflag: 'Signalement retiré.' };
      setToast(msgs[action]);
      load();
    } else {
      setToast(d.message ?? 'Erreur.');
    }
    setTimeout(() => setToast(''), 3000);
  }

  const posts = tab === 'flagged' ? (data?.flagged_posts ?? []) : (data?.all_posts ?? []);

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Modération du forum</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les publications et les signalements</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab('flagged')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'flagged' ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            style={tab === 'flagged' ? { backgroundColor: '#c2410c' } : {}}>
            <Flag className="w-4 h-4" /> Signalés ({data?.flagged_posts?.length ?? 0})
          </button>
          <button onClick={() => setTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'all' ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            style={tab === 'all' ? { backgroundColor: '#002050' } : {}}>
            <MessageSquare className="w-4 h-4" /> Tous les posts ({data?.all_posts?.length ?? 0})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">
              {tab === 'flagged' ? 'Aucun post signalé' : 'Aucun post'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                style={!p.is_visible ? { opacity: 0.6 } : {}}>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {p.title && <p className="font-semibold text-gray-800">{p.title}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.author_name} · {p.space} · {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!p.is_visible && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Masqué</span>
                      )}
                      {p.is_flagged && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium flex items-center gap-1">
                          <Flag className="w-3 h-3" /> Signalé
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{p.content}</p>
                  {p.flagged_reason && (
                    <div className="rounded-lg p-2.5 bg-orange-50 border border-orange-100">
                      <p className="text-xs text-orange-700"><strong>Raison du signalement :</strong> {p.flagged_reason}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.is_visible ? (
                      <button onClick={() => doAction(p.id, 'hide')} disabled={submitting === p.id + 'hide'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <EyeOff className="w-3.5 h-3.5" /> Masquer
                      </button>
                    ) : (
                      <button onClick={() => doAction(p.id, 'restore')} disabled={submitting === p.id + 'restore'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#1E7A52' }}>
                        <Eye className="w-3.5 h-3.5" /> Restaurer
                      </button>
                    )}
                    {p.is_flagged && (
                      <button onClick={() => doAction(p.id, 'unflag')} disabled={submitting === p.id + 'unflag'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Retirer le signalement
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
