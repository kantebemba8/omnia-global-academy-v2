import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import {
  AlertCircle, CheckCircle2, FileText, Loader2, Plus, Save, Send, ShieldCheck,
  Upload, Users, XCircle,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StructureLayout } from '../../components/StructureLayout';
import { assessmentGovernanceCall, uploadAssessmentGovernanceFile } from '../../lib/assessmentGovernanceApi';

const BLUE = '#002050'; const GOLD = '#BF8813'; const BORDER = '#E4E7EC';
type Tab = 'manage' | 'my_juries' | 'appeals';

export default function ProfesseurJuries() {
  const location = useLocation();
  const isStructure = location.pathname.startsWith('/structure/');
  const [data, setData] = useState<any>({ courses: [], assessments: [], experts: [], panels: [], attempts: [], assigned_appeals: [] });
  const [juryData, setJuryData] = useState<any>({ panels: [] });
  const [tab, setTab] = useState<Tab>('manage');
  const [loading, setLoading] = useState(true); const [working, setWorking] = useState(''); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [expertFile, setExpertFile] = useState<File | null>(null);
  const [expertForm, setExpertForm] = useState({ full_name: '', email: '', organization_name: '', expertise_domains: '', biography: '' });
  const [panelForm, setPanelForm] = useState({ assessment_id: '', name: '', purpose: '', required_members: '2', quorum: '2', blind_review: true, decision_mode: 'majority' });
  const [memberForms, setMemberForms] = useState<Record<string, { expert_id: string; member_role: string }>>({});
  const [caseForms, setCaseForms] = useState<Record<string, { attempt_id: string; review_due_at: string }>>({});
  const [terms, setTerms] = useState<Record<string, { confidentiality: boolean; conflict: boolean; details: string }>>({});
  const [reviews, setReviews] = useState<Record<string, { score: string; recommendation: string; comment: string; complement_request: string }>>({});
  const [appealForms, setAppealForms] = useState<Record<string, { decision: string; score: string; reason: string; feedback: string }>>({});
  const [finalForms, setFinalForms] = useState<Record<string, { decision: string; score: string; mention: string; comment: string }>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [creator, juries] = await Promise.all([
        assessmentGovernanceCall('creator_overview'),
        assessmentGovernanceCall('jury_overview'),
      ]);
      setData(creator); setJuryData(juries);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const approvedExperts = useMemo(() => (data.experts || []).filter((item: any) => item.status === 'approved'), [data.experts]);
  const selectedAssessment = data.assessments?.find((item: any) => item.id === panelForm.assessment_id);

  async function proposeExpert() {
    if (!expertForm.full_name.trim() || !expertForm.email.trim()) { setError('Le nom et l’adresse e-mail de l’expert sont obligatoires.'); return; }
    setWorking('expert'); setError(''); setSuccess('');
    try {
      const documents = expertFile ? [await uploadAssessmentGovernanceFile(expertFile, 'expert')] : [];
      await assessmentGovernanceCall('creator_propose_expert', { ...expertForm, expertise_domains: expertForm.expertise_domains.split(',').map(item => item.trim()).filter(Boolean), documents });
      setExpertForm({ full_name: '', email: '', organization_name: '', expertise_domains: '', biography: '' }); setExpertFile(null);
      setSuccess('L’expert a été proposé au Super Admin. Aucun accès ne lui est accordé avant validation.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Proposition impossible.'); }
    finally { setWorking(''); }
  }

  async function createPanel() {
    if (!panelForm.assessment_id || !panelForm.name.trim()) { setError('Choisissez une évaluation et nommez le jury.'); return; }
    setWorking('panel'); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('creator_create_panel', { ...panelForm, required_members: Number(panelForm.required_members), quorum: Number(panelForm.quorum) });
      setPanelForm({ assessment_id: '', name: '', purpose: '', required_members: '2', quorum: '2', blind_review: true, decision_mode: 'majority' });
      setSuccess('Le jury a été créé et transmis au Super Admin.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Création impossible.'); }
    finally { setWorking(''); }
  }

  async function addMember(panelId: string) {
    const form = memberForms[panelId] || { expert_id: '', member_role: 'member' };
    if (!form.expert_id) { setError('Choisissez un expert validé.'); return; }
    setWorking(`member-${panelId}`); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('creator_add_panel_member', { panel_id: panelId, expert_id: form.expert_id, member_role: form.member_role });
      setSuccess('Le membre a été ajouté au jury.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ajout impossible.'); }
    finally { setWorking(''); }
  }

  async function assignCase(panelId: string) {
    const form = caseForms[panelId] || { attempt_id: '', review_due_at: '' };
    if (!form.attempt_id) { setError('Choisissez une copie à transmettre au jury.'); return; }
    setWorking(`case-${panelId}`); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('creator_assign_case', { panel_id: panelId, attempt_id: form.attempt_id, review_due_at: form.review_due_at ? new Date(form.review_due_at).toISOString() : null });
      setSuccess('La copie a été affectée au jury avec un identifiant candidat neutre.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Affectation impossible.'); }
    finally { setWorking(''); }
  }

  async function acceptTerms(memberId: string) {
    const current = terms[memberId] || { confidentiality: false, conflict: false, details: '' };
    if (!current.confidentiality) { setError('Vous devez accepter l’engagement de confidentialité.'); return; }
    if (current.conflict && !current.details.trim()) { setError('Décrivez le conflit d’intérêts déclaré.'); return; }
    setWorking(memberId); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('jury_accept_terms', { member_id: memberId, confidentiality_accepted: true, conflict_declared: current.conflict, conflict_details: current.details });
      setSuccess(current.conflict ? 'Le conflit a été déclaré. Le dossier reste bloqué jusqu’au remplacement ou à la décision du Super Admin.' : 'Les engagements ont été acceptés.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Validation impossible.'); }
    finally { setWorking(''); }
  }

  async function saveReview(memberId: string, caseId: string, publish: boolean) {
    const current = reviews[caseId] || { score: '', recommendation: 'pass', comment: '', complement_request: '' };
    setWorking(caseId); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('jury_save_review', { member_id: memberId, case_id: caseId, score: Number(current.score || 0), recommendation: current.recommendation, comment: current.comment, complement_request: current.complement_request, publish });
      setSuccess(publish ? 'Votre évaluation a été signée et transmise à la délibération.' : 'Votre brouillon a été enregistré.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.'); }
    finally { setWorking(''); }
  }

  async function finalizeCase(caseId: string) {
    const current = finalForms[caseId] || { decision: 'passed', score: '', mention: '', comment: '' };
    if (current.score === '' || Number.isNaN(Number(current.score))) { setError('Indiquez la note finale du jury.'); return; }
    if (!current.comment.trim()) { setError('La décision finale du jury doit être motivée.'); return; }
    setWorking(`final-${caseId}`); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('jury_finalize_case', { case_id: caseId, final_decision: current.decision, final_score: Number(current.score), final_mention: current.mention, final_comment: current.comment });
      setSuccess('La décision finale du jury a été publiée et les compétences ont été synchronisées.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Délibération impossible.'); }
    finally { setWorking(''); }
  }

  async function resolveAppeal(appealId: string) {
    const current = appealForms[appealId] || { decision: 'confirmed', score: '', reason: '', feedback: '' };
    if (!current.reason.trim()) { setError('La décision doit être motivée.'); return; }
    setWorking(appealId); setError(''); setSuccess('');
    try {
      await assessmentGovernanceCall('reviewer_resolve_appeal', { appeal_id: appealId, decision: current.decision, final_score: current.decision === 'modified' ? Number(current.score) : undefined, decision_reason: current.reason, final_feedback: current.feedback });
      setSuccess('La révision a été traitée et son historique a été conservé.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  const content = <div className="mx-auto max-w-7xl p-6 lg:p-8">
    <div><h1 className="text-2xl font-bold" style={{ color: BLUE }}>Jurys et révisions</h1><p className="mt-1 text-sm text-gray-500">Proposez des experts, constituez un jury limité à une évaluation et traitez uniquement les dossiers qui vous sont affectés.</p></div>
    {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
    {success && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}
    <div className="mt-6 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: BORDER }}>
      <TabButton active={tab === 'manage'} onClick={() => setTab('manage')}>Constituer les jurys</TabButton>
      <TabButton active={tab === 'my_juries'} onClick={() => setTab('my_juries')}>Mes dossiers de jury ({juryData.panels?.length || 0})</TabButton>
      <TabButton active={tab === 'appeals'} onClick={() => setTab('appeals')}>Révisions affectées ({data.assigned_appeals?.length || 0})</TabButton>
    </div>
    {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : <div className="mt-6">
      {tab === 'manage' && <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <div className="space-y-5">
          <Card title="Proposer un expert" icon={Users}>
            <Field label="Nom complet"><input value={expertForm.full_name} onChange={event => setExpertForm(current => ({ ...current, full_name: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
            <Field label="E-mail"><input type="email" value={expertForm.email} onChange={event => setExpertForm(current => ({ ...current, email: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
            <Field label="Organisation"><input value={expertForm.organization_name} onChange={event => setExpertForm(current => ({ ...current, organization_name: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
            <Field label="Domaines d’expertise"><input value={expertForm.expertise_domains} onChange={event => setExpertForm(current => ({ ...current, expertise_domains: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Audit, ISO 45001, cybersécurité…" /></Field>
            <Field label="Présentation"><textarea rows={3} value={expertForm.biography} onChange={event => setExpertForm(current => ({ ...current, biography: event.target.value }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold" style={{ borderColor: GOLD, color: BLUE }}><Upload size={16} />Joindre un justificatif<input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={event => setExpertFile(event.target.files?.[0] || null)} /></label>
            {expertFile && <p className="text-xs text-green-700">{expertFile.name}</p>}
            <Primary loading={working === 'expert'} onClick={() => void proposeExpert()}>Proposer au Super Admin</Primary>
          </Card>

          <Card title="Créer un jury" icon={ShieldCheck}>
            <Field label="Évaluation"><select value={panelForm.assessment_id} onChange={event => setPanelForm(current => ({ ...current, assessment_id: event.target.value, name: current.name || `Jury — ${data.assessments.find((item: any) => item.id === event.target.value)?.title || ''}` }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Sélectionner…</option>{data.assessments?.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
            {selectedAssessment && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Paramètre Studio : {selectedAssessment.jury_required ? 'jury obligatoire' : 'jury facultatif'} · décision {selectedAssessment.jury_decision_mode}.</p>}
            <Field label="Nom"><input value={panelForm.name} onChange={event => setPanelForm(current => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
            <Field label="Objet"><textarea rows={2} value={panelForm.purpose} onChange={event => setPanelForm(current => ({ ...current, purpose: event.target.value }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Membres requis"><input type="number" min="1" max="15" value={panelForm.required_members} onChange={event => setPanelForm(current => ({ ...current, required_members: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Quorum"><input type="number" min="1" max="15" value={panelForm.quorum} onChange={event => setPanelForm(current => ({ ...current, quorum: event.target.value }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field></div>
            <Field label="Décision"><select value={panelForm.decision_mode} onChange={event => setPanelForm(current => ({ ...current, decision_mode: event.target.value }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="majority">Majorité</option><option value="unanimous">Unanimité</option><option value="president_final">Décision finale du président</option></select></Field>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={panelForm.blind_review} onChange={event => setPanelForm(current => ({ ...current, blind_review: event.target.checked }))} />Masquer l’identité du candidat</label>
            <Primary loading={working === 'panel'} onClick={() => void createPanel()}>Créer et transmettre</Primary>
          </Card>
        </div>

        <div className="space-y-4">{data.panels?.length ? data.panels.map((panel: any) => {
          const memberForm = memberForms[panel.id] || { expert_id: '', member_role: 'member' };
          const caseForm = caseForms[panel.id] || { attempt_id: '', review_due_at: '' };
          const attempts = (data.attempts || []).filter((attempt: any) => attempt.assessment_id === panel.assessment_id && !(panel.cases || []).some((juryCase: any) => juryCase.attempt_id === attempt.id));
          return <section key={panel.id} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{panel.name}</p><p className="mt-1 text-xs text-gray-500">{panel.status} · quorum {panel.quorum}/{panel.required_members} · {panel.decision_mode}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{panel.members?.length || 0} membre(s) · {panel.cases?.length || 0} dossier(s)</span></div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4"><p className="text-sm font-semibold" style={{ color: BLUE }}>Ajouter un expert validé</p><div className="mt-3 grid gap-2"><select value={memberForm.expert_id} onChange={event => setMemberForms(current => ({ ...current, [panel.id]: { ...memberForm, expert_id: event.target.value } }))} className="h-10 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Sélectionner…</option>{approvedExperts.map((expert: any) => <option key={expert.id} value={expert.id}>{expert.full_name} · {expert.email}</option>)}</select><select value={memberForm.member_role} onChange={event => setMemberForms(current => ({ ...current, [panel.id]: { ...memberForm, member_role: event.target.value } }))} className="h-10 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="member">Membre</option><option value="president">Président</option><option value="rapporteur">Rapporteur</option><option value="observer">Observateur</option></select><button disabled={working === `member-${panel.id}`} onClick={() => void addMember(panel.id)} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{working === `member-${panel.id}` ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Ajouter</button></div></div>
              <div className="rounded-lg bg-gray-50 p-4"><p className="text-sm font-semibold" style={{ color: BLUE }}>Affecter une copie</p>{['approved', 'active', 'deliberating'].includes(panel.status) ? <div className="mt-3 grid gap-2"><select value={caseForm.attempt_id} onChange={event => setCaseForms(current => ({ ...current, [panel.id]: { ...caseForm, attempt_id: event.target.value } }))} className="h-10 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Sélectionner…</option>{attempts.map((attempt: any) => <option key={attempt.id} value={attempt.id}>{attempt.users?.full_name || 'Apprenant'} · tentative {attempt.attempt_number} · {attempt.score ?? 'sans note'}%</option>)}</select><input type="datetime-local" value={caseForm.review_due_at} onChange={event => setCaseForms(current => ({ ...current, [panel.id]: { ...caseForm, review_due_at: event.target.value } }))} className="h-10 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }} /><button disabled={working === `case-${panel.id}`} onClick={() => void assignCase(panel.id)} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{working === `case-${panel.id}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Affecter au jury</button></div> : <p className="mt-3 text-xs text-amber-700">Le Super Admin doit d’abord valider le jury et ses membres.</p>}</div>
            </div>
            {panel.members?.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{panel.members.map((member: any) => <div key={member.id} className="rounded-lg border p-3 text-xs" style={{ borderColor: BORDER }}><p className="font-semibold" style={{ color: BLUE }}>{member.external_name} · {member.member_role}</p><p className="mt-1 text-gray-500">{member.status} · confidentialité {member.confidentiality_accepted_at ? 'acceptée' : 'en attente'} · conflit {member.conflict_status}</p></div>)}</div>}
          </section>;
        }) : <Empty text="Aucun jury créé." />}</div>
      </div>}

      {tab === 'my_juries' && <div className="space-y-5">{juryData.panels?.length ? juryData.panels.map((entry: any) => {
        const member = entry.member; const term = terms[member.id] || { confidentiality: false, conflict: false, details: '' };
        return <section key={member.id} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{entry.panel.name}</p><p className="mt-1 text-xs text-gray-500">Vous intervenez comme {member.member_role} · accès limité à ce jury</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{member.status}</span></div>
          {!member.confidentiality_accepted_at || member.conflict_status === 'pending' ? <div className="mt-4 rounded-xl bg-gray-50 p-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={term.confidentiality} onChange={event => setTerms(current => ({ ...current, [member.id]: { ...term, confidentiality: event.target.checked } }))} />J’accepte la confidentialité et l’utilisation limitée des données.</label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={term.conflict} onChange={event => setTerms(current => ({ ...current, [member.id]: { ...term, conflict: event.target.checked } }))} />Je déclare un conflit d’intérêts.</label>{term.conflict && <textarea rows={3} value={term.details} onChange={event => setTerms(current => ({ ...current, [member.id]: { ...term, details: event.target.value } }))} className="mt-3 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Décrivez le conflit…" />}<button disabled={working === member.id} onClick={() => void acceptTerms(member.id)} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>Valider mes déclarations</button></div> : member.conflict_status === 'declared' ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Le dossier est bloqué à la suite de votre déclaration de conflit d’intérêts.</p> : <div className="mt-4 space-y-4">{entry.cases?.map((juryCase: any) => {
            const current = reviews[juryCase.id] || { score: juryCase.review?.score ?? '', recommendation: juryCase.review?.recommendation || 'pass', comment: juryCase.review?.comment || '', complement_request: juryCase.review?.complement_request || '' };
            return <div key={juryCase.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{juryCase.assessment?.title || 'Évaluation'} · {juryCase.candidate?.full_name}</p><p className="mt-1 text-xs text-gray-500">Tentative {juryCase.attempt?.attempt_number} · dossier {juryCase.status}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{juryCase.review?.status || 'non commencé'}</span></div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]"><div><p className="text-xs font-semibold text-gray-500">Réponses</p><div className="mt-2 space-y-2">{juryCase.answers?.map((answer: any, index: number) => <div key={answer.id} className="rounded-lg bg-gray-50 p-3 text-sm"><p className="font-semibold" style={{ color: BLUE }}>{index + 1}. {answer.assessment_questions?.prompt || 'Question'}</p><pre className="mt-2 whitespace-pre-wrap font-sans text-gray-700">{JSON.stringify(answer.answer_json, null, 2)}</pre></div>)}</div>{juryCase.files?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{juryCase.files.map((file: any) => <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name}</a>)}</div>}</div>
                <div className="space-y-3 rounded-lg bg-gray-50 p-4"><Field label="Note sur 100"><input type="number" min="0" max="100" value={current.score} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, score: event.target.value } }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Recommandation"><select value={current.recommendation} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, recommendation: event.target.value } }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="pass">Réussite</option><option value="fail">Échec</option><option value="retry">Nouvelle tentative</option><option value="complement">Complément demandé</option></select></Field><Field label="Commentaire"><textarea rows={4} value={current.comment} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, comment: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>{member.permissions?.request_complement && <Field label="Complément demandé"><textarea rows={2} value={current.complement_request} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, complement_request: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>}<div className="grid grid-cols-2 gap-2"><button disabled={working === juryCase.id} onClick={() => void saveReview(member.id, juryCase.id, false)} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Save size={14} />Brouillon</button><button disabled={working === juryCase.id} onClick={() => void saveReview(member.id, juryCase.id, true)} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ background: BLUE }}><Send size={14} />Signer</button></div></div></div>
              {member.member_role === 'president' && member.permissions?.sign_decision === true && ['ready', 'deliberating'].includes(juryCase.status) && (() => { const final = finalForms[juryCase.id] || { decision: 'passed', score: '', mention: '', comment: '' }; return <div className="mt-4 rounded-xl border p-4" style={{ borderColor: GOLD }}><p className="text-sm font-semibold" style={{ color: BLUE }}>Décision finale du président</p><p className="mt-1 text-xs text-gray-500">Le quorum est atteint. La note initiale et tous les avis restent conservés dans l’historique.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Décision"><select value={final.decision} onChange={event => setFinalForms(state => ({ ...state, [juryCase.id]: { ...final, decision: event.target.value } }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="passed">Réussite</option><option value="failed">Échec</option><option value="retry">Nouvelle tentative</option><option value="complement_required">Complément demandé</option></select></Field><Field label="Note finale sur 100"><input type="number" min="0" max="100" value={final.score} onChange={event => setFinalForms(state => ({ ...state, [juryCase.id]: { ...final, score: event.target.value } }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Mention facultative"><input value={final.mention} onChange={event => setFinalForms(state => ({ ...state, [juryCase.id]: { ...final, mention: event.target.value } }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Motivation de la décision"><textarea rows={3} value={final.comment} onChange={event => setFinalForms(state => ({ ...state, [juryCase.id]: { ...final, comment: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field><button disabled={working === `final-${juryCase.id}`} onClick={() => void finalizeCase(juryCase.id)} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white md:col-span-2" style={{ background: BLUE }}><CheckCircle2 size={15} />Publier la décision du jury</button></div></div>; })()}
            </div>;
          })}{!entry.cases?.length && <Empty text="Aucun dossier affecté." />}</div>}
        </section>;
      }) : <Empty text="Vous ne participez actuellement à aucun jury." />}</div>}

      {tab === 'appeals' && <div className="space-y-4">{data.assigned_appeals?.length ? data.assigned_appeals.map((appeal: any) => {
        const current = appealForms[appeal.id] || { decision: 'confirmed', score: '', reason: '', feedback: '' };
        return <section key={appeal.id} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><p className="font-semibold" style={{ color: BLUE }}>{appeal.attempt?.course_assessments?.title || 'Évaluation'} · {appeal.attempt?.users?.full_name || 'Apprenant'}</p><p className="mt-1 text-xs text-gray-500">Note initiale {appeal.original_score ?? appeal.attempt?.score ?? '—'}%</p><p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">{appeal.reason}</p>{appeal.evidence?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{appeal.evidence.map((file: any, index: number) => <a key={index} href={file.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name || 'Preuve'}</a>)}</div>}{appeal.files?.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-gray-500">Copie originale</p><div className="mt-2 flex flex-wrap gap-2">{appeal.files.map((file: any) => <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name}</a>)}</div></div>}{appeal.previous_corrections?.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-gray-500">Correction précédente</p><div className="mt-2 flex flex-wrap gap-2">{appeal.previous_corrections.map((file: any) => <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.corrected_file_name || 'Copie corrigée'}</a>)}</div></div>}<div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Décision"><select value={current.decision} onChange={event => setAppealForms(state => ({ ...state, [appeal.id]: { ...current, decision: event.target.value } }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="confirmed">Confirmer la note</option><option value="modified">Modifier la note</option><option value="new_attempt">Autoriser une nouvelle tentative</option></select></Field>{current.decision === 'modified' && <Field label="Note finale"><input type="number" min="0" max="100" value={current.score} onChange={event => setAppealForms(state => ({ ...state, [appeal.id]: { ...current, score: event.target.value } }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>}<Field label="Motif"><textarea rows={3} value={current.reason} onChange={event => setAppealForms(state => ({ ...state, [appeal.id]: { ...current, reason: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field><Field label="Commentaire final"><textarea rows={3} value={current.feedback} onChange={event => setAppealForms(state => ({ ...state, [appeal.id]: { ...current, feedback: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field><button disabled={working === appeal.id} onClick={() => void resolveAppeal(appeal.id)} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white md:col-span-2" style={{ background: BLUE }}><CheckCircle2 size={15} />Publier la décision</button></div></section>;
      }) : <Empty text="Aucune demande de révision ne vous est affectée." />}</div>}
    </div>}
  </div>;

  return isStructure ? <StructureLayout>{content}</StructureLayout> : <DashboardLayout role="professeur">{content}</DashboardLayout>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) { return <section className="space-y-3 rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><Icon size={18} color={GOLD} />{title}</h2>{children}</section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-semibold text-gray-600">{label}<div className="mt-1">{children}</div></label>; }
function Primary({ loading, onClick, children }: { loading?: boolean; onClick: () => void; children: ReactNode }) { return <button disabled={loading} onClick={onClick} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{children}</button>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: active ? BLUE : '#F3F4F6', color: active ? 'white' : '#4B5563' }}>{children}</button>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}>{text}</div>; }
