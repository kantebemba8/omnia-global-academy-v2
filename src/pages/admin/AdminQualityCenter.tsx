import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  ShieldCheck, RefreshCw, Search, ClipboardCheck, AlertTriangle, CheckCircle2,
  Clock3, FileText, Activity, Plus, X, Save, Send, Ban,
  CalendarDays, BadgeCheck, Bot
} from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quality-center`;
const BLUE = '#002050';
const GOLD = '#BF8813';

type Tab = 'queue' | 'criteria' | 'audits' | 'nonconformities' | 'ai';

type Review = {
  id: string;
  entity_type: 'course' | 'assessment';
  status: string;
  review_type: string;
  accelerated: boolean;
  created_at: string;
  course?: any;
  assessment?: any;
  submitter?: any;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'À contrôler', in_review: 'En contrôle',
  changes_requested: 'Modifications demandées', approved: 'Validé', rejected: 'Refusé',
  suspended: 'Suspendu', archived: 'Archivé',
};

export default function AdminQualityCenter() {
  const [tab, setTab] = useState<Tab>('queue');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [selected, setSelected] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [nonconformities, setNonconformities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [decision, setDecision] = useState<any>(null);
  const [changeForm, setChangeForm] = useState<any>(null);
  const [criterionForm, setCriterionForm] = useState<any>(null);
  const [auditForm, setAuditForm] = useState<any>(null);
  const [ncForm, setNcForm] = useState<any>(null);
  const [aiGovernance, setAiGovernance] = useState<any>(null);
  const [aiLogs, setAiLogs] = useState<any[]>([]);

  async function call(action: string, body: any = {}) {
    const response = await fetch(API, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action, ...body }),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
    return data;
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }

  async function loadQueue() {
    setLoading(true); setError('');
    try {
      const data = await call('admin_dashboard', { status: statusFilter });
      setReviews(data.reviews || []);
      setSummary(data.summary || {});
      if (selected?.review?.id) await openReview(selected.review.id, false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de chargement'); }
    finally { setLoading(false); }
  }

  async function openReview(reviewId: string, markLoading = true) {
    if (markLoading) setBusy(`open:${reviewId}`);
    try {
      const data = await call('admin_review_get', { review_id: reviewId });
      setSelected(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’ouvrir le contrôle'); }
    finally { if (markLoading) setBusy(''); }
  }

  async function loadCriteria() {
    setLoading(true);
    try { const data = await call('admin_list_criteria'); setCriteria(data.criteria || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  }

  async function loadAudits() {
    setLoading(true);
    try { const data = await call('admin_list_audits'); setAudits(data.audits || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  }


  async function loadAiGovernance() {
    setLoading(true); setError('');
    try { const data = await call('admin_ai_governance_get'); setAiGovernance(data.governance || {}); setAiLogs(data.logs || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur de chargement'); }
    finally { setLoading(false); }
  }

  async function saveAiGovernance() {
    if (!aiGovernance) return;
    setBusy('ai-governance');
    try { const data = await call('admin_ai_governance_save', aiGovernance); setAiGovernance(data.governance); notify('Gouvernance de l’assistant enregistrée.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setBusy(''); }
  }
  async function loadNonconformities() {
    setLoading(true);
    try { const data = await call('admin_list_nonconformities'); setNonconformities(data.nonconformities || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === 'queue') loadQueue();
    if (tab === 'criteria') loadCriteria();
    if (tab === 'audits') loadAudits();
    if (tab === 'nonconformities') loadNonconformities();
    if (tab === 'ai') loadAiGovernance();
  }, [tab, statusFilter]);

  const filteredReviews = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((review) => `${review.course?.title || ''} ${review.assessment?.title || ''} ${review.submitter?.full_name || ''}`.toLowerCase().includes(q));
  }, [reviews, query]);

  async function startReview() {
    if (!selected?.review) return;
    setBusy('start');
    try {
      await call('admin_review_start', { review_id: selected.review.id });
      await openReview(selected.review.id, false); await loadQueue(); notify('Contrôle démarré.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(''); }
  }

  async function saveItem(item: any, patch: any) {
    setBusy(`item:${item.id}`);
    try {
      await call('admin_save_item', { item_id: item.id, status: patch.status ?? item.status, score: patch.score ?? item.score, comment: patch.comment ?? item.comment, required_action: patch.required_action ?? item.required_action, evidence: item.evidence || [] });
      await openReview(selected.review.id, false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(''); }
  }

  async function submitDecision() {
    if (!selected?.review || !decision?.type) return;
    setBusy('decision');
    try {
      if (decision.type === 'fast_track') {
        await call('admin_fast_track', { course_id: selected.review.course_id, summary: decision.summary, publish: decision.publish !== false, cpd_status: decision.cpd_status || 'pending', review_months: Number(decision.review_months || 12) });
      } else {
        await call('admin_decide', { review_id: selected.review.id, decision: decision.type, summary: decision.summary, publish: !!decision.publish, cpd_status: decision.cpd_status || selected.review.cpd_status, cpd_notes: decision.cpd_notes, review_months: Number(decision.review_months || 12) });
      }
      setDecision(null); setSelected(null); await loadQueue(); notify('Décision enregistrée et tracée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Décision impossible'); }
    finally { setBusy(''); }
  }

  async function addChangeRequest() {
    if (!selected?.review || !changeForm) return;
    setBusy('change');
    try {
      await call('admin_add_change_request', { review_id: selected.review.id, ...changeForm });
      setChangeForm(null); await openReview(selected.review.id, false); notify('Demande de modification ajoutée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(''); }
  }

  async function saveCriterion() {
    setBusy('criterion');
    try {
      await call('admin_save_criterion', criterionForm);
      setCriterionForm(null); await loadCriteria(); notify('Critère enregistré.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(''); }
  }

  async function saveAudit() {
    setBusy('audit');
    try { await call('admin_save_audit', auditForm); setAuditForm(null); await loadAudits(); notify('Audit enregistré.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(''); }
  }

  async function saveNonconformity() {
    setBusy('nc');
    try { await call('admin_save_nonconformity', ncForm); setNcForm(null); await loadNonconformities(); notify('Non-conformité enregistrée.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(''); }
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {toast && <div className="fixed top-4 right-4 z-[120] bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 text-sm font-semibold" style={{ color: BLUE }}>{toast}</div>}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-gray-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: GOLD }}>Programme qualité Omnia</p>
            <h1 className="text-2xl font-black mt-1" style={{ color: BLUE }}>Centre Qualité</h1>
            <p className="text-sm text-gray-500 mt-1">Contrôles pédagogiques, évaluations, conformité CPD, audits et actions correctives.</p>
          </div>
          <button onClick={() => tab === 'queue' ? loadQueue() : tab === 'criteria' ? loadCriteria() : tab === 'audits' ? loadAudits() : tab === 'nonconformities' ? loadNonconformities() : loadAiGovernance()} className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"><RefreshCw size={15}/>Actualiser</button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {[
            ['queue', 'Contrôles', ShieldCheck], ['criteria', 'Grilles de critères', ClipboardCheck],
            ['audits', 'Audits', Activity], ['nonconformities', 'Non-conformités', AlertTriangle], ['ai', 'Assistant pédagogique', Bot],
          ].map(([key, label, Icon]: any) => <button key={key} onClick={() => { setTab(key); setSelected(null); }} className="inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2" style={{ color: tab === key ? BLUE : '#6B7280', borderColor: tab === key ? GOLD : 'transparent' }}><Icon size={16}/>{label}</button>)}
        </div>

        {error && <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {tab === 'ai' && <section className="space-y-5">
          {loading ? <p className="text-sm text-gray-400">Chargement…</p> : aiGovernance && <>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 border-y border-gray-200 py-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div><h2 className="font-black" style={{ color: BLUE }}>Gouvernance de l’assistant pédagogique</h2><p className="mt-1 text-sm text-gray-500">L’assistant répond uniquement à partir des formations publiées et validées. Les réglages ci-dessous s’appliquent à toute la plateforme.</p></div>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={aiGovernance.enabled !== false} onChange={(e) => setAiGovernance({ ...aiGovernance, enabled: e.target.checked })}/>Activé</label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs text-gray-500">Limite par heure<input type="number" min={1} max={200} value={aiGovernance.hourly_limit || 20} onChange={(e) => setAiGovernance({ ...aiGovernance, hourly_limit: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
                  <label className="text-xs text-gray-500">Longueur maximale<input type="number" min={200} max={4000} value={aiGovernance.max_tokens || 1000} onChange={(e) => setAiGovernance({ ...aiGovernance, max_tokens: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
                  <label className="text-xs text-gray-500">Sources consultées<input type="number" min={1} max={12} value={aiGovernance.max_chunks || 6} onChange={(e) => setAiGovernance({ ...aiGovernance, max_chunks: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label>
                </div>
                <div><p className="text-xs font-bold uppercase text-gray-500">Fonctions autorisées</p><div className="mt-2 flex flex-wrap gap-3">{[['question','Questions'],['explanation','Explications'],['reformulation','Reformulations'],['exercise','Exercices'],['revision_plan','Plans de révision'],['recommendation','Recommandations']].map(([key,label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(aiGovernance.allowed_modes || []).includes(key)} onChange={(e) => { const current = aiGovernance.allowed_modes || []; setAiGovernance({ ...aiGovernance, allowed_modes: e.target.checked ? [...new Set([...current,key])] : current.filter((x:string) => x !== key) }); }}/>{label}</label>)}</div></div>
                <button onClick={saveAiGovernance} disabled={busy === 'ai-governance'} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={15}/>{busy === 'ai-governance' ? 'Enregistrement…' : 'Enregistrer la gouvernance'}</button>
              </div>
              <div className="border-y border-gray-200 py-5"><ShieldCheck size={22} color={GOLD}/><h3 className="mt-3 font-bold" style={{ color: BLUE }}>Protections actives</h3><div className="mt-3 space-y-2 text-sm text-gray-600"><p>Formation publiée et validée obligatoire.</p><p>Réponses limitées aux sources indexées.</p><p>Refus des évaluations réalisées à la place de l’apprenant.</p><p>Traçabilité des usages pour le Centre Qualité.</p></div></div>
            </div>
            <div><h2 className="font-black" style={{ color: BLUE }}>Utilisations récentes</h2><div className="mt-3 overflow-x-auto border-y border-gray-200"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500"><th className="py-3 pr-4">Utilisateur</th><th className="py-3 pr-4">Formation</th><th className="py-3 pr-4">Fonction</th><th className="py-3 pr-4">Résultat</th><th className="py-3">Date</th></tr></thead><tbody>{aiLogs.length === 0 ? <tr><td colSpan={5} className="py-6 text-gray-400">Aucune utilisation enregistrée.</td></tr> : aiLogs.map((log:any) => <tr key={log.id} className="border-t"><td className="py-3 pr-4">{log.user?.full_name || log.user?.email || 'Utilisateur'}</td><td className="py-3 pr-4">{log.course?.title || 'Formation'}</td><td className="py-3 pr-4">{log.mode}</td><td className="py-3 pr-4">{log.status === 'answered' ? 'Réponse fournie' : log.status === 'no_context' ? 'Source insuffisante' : log.status}</td><td className="py-3">{new Date(log.created_at).toLocaleString('fr-FR')}</td></tr>)}</tbody></table></div></div>
          </>}
        </section>}

        {tab === 'queue' && <>
          <div className="grid grid-cols-2 lg:grid-cols-6 border-y border-gray-200">
            {[
              ['À contrôler', summary.waiting, Clock3], ['En contrôle', summary.in_review, Activity], ['Corrections', summary.changes, FileText],
              ['Validés', summary.approved, CheckCircle2], ['Non-conformités', summary.nonconformities, AlertTriangle], ['Audits', summary.audits, CalendarDays],
            ].map(([label, value, Icon]: any, index) => <div key={label} className={`p-4 ${index < 5 ? 'lg:border-r border-gray-200' : ''}`}><Icon size={17} color={GOLD}/><p className="text-xl font-black mt-2" style={{ color: BLUE }}>{value ?? 0}</p><p className="text-xs text-gray-500">{label}</p></div>)}
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1"><Search size={16} className="absolute left-3 top-2.5 text-gray-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une formation, une évaluation ou un auteur" className="w-full border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-sm"/></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"><option value="all">Tous les statuts</option><option value="submitted">À contrôler</option><option value="in_review">En contrôle</option><option value="changes_requested">Modifications</option><option value="approved">Validés</option><option value="rejected">Refusés</option><option value="suspended">Suspendus</option></select>
          </div>
          <div className="grid lg:grid-cols-[360px_1fr] border-y border-gray-200 min-h-[620px]">
            <div className="border-r border-gray-200 overflow-y-auto max-h-[760px]">
              {loading ? <p className="p-6 text-sm text-gray-400">Chargement…</p> : filteredReviews.length === 0 ? <p className="p-6 text-sm text-gray-400">Aucun contrôle.</p> : filteredReviews.map((review) => {
                const active = selected?.review?.id === review.id;
                return <button key={review.id} onClick={() => openReview(review.id)} className="w-full text-left p-4 border-b border-gray-100" style={{ background: active ? '#F4F7FB' : 'white' }}>
                  <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold uppercase" style={{ color: review.entity_type === 'course' ? BLUE : GOLD }}>{review.entity_type === 'course' ? 'Formation' : 'Évaluation'}</span><span className="text-xs text-gray-500">{STATUS_LABELS[review.status] || review.status}</span></div>
                  <p className="font-semibold text-sm mt-1" style={{ color: BLUE }}>{review.entity_type === 'course' ? review.course?.title : review.assessment?.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{review.submitter?.full_name || 'Créateur'} · {review.accelerated ? 'procédure accélérée' : 'procédure standard'}</p>
                </button>;
              })}
            </div>
            <div className="p-5 overflow-y-auto max-h-[760px]">
              {!selected ? <div className="h-full flex items-center justify-center text-center"><div><ShieldCheck size={38} className="mx-auto text-gray-200"/><p className="text-sm text-gray-400 mt-3">Sélectionnez un contrôle pour examiner le dossier.</p></div></div> : <ReviewDetail data={selected} busy={busy} onStart={startReview} onSaveItem={saveItem} onDecision={setDecision} onChange={() => setChangeForm({ title: '', description: '', severity: 'major', criterion_id: null })}/>} 
            </div>
          </div>
        </>}

        {tab === 'criteria' && <div className="space-y-4">
          <div className="flex justify-end"><button onClick={() => setCriterionForm({ code: '', name: '', description: '', category: 'pedagogie', entity_type: 'course', weight: 1, is_required: true, cpd_relevant: false, active: true })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: BLUE }}><Plus size={15}/>Créer un critère</button></div>
          <div className="overflow-x-auto border-t border-gray-200"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-3">Critère</th><th>Catégorie</th><th>Périmètre</th><th>Poids</th><th>Obligatoire</th><th>CPD</th></tr></thead><tbody>{criteria.map((criterion) => <tr key={criterion.id} onClick={() => setCriterionForm(criterion)} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"><td className="py-3"><p className="font-semibold" style={{ color: BLUE }}>{criterion.name}</p><p className="text-xs text-gray-400">{criterion.code}</p></td><td>{criterion.category}</td><td>{criterion.entity_type}</td><td>{criterion.weight}</td><td>{criterion.is_required ? 'Oui' : 'Non'}</td><td>{criterion.cpd_relevant ? 'Oui' : 'Non'}</td></tr>)}</tbody></table></div>
        </div>}

        {tab === 'audits' && <div className="space-y-4">
          <div className="flex justify-end"><button onClick={() => setAuditForm({ title: '', audit_type: 'periodic', status: 'planned', scheduled_for: '', course_id: '' })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: BLUE }}><Plus size={15}/>Planifier un audit</button></div>
          <div className="space-y-2">{audits.map((audit) => <button key={audit.id} onClick={() => setAuditForm(audit)} className="w-full text-left border-y border-gray-200 py-4 flex items-center justify-between"><div><p className="font-semibold" style={{ color: BLUE }}>{audit.title}</p><p className="text-xs text-gray-500">{audit.course?.title || 'Périmètre général'} · {audit.audit_type}</p></div><span className="text-xs font-semibold">{audit.status}</span></button>)}</div>
        </div>}

        {tab === 'nonconformities' && <div className="space-y-4">
          <div className="flex justify-end"><button onClick={() => setNcForm({ code: '', title: '', description: '', severity: 'major', status: 'open', course_id: '' })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: BLUE }}><Plus size={15}/>Créer une non-conformité</button></div>
          <div className="space-y-2">{nonconformities.map((item) => <button key={item.id} onClick={() => setNcForm(item)} className="w-full text-left border-y border-gray-200 py-4 flex items-center justify-between"><div><p className="font-semibold" style={{ color: BLUE }}>{item.code} — {item.title}</p><p className="text-xs text-gray-500">{item.course?.title || 'Périmètre général'} · {item.severity}</p></div><span className="text-xs font-semibold">{item.status}</span></button>)}</div>
        </div>}

        {decision && <DecisionModal value={decision} onChange={setDecision} onClose={() => setDecision(null)} onSubmit={submitDecision} busy={busy === 'decision'}/>} 
        {changeForm && <SimpleModal title="Demander une modification" onClose={() => setChangeForm(null)} onSubmit={addChangeRequest} busy={busy === 'change'}><input value={changeForm.title} onChange={(e) => setChangeForm({ ...changeForm, title: e.target.value })} placeholder="Titre" className="w-full border rounded-lg px-3 py-2 text-sm"/><textarea value={changeForm.description} onChange={(e) => setChangeForm({ ...changeForm, description: e.target.value })} placeholder="Modification attendue" className="w-full border rounded-lg px-3 py-2 text-sm min-h-28"/><select value={changeForm.severity} onChange={(e) => setChangeForm({ ...changeForm, severity: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="minor">Mineure</option><option value="major">Majeure</option><option value="critical">Critique</option></select></SimpleModal>}
        {criterionForm && <SimpleModal title="Critère qualité" onClose={() => setCriterionForm(null)} onSubmit={saveCriterion} busy={busy === 'criterion'}><input value={criterionForm.code || ''} onChange={(e) => setCriterionForm({ ...criterionForm, code: e.target.value })} placeholder="Code" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={criterionForm.name || ''} onChange={(e) => setCriterionForm({ ...criterionForm, name: e.target.value })} placeholder="Nom" className="w-full border rounded-lg px-3 py-2 text-sm"/><textarea value={criterionForm.description || ''} onChange={(e) => setCriterionForm({ ...criterionForm, description: e.target.value })} placeholder="Description" className="w-full border rounded-lg px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-3"><select value={criterionForm.entity_type} onChange={(e) => setCriterionForm({ ...criterionForm, entity_type: e.target.value })} className="border rounded-lg px-3 py-2 text-sm"><option value="course">Formation</option><option value="assessment">Évaluation</option><option value="both">Les deux</option></select><input type="number" value={criterionForm.weight} onChange={(e) => setCriterionForm({ ...criterionForm, weight: Number(e.target.value) })} className="border rounded-lg px-3 py-2 text-sm"/></div><label className="text-sm"><input type="checkbox" checked={!!criterionForm.is_required} onChange={(e) => setCriterionForm({ ...criterionForm, is_required: e.target.checked })}/> Obligatoire</label><label className="text-sm"><input type="checkbox" checked={!!criterionForm.cpd_relevant} onChange={(e) => setCriterionForm({ ...criterionForm, cpd_relevant: e.target.checked })}/> Pertinent CPD</label></SimpleModal>}
        {auditForm && <SimpleModal title="Audit qualité" onClose={() => setAuditForm(null)} onSubmit={saveAudit} busy={busy === 'audit'}><input value={auditForm.title || ''} onChange={(e) => setAuditForm({ ...auditForm, title: e.target.value })} placeholder="Titre" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={auditForm.course_id || ''} onChange={(e) => setAuditForm({ ...auditForm, course_id: e.target.value })} placeholder="ID de la formation" className="w-full border rounded-lg px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-3"><select value={auditForm.audit_type} onChange={(e) => setAuditForm({ ...auditForm, audit_type: e.target.value })} className="border rounded-lg px-3 py-2 text-sm"><option value="periodic">Périodique</option><option value="cpd">CPD</option><option value="version">Nouvelle version</option><option value="complaint">Réclamation</option><option value="targeted">Ciblé</option></select><select value={auditForm.status} onChange={(e) => setAuditForm({ ...auditForm, status: e.target.value })} className="border rounded-lg px-3 py-2 text-sm"><option value="planned">Planifié</option><option value="in_progress">En cours</option><option value="actions_required">Actions requises</option><option value="completed">Terminé</option></select></div><input type="datetime-local" value={auditForm.scheduled_for ? String(auditForm.scheduled_for).slice(0,16) : ''} onChange={(e) => setAuditForm({ ...auditForm, scheduled_for: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm"/><textarea value={auditForm.summary || ''} onChange={(e) => setAuditForm({ ...auditForm, summary: e.target.value })} placeholder="Résumé" className="w-full border rounded-lg px-3 py-2 text-sm"/></SimpleModal>}
        {ncForm && <SimpleModal title="Non-conformité" onClose={() => setNcForm(null)} onSubmit={saveNonconformity} busy={busy === 'nc'}><div className="grid grid-cols-2 gap-3"><input value={ncForm.code || ''} onChange={(e) => setNcForm({ ...ncForm, code: e.target.value })} placeholder="Code" className="border rounded-lg px-3 py-2 text-sm"/><select value={ncForm.severity} onChange={(e) => setNcForm({ ...ncForm, severity: e.target.value })} className="border rounded-lg px-3 py-2 text-sm"><option value="minor">Mineure</option><option value="major">Majeure</option><option value="critical">Critique</option></select></div><input value={ncForm.title || ''} onChange={(e) => setNcForm({ ...ncForm, title: e.target.value })} placeholder="Titre" className="w-full border rounded-lg px-3 py-2 text-sm"/><textarea value={ncForm.description || ''} onChange={(e) => setNcForm({ ...ncForm, description: e.target.value })} placeholder="Description" className="w-full border rounded-lg px-3 py-2 text-sm min-h-24"/><input value={ncForm.course_id || ''} onChange={(e) => setNcForm({ ...ncForm, course_id: e.target.value })} placeholder="ID de la formation" className="w-full border rounded-lg px-3 py-2 text-sm"/><textarea value={ncForm.corrective_action || ''} onChange={(e) => setNcForm({ ...ncForm, corrective_action: e.target.value })} placeholder="Action corrective" className="w-full border rounded-lg px-3 py-2 text-sm"/></SimpleModal>}
      </div>
    </AdminLayout>
  );
}

function ReviewDetail({ data, busy, onStart, onSaveItem, onDecision, onChange }: any) {
  const { review, course, assessment, items, change_requests: changes } = data;
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div><p className="text-xs font-bold uppercase" style={{ color: GOLD }}>{review.entity_type === 'course' ? 'Formation' : 'Évaluation'}</p><h2 className="text-xl font-black mt-1" style={{ color: BLUE }}>{review.entity_type === 'course' ? course?.title : assessment?.title}</h2><p className="text-sm text-gray-500 mt-1">{STATUS_LABELS[review.status] || review.status} · {review.accelerated ? 'Procédure accélérée' : 'Procédure standard'}</p></div>
      <div className="flex flex-wrap gap-2">{review.status === 'submitted' && <button onClick={onStart} disabled={busy === 'start'} className="px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: BLUE }}>Démarrer</button>}<button onClick={onChange} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold">Demander une modification</button></div>
    </div>
    {course && <div className="grid md:grid-cols-4 border-y border-gray-200"><InfoCell label="Contexte" value={course.creator_context}/><InfoCell label="Version" value={course.current_version || '1.0'}/><InfoCell label="Statut Studio" value={course.studio_status}/><InfoCell label="CPD" value={review.cpd_status}/></div>}
    {assessment && <section className="rounded-xl border border-gray-200 bg-gray-50 p-4"><h3 className="font-bold text-sm" style={{ color: BLUE }}>Gouvernance de l’évaluation</h3><p className="mt-1 text-xs text-gray-500">Ces paramètres doivent rester proportionnés au niveau de l’épreuve et cohérents avec les compétences annoncées.</p><div className="mt-3 grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3"><InfoCell label="Surveillance" value={assessment.proctoring_level || 'non définie'}/><InfoCell label="Jury" value={assessment.jury_required ? `${assessment.jury_min_members || 1} membre(s) · ${assessment.jury_decision_mode || 'majority'}` : 'Non requis'}/><InfoCell label="Révision de note" value={assessment.appeal_enabled ? `Autorisée pendant ${assessment.appeal_deadline_days || 7} jour(s)` : 'Non autorisée'}/><InfoCell label="Seuil de réussite" value={`${assessment.passing_score ?? 70}%`}/><InfoCell label="Référentiel" value={assessment.competency_framework_id || 'Aucun référentiel sélectionné'}/><InfoCell label="Compétences" value={Array.isArray(assessment.competency_labels) && assessment.competency_labels.length ? assessment.competency_labels.join(', ') : 'Aucune compétence déclarée'}/></div></section>}
    <div><h3 className="font-bold text-sm mb-3" style={{ color: BLUE }}>Grille de contrôle</h3><div className="space-y-3">{items.map((item: any) => <CriterionRow key={item.id} item={item} saving={busy === `item:${item.id}`} onSave={(patch: any) => onSaveItem(item, patch)}/>)}</div></div>
    {changes?.length > 0 && <div><h3 className="font-bold text-sm mb-2" style={{ color: BLUE }}>Demandes de modification</h3><div className="space-y-2">{changes.map((change: any) => <div key={change.id} className="border-l-4 pl-3 py-2" style={{ borderColor: change.severity === 'critical' ? '#DC2626' : GOLD }}><p className="text-sm font-semibold">{change.title}</p><p className="text-sm text-gray-600">{change.description}</p><p className="text-xs text-gray-400 mt-1">{change.status}</p></div>)}</div></div>}
    <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2">
      {review.accelerated && review.entity_type === 'course' && <button onClick={() => onDecision({ type: 'fast_track', summary: '', publish: true, cpd_status: 'pending', review_months: 12 })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: GOLD }}><BadgeCheck size={15}/>Validation accélérée</button>}
      <button onClick={() => onDecision({ type: 'approved', summary: '', publish: false, cpd_status: review.cpd_status, review_months: 12 })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-semibold bg-emerald-700"><CheckCircle2 size={15}/>Valider</button>
      <button onClick={() => onDecision({ type: 'changes_requested', summary: '', publish: false })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 text-sm font-semibold text-amber-700"><Send size={15}/>Renvoyer en correction</button>
      <button onClick={() => onDecision({ type: 'rejected', summary: '', publish: false })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 text-sm font-semibold text-red-700"><Ban size={15}/>Refuser</button>
      {review.entity_type === 'course' && <button onClick={() => onDecision({ type: 'suspended', summary: '', publish: false })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold"><AlertTriangle size={15}/>Suspendre</button>}
    </div>
  </div>;
}

function CriterionRow({ item, saving, onSave }: any) {
  const [status, setStatus] = useState(item.status);
  const [comment, setComment] = useState(item.comment || '');
  const criterion = item.criterion || {};
  useEffect(() => { setStatus(item.status); setComment(item.comment || ''); }, [item.id, item.status, item.comment]);
  return <div className="border-y border-gray-200 py-3"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div className="flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold" style={{ color: BLUE }}>{criterion.name}</p>{criterion.is_required && <span className="text-[10px] uppercase font-bold text-red-600">Obligatoire</span>}{criterion.cpd_relevant && <span className="text-[10px] uppercase font-bold" style={{ color: GOLD }}>CPD</span>}</div><p className="text-xs text-gray-500 mt-1">{criterion.description}</p></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"><option value="not_reviewed">Non contrôlé</option><option value="conform">Conforme</option><option value="partial">Partiel</option><option value="non_conform">Non conforme</option><option value="not_applicable">Non applicable</option></select></div><div className="mt-2 flex gap-2"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Observation du contrôleur" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"/><button disabled={saving} onClick={() => onSave({ status, comment })} className="px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: BLUE }}><Save size={14}/></button></div></div>;
}

function DecisionModal({ value, onChange, onClose, onSubmit, busy }: any) {
  const labels: any = { approved: 'Valider le dossier', changes_requested: 'Renvoyer en correction', rejected: 'Refuser le dossier', suspended: 'Suspendre', fast_track: 'Validation accélérée Omnia' };
  return <SimpleModal title={labels[value.type] || 'Décision qualité'} onClose={onClose} onSubmit={onSubmit} busy={busy}>
    <textarea value={value.summary || ''} onChange={(e) => onChange({ ...value, summary: e.target.value })} placeholder="Motif et résumé obligatoires" className="w-full border rounded-lg px-3 py-2 text-sm min-h-28"/>
    {(value.type === 'approved' || value.type === 'fast_track') && <><select value={value.cpd_status || 'pending'} onChange={(e) => onChange({ ...value, cpd_status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="not_assessed">CPD non évalué</option><option value="not_applicable">Non applicable</option><option value="pending">À compléter</option><option value="compliant">Conforme CPD</option><option value="partially_compliant">Partiellement conforme</option><option value="non_compliant">Non conforme</option></select><div className="grid grid-cols-2 gap-3"><input type="number" min={1} value={value.review_months || 12} onChange={(e) => onChange({ ...value, review_months: Number(e.target.value) })} className="border rounded-lg px-3 py-2 text-sm"/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value.publish} onChange={(e) => onChange({ ...value, publish: e.target.checked })}/>Publier après validation</label></div></>}
  </SimpleModal>;
}

function SimpleModal({ title, onClose, onSubmit, busy, children }: any) {
  return <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200"><div className="flex items-center justify-between p-4 border-b"><h3 className="font-black" style={{ color: BLUE }}>{title}</h3><button onClick={onClose}><X size={18}/></button></div><div className="p-4 space-y-3">{children}</div><div className="flex justify-end gap-2 p-4 border-t"><button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-semibold">Annuler</button><button onClick={onSubmit} disabled={busy} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: BLUE }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div></div></div>;
}

function InfoCell({ label, value }: any) { return <div className="bg-white p-3 border-r last:border-r-0 border-gray-200"><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-semibold mt-1" style={{ color: BLUE }}>{value || '—'}</p></div>; }
