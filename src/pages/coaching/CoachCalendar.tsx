import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, CheckCircle2, Clock3, Edit3, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import CoachWorkspaceNav from '../../components/coaching/CoachWorkspaceNav';
import { CoachAvailabilityException, CoachAvailabilityRule, CoachProfile, coachingRequest, formatCoachingDate } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';
const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

type CalendarData = {
  success: true;
  profile: CoachProfile;
  rules: CoachAvailabilityRule[];
  exceptions: CoachAvailabilityException[];
  settings: {
    default_booking_notice_hours: number;
    default_max_sessions_per_day: number;
    maximum_booking_window_days: number;
  };
};

type RuleForm = {
  id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  timezone: string;
  valid_from: string;
  valid_until: string;
  booking_notice_hours: string;
  maximum_sessions_per_day: string;
  buffer_before_minutes: string;
  buffer_after_minutes: string;
  is_active: boolean;
};

type ExceptionForm = {
  id?: string;
  exception_type: 'blocked' | 'available';
  starts_at: string;
  ends_at: string;
  reason: string;
};

function today() { return new Date().toISOString().slice(0, 10); }
function toLocalInput(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }

export default function CoachCalendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [editingRule, setEditingRule] = useState<RuleForm | null>(null);
  const [editingException, setEditingException] = useState<ExceptionForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ type: 'rule' | 'exception'; id: string } | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { setData(await coachingRequest<CalendarData>('coach_availability')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Calendrier indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function newRule(day = 1) {
    setEditingRule({ day_of_week: String(day), start_time: '09:00', end_time: '17:00', timezone: data?.profile.timezone || 'Africa/Bamako', valid_from: today(), valid_until: '', booking_notice_hours: String(data?.settings.default_booking_notice_hours ?? 24), maximum_sessions_per_day: String(data?.settings.default_max_sessions_per_day ?? 8), buffer_before_minutes: '0', buffer_after_minutes: '0', is_active: true });
  }

  function editRule(rule: CoachAvailabilityRule) {
    setEditingRule({ id: rule.id, day_of_week: String(rule.day_of_week), start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5), timezone: rule.timezone, valid_from: rule.valid_from, valid_until: rule.valid_until || '', booking_notice_hours: rule.booking_notice_hours?.toString() || '', maximum_sessions_per_day: rule.maximum_sessions_per_day?.toString() || '', buffer_before_minutes: String(rule.buffer_before_minutes || 0), buffer_after_minutes: String(rule.buffer_after_minutes || 0), is_active: rule.is_active });
  }

  async function removeRule(id: string) {
    setBusyId(id); setError('');
    try { await coachingRequest('coach_availability_rule_delete', { id }); setNotice('Disponibilité supprimée.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible.'); }
    finally { setBusyId(''); }
  }

  function newException(type: 'blocked' | 'available') {
    const start = new Date(Date.now() + 86400000); start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    setEditingException({ exception_type: type, starts_at: toLocalInput(start.toISOString()), ends_at: toLocalInput(end.toISOString()), reason: '' });
  }

  async function removeException(id: string) {
    setBusyId(id); setError('');
    try { await coachingRequest('coach_availability_exception_delete', { id }); setNotice('Exception supprimée.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible.'); }
    finally { setBusyId(''); }
  }

  const grouped = useMemo(() => {
    const map = new Map<number, CoachAvailabilityRule[]>();
    for (let day = 0; day <= 6; day += 1) map.set(day, []);
    data?.rules.forEach(rule => map.set(rule.day_of_week, [...(map.get(rule.day_of_week) || []), rule]));
    return map;
  }, [data]);

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader />
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <CoachWorkspaceNav />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Espace coach</span><h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Mon calendrier</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Définissez vos disponibilités récurrentes, bloquez vos absences et ouvrez des créneaux exceptionnels. Les heures sont enregistrées avec votre fuseau horaire.</p></div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16}/>Actualiser</button>
      </header>
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 size={18}/>{notice}</div>}

      {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement du calendrier…</div> : data && <>
        <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold" style={{ color: BLUE }}>Disponibilités hebdomadaires</h2><p className="mt-1 text-sm text-slate-500">Fuseau principal : {data.profile.timezone}</p></div><button onClick={() => newRule()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Plus size={16}/>Ajouter une plage</button></div>
          <div className="mt-5 divide-y" style={{ borderColor: BORDER }}>
            {[1, 2, 3, 4, 5, 6, 0].map(day => <div key={day} className="grid gap-3 py-4 md:grid-cols-[150px_1fr]">
              <div><p className="font-semibold" style={{ color: BLUE }}>{days[day]}</p><button onClick={() => newRule(day)} className="mt-1 text-xs font-semibold" style={{ color: GOLD }}>Ajouter</button></div>
              <div className="space-y-2">{(grouped.get(day) || []).length ? (grouped.get(day) || []).map(rule => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-4 text-sm"><span className="inline-flex items-center gap-2 font-semibold text-slate-800"><Clock3 size={15}/>{rule.start_time.slice(0, 5)} – {rule.end_time.slice(0, 5)}</span><span className="text-slate-500">Préavis : {rule.booking_notice_hours ?? data.settings.default_booking_notice_hours} h</span><span className="text-slate-500">Maximum : {rule.maximum_sessions_per_day ?? data.settings.default_max_sessions_per_day}/jour</span>{!rule.is_active && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Désactivée</span>}</div>
                <div className="flex gap-2"><button onClick={() => editRule(rule)} className="rounded-lg border bg-white p-2" style={{ borderColor: BORDER }}><Edit3 size={15}/></button><button disabled={busyId === rule.id} onClick={() => setPendingDelete({ type: 'rule', id: rule.id })} className="rounded-lg border bg-white p-2 text-red-600 disabled:opacity-50" style={{ borderColor: BORDER }}><Trash2 size={15}/></button></div>
              </div>) : <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Indisponible par défaut.</p>}</div>
            </div>)}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold" style={{ color: BLUE }}>Exceptions et absences</h2><p className="mt-1 text-sm text-slate-500">Une indisponibilité bloque les règles récurrentes. Une ouverture exceptionnelle ajoute un créneau hors planning.</p></div><div className="flex gap-2"><button onClick={() => newException('blocked')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: '#B42318' }}><Ban size={15}/>Bloquer</button><button onClick={() => newException('available')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><CalendarDays size={15}/>Ouvrir exceptionnellement</button></div></div>
          <div className="mt-5 space-y-3">{data.exceptions.length ? data.exceptions.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: BORDER }}><div><div className="flex items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: item.exception_type === 'blocked' ? '#FEF2F2' : '#ECFDF3', color: item.exception_type === 'blocked' ? '#B42318' : '#027A48' }}>{item.exception_type === 'blocked' ? 'Indisponible' : 'Ouverture exceptionnelle'}</span><p className="text-sm font-semibold" style={{ color: BLUE }}>{formatCoachingDate(item.starts_at)} → {formatCoachingDate(item.ends_at)}</p></div>{item.reason && <p className="mt-1 text-sm text-slate-500">{item.reason}</p>}</div><button disabled={busyId === item.id} onClick={() => setPendingDelete({ type: 'exception', id: item.id })} className="rounded-lg border p-2 text-red-600 disabled:opacity-50" style={{ borderColor: BORDER }}><Trash2 size={15}/></button></div>) : <div className="py-10 text-center text-sm text-slate-500">Aucune exception à venir.</div>}</div>
        </section>
      </>}

      {editingRule && <RuleModal form={editingRule} onClose={() => setEditingRule(null)} onDone={async message => { setEditingRule(null); setNotice(message); await load(); }} />}
      {editingException && <ExceptionModal form={editingException} onClose={() => setEditingException(null)} onDone={async message => { setEditingException(null); setNotice(message); await load(); }} />}
      {pendingDelete && <ConfirmDelete type={pendingDelete.type} busy={busyId === pendingDelete.id} onClose={() => setPendingDelete(null)} onConfirm={async () => { const item = pendingDelete; if (item.type === 'rule') await removeRule(item.id); else await removeException(item.id); setPendingDelete(null); }} />}
    </main>
  </div>;
}

