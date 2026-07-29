import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, FileCheck2, Plus, RefreshCw, Route, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  ProfessionalPathway,
  professionalPathwaysCall,
} from '../../lib/professionalPathwaysApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type AdminData = {
  pathways: ProfessionalPathway[];
  enrollments: any[];
  pending_step_results: any[];
  renewals: any[];
  pending_prerequisites: any[];
  catalogs: {
    courses: any[];
    assessments: any[];
    projects: any[];
    recognition_programs: any[];
    badge_templates: any[];
    certificate_templates: any[];
  };
};

const emptyPathway = {
  title: '', slug: '', description: '', visibility: 'authenticated', certification_type: 'oga',
  recognition_program_id: '', validity_months: '', renewal_required: false, cpd_enabled: false,
  cpd_credit_value: '', cpd_credit_unit: 'hours', badge_template_id: '', certificate_template_id: '',
};

export default function AdminProfessionalPathways() {
  const [data, setData] = useState<AdminData | null>(null);
  const [selected, setSelected] = useState<ProfessionalPathway | null>(null);
  const [pathwayForm, setPathwayForm] = useState<any>(null);
  const [stepForm, setStepForm] = useState<any>({ step_type: 'course', title: '', position: 1, required: true, source_id: '', minimum_score: '' });
  const [prerequisiteForm, setPrerequisiteForm] = useState<any>({ prerequisite_type: 'course', title: '', required: true, source_id: '', skill_code: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await professionalPathwaysCall<AdminData>('admin_dashboard');
      setData(result);
      if (selected) setSelected(result.pathways.find(item => item.id === selected.id) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    pathways: data?.pathways.length || 0,
    active: data?.enrollments.filter(item => item.status === 'active').length || 0,
    reviews: (data?.pending_step_results.length || 0) + (data?.pending_prerequisites.length || 0),
    renewals: data?.renewals.length || 0,
  }), [data]);

  const openEditor = (pathway?: ProfessionalPathway) => {
    setPathwayForm(pathway ? {
      ...pathway,
      recognition_program_id: pathway.recognition_program_id || '',
      validity_months: pathway.validity_months || '',
      cpd_credit_value: pathway.cpd_credit_value || '',
      badge_template_id: pathway.badge_template_id || '',
      certificate_template_id: pathway.certificate_template_id || '',
    } : { ...emptyPathway });
  };

  const savePathway = async (event: FormEvent) => {
    event.preventDefault();
    if (!pathwayForm) return;
    setBusy(true); setError('');
    try {
      await professionalPathwaysCall('save_pathway', {
        ...pathwayForm,
        validity_months: pathwayForm.validity_months ? Number(pathwayForm.validity_months) : null,
        cpd_credit_value: pathwayForm.cpd_credit_value ? Number(pathwayForm.cpd_credit_value) : null,
        recognition_program_id: pathwayForm.recognition_program_id || null,
        badge_template_id: pathwayForm.badge_template_id || null,
        certificate_template_id: pathwayForm.certificate_template_id || null,
      });
      setPathwayForm(null); setMessage('Parcours enregistré.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };

  const setStatus = async (pathway: ProfessionalPathway, status: string) => {
    setBusy(true); setError('');
    try { await professionalPathwaysCall('set_pathway_status', { pathway_id: pathway.id, status }); setMessage('Statut mis à jour.'); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Changement de statut impossible.'); }
    finally { setBusy(false); }
  };

  const saveStep = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const payload: Record<string, unknown> = {
      pathway_id: selected.id, step_type: stepForm.step_type, title: stepForm.title,
      position: Number(stepForm.position), required: stepForm.required,
      minimum_score: stepForm.minimum_score ? Number(stepForm.minimum_score) : null,
    };
    if (['course', 'renewal_training'].includes(stepForm.step_type)) payload.course_id = stepForm.source_id || null;
    if (stepForm.step_type === 'assessment') payload.assessment_id = stepForm.source_id || null;
    if (stepForm.step_type === 'project') payload.project_id = stepForm.source_id || null;
    if (stepForm.step_type === 'evidence' && stepForm.skill_code) payload.rules = { skill_code: stepForm.skill_code };
    setBusy(true);
    try {
      await professionalPathwaysCall('save_step', payload);
      setStepForm({ step_type: 'course', title: '', position: (selected.steps?.length || 0) + 1, required: true, source_id: '', minimum_score: '', skill_code: '' });
      setMessage('Étape ajoutée.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Ajout impossible.'); }
    finally { setBusy(false); }
  };

  const savePrerequisite = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const payload: Record<string, unknown> = {
      pathway_id: selected.id, prerequisite_type: prerequisiteForm.prerequisite_type,
      title: prerequisiteForm.title, required: prerequisiteForm.required,
    };
    if (prerequisiteForm.prerequisite_type === 'course') payload.course_id = prerequisiteForm.source_id || null;
    if (prerequisiteForm.prerequisite_type === 'pathway') payload.required_pathway_id = prerequisiteForm.source_id || null;
    if (prerequisiteForm.prerequisite_type === 'badge') payload.badge_template_id = prerequisiteForm.source_id || null;
    if (prerequisiteForm.prerequisite_type === 'skill') payload.skill_code = prerequisiteForm.skill_code;
    setBusy(true);
    try {
      await professionalPathwaysCall('save_prerequisite', payload);
      setPrerequisiteForm({ prerequisite_type: 'course', title: '', required: true, source_id: '', skill_code: '' });
      setMessage('Prérequis ajouté.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Ajout impossible.'); }
    finally { setBusy(false); }
  };

  const removeItem = async (action: 'delete_step' | 'delete_prerequisite', id: string) => {
    if (!window.confirm('Supprimer cet élément du parcours ?')) return;
    try { await professionalPathwaysCall(action, action === 'delete_step' ? { step_id: id } : { prerequisite_id: id }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Suppression impossible.'); }
  };

  const review = async (action: 'review_step' | 'review_prerequisite' | 'review_renewal', payload: Record<string, unknown>) => {
    const note = window.prompt('Commentaire de décision (facultatif)', '') || '';
    try { await professionalPathwaysCall(action, { ...payload, comments: note, decision_notes: note }); setMessage('Décision enregistrée.'); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Décision impossible.'); }
  };

  const sourceOptions = (type: string) => {
    if (!data) return [];
    if (['course', 'renewal_training'].includes(type)) return data.catalogs.courses;
    if (type === 'assessment') return data.catalogs.assessments;
    if (type === 'project') return data.catalogs.projects;
    if (type === 'pathway') return data.pathways.filter(item => item.id !== selected?.id);
    if (type === 'badge') return data.catalogs.badge_templates;
    return [];
  };

  return (
    <AdminLayout>
      <main className="mx-auto max-w-7xl p-5 md:p-8">
        <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: GOLD }}>Programme 2 · GM4</p><h1 className="mt-2 text-3xl font-black" style={{ color: BLUE }}>Parcours professionnels et certifications</h1><p className="mt-2 max-w-3xl text-sm text-gray-600">Orchestration des formations, examens, projets, jurys, certificats, badges, relevés et renouvellements. Le CPD reste optionnel par parcours.</p></div>
          <div className="flex gap-2"><button onClick={load} className="flex items-center gap-2 border px-4 py-2 text-sm"><RefreshCw size={16}/>Actualiser</button><button onClick={() => openEditor()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white" style={{ background: BLUE }}><Plus size={16}/>Nouveau parcours</button></div>
        </header>

        {message && <p className="mt-5 border-l-4 bg-amber-50 p-3 text-sm" style={{ borderColor: GOLD }}>{message}</p>}
        {error && <p className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <section className="mt-7 grid gap-4 md:grid-cols-4">
          <Metric icon={<Route/>} label="Parcours" value={metrics.pathways}/><Metric icon={<BookOpen/>} label="Inscriptions actives" value={metrics.active}/><Metric icon={<ShieldCheck/>} label="Validations" value={metrics.reviews}/><Metric icon={<Award/>} label="Renouvellements" value={metrics.renewals}/>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="border bg-white">
            <div className="border-b p-4"><h2 className="font-bold" style={{ color: BLUE }}>Parcours configurés</h2></div>
            {loading ? <div className="h-64 animate-pulse bg-gray-50"/> : <div className="divide-y">{(data?.pathways || []).map(pathway => <button key={pathway.id} onClick={() => setSelected(pathway)} className="w-full p-5 text-left hover:bg-gray-50"><div className="flex items-start justify-between gap-3"><div><p className="font-bold" style={{ color: BLUE }}>{pathway.title}</p><p className="mt-1 text-xs text-gray-500">{pathway.certification_type} · {pathway.status} · {pathway.steps?.length || 0} étape(s) · {pathway.prerequisites?.length || 0} prérequis</p><p className="mt-2 text-sm text-gray-600">{pathway.description}</p></div><span className="border px-2 py-1 text-xs">{pathway.status}</span></div><div className="mt-3 flex flex-wrap gap-2" onClick={event => event.stopPropagation()}><button onClick={() => openEditor(pathway)} className="border px-3 py-1.5 text-xs font-semibold">Modifier</button>{pathway.status !== 'published' && <button disabled={busy} onClick={() => setStatus(pathway, 'published')} className="px-3 py-1.5 text-xs font-bold text-white" style={{ background: GOLD }}>Publier</button>}{pathway.status === 'published' && <button disabled={busy} onClick={() => setStatus(pathway, 'suspended')} className="border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Suspendre</button>}</div></button>)}</div>}
          </section>

          <aside className="space-y-5">
            {selected ? <>
              <section className="border bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase" style={{ color: GOLD }}>Configuration</p><h2 className="mt-1 text-xl font-black" style={{ color: BLUE }}>{selected.title}</h2></div><button onClick={() => setSelected(null)}><X size={18}/></button></div>
                <h3 className="mt-5 font-bold">Étapes obligatoires et facultatives</h3><div className="mt-3 space-y-2">{selected.steps?.map(step => <ItemRow key={step.id} title={`${step.position}. ${step.title}`} subtitle={`${step.step_type} · ${step.required ? 'obligatoire' : 'facultative'}`} onDelete={() => removeItem('delete_step', step.id)}/>)}</div>
                <form onSubmit={saveStep} className="mt-4 space-y-3 bg-gray-50 p-4"><Select label="Type d’étape" value={stepForm.step_type} onChange={value => setStepForm({ ...stepForm, step_type: value, source_id: '' })} options={['course','assessment','jury','project','evidence','renewal_training'].map(value => ({ value, label: value }))}/><Input label="Titre" value={stepForm.title} onChange={value => setStepForm({ ...stepForm, title: value })}/>{sourceOptions(stepForm.step_type).length > 0 && <Select label="Source existante" value={stepForm.source_id} onChange={value => setStepForm({ ...stepForm, source_id: value })} options={[{value:'',label:'Sélectionner'},...sourceOptions(stepForm.step_type).map((item:any)=>({value:item.id,label:item.title || item.name}))]}/>} {stepForm.step_type === 'evidence' && <Input label="Code compétence attendu (facultatif)" value={stepForm.skill_code || ''} onChange={value => setStepForm({ ...stepForm, skill_code: value })}/>}<div className="grid grid-cols-2 gap-3"><Input label="Position" type="number" value={String(stepForm.position)} onChange={value => setStepForm({ ...stepForm, position: value })}/><Input label="Score minimum" type="number" value={stepForm.minimum_score} onChange={value => setStepForm({ ...stepForm, minimum_score: value })}/></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={stepForm.required} onChange={event => setStepForm({ ...stepForm, required: event.target.checked })}/>Étape obligatoire</label><button disabled={busy} className="w-full px-4 py-2 text-sm font-bold text-white" style={{ background: BLUE }}>Ajouter l’étape</button></form>

                <h3 className="mt-6 font-bold">Prérequis d’entrée</h3><div className="mt-3 space-y-2">{selected.prerequisites?.map(prerequisite => <ItemRow key={prerequisite.id} title={prerequisite.title} subtitle={`${prerequisite.prerequisite_type} · ${prerequisite.required ? 'obligatoire' : 'facultatif'}`} onDelete={() => removeItem('delete_prerequisite', prerequisite.id)}/>)}</div>
                <form onSubmit={savePrerequisite} className="mt-4 space-y-3 bg-gray-50 p-4"><Select label="Type de prérequis" value={prerequisiteForm.prerequisite_type} onChange={value => setPrerequisiteForm({ ...prerequisiteForm, prerequisite_type: value, source_id: '' })} options={['course','pathway','badge','skill','manual'].map(value => ({ value, label: value }))}/><Input label="Titre" value={prerequisiteForm.title} onChange={value => setPrerequisiteForm({ ...prerequisiteForm, title: value })}/>{sourceOptions(prerequisiteForm.prerequisite_type).length > 0 && <Select label="Source" value={prerequisiteForm.source_id} onChange={value => setPrerequisiteForm({ ...prerequisiteForm, source_id: value })} options={[{value:'',label:'Sélectionner'},...sourceOptions(prerequisiteForm.prerequisite_type).map((item:any)=>({value:item.id,label:item.title || item.name}))]}/>} {prerequisiteForm.prerequisite_type === 'skill' && <Input label="Code compétence" value={prerequisiteForm.skill_code} onChange={value => setPrerequisiteForm({ ...prerequisiteForm, skill_code: value })}/>}<label className="flex gap-2 text-sm"><input type="checkbox" checked={prerequisiteForm.required} onChange={event => setPrerequisiteForm({ ...prerequisiteForm, required: event.target.checked })}/>Prérequis obligatoire</label><button disabled={busy} className="w-full px-4 py-2 text-sm font-bold text-white" style={{ background: GOLD }}>Ajouter le prérequis</button></form>
              </section>
            </> : <section className="border bg-white p-8 text-center text-sm text-gray-500">Sélectionnez un parcours pour configurer ses étapes et prérequis.</section>}
          </aside>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <ReviewBox title="Prérequis manuels" rows={data?.pending_prerequisites || []} render={(row:any)=><ReviewRow key={row.id} title={row.prerequisite?.title || 'Prérequis'} subtitle={row.user?.full_name || row.user?.email || row.user_id} onApprove={() => review('review_prerequisite',{validation_id:row.id,status:'approved'})} onReject={() => review('review_prerequisite',{validation_id:row.id,status:'rejected'})}/>} />
          <ReviewBox title="Jurys et preuves" rows={data?.pending_step_results || []} render={(row:any)=><ReviewRow key={row.id} title={row.step?.title || 'Étape'} subtitle={row.status} onApprove={() => review('review_step',{result_id:row.id,decision:'passed',score:100})} onReject={() => review('review_step',{result_id:row.id,decision:'failed',score:0})}/>} />
          <ReviewBox title="Renouvellements" rows={data?.renewals || []} render={(row:any)=><ReviewRow key={row.id} title={row.enrollment?.pathway?.title || 'Renouvellement'} subtitle={`${row.enrollment?.user?.full_name || row.enrollment?.user?.email || ''} · ${new Date(row.due_at).toLocaleDateString('fr-FR')}`} onApprove={() => review('review_renewal',{renewal_id:row.id,decision:'approved'})} onReject={() => review('review_renewal',{renewal_id:row.id,decision:'rejected'})}/>} />
        </section>
      </main>

      {pathwayForm && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setPathwayForm(null); }}><form onSubmit={savePathway} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-white p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase" style={{ color: GOLD }}>Parcours professionnel</p><h2 className="mt-1 text-2xl font-black" style={{ color: BLUE }}>{pathwayForm.id ? 'Modifier le parcours' : 'Créer un parcours'}</h2></div><button type="button" onClick={() => setPathwayForm(null)}><X/></button></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Input label="Titre" value={pathwayForm.title} onChange={value => setPathwayForm({ ...pathwayForm, title: value })}/><Input label="Slug" value={pathwayForm.slug} onChange={value => setPathwayForm({ ...pathwayForm, slug: value })}/><div className="md:col-span-2"><Input label="Description" value={pathwayForm.description || ''} onChange={value => setPathwayForm({ ...pathwayForm, description: value })}/></div><Select label="Type de certification" value={pathwayForm.certification_type} onChange={value => setPathwayForm({ ...pathwayForm, certification_type: value, cpd_enabled: value === 'cpd' || pathwayForm.cpd_enabled })} options={['oga','recognized','co_certified','professional','cpd'].map(value => ({value,label:value}))}/><Select label="Visibilité" value={pathwayForm.visibility} onChange={value => setPathwayForm({ ...pathwayForm, visibility: value })} options={['public','authenticated'].map(value => ({value,label:value}))}/><Select label="Programme de reconnaissance" value={pathwayForm.recognition_program_id} onChange={value => setPathwayForm({ ...pathwayForm, recognition_program_id: value })} options={[{value:'',label:'Aucun'},...(data?.catalogs.recognition_programs || []).map((item:any)=>({value:item.id,label:`${item.title} — ${item.partner?.name || ''}`}))]}/><Select label="Modèle de certificat" value={pathwayForm.certificate_template_id} onChange={value => setPathwayForm({ ...pathwayForm, certificate_template_id: value })} options={[{value:'',label:'Modèle par défaut'},...(data?.catalogs.certificate_templates || []).map((item:any)=>({value:item.id,label:item.name}))]}/><Select label="Badge final" value={pathwayForm.badge_template_id} onChange={value => setPathwayForm({ ...pathwayForm, badge_template_id: value })} options={[{value:'',label:'Aucun badge'},...(data?.catalogs.badge_templates || []).map((item:any)=>({value:item.id,label:item.name}))]}/><Input label="Validité (mois)" type="number" value={String(pathwayForm.validity_months || '')} onChange={value => setPathwayForm({ ...pathwayForm, validity_months: value })}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pathwayForm.renewal_required} onChange={event => setPathwayForm({ ...pathwayForm, renewal_required: event.target.checked })}/>Renouvellement obligatoire</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pathwayForm.cpd_enabled} onChange={event => setPathwayForm({ ...pathwayForm, cpd_enabled: event.target.checked })}/>CPD applicable à ce parcours</label>{pathwayForm.cpd_enabled && <><Input label="Crédits / heures CPD" type="number" value={String(pathwayForm.cpd_credit_value || '')} onChange={value => setPathwayForm({ ...pathwayForm, cpd_credit_value: value })}/><Input label="Unité CPD" value={pathwayForm.cpd_credit_unit} onChange={value => setPathwayForm({ ...pathwayForm, cpd_credit_unit: value })}/></>}</div><div className="mt-6 flex justify-end"><button disabled={busy} className="flex items-center gap-2 px-5 py-3 font-bold text-white" style={{ background: BLUE }}><Save size={17}/>Enregistrer</button></div></form></div>}
    </AdminLayout>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="border bg-white p-5"><span style={{ color: GOLD }}>{icon}</span><p className="mt-3 text-3xl font-black" style={{ color: BLUE }}>{value}</p><p className="text-sm text-gray-500">{label}</p></div>; }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value:string)=>void; type?: string }) { return <label className="block text-sm"><span className="font-semibold">{label}</span><input required={label === 'Titre'} type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full border p-2.5"/></label>; }
function Select({ label, value, onChange, options }: { label:string; value:string; onChange:(value:string)=>void; options:Array<{value:string;label:string}> }) { return <label className="block text-sm"><span className="font-semibold">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full border p-2.5">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function ItemRow({ title, subtitle, onDelete }: { title:string; subtitle:string; onDelete:()=>void }) { return <div className="flex items-center justify-between gap-3 border p-3"><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-gray-500">{subtitle}</p></div><button onClick={onDelete} className="text-red-700"><Trash2 size={15}/></button></div>; }
function ReviewBox({ title, rows, render }: { title:string; rows:any[]; render:(row:any)=>ReactNode }) { return <section className="border bg-white p-5"><h2 className="flex items-center gap-2 font-bold" style={{color:BLUE}}><FileCheck2 size={18} style={{color:GOLD}}/>{title}</h2><div className="mt-4 divide-y">{rows.length ? rows.map(render) : <p className="py-5 text-sm text-gray-500">Aucun dossier en attente.</p>}</div></section>; }
function ReviewRow({ title, subtitle, onApprove, onReject }: { title:string; subtitle:string; onApprove:()=>void; onReject:()=>void }) { return <div className="py-4"><p className="font-semibold">{title}</p><p className="text-xs text-gray-500">{subtitle}</p><div className="mt-3 flex gap-2"><button onClick={onApprove} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white" style={{background:'#087A55'}}><CheckCircle2 size={14}/>Valider</button><button onClick={onReject} className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Refuser</button></div></div>; }
