import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle, Award, CheckCircle2, Clock3, ExternalLink, FileText, Loader2,
  Plus, RefreshCw, Save, Settings2, ShieldCheck, Users, XCircle, type LucideIcon,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { assessmentGovernanceCall } from '../../lib/assessmentGovernanceApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Tab = 'thresholds' | 'experts' | 'panels' | 'appeals' | 'frameworks';

export default function AdminAssessmentGovernance() {
  const [data, setData] = useState<any>({ summary: {}, experts: [], panels: [], appeals: [], frameworks: [], threshold_defaults: {} });
  const [tab, setTab] = useState<Tab>('experts');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitations, setInvitations] = useState<any[]>([]);
  const [appealForm, setAppealForm] = useState<Record<string, { accepted?: boolean; decision?: string; score?: string; reason?: string; feedback?: string; reviewer_user_id?: string }>>({});
  const [frameworkForm, setFrameworkForm] = useState({ code: '', name: '', version: '1.0', description: '' });
  const [levelForm, setLevelForm] = useState({ framework_id: '', level_number: '1', code: 'N1', name: '', description: '' });
  const [competencyForm, setCompetencyForm] = useState({ framework_id: '', code: '', name: '', domain: '', category: '', description: '', validity_months: '', renewal_mode: 'none' });
  const [thresholdForm, setThresholdForm] = useState({ lesson_passing_score: 80, module_passing_score: 80, final_passing_score: 70, competency_mastery_score: 80, default_retry_cooldown_hours: 24, default_remediation_after_attempts: 3 });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await assessmentGovernanceCall<any>('admin_overview');
      setData(result);
      if (result.threshold_defaults) setThresholdForm(result.threshold_defaults);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveThresholdDefaults() {
    const values = Object.values(thresholdForm);
    if (values.some(value => !Number.isFinite(Number(value)))) { setError('Tous les paramètres doivent être numériques.'); return; }
    setWorking('thresholds'); setError(''); setSuccess('');
    try {
      const result = await assessmentGovernanceCall<any>('admin_save_threshold_defaults', thresholdForm);
      setThresholdForm(result.threshold_defaults || thresholdForm);
      setSuccess('Les seuils par défaut des nouvelles formations ont été enregistrés. Chaque formation peut ensuite les personnaliser.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.'); }
    finally { setWorking(''); }
  }

  async function decideExpert(id: string, status: 'approved' | 'rejected' | 'suspended') {
    if (status !== 'approved' && !notes[id]?.trim()) { setError('Le motif est obligatoire.'); return; }
    setWorking(id); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('admin_expert_decide', { expert_id: id, status, validation_note: notes[id] || '' });
      setSuccess('La décision concernant l’expert a été enregistrée.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  async function decidePanel(id: string, status: 'approved' | 'rejected' | 'cancelled') {
    if (status !== 'approved' && !notes[id]?.trim()) { setError('Le motif est obligatoire.'); return; }
    setWorking(id); setError(''); setSuccess(''); setInvitations([]);
    try {
      const result = await assessmentGovernanceCall<any>('admin_panel_decide', { panel_id: id, status, approval_note: notes[id] || '' });
      setInvitations(result.invitations || []);
      setSuccess(status === 'approved' ? 'Le jury est validé. Les accès temporaires sont affichés ci-dessous.' : 'La décision sur le jury a été enregistrée.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  async function decideAppealAdmissibility(id: string, accepted: boolean) {
    const current = appealForm[id] || {};
    if (!current.reason?.trim()) { setError('La décision doit être motivée.'); return; }
    setWorking(id); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('admin_appeal_admissibility', { appeal_id: id, accepted, reason: current.reason, assigned_to: accepted ? (current.reviewer_user_id || undefined) : undefined });
      setSuccess(accepted ? 'La demande de révision est recevable et passe en nouvelle correction.' : 'La demande de révision a été rejetée avec son motif.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  async function resolveAppeal(id: string) {
    const current = appealForm[id] || {};
    if (!current.reason?.trim()) { setError('La décision finale doit être motivée.'); return; }
    if (current.decision === 'modified' && (current.score === '' || Number.isNaN(Number(current.score)))) { setError('Indiquez la note finale.'); return; }
    setWorking(id); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('reviewer_resolve_appeal', {
        appeal_id: id,
        decision: current.decision || 'confirmed',
        final_score: current.score === '' ? undefined : Number(current.score),
        final_feedback: current.feedback || '',
        decision_reason: current.reason,
      });
      setSuccess('La décision finale de révision a été publiée.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Publication impossible.'); }
    finally { setWorking(''); }
  }

  async function saveFramework() {
    if (!frameworkForm.code.trim() || !frameworkForm.name.trim()) { setError('Le code et le nom du référentiel sont obligatoires.'); return; }
    setWorking('framework'); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('admin_save_framework', { ...frameworkForm, status: 'draft', scope: 'omnia' });
      setFrameworkForm({ code: '', name: '', version: '1.0', description: '' });
      setSuccess('Le référentiel a été créé en brouillon.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Création impossible.'); }
    finally { setWorking(''); }
  }

  async function saveLevel() {
    if (!levelForm.framework_id || !levelForm.name.trim() || !levelForm.code.trim()) { setError('Choisissez le référentiel et complétez le niveau.'); return; }
    setWorking('level'); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('admin_save_level', { ...levelForm, level_number: Number(levelForm.level_number) });
      setSuccess('Le niveau a été enregistré.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.'); }
    finally { setWorking(''); }
  }

  async function saveCompetency() {
    if (!competencyForm.framework_id || !competencyForm.code.trim() || !competencyForm.name.trim()) { setError('Choisissez le référentiel et complétez la compétence.'); return; }
    setWorking('competency'); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('admin_save_competency', { ...competencyForm, validity_months: competencyForm.validity_months ? Number(competencyForm.validity_months) : null, status: 'active' });
      setCompetencyForm(current => ({ ...current, code: '', name: '', domain: '', category: '', description: '', validity_months: '' }));
      setSuccess('La compétence a été ajoutée.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Création impossible.'); }
    finally { setWorking(''); }
  }

  async function setFrameworkStatus(id: string, status: 'published' | 'archived' | 'draft') {
    setWorking(id); setError(''); setSuccess('');
    try { await assessmentGovernanceCall('admin_set_framework_status', { framework_id: id, status }); setSuccess('Le statut du référentiel a été modifié.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Modification impossible.'); }
    finally { setWorking(''); }
  }

  const tabs = useMemo(() => [
    ['thresholds', 'Seuils & tentatives', 6],
    ['experts', 'Experts', data.summary?.pending_experts || 0],
    ['panels', 'Jurys', data.summary?.pending_panels || 0],
    ['appeals', 'Révisions', data.summary?.pending_appeals || 0],
    ['frameworks', 'Référentiels', data.summary?.published_frameworks || 0],
  ] as const, [data]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BLUE }}>Jurys, révisions et compétences</h1>
            <p className="mt-1 text-sm text-gray-500">Validez les experts, limitez leurs permissions, arbitrez les révisions et administrez le référentiel central.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16} />Actualiser</button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Users} label="Experts à valider" value={data.summary?.pending_experts || 0} />
          <Stat icon={ShieldCheck} label="Jurys à valider" value={data.summary?.pending_panels || 0} />
          <Stat icon={FileText} label="Dossiers actifs" value={data.summary?.active_cases || 0} />
          <Stat icon={Clock3} label="Révisions ouvertes" value={data.summary?.pending_appeals || 0} />
          <Stat icon={Award} label="Référentiels publiés" value={data.summary?.published_frameworks || 0} />
        </div>

        {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
        {success && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}

        {invitations.length > 0 && <section className="mt-5 rounded-xl border bg-amber-50 p-4" style={{ borderColor: GOLD }}>
          <h2 className="font-semibold" style={{ color: BLUE }}>Accès temporaires du jury</h2>
          <p className="mt-1 text-xs text-amber-800">Ces codes ne sont affichés qu’après la validation. Transmettez chaque lien et PIN uniquement à la personne concernée.</p>
          <div className="mt-3 space-y-2">{invitations.map(item => <div key={item.member_id} className="rounded-lg bg-white p-3 text-xs"><p className="font-semibold" style={{ color: BLUE }}>{item.name} · {item.role}</p><p className="mt-1 break-all">{item.invite_url}</p><p className="mt-1">PIN : <strong>{item.pin}</strong> · expiration : {formatDate(item.expires_at)}</p></div>)}</div>
        </section>}

        <div className="mt-6 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: BORDER }}>
          {tabs.map(([key, label, count]) => <button key={key} onClick={() => setTab(key)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: tab === key ? BLUE : '#F3F4F6', color: tab === key ? 'white' : '#4B5563' }}>{label} ({count})</button>)}
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : <div className="mt-5 space-y-4">
          {tab === 'thresholds' && <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><Settings2 size={18} style={{ color: GOLD }} /></div><div><h2 className="font-semibold" style={{ color: BLUE }}>Paramètres par défaut des évaluations</h2><p className="mt-1 text-sm text-gray-500">Ces valeurs sont proposées aux nouvelles formations. Le créateur peut les adapter par formation et par évaluation avant soumission.</p></div></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ThresholdField label="Seuil leçon (%)" value={thresholdForm.lesson_passing_score} min={1} max={100} onChange={value => setThresholdForm(current => ({ ...current, lesson_passing_score: value }))} />
              <ThresholdField label="Seuil module (%)" value={thresholdForm.module_passing_score} min={1} max={100} onChange={value => setThresholdForm(current => ({ ...current, module_passing_score: value }))} />
              <ThresholdField label="Seuil examen final (%)" value={thresholdForm.final_passing_score} min={1} max={100} onChange={value => setThresholdForm(current => ({ ...current, final_passing_score: value }))} />
              <ThresholdField label="Maîtrise d’une compétence (%)" value={thresholdForm.competency_mastery_score} min={1} max={100} onChange={value => setThresholdForm(current => ({ ...current, competency_mastery_score: value }))} />
              <ThresholdField label="Délai entre tentatives (heures)" value={thresholdForm.default_retry_cooldown_hours} min={0} max={720} onChange={value => setThresholdForm(current => ({ ...current, default_retry_cooldown_hours: value }))} />
              <ThresholdField label="Remédiation après (tentatives)" value={thresholdForm.default_remediation_after_attempts} min={1} max={100} onChange={value => setThresholdForm(current => ({ ...current, default_remediation_after_attempts: value }))} />
            </div>
            <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><strong>Règle de gouvernance :</strong> toute modification s’applique comme valeur par défaut aux prochaines créations. Les formations existantes conservent leurs seuils déjà validés afin d’éviter de changer rétroactivement les règles d’évaluation.</div>
            <button disabled={working === 'thresholds'} onClick={() => void saveThresholdDefaults()} className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{working === 'thresholds' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Enregistrer les paramètres</button>
          </section>}

          {tab === 'experts' && (data.experts?.length ? data.experts.map((expert: any) => <section key={expert.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
            <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{expert.full_name}</p><p className="mt-1 text-xs text-gray-500">{expert.email} · {expert.organization_name || 'Organisation non indiquée'} · proposé par {expert.proposal_source}</p></div><Badge text={expert.status} good={expert.status === 'approved'} /></div>
            {expert.expertise_domains?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{expert.expertise_domains.map((item: string) => <span key={item} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{item}</span>)}</div>}
            {expert.biography && <p className="mt-3 text-sm text-gray-600">{expert.biography}</p>}
            {expert.documents?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{expert.documents.map((file: any, index: number) => <a key={index} href={file.signed_url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name || 'Justificatif'}<ExternalLink size={12} /></a>)}</div>}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><textarea rows={2} value={notes[expert.id] || ''} onChange={event => setNotes(current => ({ ...current, [expert.id]: event.target.value }))} className="rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Motif de validation, refus ou suspension" /><div className="flex flex-wrap items-start gap-2"><Action disabled={working === expert.id} icon={CheckCircle2} label="Valider" onClick={() => void decideExpert(expert.id, 'approved')} /><Action disabled={working === expert.id} icon={XCircle} label="Refuser" danger onClick={() => void decideExpert(expert.id, 'rejected')} />{expert.status === 'approved' && <Action disabled={working === expert.id} icon={XCircle} label="Suspendre" secondary onClick={() => void decideExpert(expert.id, 'suspended')} />}</div></div>
          </section>) : <Empty text="Aucun expert proposé." />)}

          {tab === 'panels' && (data.panels?.length ? data.panels.map((panel: any) => <section key={panel.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
            <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{panel.name}</p><p className="mt-1 text-xs text-gray-500">{panel.course?.title || 'Formation'} · {panel.assessment?.title || 'Évaluation'} · quorum {panel.quorum}/{panel.required_members} · {panel.decision_mode}</p></div><Badge text={panel.status} good={['approved', 'active', 'completed'].includes(panel.status)} /></div>
            {panel.purpose && <p className="mt-3 text-sm text-gray-600">{panel.purpose}</p>}
            <div className="mt-3 grid gap-2 md:grid-cols-2">{panel.members?.map((member: any) => <div key={member.id} className="rounded-lg bg-gray-50 p-3 text-xs"><p className="font-semibold" style={{ color: BLUE }}>{member.external_name || 'Membre'} · {member.member_role}</p><p className="mt-1 text-gray-500">{member.external_email || 'Compte Omnia'} · {member.status} · conflit : {member.conflict_status}</p></div>)}</div>
            {panel.status === 'pending_approval' && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><textarea rows={2} value={notes[panel.id] || ''} onChange={event => setNotes(current => ({ ...current, [panel.id]: event.target.value }))} className="rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Note de contrôle du jury" /><div className="flex gap-2"><Action disabled={working === panel.id} icon={CheckCircle2} label="Valider et générer les accès" onClick={() => void decidePanel(panel.id, 'approved')} /><Action disabled={working === panel.id} icon={XCircle} label="Refuser" danger onClick={() => void decidePanel(panel.id, 'rejected')} /></div></div>}
          </section>) : <Empty text="Aucun jury constitué." />)}

          {tab === 'appeals' && (data.appeals?.length ? data.appeals.map((appeal: any) => {
            const current = appealForm[appeal.id] || {};
            return <section key={appeal.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{appeal.attempt?.course_assessments?.title || 'Évaluation'}</p><p className="mt-1 text-xs text-gray-500">{appeal.attempt?.users?.full_name || 'Apprenant'} · note initiale {appeal.original_score ?? appeal.attempt?.score ?? '—'}% · {formatDate(appeal.submitted_at)}</p></div><Badge text={appeal.status} good={appeal.status === 'decided'} /></div>
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{appeal.reason}</p>
              {appeal.evidence?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{appeal.evidence.map((file: any, index: number) => <a key={index} href={file.signed_url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name || 'Preuve de la demande'}<ExternalLink size={12} /></a>)}</div>}
              {['submitted', 'admissibility_review'].includes(appeal.status) && <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Motif de recevabilité ou de rejet"><textarea rows={3} value={current.reason || ''} onChange={event => setAppealForm(state => ({ ...state, [appeal.id]: { ...current, reason: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                  <Field label="Nouvelle correction attribuée à"><select value={current.reviewer_user_id || ''} onChange={event => setAppealForm(state => ({ ...state, [appeal.id]: { ...current, reviewer_user_id: event.target.value } }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Administration Omnia</option>{(data.experts || []).filter((expert: any) => expert.status === 'approved' && expert.user_id).map((expert: any) => <option key={expert.id} value={expert.user_id}>{expert.full_name} · expert validé</option>)}</select><p className="mt-2 text-xs font-normal text-gray-500">Seuls les experts validés disposant d’un compte Omnia peuvent recevoir une révision. Les experts externes restent affectés via un jury temporaire.</p></Field>
                </div>
                <div className="flex flex-wrap justify-end gap-2"><Action disabled={working === appeal.id} icon={CheckCircle2} label="Recevable" onClick={() => void decideAppealAdmissibility(appeal.id, true)} /><Action disabled={working === appeal.id} icon={XCircle} label="Rejeter" danger onClick={() => void decideAppealAdmissibility(appeal.id, false)} /></div>
              </div>}
              {['accepted', 'in_review'].includes(appeal.status) && <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 md:grid-cols-2">
                <Field label="Décision"><select value={current.decision || 'confirmed'} onChange={event => setAppealForm(state => ({ ...state, [appeal.id]: { ...current, decision: event.target.value } }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="confirmed">Note confirmée</option><option value="modified">Note modifiée</option><option value="new_attempt">Nouvelle tentative</option></select></Field>
                {current.decision === 'modified' && <Field label="Note finale"><input type="number" min="0" max="100" value={current.score || ''} onChange={event => setAppealForm(state => ({ ...state, [appeal.id]: { ...current, score: event.target.value } }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>}
                <Field label="Motif de la décision"><textarea rows={3} value={current.reason || ''} onChange={event => setAppealForm(state => ({ ...state, [appeal.id]: { ...current, reason: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <Field label="Appréciation finale"><textarea rows={3} value={current.feedback || ''} onChange={event => setAppealForm(state => ({ ...state, [appeal.id]: { ...current, feedback: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <button disabled={working === appeal.id} onClick={() => void resolveAppeal(appeal.id)} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 md:col-span-2" style={{ background: BLUE }}>{working === appeal.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Publier la décision finale</button>
              </div>}
              {appeal.status === 'decided' && <p className="mt-3 text-sm text-green-700">Décision : {appeal.decision} · note finale {appeal.final_score ?? appeal.original_score ?? '—'}% · {appeal.decision_reason}</p>}
            </section>;
          }) : <Empty text="Aucune demande de révision." />)}

          {tab === 'frameworks' && <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <div className="space-y-5">
              <FormCard title="Créer un référentiel" icon={Plus}>
                <Field label="Code"><input value={frameworkForm.code} onChange={event => setFrameworkForm(current => ({ ...current, code: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="EX. OGA-QHSE" /></Field>
                <Field label="Nom"><input value={frameworkForm.name} onChange={event => setFrameworkForm(current => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <Field label="Version"><input value={frameworkForm.version} onChange={event => setFrameworkForm(current => ({ ...current, version: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <Field label="Description"><textarea rows={3} value={frameworkForm.description} onChange={event => setFrameworkForm(current => ({ ...current, description: event.target.value }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <PrimaryButton loading={working === 'framework'} onClick={() => void saveFramework()}>Créer en brouillon</PrimaryButton>
              </FormCard>

              <FormCard title="Ajouter un niveau" icon={Award}>
                <FrameworkSelect value={levelForm.framework_id} frameworks={data.frameworks || []} onChange={value => setLevelForm(current => ({ ...current, framework_id: value }))} />
                <div className="grid grid-cols-2 gap-3"><Field label="Numéro"><input type="number" min="1" max="20" value={levelForm.level_number} onChange={event => setLevelForm(current => ({ ...current, level_number: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Code"><input value={levelForm.code} onChange={event => setLevelForm(current => ({ ...current, code: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field></div>
                <Field label="Nom"><input value={levelForm.name} onChange={event => setLevelForm(current => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <Field label="Description"><textarea rows={2} value={levelForm.description} onChange={event => setLevelForm(current => ({ ...current, description: event.target.value }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <PrimaryButton loading={working === 'level'} onClick={() => void saveLevel()}>Enregistrer le niveau</PrimaryButton>
              </FormCard>

              <FormCard title="Créer une compétence" icon={ShieldCheck}>
                <FrameworkSelect value={competencyForm.framework_id} frameworks={data.frameworks || []} onChange={value => setCompetencyForm(current => ({ ...current, framework_id: value }))} />
                <div className="grid grid-cols-2 gap-3"><Field label="Code"><input value={competencyForm.code} onChange={event => setCompetencyForm(current => ({ ...current, code: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Validité (mois)"><input type="number" min="1" value={competencyForm.validity_months} onChange={event => setCompetencyForm(current => ({ ...current, validity_months: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Sans expiration" /></Field></div>
                <Field label="Nom"><input value={competencyForm.name} onChange={event => setCompetencyForm(current => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="Domaine"><input value={competencyForm.domain} onChange={event => setCompetencyForm(current => ({ ...current, domain: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Catégorie"><input value={competencyForm.category} onChange={event => setCompetencyForm(current => ({ ...current, category: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field></div>
                <Field label="Mode de renouvellement"><select value={competencyForm.renewal_mode} onChange={event => setCompetencyForm(current => ({ ...current, renewal_mode: event.target.value }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="none">Aucun</option><option value="update_training">Formation de mise à jour</option><option value="full_training">Formation complète</option><option value="renewal_exam">Examen de renouvellement</option><option value="new_evidence">Nouvelle preuve</option><option value="expert_validation">Validation d’un expert</option></select></Field>
                <Field label="Description"><textarea rows={3} value={competencyForm.description} onChange={event => setCompetencyForm(current => ({ ...current, description: event.target.value }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
                <PrimaryButton loading={working === 'competency'} onClick={() => void saveCompetency()}>Ajouter la compétence</PrimaryButton>
              </FormCard>
            </div>

            <div className="space-y-4">{data.frameworks?.length ? data.frameworks.map((framework: any) => <section key={framework.id} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{framework.name}</p><p className="mt-1 text-xs text-gray-500">{framework.code} · version {framework.version} · {framework.scope}</p></div><div className="flex gap-2"><Badge text={framework.status} good={framework.status === 'published'} />{framework.status !== 'published' && <Action disabled={working === framework.id} icon={CheckCircle2} label="Publier" onClick={() => void setFrameworkStatus(framework.id, 'published')} />}{framework.status === 'published' && framework.code !== 'OGA-CORE' && <Action disabled={working === framework.id} icon={XCircle} label="Archiver" secondary onClick={() => void setFrameworkStatus(framework.id, 'archived')} />}</div></div>
              {framework.description && <p className="mt-3 text-sm text-gray-600">{framework.description}</p>}
              <div className="mt-4"><p className="text-xs font-semibold text-gray-500">Niveaux</p><div className="mt-2 flex flex-wrap gap-2">{framework.levels?.map((level: any) => <span key={level.id} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{level.code} · {level.name}</span>)}</div></div>
              <div className="mt-4"><p className="text-xs font-semibold text-gray-500">Compétences ({framework.competencies?.length || 0})</p><div className="mt-2 grid gap-2 md:grid-cols-2">{framework.competencies?.map((competency: any) => <div key={competency.id} className="rounded-lg bg-gray-50 p-3 text-xs"><p className="font-semibold" style={{ color: BLUE }}>{competency.code} · {competency.name}</p><p className="mt-1 text-gray-500">{competency.domain || 'Domaine non défini'}{competency.validity_months ? ` · validité ${competency.validity_months} mois` : ' · sans expiration'}</p></div>)}</div></div>
            </section>) : <Empty text="Aucun référentiel." />}</div>
          </div>}
        </div>}
      </div>
    </AdminLayout>
  );
}

function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><Icon size={18} color={GOLD} /><p className="mt-2 text-xs text-gray-500">{label}</p><p className="text-2xl font-bold" style={{ color: BLUE }}>{value}</p></div>; }
function Badge({ text, good = false }: { text: string; good?: boolean }) { return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${good ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{text}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}><Clock3 className="mx-auto mb-2 text-gray-300" />{text}</div>; }
function Action({ label, icon: Icon, onClick, disabled, secondary, danger }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) { return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: secondary ? '#F3F4F6' : danger ? '#FEE2E2' : BLUE, color: secondary ? BLUE : danger ? '#B91C1C' : 'white' }}>{disabled ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}{label}</button>; }
function ThresholdField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span><input type="number" min={min} max={max} value={value} onChange={event => onChange(Math.min(max, Math.max(min, Number(event.target.value))))} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-semibold text-gray-600">{label}<div className="mt-1">{children}</div></label>; }
function FormCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) { return <section className="space-y-3 rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><Icon size={18} color={GOLD} />{title}</h2>{children}</section>; }
function PrimaryButton({ loading, onClick, children }: { loading?: boolean; onClick: () => void; children: ReactNode }) { return <button disabled={loading} onClick={onClick} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{children}</button>; }
function FrameworkSelect({ value, frameworks, onChange }: { value: string; frameworks: any[]; onChange: (value: string) => void }) { return <Field label="Référentiel"><select value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Sélectionner…</option>{frameworks.map(item => <option key={item.id} value={item.id}>{item.name} · {item.version}</option>)}</select></Field>; }
