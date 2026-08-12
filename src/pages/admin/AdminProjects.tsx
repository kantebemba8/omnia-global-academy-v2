import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, Ban, CheckCircle2, Eye, FolderKanban, RefreshCw, RotateCcw,
  ShieldAlert, Trash2, XCircle, Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  decideProject,
  getAdminProjects,
  OmniaProject,
  PROJECT_TYPE_LABELS,
  resolveProjectReport, getProjectCreatorPermissions, setProjectCreatorPermission,
  getProjectPartners, saveProjectPartner, ProjectPartner, ProjectType,
} from '../../lib/projectsApi';
import { ProjectStatusBadge } from '../../components/projects/ProjectUi';
import { AdminProjectRecommendationsPanel } from '../../components/projects/ProjectRecommendationsPanel';

const FILTERS = [
  ['', 'Tous'],
  ['pending_validation', 'À valider'],
  ['published', 'Publiés'],
  ['in_progress', 'En cours'],
  ['changes_requested', 'Corrections'],
  ['suspended', 'Suspendus'],
  ['closed', 'Clôturés'],
  ['archived', 'Archivés'],
] as const;

export default function AdminProjects() {
  const [projects, setProjects] = useState<OmniaProject[]>([]);
  const [reports, setReports] = useState<Array<Record<string, any>>>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<OmniaProject | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingReportId, setProcessingReportId] = useState('');
  const [professors, setProfessors] = useState<Array<any>>([]);
  const [partners, setPartners] = useState<ProjectPartner[]>([]);

  const load = async (status = filter) => {
    setLoading(true);
    setError('');
    try {
      const [result, permissionResult] = await Promise.all([getAdminProjects(status || undefined), getProjectCreatorPermissions()]);
      setProjects(result.projects);
      setReports(result.reports);
      setProfessors(permissionResult.professors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger Omnia Projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const metrics = useMemo(() => ({
    pending: projects.filter(item => item.status === 'pending_validation').length,
    active: projects.filter(item => ['published', 'selection', 'in_progress'].includes(item.status)).length,
    funding: projects.filter(item => item.reward_type === 'financial_prize' && item.reward_funding_status !== 'verified').length,
    reports: reports.length,
  }), [projects, reports]);


  const openProject = async (project: OmniaProject) => {
    setSelected(project);
    setNote(project.admin_feedback || '');
    try { const result = await getProjectPartners(project.id); setPartners(result.partners || []); }
    catch { setPartners([]); }
  };

  const changeProfessorPermission = async (professor: any, status: 'allowed' | 'suspended' | 'revoked') => {
    setMessage('');
    try {
      const allTypes = Object.keys(PROJECT_TYPE_LABELS) as ProjectType[];
      await setProjectCreatorPermission(professor.id, status, professor.permission?.allowed_project_types || allTypes);
      setMessage('Autorisation du professeur mise à jour.');
      await load();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Mise à jour impossible.'); }
  };

  const reviewPartner = async (partner: ProjectPartner, status: 'confirmed' | 'declined') => {
    if (!selected) return;
    try {
      await saveProjectPartner(selected.id, { ...partner, partner_id: partner.id, status });
      const result = await getProjectPartners(selected.id); setPartners(result.partners || []);
      setMessage(status === 'confirmed' ? 'Partenaire confirmé.' : 'Partenaire refusé.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Décision partenaire impossible.'); }
  };

  const resolveReport = async (report: Record<string, any>, status: 'under_review' | 'resolved' | 'dismissed' | 'escalated') => {
    const noteRequired = ['resolved', 'dismissed', 'escalated'].includes(status);
    const note = window.prompt(noteRequired ? 'Décision et justification' : 'Note interne facultative', report.resolution_note || '');
    if (note === null) return;
    if (noteRequired && !note.trim()) {
      setMessage('Une justification est obligatoire pour cette décision.');
      return;
    }
    setProcessingReportId(String(report.id));
    setMessage('');
    try {
      await resolveProjectReport(String(report.id), status, note.trim());
      setMessage('Signalement mis à jour.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Traitement du signalement impossible.');
    } finally {
      setProcessingReportId('');
    }
  };

  const decision = async (value: string) => {
    if (!selected) return;
    if (['request_changes', 'reject', 'block_reward', 'verify_reward'].includes(value) && !note.trim()) {
      setMessage('Un motif est obligatoire pour cette décision.');
      return;
    }
    if (value === 'delete' && !window.confirm('Supprimer définitivement ce projet et toutes ses données associées ?')) return;
    setProcessing(true);
    setMessage('');
    try {
      await decideProject(selected.id, value, note);
      setMessage('Décision enregistrée.');
      setSelected(null);
      setNote('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Décision impossible.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6 md:py-8">
        <header className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B5623C]">Omnia Projects · Administration</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Gestion Omnia Projects</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Validation, supervision, récompenses, signalements, autorisations de création et clôture des projets.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/projects/gestion" className="inline-flex items-center justify-center gap-2 bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Créer un projet</Link>
              <Link to="/projects" className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#002050]"><Eye size={17} /> Voir l’espace public</Link>
            </div>
          </div>
          <div className="h-1 bg-[linear-gradient(90deg,#002050_0%,#B5623C_55%,#B5623C_100%)]" />
        </header>

        {message && <div className="mt-5 border border-[#E7D4A1] bg-[#FFFBF0] px-4 py-3 text-sm text-[#6E4C08]">{message}</div>}
        {error && <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <dl className="mt-6 grid border-y border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
          {[['À valider', metrics.pending], ['Actifs', metrics.active], ['Financements à vérifier', metrics.funding], ['Signalements ouverts', metrics.reports]].map(([label, value], index) => <div key={String(label)} className={`px-5 py-4 ${index < 3 ? 'lg:border-r lg:border-slate-200' : ''}`}><dt className="text-xs font-bold uppercase tracking-[0.11em] text-slate-400">{label}</dt><dd className="mt-1 text-2xl font-black text-[#002050]">{value}</dd></div>)}
        </dl>

        <section className="mt-7 border-y border-slate-200 bg-white py-5 sm:py-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><Users size={19}/> Professeurs autorisés à créer des projets</h2><p className="mt-1 text-sm text-slate-600">Une autorisation explicite est désormais obligatoire. Les projets déjà créés restent accessibles à leur auteur.</p></div></div>
          <div className="mt-5 divide-y">{professors.length ? professors.map((professor:any)=><div key={professor.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{professor.full_name || professor.email}</p><p className="text-sm text-slate-500">{professor.email} · {professor.permission?.status || 'non autorisé'}</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>changeProfessorPermission(professor,'allowed')} className="rounded-lg px-3 py-2 text-xs font-bold text-white" style={{background:'#087A55'}}>Autoriser</button><button onClick={()=>changeProfessorPermission(professor,'suspended')} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{borderColor:'#B5623C',color:'#8B482F'}}>Suspendre</button><button onClick={()=>changeProfessorPermission(professor,'revoked')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Révoquer</button></div></div>) : <p className="py-5 text-sm text-slate-500">Aucun compte professeur trouvé.</p>}</div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2">
          {FILTERS.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className="border-b-2 px-3.5 py-2 text-sm font-semibold" style={{ borderColor: filter === value ? '#B5623C' : 'transparent', color: filter === value ? '#002050' : '#64748B' }}>{label}</button>)}
          <button onClick={() => load()} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-white"><RefreshCw size={18} /></button>
        </div>

        <section className="mt-4 overflow-hidden border-y border-slate-200 bg-white">
          {loading ? <div className="h-72 animate-pulse bg-slate-50" /> : projects.length ? <div className="divide-y" style={{ borderColor: '#EEF0F3' }}>{projects.map(project => (
            <button key={project.id} onClick={() => openProject(project)} className="grid w-full gap-4 px-5 py-5 text-left hover:bg-slate-50 lg:grid-cols-[1fr_170px_130px_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B5623C' }}>{PROJECT_TYPE_LABELS[project.project_type]}</span><ProjectStatusBadge status={project.status} /></div><h2 className="mt-2 font-bold" style={{ color: '#002050' }}>{project.title}</h2><p className="mt-1 text-sm text-slate-600">{project.organization_name || 'Omnia Global Academy'} · {project.country_code || 'Zone non précisée'}</p></div>
              <div className="text-sm text-slate-600"><span className="block text-xs font-semibold uppercase text-slate-400">Candidatures</span><strong className="mt-1 block text-slate-800">{project.application_count || 0}</strong></div>
              <div className="text-sm text-slate-600"><span className="block text-xs font-semibold uppercase text-slate-400">Récompense</span><strong className="mt-1 block text-slate-800">{project.reward_type === 'none' ? 'Aucune' : project.reward_type.split('_').join(' ')}</strong></div>
              <span className="text-sm font-bold" style={{ color: '#002050' }}>Examiner</span>
            </button>
          ))}</div> : <div className="px-5 py-16 text-center"><FolderKanban className="mx-auto" size={36} style={{ color: '#B5623C' }} /><h2 className="mt-4 font-bold" style={{ color: '#002050' }}>Aucun projet dans cette catégorie</h2></div>}
        </section>

        <AdminProjectRecommendationsPanel />

        {!!reports.length && (
          <section className="mt-8 border-y border-red-200 bg-white py-5 sm:py-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-red-800"><ShieldAlert size={20} /> Signalements ouverts</h2>
            <div className="mt-5 divide-y">{reports.slice(0, 10).map(report => <div key={report.id} className="py-4 first:pt-0"><p className="font-bold text-slate-900">{report.project?.title || 'Projet'}</p><p className="mt-1 text-sm text-slate-600">{String(report.report_type).split('_').join(' ')} — {report.description}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={processingReportId === String(report.id)} onClick={() => resolveReport(report, 'under_review')} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#D0D5DD' }}>Prendre en charge</button><button disabled={processingReportId === String(report.id)} onClick={() => resolveReport(report, 'escalated')} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#B5623C', color: '#8B482F' }}>Escalader</button><button disabled={processingReportId === String(report.id)} onClick={() => resolveReport(report, 'dismissed')} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#D0D5DD' }}>Classer sans suite</button><button disabled={processingReportId === String(report.id)} onClick={() => resolveReport(report, 'resolved')} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: '#087A55' }}>Résoudre</button></div></div>)}</div>
          </section>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/50" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between"><div><div className="flex flex-wrap items-center gap-2"><ProjectStatusBadge status={selected.status} /><span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B5623C' }}>{PROJECT_TYPE_LABELS[selected.project_type]}</span></div><h2 className="mt-3 text-2xl font-bold" style={{ color: '#002050' }}>{selected.title}</h2><p className="mt-2 text-sm text-slate-600">{selected.organization_name} · {selected.country_code}</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-slate-100"><XCircle size={20} /></button></div>

            <div className="mt-7 space-y-6"><section><h3 className="font-bold text-slate-900">Description</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{selected.description}</p></section>{selected.deliverables_summary && <section><h3 className="font-bold text-slate-900">Livrables</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{selected.deliverables_summary}</p></section>}<section className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-400">Confidentialité</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.confidentiality_level}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Propriété intellectuelle</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.ip_policy}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Portfolio</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.portfolio_policy}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Financement récompense</p><p className="mt-1 text-sm font-semibold text-slate-700">{selected.reward_funding_status}</p>{selected.reward_type === 'financial_prize' && <p className="mt-1 text-xs text-slate-500">{typeof selected.reward_details?.amount_minor === 'number' ? `${(selected.reward_details.amount_minor / 100).toLocaleString('fr-FR')} ${String(selected.reward_details.currency || '')}` : 'Montant non renseigné'}</p>}</div></section><section><h3 className="font-bold text-slate-900">Entreprises et institutions participantes</h3><p className="mt-1 text-xs text-slate-500">Les partenaires proposés par le porteur doivent être confirmés avant d’être présentés comme participants officiels.</p><div className="mt-3 divide-y rounded-xl border">{partners.length ? partners.map(partner=><div key={partner.id} className="p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{partner.partner_name}</p><p className="text-xs text-slate-500">{partner.partner_role} · {partner.status}</p>{partner.notes&&<p className="mt-1 text-sm text-slate-600">{partner.notes}</p>}</div>{partner.status==='proposed'&&<div className="flex gap-2"><button onClick={()=>reviewPartner(partner,'confirmed')} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-white" style={{background:'#087A55'}}>Confirmer</button><button onClick={()=>reviewPartner(partner,'declined')} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700">Refuser</button></div>}</div></div>) : <p className="p-4 text-sm text-slate-500">Aucun partenaire supplémentaire.</p>}</div></section><label className="block"><span className="text-sm font-bold text-slate-800">Commentaire ou motif</span><textarea value={note} onChange={event => setNote(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} placeholder="Obligatoire pour demander des corrections, refuser ou bloquer une récompense." /></label></div>

            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {selected.reward_type === 'financial_prize' && selected.reward_funding_status !== 'verified' && <button disabled={processing} onClick={() => decision('verify_reward')} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: '#B5623C', color: '#8B482F' }}><CheckCircle2 size={16} /> Vérifier le financement</button>}
              {selected.status === 'pending_validation' && <button disabled={processing} onClick={() => decision('approve')} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#087A55' }}><CheckCircle2 size={16} /> Approuver et publier</button>}
              {selected.status === 'pending_validation' && <button disabled={processing} onClick={() => decision('request_changes')} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: '#B5623C', color: '#8B482F' }}><RotateCcw size={16} /> Demander des corrections</button>}
              {selected.status === 'pending_validation' && <button disabled={processing} onClick={() => decision('reject')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700"><XCircle size={16} /> Refuser</button>}
              {['published', 'selection', 'in_progress'].includes(selected.status) && <button disabled={processing} onClick={() => decision('suspend')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700"><Ban size={16} /> Suspendre</button>}
              {!['closed', 'archived'].includes(selected.status) && <button disabled={processing} onClick={() => decision('close')} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: '#D0D5DD' }}><Archive size={16} /> Clôturer</button>}
              {selected.status === 'closed' && <button disabled={processing} onClick={() => decision('archive')} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: '#D0D5DD' }}><Archive size={16} /> Archiver</button>}
              <a href={`/projects/${selected.slug}`} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#002050' }}><Eye size={16} /> Prévisualiser</a>
              <button disabled={processing} onClick={() => decision('delete')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700"><Trash2 size={16} /> Supprimer définitivement</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
