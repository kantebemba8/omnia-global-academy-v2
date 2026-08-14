import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardTopbar } from '../components/DashboardTopbar';
import { getDashboardPathForRoles, getSessionToken, getStoredUser } from '../lib/session';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type OmniaNotification } from '../lib/notifications';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OmniaNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const user = getStoredUser<{ roles?: string[] }>();
  const dashboardPath = getDashboardPathForRoles(user?.roles || []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listNotifications(200);
      setRows(Array.isArray(result.notifications) ? result.notifications : []);
      setUnread(Math.max(0, Number(result.unread_count || 0)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getSessionToken()) {
      navigate('/connexion?redirect=%2Fnotifications', { replace: true });
      return;
    }
    void load();
    const onRefresh = () => void load();
    window.addEventListener('omnia:notifications-changed', onRefresh);
    return () => window.removeEventListener('omnia:notifications-changed', onRefresh);
  }, [load, navigate]);

  async function openRow(row: OmniaNotification) {
    if (!row.read_at) {
      setBusy(`${row.source}:${row.id}`);
      setError('');
      try {
        await markNotificationRead(row);
        const now = new Date().toISOString();
        setRows(current => current.map(item => item.id === row.id && item.source === row.source ? { ...item, read_at: now } : item));
        setUnread(current => Math.max(0, current - 1));
        window.dispatchEvent(new CustomEvent('omnia:notifications-changed'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lecture non confirmée');
        setBusy('');
        return;
      }
      setBusy('');
    }
    if (row.action_url) navigate(row.action_url);
  }

  async function markAll() {
    if (unread <= 0) return;
    setBusy('all');
    setError('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setRows(current => current.map(row => row.read_at ? row : { ...row, read_at: now }));
      setUnread(0);
      window.dispatchEvent(new CustomEvent('omnia:notifications-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action non confirmée');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA]">
      <DashboardTopbar title="Notifications" subtitle="Centre unifié Omnia" dashboardPath={dashboardPath} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black" style={{ color: BLUE }}>Toutes vos notifications</h1>
              <p className="mt-1 text-sm text-slate-500">Toutes les notifications de votre compte Omnia sont réunies ici, quel que soit l’espace ou l’écosystème.</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{unread > 0 ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</p>
            </div>
            <button type="button" onClick={() => void markAll()} disabled={unread <= 0 || busy === 'all'} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              {busy === 'all' ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />} Tout marquer comme lu
            </button>
          </div>

          {error && <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

          {loading ? (
            <div className="grid min-h-64 place-items-center"><Loader2 size={28} className="animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <Bell className="mx-auto text-slate-300" size={38} />
              <p className="mt-4 font-black text-slate-600">Aucune notification.</p>
            </div>
          ) : (
            <div>
              {rows.map(row => {
                const rowBusy = busy === `${row.source}:${row.id}`;
                return (
                  <button key={`${row.source}:${row.id}`} type="button" onClick={() => void openRow(row)} disabled={rowBusy} className={`flex w-full items-start gap-4 border-b border-slate-100 px-5 py-5 text-left transition last:border-b-0 hover:bg-slate-50 ${row.read_at ? 'bg-white' : 'bg-[#FFF9EC]'}`}>
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.read_at ? '#CBD5E1' : GOLD }} />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-black" style={{ color: BLUE }}>{row.title}</span>
                      {row.message && <span className="mt-1.5 block text-sm leading-6 text-slate-600">{row.message}</span>}
                      <span className="mt-2 block text-xs font-semibold text-slate-400">{new Date(row.created_at).toLocaleString('fr-FR')}</span>
                    </span>
                    {rowBusy ? <Loader2 size={16} className="mt-1 animate-spin text-slate-400" /> : row.action_url ? <ChevronRight size={17} className="mt-1 text-slate-400" /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