function RuleModal({ form: initial, onClose, onDone }: { form: RuleForm; onClose: () => void; onDone: (message: string) => void }) {
  const [form, setForm] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await coachingRequest('coach_availability_rule_save', { ...form, day_of_week: Number(form.day_of_week), valid_until: form.valid_until || null, booking_notice_hours: form.booking_notice_hours === '' ? null : Number(form.booking_notice_hours), maximum_sessions_per_day: form.maximum_sessions_per_day === '' ? null : Number(form.maximum_sessions_per_day), buffer_before_minutes: Number(form.buffer_before_minutes || 0), buffer_after_minutes: Number(form.buffer_after_minutes || 0) }); onDone(initial.id ? 'Disponibilité mise à jour.' : 'Disponibilité ajoutée.'); } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); } }
  return <Modal title={initial.id ? 'Modifier la disponibilité' : 'Ajouter une disponibilité'} onClose={onClose}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Jour"><select value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)} className="input">{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Field><Field label="Fuseau horaire"><input required value={form.timezone} onChange={e => set('timezone', e.target.value)} className="input" /></Field><Field label="Heure de début"><input required type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="input" /></Field><Field label="Heure de fin"><input required type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="input" /></Field><Field label="Valable à partir du"><input required type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} className="input" /></Field><Field label="Valable jusqu’au"><input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className="input" /></Field><Field label="Préavis minimum (heures)"><input type="number" min="0" value={form.booking_notice_hours} onChange={e => set('booking_notice_hours', e.target.value)} className="input" /></Field><Field label="Sessions maximum par jour"><input type="number" min="1" max="30" value={form.maximum_sessions_per_day} onChange={e => set('maximum_sessions_per_day', e.target.value)} className="input" /></Field><Field label="Pause avant (minutes)"><input type="number" min="0" max="180" value={form.buffer_before_minutes} onChange={e => set('buffer_before_minutes', e.target.value)} className="input" /></Field><Field label="Pause après (minutes)"><input type="number" min="0" max="180" value={form.buffer_after_minutes} onChange={e => set('buffer_after_minutes', e.target.value)} className="input" /></Field></div><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />Plage active</label>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Actions busy={busy} onClose={onClose} /></form></Modal>;
}

