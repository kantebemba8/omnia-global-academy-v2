import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type OmniaNotification } from '../lib/notifications';
import { getSessionToken } from '../lib/session';

const BLUE = '#002050';
const GOLD = '#BF8813';
const MENU_WIDTH = 390;

type MenuPosition = { top: number; right: number; width: number };

function relativeDate(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return new Date(time).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function GlobalNotificationsButton() {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<OmniaNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [position, setPosition] = useState<MenuPosition>({ top: 64, right: 12, width: MENU_WIDTH });

  const refresh = useCallback(async (silent = false) => {
    if (!getSessionToken()) return;
    if (!silent) setLoading(true);
    try {
      const result = await listNotifications(40);
      if (!mounted.current) return;
      setRows(Array.isArray(result.notifications) ? result.notifications : []);
      setUnread(Math.max(0, Number(result.unread_count || 0)));
      setError('');
    } catch (e) {
      if (mounted.current && !silent) setError(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh(true);
    const timer = window.setInterval(() => void refresh(true), 60_000);
    const onRefresh = () => void refresh(true);
    window.addEventListener('omnia:mobile-notification', onRefresh);
    window.addEventListener('omnia:session-changed', onRefresh);
    window.addEventListener('omnia:notifications-changed', onRefresh);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('omnia:mobile-notification', onRefresh);
      window.removeEventListener('omnia:session-changed', onRefresh);
      window.removeEventListener('omnia:notifications-changed', onRefresh);
    };
  }, [refresh]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(MENU_WIDTH, Math.max(280, window.innerWidth - 24));
      const right = Math.max(12, window.innerWidth - rect.right);
      setPosition({ top: rect.bottom + 8, right, width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [open, refresh]);

  async function openNotification(notification: OmniaNotification) {
    if (!notification.read_at) {
      setBusy(`read:${notification.source}:${notification.id}`);
      setError('');
      try {
        await markNotificationRead(notification);
        const now = new Date().toISOString();
        setRows(current => current.map(row => row.id === notification.id && row.source === notification.source ? { ...row, read_at: now } : row));
        setUnread(current => Math.max(0, current - 1));
        window.dispatchEvent(new CustomEvent('omnia:notifications-changed'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lecture non confirmée');
        setBusy('');
        return;
      }
      setBusy('');
    }
    if (notification.action_url) {
      setOpen(false);
      navigate(notification.action_url);
    }
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

  const visibleRows = rows.slice(0, 10);
  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[650] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(0,32,80,.24)]"
      style={{ top: position.top, right: position.right, width: position.width, maxHeight: 'min(520px, 72vh)' }}
      role="menu"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-black" style={{ color: BLUE }}>Notifications</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</p>
        </div>
        <button
          type="button"
          onClick={() => void markAll()}
          disabled={unread <= 0 || busy === 'all'}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-black text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'all' ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
          Tout marquer comme lu
        </button>
      </div>

      {error && <div className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

      <div className="max-h-[430px] overflow-y-auto">
        {loading ? (
          <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : visibleRows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Bell className="mx-auto text-slate-300" size={30} />
            <p className="mt-3 text-sm font-bold text-slate-600">Aucune notification</p>
          </div>
        ) : visibleRows.map(notification => {
          const unreadRow = !notification.read_at;
          const rowBusy = busy === `read:${notification.source}:${notification.id}`;
          return (
            <button
              key={`${notification.source}:${notification.id}`}
              type="button"
              onClick={() => void openNotification(notification)}
              disabled={rowBusy}
              className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${unreadRow ? 'bg-[#FFF9EC]' : 'bg-white'}`}
              role="menuitem"
            >
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: unreadRow ? GOLD : '#CBD5E1' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[#002050]">{notification.title}</span>
                {notification.message && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">{notification.message}</span>}
                <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">{relativeDate(notification.created_at)}</span>
              </span>
              {rowBusy ? <Loader2 size={15} className="mt-1 shrink-0 animate-spin text-slate-400" /> : notification.action_url ? <ChevronRight size={16} className="mt-1 shrink-0 text-slate-400" /> : null}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#002050] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
        aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {menu}
    </>
  );
}
