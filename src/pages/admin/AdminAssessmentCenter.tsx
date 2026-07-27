import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarClock, CheckCircle2, ClipboardCheck, Clock3, ExternalLink, FileText, Loader2,
  RefreshCw, ShieldAlert, ShieldCheck, Users, XCircle,
  type LucideIcon,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-center`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Overview = {
  summary: { assessments: number; official: number; upcoming_sessions: number; open_incidents: number; pending_accommodations: number };
  assessments: any[];
  sessions: any[];
  incidents: any[];
  accommodations: any[];
};

async function call(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...payload }) });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
  return data;
}

function date(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminAssessmentCenter() {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<'assessments' | 'sessions' | 'incidents' | 'accommodations'>('assessments');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await call('admin_overview')); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decideSession(sessionId: string, status: string) {
    if (['cancelled', 'suspended'].includes(status) && !reason[sessionId]?.trim()) {
      setError('Le motif est obligatoire pour suspendre ou annuler une session.'); return;
    }
    setWorking(sessionId); setError(''); setSuccess('');
    try {
      await call('admin_session_decide', { session_id: sessionId, status, reason: reason[sessionId] || '' });
      setSuccess('La session a été mise à jour.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  async function resolveIncident(id: string, status: 'resolved' | 'dismissed') {
    if (!reason[id]?.trim()) { setError('Saisissez la résolution ou le motif de classement.'); return; }
    setWorking(id); setError(''); setSuccess('');
    try {
      await call('admin_resolve_incident', { incident_id: id, status, resolution: reason[id] });
      setSuccess('L’incident a été traité.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Traitement impossible.'); }
    finally { setWorking(''); }
  }

  async function decideAccommodation(id: string, status: 'approved' | 'rejected') {
    setWorking(id); setError(''); setSuccess('');
    try {
      const current = data?.accommodations.find(item => item.id === id);
      await call('admin_accommodation_decide', {
        accommodation_id: id, status,
        extra_time_minutes: current?.extra_time_minutes || 0,
        break_minutes: current?.break_minutes || 0,
        adjustments: current?.adjustments || {},
        private_note: reason[id] || '',
      });
      setSuccess('La demande d’aménagement a été traitée.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  const tabs = useMemo(() => [
    ['assessments', 'Évaluations', data?.summary.assessments || 0],
    ['sessions', 'Sessions', data?.summary.upcoming_sessions || 0],
    ['incidents', 'Incidents', data?.summary.open_incidents || 0],
    ['accommodations', 'Aménagements', data?.summary.pending_accommodations || 0],
  ] as const, [data]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BLUE }}>Omnia Assessment Center</h1>
            <p className="mt-1 text-sm text-gray-500">Supervisez les évaluations officielles, sessions, incidents et aménagements.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16} />Actualiser</button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={ClipboardCheck} label="Évaluations" value={data?.summary.assessments || 0} />
          <Stat icon={ShieldCheck} label="Officielles" value={data?.summary.official || 0} />
          <Stat icon={CalendarClock} label="Sessions à venir" value={data?.summary.upcoming_sessions || 0} />
          <Stat icon={ShieldAlert} label="Incidents ouverts" value={data?.summary.open_incidents || 0} />
          <Stat icon={Users} label="Aménagements" value={data?.summary.pending_accommodations || 0} />
        </div>

        {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
        {success && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}

        <div className="mt-6 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: BORDER }}>
          {tabs.map(([key, label, count]) => <button key={key} onClick={() => setTab(key)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: tab === key ? BLUE : '#F3F4F6', color: tab === key ? 'white' : '#4B5563' }}>{label} ({count})</button>)}
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : (
          <div className="mt-5 space-y-3">
            {tab === 'assessments' && (data?.assessments.length ? data.assessments.map(item => (
              <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.course?.title || 'Formation'} · {item.assessment_type} · seuil {item.passing_score}%</p></div>
                  <div className="flex gap-2"><Badge text={`Surveillance ${item.security_level}/4`} /><Badge text={item.quality_review_status === 'approved' ? 'Qualité validée' : 'Qualité à contrôler'} good={item.quality_review_status === 'approved'} /></div>
                </div>
                <p className="mt-3 text-sm text-gray-600">Mode : {item.delivery_mode} · {item.session_required ? 'session obligatoire' : 'passage libre'} · {item.required ? 'obligatoire' : 'facultative'}</p>
              </div>
            )) : <Empty text="Aucune évaluation configurée." />)}

            {tab === 'sessions' && (data?.sessions.length ? data.sessions.map(item => (
              <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.course?.title} · {date(item.starts_at)} → {date(item.ends_at)}</p></div>
                  <Badge text={item.computed_status || item.status} good={['scheduled', 'open', 'completed'].includes(item.computed_status || item.status)} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input value={reason[item.id] || ''} onChange={event => setReason(current => ({ ...current, [item.id]: event.target.value }))} className="h-10 rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Motif si suspension ou annulation" />
                  <div className="flex flex-wrap gap-2">
                    {item.status === 'pending_approval' && <Action disabled={working === item.id} label="Approuver" icon={CheckCircle2} onClick={() => void decideSession(item.id, 'scheduled')} />}
                    {!['completed', 'cancelled'].includes(item.status) && <Action disabled={working === item.id} label="Suspendre" icon={ShieldAlert} onClick={() => void decideSession(item.id, 'suspended')} secondary />}
                    {!['completed', 'cancelled'].includes(item.status) && <Action disabled={working === item.id} label="Annuler" icon={XCircle} onClick={() => void decideSession(item.id, 'cancelled')} danger />}
                  </div>
                </div>
              </div>
            )) : <Empty text="Aucune session programmée." />)}

            {tab === 'incidents' && (data?.incidents.length ? data.incidents.map(item => (
              <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.user?.full_name || 'Apprenant'} · {item.user?.email || '—'} · {item.session?.title || 'Session'} · {item.incident_type} · {item.severity} · {date(item.created_at)}</p></div><Badge text={item.status} good={item.status === 'resolved'} /></div>
                <p className="mt-3 text-sm text-gray-600">{item.description}</p>
                {item.evidence?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.evidence.map((file: any, index: number) => <a key={`${item.id}-${index}`} href={file.signed_url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name || 'Preuve'}<ExternalLink size={12} /></a>)}</div>}
                {!['resolved', 'dismissed'].includes(item.status) && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><textarea rows={2} value={reason[item.id] || ''} onChange={event => setReason(current => ({ ...current, [item.id]: event.target.value }))} className="rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Résolution ou motif de classement" /><div className="flex gap-2"><Action disabled={working === item.id} label="Résoudre" icon={CheckCircle2} onClick={() => void resolveIncident(item.id, 'resolved')} /><Action disabled={working === item.id} label="Classer" icon={XCircle} onClick={() => void resolveIncident(item.id, 'dismissed')} secondary /></div></div>}
              </div>
            )) : <Empty text="Aucun incident enregistré." />)}

            {tab === 'accommodations' && (data?.accommodations.length ? data.accommodations.map(item => (
              <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>Demande d’aménagement — {item.user?.full_name || 'Apprenant'}</p><p className="mt-1 text-xs text-gray-500">{item.user?.email || '—'} · {item.session?.title || 'Session'} · temps supplémentaire : {item.extra_time_minutes || 0} min · pauses : {item.break_minutes || 0} min</p></div><Badge text={item.status} good={item.status === 'approved'} /></div>
                <p className="mt-3 text-sm text-gray-600">{item.reason || 'Aucun motif indiqué.'}</p>
                {item.status === 'pending' && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><input value={reason[item.id] || ''} onChange={event => setReason(current => ({ ...current, [item.id]: event.target.value }))} className="h-10 rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Note interne facultative" /><div className="flex gap-2"><Action disabled={working === item.id} label="Accepter" icon={CheckCircle2} onClick={() => void decideAccommodation(item.id, 'approved')} /><Action disabled={working === item.id} label="Refuser" icon={XCircle} onClick={() => void decideAccommodation(item.id, 'rejected')} danger /></div></div>}
              </div>
            )) : <Empty text="Aucune demande d’aménagement." />)}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><Icon size={18} color={GOLD} /><p className="mt-2 text-xs text-gray-500">{label}</p><p className="text-2xl font-bold" style={{ color: BLUE }}>{value}</p></div>; }
function Badge({ text, good = false }: { text: string; good?: boolean }) { return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${good ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{text}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}><Clock3 className="mx-auto mb-2 text-gray-300" />{text}</div>; }
function Action({ label, icon: Icon, onClick, disabled, secondary, danger }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) { return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: secondary ? '#F3F4F6' : danger ? '#FEE2E2' : BLUE, color: secondary ? BLUE : danger ? '#B91C1C' : 'white' }}>{disabled ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}{label}</button>; }