function ExceptionModal({ form: initial, onClose, onDone }: { form: ExceptionForm; onClose: () => void; onDone: (message: string) => void }) {
  const [form, setForm] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const set = <K extends keyof ExceptionForm>(key: K, value: ExceptionForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await coachingRequest('coach_availability_exception_save', { ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() }); onDone(initial.id ? 'Exception mise à jour.' : 'Exception ajoutée.'); } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); } }
  return <Modal title={form.exception_type === 'blocked' ? 'Bloquer une période' : 'Ouvrir une période exceptionnelle'} onClose={onClose}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Début"><input required type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} className="input" /></Field><Field label="Fin"><input required type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} className="input" /></Field></div><Field label="Motif facultatif"><textarea rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} className="textarea" /></Field>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Actions busy={busy} onClose={onClose} /></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><div className="pt-5">{children}</div><style>{`.input{margin-top:.35rem;height:2.65rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:0 .75rem;font-size:.875rem;outline:none}.textarea{margin-top:.35rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:.7rem;font-size:.875rem;outline:none}.input:focus,.textarea:focus{border-color:${GOLD}}`}</style></div></div>; }
function Actions({ busy, onClose }: { busy: boolean; onClose: () => void }) { return <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: BORDER }}><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>Enregistrer</button></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>; }

function ConfirmDelete({ type, busy, onClose, onConfirm }: { type: 'rule' | 'exception'; busy: boolean; onClose: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Confirmer la suppression</h2><p className="mt-3 text-sm leading-6 text-slate-600">{type === 'rule' ? 'Cette plage hebdomadaire ne générera plus de créneaux.' : 'Cette exception sera retirée du calendrier.'}</p><div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy} onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Supprimer</button></div></div></div>; }
