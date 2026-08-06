import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CalendarPlus, ClipboardCheck, ExternalLink, Loader2, Save } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-center`;
const BLUE = '#002050'; const GOLD = '#BF8813'; const BORDER = '#E4E7EC';

async function call(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...payload }) });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
  return data;
}
function date(value?: string) { return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'; }

export default function ProfesseurAssessmentCenter() {
  const location = useLocation();
  const isStructure = location.pathname.startsWith('/structure/');
  const [data, setData] = useState<any>({ courses: [], assessments: [], sessions: [], pending_attempts: [] });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ assessment_id: '', title: '', starts_at: '', ends_at: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', capacity: '', delivery_mode: 'scheduled_online', meeting_url: '', location: '', include_enrolled: true });

  const load = useCallback(async () => { setLoading(true); setError(''); try { setData(await call('creator_overview')); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const approved = useMemo(() => (data.assessments || []).filter((item: any) => item.quality_review_status === 'approved' && item.session_required), [data.assessments]);
  const selected = approved.find((item: any) => item.id === form.assessment_id);

  async function create() {
    if (!form.assessment_id || !form.starts_at || !form.ends_at) { setError('Choisissez une évaluation et indiquez les dates de la session.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await call('creator_create_session', { ...form, title: form.title || selected?.title, capacity: form.capacity ? Number(form.capacity) : null, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), security_level: selected?.security_level || 2, proctoring_settings: selected?.proctoring_settings || {}, identity_verification_required: selected?.identity_verification_required || false });
      setSuccess('La session a été créée et transmise à l’Administration Omnia pour validation.');
      setForm(current => ({ ...current, assessment_id: '', title: '', starts_at: '', ends_at: '', capacity: '', meeting_url: '', location: '' }));
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Création impossible.'); }
    finally { setSaving(false); }
  }

  const content = <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div><h1 className="text-2xl font-bold" style={{ color: BLUE }}>Assessment Center</h1><p className="mt-1 text-sm text-gray-500">Programmez les évaluations validées et accédez aux corrections.</p></div>
      {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
      {success && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : <>
        <div className="mt-6 grid gap-4 md:grid-cols-3"><Stat label="Évaluations validées" value={approved.length} /><Stat label="Sessions" value={data.sessions?.length || 0} /><Stat label="Copies en attente" value={data.pending_attempts?.length || 0} /></div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <h2 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><CalendarPlus size={18} color={GOLD} />Programmer une session</h2>
            {approved.length === 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Aucune évaluation avec session obligatoire n’a encore été validée par le Centre Qualité.</p> : <div className="mt-4 space-y-3">
              <Field label="Évaluation"><select value={form.assessment_id} onChange={event => setForm(current => ({ ...current, assessment_id: event.target.value }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Sélectionner…</option>{approved.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
              <Field label="Titre de la session"><input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder={selected?.title || 'Session d’évaluation'} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Début"><input type="datetime-local" value={form.starts_at} onChange={event => setForm(current => ({ ...current, starts_at: event.target.value }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Fin"><input type="datetime-local" value={form.ends_at} onChange={event => setForm(current => ({ ...current, ends_at: event.target.value }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Mode"><select value={form.delivery_mode} onChange={event => setForm(current => ({ ...current, delivery_mode: event.target.value }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="scheduled_online">En ligne</option><option value="scheduled_in_person">Présentiel</option><option value="hybrid">Hybride</option></select></Field><Field label="Capacité"><input type="number" min="1" value={form.capacity} onChange={event => setForm(current => ({ ...current, capacity: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Illimitée" /></Field></div>
              {form.delivery_mode !== 'scheduled_in_person' && <Field label="Lien de réunion"><input value={form.meeting_url} onChange={event => setForm(current => ({ ...current, meeting_url: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="https://…" /></Field>}
              {form.delivery_mode !== 'scheduled_online' && <Field label="Lieu"><input value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>}
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.include_enrolled} onChange={event => setForm(current => ({ ...current, include_enrolled: event.target.checked }))} />Inscrire les apprenants déjà inscrits à la formation</label>
              <button disabled={saving} onClick={() => void create()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Créer la session</button>
            </div>}
          </section>
          <section className="space-y-5">
            <div className="rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="border-b p-4" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Sessions programmées</h2></div>{data.sessions?.length ? <div className="divide-y">{data.sessions.map((item: any) => <div key={item.id} className="p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-gray-500">{date(item.starts_at)} → {date(item.ends_at)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item.computed_status || item.status}</span></div></div>)}</div> : <Empty text="Aucune session programmée." />}</div>
            <div className="rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="border-b p-4" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Corrections</h2></div>{data.courses?.length ? <div className="divide-y">{data.courses.map((course: any) => <Link key={course.id} to={`${isStructure ? '/structure' : '/professeur'}/studio/${course.id}/evaluations`} className="flex items-center justify-between p-4 hover:bg-gray-50"><span className="flex items-center gap-2 text-sm font-medium" style={{ color: BLUE }}><ClipboardCheck size={16} color={GOLD} />{course.title}</span><ExternalLink size={15} /></Link>)}</div> : <Empty text="Aucune formation." />}</div>
          </section>
        </div>
      </>}
    </div>;
  return isStructure ? <StructureLayout>{content}</StructureLayout> : <DashboardLayout role="professeur">{content}</DashboardLayout>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>{value}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-semibold text-gray-600">{label}<div className="mt-1">{children}</div></label>; }
function Empty({ text }: { text: string }) { return <p className="p-8 text-center text-sm text-gray-500">{text}</p>; }
