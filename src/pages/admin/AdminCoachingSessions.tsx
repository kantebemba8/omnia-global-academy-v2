import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, RefreshCw, Search, Settings2, ShieldCheck, UsersRound, X } from 'lucide-react';
import AdminCoachingManagementLayout from '../../components/admin/AdminCoachingManagementLayout';
import { CoachingRoom, CoachingSession, coachingRequest, formatCoachingDate } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type AdminSession = CoachingSession & {
  coach?: { full_name?: string; email?: string } | null;
  learner?: { full_name?: string; email?: string } | null;
  room?: CoachingRoom | null;
};
type Settings = {
  room_access_before_minutes: number;
  room_access_after_minutes: number;
  external_link_reveal_before_minutes: number;
  no_show_grace_minutes: number;
  auto_complete_after_minutes: number;
};
type Filter = 'all' | 'today' | 'upcoming' | 'live' | 'history';

export default function AdminCoachingSessions() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await coachingRequest<{ success: true; sessions: AdminSession[]; settings: Settings }>('admin_sessions');
      setSessions(result.sessions); setSettings(result.settings);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sessions indisponibles.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const displayed = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;
    const term = query.trim().toLowerCase();
    return sessions.filter(item => {
      const start = item.scheduled_start ? new Date(item.scheduled_start).getTime() : 0;
      if (filter === 'today' && !(start >= todayStart && start < todayEnd)) return false;
      if (filter === 'upcoming' && !(start >= now.getTime() && ['confirmed', 'ready'].includes(item.status))) return false;
      if (filter === 'live' && item.status !== 'in_progress') return false;
      if (filter === 'history' && !['completed', 'no_show_coach', 'no_show_learner', 'cancelled_by_coach', 'cancelled_by_learner', 'refunded', 'partially_refunded'].includes(item.status)) return false;
      if (!term) return true;
      return [item.offer_title_snapshot, item.coach?.full_name, item.coach?.email, item.learner?.full_name, item.learner?.email].some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [sessions, filter, query]);

  return <AdminCoachingManagementLayout><div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}><div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Omnia Coaching</span><h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Supervision des sessions</h1><p className="mt-2 text-sm text-slate-500">Sessions programmées, salles actives, présences et clôtures.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Settings2 size={15}/>Paramètres</button><button onClick={load} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><RefreshCw size={15}/>Actualiser</button></div></header>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}{notice && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><nav className="flex gap-1 overflow-x-auto">{([['all','Toutes'],['today','Aujourd’hui'],['upcoming','À venir'],['live','En cours'],['history','Historique']] as Array<[Filter,string]>).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: filter === value ? BLUE : 'white', color: filter === value ? 'white' : BLUE, border: `1px solid ${BORDER}` }}>{label}</button>)}</nav><label className="relative block min-w-[260px]"><Search className="absolute left-3 top-2.5 text-slate-400" size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Coach, apprenant ou session" className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none" style={{ borderColor: BORDER }}/></label></div>
    {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement…</div> : displayed.length ? <section className="mt-5 space-y-4">{displayed.map(item => <article key={item.id} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold" style={{ color: BLUE }}>{item.offer_title_snapshot}</h2><Status value={item.status}/>{item.room && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">Salle : {item.room.status}</span>}</div><div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2"><p><strong>Coach :</strong> {item.coach?.full_name || item.coach_name_snapshot}<br/><span className="text-xs text-slate-500">{item.coach?.email}</span></p><p><strong>Apprenant :</strong> {item.learner?.full_name || 'Utilisateur OGA'}<br/><span className="text-xs text-slate-500">{item.learner?.email}</span></p></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarClock size={15}/>{formatCoachingDate(item.scheduled_start)}</span><span>{item.duration_minutes} minutes</span><span>{item.meeting_mode === 'jitsi' ? 'Salle intégrée OGA' : 'Lien externe'}</span></div><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>Coach présent : {item.coach_joined_at ? formatCoachingDate(item.coach_joined_at) : 'non enregistré'}</span><span>Apprenant présent : {item.learner_joined_at ? formatCoachingDate(item.learner_joined_at) : 'non enregistré'}</span></div></div><Link to={`/coaching/sessions/${item.id}/room`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><ShieldCheck size={15}/>Superviser</Link></div></article>)}</section> : <div className="mt-6 rounded-xl border bg-white py-16 text-center" style={{ borderColor: BORDER }}><UsersRound className="mx-auto" color={GOLD}/><p className="mt-3 text-sm text-slate-500">Aucune session dans cette catégorie.</p></div>}
    {settingsOpen && settings && <SettingsModal settings={settings} onClose={() => setSettingsOpen(false)} onDone={async () => { setSettingsOpen(false); setNotice('Les paramètres de session ont été enregistrés.'); await load(); }}/>} 
  </div></AdminCoachingManagementLayout>;
}

function SettingsModal({ settings, onClose, onDone }: { settings: Settings; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof Settings, value: string) => setForm(previous => ({ ...previous, [key]: Number(value) }));
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await coachingRequest('admin_session_settings_save', form); onDone(); } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Paramètres des sessions</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Ouverture avant la session (min)"><input type="number" min="0" max="240" value={form.room_access_before_minutes} onChange={e => set('room_access_before_minutes', e.target.value)} className="input"/></Field><Field label="Fermeture après la session (min)"><input type="number" min="0" max="240" value={form.room_access_after_minutes} onChange={e => set('room_access_after_minutes', e.target.value)} className="input"/></Field><Field label="Affichage du lien externe avant (min)"><input type="number" min="0" max="240" value={form.external_link_reveal_before_minutes} onChange={e => set('external_link_reveal_before_minutes', e.target.value)} className="input"/></Field><Field label="Tolérance d’absence (min)"><input type="number" min="0" max="120" value={form.no_show_grace_minutes} onChange={e => set('no_show_grace_minutes', e.target.value)} className="input"/></Field><Field label="Clôture automatique après (min)"><input type="number" min="0" max="240" value={form.auto_complete_after_minutes} onChange={e => set('auto_complete_after_minutes', e.target.value)} className="input"/></Field>{error && <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>Enregistrer</button></div></form><style>{`.input{margin-top:.35rem;height:2.65rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:0 .75rem;font-size:.875rem;outline:none}.input:focus{border-color:${GOLD}}`}</style></div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>; }
function Status({ value }: { value: string }) { const danger = ['no_show_coach', 'cancelled_by_coach', 'refunded'].includes(value); const warning = ['confirmed', 'ready', 'no_show_learner'].includes(value); return <span className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" style={{ background: danger ? '#FEF2F2' : warning ? '#FFF7E6' : '#ECFDF3', color: danger ? '#B42318' : warning ? '#9A6700' : '#027A48' }}>{value.replace(/_/g, ' ')}</span>; }
