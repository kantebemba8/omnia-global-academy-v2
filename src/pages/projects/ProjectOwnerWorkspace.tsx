import { openExternalUrl } from '../../lib/mobile';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarDays, Check, ClipboardList, Edit3, Eye, FileCheck2, FolderKanban, Mail, Plus, RefreshCw,
  Send, Trash2, Users, X,
} from 'lucide-react';
import {
  changeProjectStatus,
  createProject,
  createProjectTeam,
  evaluateProjectDeliverable,
  getOwnerProjects,
  getProjectApplications,
  getProjectDetail,
  getProjectFileUrl,
  inviteProjectUser,
  OmniaProject,
  ProjectApplication,
  ProjectDeliverable,
  ProjectMilestone,
  ProjectTeam,
  ProjectPartner,
  saveProjectPartner,
  removeProjectPartner,
  PROJECT_TYPE_LABELS,
  reviewProjectApplication,
  submitProject,
  updateProject,
  upsertProjectMilestone,
} from '../../lib/projectsApi';
import { ProjectStatusBadge, ProjectsWorkspaceFrame } from '../../components/projects/ProjectUi';
import { AdminLayout } from '../../components/AdminLayout';
import { OwnerProjectRecommendationsPanel } from '../../components/projects/ProjectRecommendationsPanel';
import { deleteOrRequestContent } from '../../lib/contentDeletion';

const EMPTY_FORM = {
  title: '', short_description: '', description: '', problem_statement: '', objectives: '',
  project_type: 'real_project', organization_name: '', country_code: '', city: '', visibility: 'authenticated',
  required_skills: '', languages: 'fr', level: 'all', participation_mode: 'individual_or_team',
  team_creation_mode: 'candidate_or_owner', selection_mode: 'manual',
  min_participants: '1', max_participants: '', min_team_size: '1', max_team_size: '6', estimated_hours: '',
  application_closes_at: '', starts_at: '', ends_at: '', deliverables_summary: '',
  confidentiality_level: 'standard', nda_required: false, portfolio_policy: 'validated_summary',
  ip_policy: 'participant_owned', ip_policy_details: '', reward_type: 'none', reward_funding_status: 'not_applicable',
  reward_description: '', reward_amount: '', reward_currency: 'XOF',
  recruitment_opportunity: false,
};

type ProjectForm = typeof EMPTY_FORM;


function OwnerWorkspaceFrame({ admin, children }: { admin: boolean; children: ReactNode }) {
  if (admin) {
    return (
      <AdminLayout headerTitle="Gestion Omnia Projects" headerSubtitle="Projets, équipes et livrables · Super-admin" contentClassName="bg-transparent">
        {children}
      </AdminLayout>
    );
  }
  return <ProjectsWorkspaceFrame>{children}</ProjectsWorkspaceFrame>;
}

function toInputDate(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

function fromProject(project: OmniaProject): ProjectForm {
  const rewardDetails = project.reward_details || {};
  const amountMinor = typeof rewardDetails.amount_minor === 'number' ? rewardDetails.amount_minor : Number(rewardDetails.amount_minor || 0);
  return {
    ...EMPTY_FORM,
    title: project.title || '',
    short_description: project.short_description || '',
    description: project.description || '',
    problem_statement: project.problem_statement || '',
    objectives: project.objectives || '',
    project_type: project.project_type,
    organization_name: project.organization_name || '',
    country_code: project.country_code || '',
    city: project.city || '',
    visibility: project.visibility,
    required_skills: (project.required_skills || []).join(', '),
    languages: (project.languages || []).join(', '),
    level: project.level,
    participation_mode: project.participation_mode,
    team_creation_mode: project.team_creation_mode,
    selection_mode: project.selection_mode,
    min_participants: String(project.min_participants || 1),
    max_participants: project.max_participants ? String(project.max_participants) : '',
    min_team_size: String(project.min_team_size || 1),
    max_team_size: project.max_team_size ? String(project.max_team_size) : '',
    estimated_hours: project.estimated_hours ? String(project.estimated_hours) : '',
    application_closes_at: toInputDate(project.application_closes_at),
    starts_at: toInputDate(project.starts_at),
    ends_at: toInputDate(project.ends_at),
    deliverables_summary: project.deliverables_summary || '',
    confidentiality_level: project.confidentiality_level,
    nda_required: project.nda_required,
    portfolio_policy: project.portfolio_policy,
    ip_policy: project.ip_policy,
    ip_policy_details: project.ip_policy_details || '',
    reward_type: project.reward_type,
    reward_funding_status: project.reward_funding_status,
    reward_description: typeof rewardDetails.description === 'string' ? rewardDetails.description : '',
    reward_amount: amountMinor ? String(amountMinor / 100) : '',
    reward_currency: typeof rewardDetails.currency === 'string' ? rewardDetails.currency : 'XOF',
    recruitment_opportunity: project.recruitment_opportunity,
  };
}

export default function ProjectOwnerWorkspace() {
  const location = useLocation();
  const isAdminWorkspace = location.pathname.startsWith('/admin/');
  const ownerScope = location.pathname.startsWith('/structure/') ? 'structure' as const
    : location.pathname.startsWith('/professeur/') ? 'personal' as const
    : '' as const;
  const [projects, setProjects] = useState<OmniaProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OmniaProject | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState<OmniaProject | null>(null);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [teams, setTeams] = useState<Array<ProjectTeam & { members?: Array<{ id: string; member_role: string; invitation_status: string; user?: { full_name: string; email: string } }> }>>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneDueAt, setMilestoneDueAt] = useState('');
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamLeaderEmail, setTeamLeaderEmail] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [partners, setPartners] = useState<ProjectPartner[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [partnerRole, setPartnerRole] = useState<ProjectPartner['partner_role']>('participant');
  const [partnerNotes, setPartnerNotes] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    if (new URLSearchParams(location.search).get('preview') === 'true') { setProjects([]); setLoading(false); return; }
    try {
      const result = await getOwnerProjects(ownerScope);
      setProjects(result.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les projets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ownerScope, location.search]);

  const metrics = useMemo(() => ({
    total: projects.length,
    pending: projects.filter(item => item.status === 'pending_validation').length,
    published: projects.filter(item => ['published', 'selection', 'in_progress'].includes(item.status)).length,
    candidates: projects.reduce((sum, item) => sum + (item.application_count || 0), 0),
  }), [projects]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (project: OmniaProject) => {
    setEditing(project);
    setForm(fromProject(project));
    setShowForm(true);
  };

  const payload = () => ({
    ...form,
    required_skills: form.required_skills.split(',').map(item => item.trim()).filter(Boolean),
    languages: form.languages.split(',').map(item => item.trim()).filter(Boolean),
    min_participants: Number(form.min_participants || 1),
    max_participants: form.max_participants ? Number(form.max_participants) : null,
    min_team_size: Number(form.min_team_size || 1),
    max_team_size: form.max_team_size ? Number(form.max_team_size) : null,
    estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
    application_closes_at: form.application_closes_at || null,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    reward_details: {
      description: form.reward_description.trim(),
      amount_minor: form.reward_type === 'financial_prize' && form.reward_amount ? Math.round(Number(form.reward_amount) * 100) : null,
      currency: form.reward_type === 'financial_prize' ? form.reward_currency : null,
    },
  });

  const save = async (event: FormEvent, sendForValidation = false) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const result = editing ? await updateProject(editing.id, payload()) : await createProject(payload(), ownerScope);
      if (sendForValidation) await submitProject(result.project.id);
      setShowForm(false);
      setMessage(sendForValidation ? 'Projet enregistré et envoyé à l’Administration Omnia.' : 'Brouillon enregistré.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const sendExisting = async (project: OmniaProject) => {
    setMessage('');
    try {
      await submitProject(project.id);
      setMessage('Projet envoyé à l’Administration Omnia pour validation.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Soumission impossible.');
    }
  };

  const removeProject = async (project: OmniaProject) => {
    const important = !['draft', 'changes_requested', 'rejected'].includes(project.status);
    const question = important
      ? `Demander la suppression de « ${project.title} » ? Le projet sera retiré uniquement après confirmation administrative.`
      : `Supprimer « ${project.title} » ? Si aucun participant ni livrable n’y est lié, la suppression sera immédiate.`;
    if (!window.confirm(question)) return;
    setMessage('');
    try {
      const result = await deleteOrRequestContent('project', project.id);
      setMessage(result.message);
      if (result.deleted) {
        setProjects(items => items.filter(item => item.id !== project.id));
        if (selectedProject?.id === project.id) setSelectedProject(null);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  };

  const openApplications = async (project: OmniaProject) => {
    setSelectedProject(project);
    setApplicationsLoading(true);
    try {
      const [applicationResult, detailResult] = await Promise.all([
        getProjectApplications(project.id),
        getProjectDetail({ project_id: project.id }),
      ]);
      setApplications(applicationResult.applications);
      setMilestones(detailResult.milestones);
      setDeliverables(detailResult.deliverables || []);
      setTeams(detailResult.teams || []);
      setPartners(detailResult.partners || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Candidatures indisponibles.');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const addPartner = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !partnerName.trim()) return;
    setDrawerBusy(true);
    try {
      await saveProjectPartner(selectedProject.id, { partner_name: partnerName.trim(), partner_kind: 'external', partner_role: partnerRole, notes: partnerNotes.trim(), status: 'proposed' });
      setPartnerName(''); setPartnerNotes(''); setPartnerRole('participant');
      await openApplications(selectedProject);
      setMessage('Partenaire proposé. L’Administration Omnia doit le confirmer.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Ajout du partenaire impossible.'); }
    finally { setDrawerBusy(false); }
  };

  const withdrawPartner = async (partner: ProjectPartner) => {
    if (!selectedProject || !window.confirm(`Retirer ${partner.partner_name} de ce projet ?`)) return;
    setDrawerBusy(true);
    try { await removeProjectPartner(partner.id); await openApplications(selectedProject); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Retrait impossible.'); }
    finally { setDrawerBusy(false); }
  };

  const review = async (application: ProjectApplication, status: string) => {
    try {
      await reviewProjectApplication(application.id, status);
      if (selectedProject) await openApplications(selectedProject);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Mise à jour impossible.');
    }
  };

  const createOwnerTeam = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !teamName.trim() || !teamLeaderEmail.trim()) return;
    setDrawerBusy(true);
    try {
      await createProjectTeam(selectedProject.id, {
        name: teamName.trim(),
        description: teamDescription.trim(),
        leader_email: teamLeaderEmail.trim(),
        max_members: selectedProject.max_team_size || 10,
      });
      setTeamName('');
      setTeamLeaderEmail('');
      setTeamDescription('');
      await openApplications(selectedProject);
      setMessage('Équipe créée. Le chef d’équipe doit accepter l’invitation avant de participer.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Création de l’équipe impossible.');
    } finally {
      setDrawerBusy(false);
    }
  };

  const inviteParticipant = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !inviteEmail.trim()) return;
    setDrawerBusy(true);
    try {
      await inviteProjectUser(selectedProject.id, inviteEmail.trim(), 'participant', inviteMessage.trim());
      setInviteEmail('');
      setInviteMessage('');
      setMessage('Invitation envoyée. L’utilisateur devra l’accepter avant d’accéder au projet.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Invitation impossible.');
    } finally {
      setDrawerBusy(false);
    }
  };

  const addMilestone = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProject || !milestoneTitle.trim()) return;
    setDrawerBusy(true);
    try {
      await upsertProjectMilestone(selectedProject.id, {
        title: milestoneTitle.trim(),
        description: milestoneDescription.trim(),
        due_at: milestoneDueAt || null,
        sequence_no: milestones.length + 1,
        deliverable_required: true,
      });
      setMilestoneTitle('');
      setMilestoneDescription('');
      setMilestoneDueAt('');
      await openApplications(selectedProject);
      setMessage('Jalon ajouté au projet.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Création du jalon impossible.');
    } finally {
      setDrawerBusy(false);
    }
  };

  const evaluateDeliverable = async (deliverable: ProjectDeliverable, status: 'changes_requested' | 'accepted' | 'rejected') => {
    if (!selectedProject) return;
    const feedback = window.prompt(
      status === 'accepted' ? 'Commentaire de validation (facultatif)' : 'Motif ou corrections demandées',
      deliverable.evaluation_feedback || '',
    );
    if (feedback === null) return;
    let score: number | null = null;
    if (status === 'accepted') {
      const scoreValue = window.prompt('Score sur 100 (facultatif)', deliverable.evaluation_score == null ? '' : String(deliverable.evaluation_score));
      if (scoreValue === null) return;
      score = scoreValue.trim() === '' ? null : Number(scoreValue);
      if (score != null && (!Number.isFinite(score) || score < 0 || score > 100)) {
        setMessage('Le score doit être compris entre 0 et 100.');
        return;
      }
    } else if (!feedback.trim()) {
      setMessage('Un motif est obligatoire pour demander des corrections ou refuser.');
      return;
    }
    setDrawerBusy(true);
    try {
      await evaluateProjectDeliverable(deliverable.id, status, feedback.trim(), score);
      await openApplications(selectedProject);
      setMessage(status === 'accepted' ? 'Livrable validé. La preuve reste privée jusqu’à sa validation et à l’accord de publication.' : 'Évaluation du livrable enregistrée.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Évaluation impossible.');
    } finally {
      setDrawerBusy(false);
    }
  };

  const openProtectedFile = async (deliverable: ProjectDeliverable) => {
    if (!deliverable.file_path) return;
    try {
      const result = await getProjectFileUrl(deliverable.project_id, deliverable.file_path);
      void openExternalUrl(result.signed_url);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Accès au fichier impossible.');
    }
  };

  const moveProject = async (status: 'selection' | 'published' | 'in_progress' | 'closed') => {
    if (!selectedProject) return;
    setDrawerBusy(true);
    try {
      const result = await changeProjectStatus(selectedProject.id, status);
      setSelectedProject(result.project);
      setMessage('Statut du projet mis à jour.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Changement de statut impossible.');
    } finally {
      setDrawerBusy(false);
    }
  };

  const setField = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => setForm(previous => ({ ...previous, [key]: value }));

  return (
    <OwnerWorkspaceFrame admin={isAdminWorkspace}>
      <div className="mx-auto max-w-7xl bg-[#FAF4F0] p-5 sm:p-8">
        <div className="overflow-hidden rounded-[26px] border border-[#E9D7CE] bg-white p-6 shadow-[0_16px_45px_rgba(0,32,80,.06)] sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#B5623C]">Atelier de pilotage</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Projets, équipes et livrables</h1><p className="mt-2 max-w-2xl text-slate-600">Créez une mission, faites-la valider, sélectionnez les participants puis suivez le cycle jusqu’aux preuves d’expérience.</p></div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#002050' }}><Plus size={17} /> Nouveau projet</button>
        </div><div className="mt-6 grid gap-2 sm:grid-cols-4"><div className="rounded-xl bg-[#F3EBDD] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#87530F]">01 · Proposer</p></div><div className="rounded-xl bg-[#EEF1F5] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#43566E]">02 · Sélectionner</p></div><div className="rounded-xl bg-[#EDF4F5] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#0D5D6A]">03 · Piloter</p></div><div className="rounded-xl bg-[#EEF6F0] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#2E6B48]">04 · Valider</p></div></div></div>

        {message && <div className="mt-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#E7D4A1', background: '#FFFBF0', color: '#6E4C08' }}>{message}</div>}
        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[['Projets', metrics.total], ['En validation', metrics.pending], ['Actifs', metrics.published], ['Candidatures', metrics.candidates]].map(([label, value]) => <div key={String(label)} className="border bg-white p-5" style={{ borderColor: '#E4E7EC', borderRadius: 16 }}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold" style={{ color: '#002050' }}>{value}</p></div>)}
        </div>

        <section className="mt-8 border bg-white" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#EEF0F3' }}><div><h2 className="text-xl font-bold" style={{ color: '#002050' }}>Projets proposés</h2><p className="mt-1 text-sm text-slate-600">Les projets partenaires sont publiés après validation.</p></div><button onClick={load} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"><RefreshCw size={18} /></button></div>
          {loading ? <div className="h-64 animate-pulse bg-slate-50" /> : projects.length ? <div className="divide-y" style={{ borderColor: '#EEF0F3' }}>{projects.map(project => (
            <div key={project.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#BF8813' }}>{PROJECT_TYPE_LABELS[project.project_type]}</span><ProjectStatusBadge status={project.status} /></div><h3 className="mt-2 text-lg font-bold" style={{ color: '#002050' }}>{project.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{project.short_description || project.description}</p><p className="mt-2 text-xs text-slate-500">{project.application_count || 0} candidature(s) · {project.team_count || 0} équipe(s)</p></div>
              <div className="flex flex-wrap gap-2"><button onClick={() => openApplications(project)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}><Users size={15} /> Candidatures</button>{['draft', 'changes_requested', 'rejected'].includes(project.status) && <button onClick={() => openEdit(project)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}><Edit3 size={15} /> Modifier</button>}{['draft', 'changes_requested', 'rejected'].includes(project.status) && <button onClick={() => sendExisting(project)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: '#BF8813' }}><Send size={15} /> Soumettre</button>}<button type="button" onClick={() => void removeProject(project)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"><Trash2 size={15} /> {['draft', 'changes_requested', 'rejected'].includes(project.status) ? 'Supprimer' : 'Demander la suppression'}</button><a href={`/projects/${project.slug}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: '#002050' }}><Eye size={15} /> Voir</a></div>
            </div>
          ))}</div> : <div className="px-5 py-14 text-center"><FolderKanban className="mx-auto" size={34} style={{ color: '#BF8813' }} /><h3 className="mt-4 font-bold" style={{ color: '#002050' }}>Aucun projet créé</h3><p className="mt-1 text-sm text-slate-600">Commencez avec un projet réel, un challenge ou une mission.</p></div>}
        </section>

        <OwnerProjectRecommendationsPanel projects={projects} />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-8" onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <form onSubmit={event => save(event, false)} className="w-full max-w-5xl bg-white" style={{ borderRadius: 20 }}>
            <div className="flex items-start justify-between border-b px-6 py-5 sm:px-8" style={{ borderColor: '#E4E7EC' }}><div><p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#BF8813' }}>{editing ? 'Modification' : 'Nouveau projet'}</p><h2 className="mt-1 text-2xl font-bold" style={{ color: '#002050' }}>{editing ? editing.title : 'Créer une opportunité Projects'}</h2></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="max-h-[72vh] overflow-y-auto px-6 py-6 sm:px-8">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Titre *</span><input value={form.title} onChange={event => setField('title', event.target.value)} required className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Format *</span><select value={form.project_type} onChange={event => setField('project_type', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}>{Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span className="text-sm font-semibold text-slate-700">Organisation porteuse</span><input value={form.organization_name} onChange={event => setField('organization_name', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Résumé</span><input value={form.short_description} onChange={event => setField('short_description', event.target.value)} maxLength={420} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Description complète *</span><textarea value={form.description} onChange={event => setField('description', event.target.value)} required rows={6} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Problématique</span><textarea value={form.problem_statement} onChange={event => setField('problem_statement', event.target.value)} rows={4} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Objectifs</span><textarea value={form.objectives} onChange={event => setField('objectives', event.target.value)} rows={4} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Livrables attendus</span><textarea value={form.deliverables_summary} onChange={event => setField('deliverables_summary', event.target.value)} rows={4} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Compétences, séparées par des virgules</span><input value={form.required_skills} onChange={event => setField('required_skills', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Langues</span><input value={form.languages} onChange={event => setField('languages', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Visibilité</span><select value={form.visibility} onChange={event => setField('visibility', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="public">Publique</option><option value="authenticated">Utilisateurs connectés</option><option value="structure">Structure</option><option value="cohort">Cohorte</option><option value="invitation">Invitation uniquement</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Niveau</span><select value={form.level} onChange={event => setField('level', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="all">Tous niveaux</option><option value="beginner">Débutant</option><option value="intermediate">Intermédiaire</option><option value="advanced">Avancé</option><option value="expert">Expert</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Participation</span><select value={form.participation_mode} onChange={event => setField('participation_mode', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="individual">Individuelle</option><option value="team">En équipe</option><option value="individual_or_team">Individuel ou équipe</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Constitution des équipes</span><select value={form.team_creation_mode} onChange={event => setField('team_creation_mode', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="candidate">Par les candidats</option><option value="owner">Par le porteur</option><option value="candidate_or_owner">Candidats ou porteur</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Mode de sélection</span><select value={form.selection_mode} onChange={event => setField('selection_mode', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="manual">Manuel</option><option value="mixed">Mixte</option><option value="automatic">Automatique (règles préparées, validation manuelle)</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Charge estimée (heures)</span><input type="number" min="0" value={form.estimated_hours} onChange={event => setField('estimated_hours', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Clôture des candidatures</span><input type="datetime-local" value={form.application_closes_at} onChange={event => setField('application_closes_at', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Début</span><input type="datetime-local" value={form.starts_at} onChange={event => setField('starts_at', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Fin</span><input type="datetime-local" value={form.ends_at} onChange={event => setField('ends_at', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Confidentialité</span><select value={form.confidentiality_level} onChange={event => setField('confidentiality_level', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="public">Publique</option><option value="standard">Standard</option><option value="confidential">Confidentielle</option><option value="strictly_confidential">Strictement confidentielle</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Propriété intellectuelle</span><select value={form.ip_policy} onChange={event => setField('ip_policy', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="participant_owned">Conservée par les participants</option><option value="partner_license">Licence accordée au partenaire</option><option value="joint_ownership">Propriété conjointe</option><option value="separate_assignment_agreement">Cession par accord séparé</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Publication dans le portfolio</span><select value={form.portfolio_policy} onChange={event => setField('portfolio_policy', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="forbidden">Interdite</option><option value="anonymized_only">Preuve anonymisée uniquement</option><option value="validated_summary">Résumé validé</option><option value="authorized_deliverable">Livrable autorisé</option></select></label>
                <label><span className="text-sm font-semibold text-slate-700">Récompense</span><select value={form.reward_type} onChange={event => setField('reward_type', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="none">Aucune récompense</option><option value="participation_certificate">Certificat de participation</option><option value="badge">Badge</option><option value="recommendation">Recommandation</option><option value="omnia_credit">Crédit Omnia</option><option value="financial_prize">Prix financier</option><option value="partner_interview">Entretien partenaire</option><option value="internship_opportunity">Opportunité de stage</option><option value="job_opportunity">Opportunité d’emploi</option><option value="training_access">Accès à une formation</option><option value="portfolio_publication">Publication portfolio</option><option value="multiple">Plusieurs récompenses</option></select></label>
                {form.reward_type !== 'none' && <label><span className="text-sm font-semibold text-slate-700">Détails de la récompense</span><input value={form.reward_description} onChange={event => setField('reward_description', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} placeholder="Conditions et contenu de la récompense" /></label>}
                {form.reward_type === 'financial_prize' && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_160px]"><label><span className="text-sm font-semibold text-slate-700">Montant annoncé</span><input type="number" min="0" step="0.01" required value={form.reward_amount} onChange={event => setField('reward_amount', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label><label><span className="text-sm font-semibold text-slate-700">Devise</span><select value={form.reward_currency} onChange={event => setField('reward_currency', event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="XOF">XOF</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label><p className="text-xs text-slate-500 sm:col-span-2">Le projet peut être soumis, mais il ne pourra pas être publié avant la vérification documentée du financement par l’Administration Omnia.</p></div>}
                <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={form.nda_required} onChange={event => setField('nda_required', event.target.checked)} /><span className="text-sm font-semibold text-slate-700">Engagement de confidentialité obligatoire</span></label>
                <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={form.recruitment_opportunity} onChange={event => setField('recruitment_opportunity', event.target.checked)} /><span className="text-sm font-semibold text-slate-700">Peut conduire à une opportunité, sans garantie</span></label>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t px-6 py-5 sm:flex-row sm:justify-end sm:px-8" style={{ borderColor: '#E4E7EC' }}><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}>Annuler</button><button disabled={saving} className="rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: '#002050', color: '#002050' }}>{saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}</button><button type="button" disabled={saving} onClick={event => save(event as unknown as FormEvent, true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: '#BF8813' }}><Send size={16} /> Enregistrer et soumettre</button></div>
          </form>
        </div>
      )}

      {selectedProject && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/50" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProject(null); }}>
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#BF8813' }}>Pilotage du projet</p><h2 className="mt-1 text-2xl font-bold" style={{ color: '#002050' }}>{selectedProject.title}</h2><div className="mt-2"><ProjectStatusBadge status={selectedProject.status} /></div></div>
              <button onClick={() => setSelectedProject(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
            </div>

            <section className="mt-7 rounded-xl border p-4" style={{ borderColor: '#E4E7EC', background: '#F8FAFD' }}>
              <h3 className="font-bold" style={{ color: '#002050' }}>Cycle du projet</h3>
              <p className="mt-1 text-sm text-slate-600">Faites avancer le projet selon son état réel. Les actions administratives restent disponibles à l’Administration Omnia.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedProject.status === 'published' && <button disabled={drawerBusy} onClick={() => moveProject('selection')} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}>Ouvrir la sélection</button>}
                {selectedProject.status === 'selection' && <button disabled={drawerBusy} onClick={() => moveProject('published')} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}>Revenir aux candidatures</button>}
                {['published', 'selection'].includes(selectedProject.status) && <button disabled={drawerBusy} onClick={() => moveProject('in_progress')} className="rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: '#002050' }}>Démarrer le projet</button>}
                {['published', 'selection', 'in_progress'].includes(selectedProject.status) && <button disabled={drawerBusy} onClick={() => moveProject('closed')} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#BF8813', color: '#76520A' }}>Clôturer</button>}
              </div>
            </section>

            <section className="mt-7 border-t pt-7" style={{ borderColor: '#EEF0F3' }}>
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><Users size={19} style={{ color: '#BF8813' }} /> Entreprises et institutions participantes</h3>
              <p className="mt-1 text-sm text-slate-600">Ajoutez les partenaires réellement impliqués. Leur statut officiel doit être confirmé par l’Administration Omnia.</p>
              <div className="mt-4 divide-y rounded-xl border" style={{borderColor:'#E4E7EC'}}>{partners.length ? partners.map(partner=><div key={partner.id} className="flex items-start justify-between gap-3 p-4"><div><p className="font-semibold text-slate-900">{partner.partner_name}</p><p className="text-xs text-slate-500">{partner.partner_role} · {partner.status}</p>{partner.notes&&<p className="mt-1 text-sm text-slate-600">{partner.notes}</p>}</div>{partner.status!=='withdrawn'&&<button type="button" disabled={drawerBusy} onClick={()=>withdrawPartner(partner)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700">Retirer</button>}</div>) : <p className="p-4 text-sm text-slate-500">Aucun partenaire supplémentaire.</p>}</div>
              <form onSubmit={addPartner} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><input required value={partnerName} onChange={event=>setPartnerName(event.target.value)} placeholder="Nom de l’entreprise ou institution" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{borderColor:'#D0D5DD'}}/><select value={partnerRole} onChange={event=>setPartnerRole(event.target.value as ProjectPartner['partner_role'])} className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{borderColor:'#D0D5DD'}}>{['co_owner','client','sponsor','technical','academic','institutional','mentor','evaluator','participant'].map(role=><option key={role} value={role}>{role}</option>)}</select><textarea value={partnerNotes} onChange={event=>setPartnerNotes(event.target.value)} rows={2} placeholder="Rôle concret, convention ou contribution" className="rounded-lg border bg-white px-3 py-2.5 text-sm sm:col-span-2" style={{borderColor:'#D0D5DD'}}/><button disabled={drawerBusy} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white sm:col-span-2" style={{background:'#002050'}}>Proposer ce partenaire</button></form>
            </section>

            <section id="jalons" className="scroll-mt-40 mt-7">
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><CalendarDays size={19} style={{ color: '#BF8813' }} /> Jalons et livrables</h3>
              {milestones.length ? <div className="mt-4 space-y-3">{milestones.map(milestone => <div key={milestone.id} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{milestone.sequence_no}. {milestone.title}</p>{milestone.description && <p className="mt-1 text-sm text-slate-600">{milestone.description}</p>}</div><span className="text-xs font-semibold text-slate-500">{milestone.due_at ? new Date(milestone.due_at).toLocaleDateString('fr-FR') : 'Sans date'}</span></div></div>)}</div> : <p className="mt-3 text-sm text-slate-600">Aucun jalon défini.</p>}
              <form onSubmit={addMilestone} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <input required value={milestoneTitle} onChange={event => setMilestoneTitle(event.target.value)} placeholder="Titre du jalon" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                <input type="datetime-local" value={milestoneDueAt} onChange={event => setMilestoneDueAt(event.target.value)} className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                <textarea value={milestoneDescription} onChange={event => setMilestoneDescription(event.target.value)} placeholder="Description et livrable attendu" rows={2} className="rounded-lg border bg-white px-3 py-2.5 text-sm sm:col-span-2" style={{ borderColor: '#D0D5DD' }} />
                <button disabled={drawerBusy} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white sm:col-span-2" style={{ background: '#002050' }}>Ajouter le jalon</button>
              </form>
            </section>

            {selectedProject.participation_mode !== 'individual' && selectedProject.team_creation_mode !== 'candidate' && (
              <section id="equipes" className="scroll-mt-40 mt-8 border-t pt-7" style={{ borderColor: '#EEF0F3' }}>
                <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><Users size={19} style={{ color: '#BF8813' }} /> Équipes constituées par le porteur</h3>
                <p className="mt-1 text-sm text-slate-600">Le chef d’équipe reçoit une invitation et doit donner son consentement avant d’être ajouté.</p>
                {teams.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{teams.map(team => <div key={team.id} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{team.name}</p><p className="mt-1 text-sm text-slate-600">{team.members?.filter(member => member.invitation_status === 'accepted').length || 0} membre(s) confirmé(s)</p></div><span className="text-xs font-semibold text-slate-500">{team.status}</span></div><div className="mt-3 space-y-1">{team.members?.map(member => <p key={member.id} className="text-xs text-slate-600">{member.user?.full_name || member.user?.email || 'Utilisateur'} · {member.member_role} · {member.invitation_status}</p>)}</div></div>)}</div> : <p className="mt-4 text-sm text-slate-600">Aucune équipe créée par le porteur.</p>}
                <form onSubmit={createOwnerTeam} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <input required value={teamName} onChange={event => setTeamName(event.target.value)} placeholder="Nom de l’équipe" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                  <input type="email" required value={teamLeaderEmail} onChange={event => setTeamLeaderEmail(event.target.value)} placeholder="Email du chef d’équipe inscrit" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                  <textarea value={teamDescription} onChange={event => setTeamDescription(event.target.value)} rows={2} placeholder="Description de l’équipe" className="rounded-lg border bg-white px-3 py-2.5 text-sm sm:col-span-2" style={{ borderColor: '#D0D5DD' }} />
                  <button disabled={drawerBusy} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white sm:col-span-2" style={{ background: '#002050' }}>Créer et inviter le chef d’équipe</button>
                </form>
              </section>
            )}

            <section id="livrables" className="scroll-mt-40 mt-8 border-t pt-7" style={{ borderColor: '#EEF0F3' }}>
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><FileCheck2 size={19} style={{ color: '#BF8813' }} /> Livrables reçus</h3>
              <p className="mt-1 text-sm text-slate-600">Une validation crée une preuve interne privée, sans publication automatique dans le portfolio.</p>
              {applicationsLoading ? <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" /> : deliverables.length ? <div className="mt-4 space-y-3">{deliverables.map(deliverable => (
                <div key={deliverable.id} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">{deliverable.title}</p><p className="mt-1 text-sm text-slate-600">{deliverable.submitter?.full_name || 'Participant'}{deliverable.team?.name ? ` · ${deliverable.team.name}` : ''}{deliverable.milestone?.title ? ` · ${deliverable.milestone.title}` : ''}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{deliverable.status.split('_').join(' ')}</span></div>
                  {deliverable.description && <p className="mt-3 text-sm leading-6 text-slate-700">{deliverable.description}</p>}
                  {deliverable.evaluation_feedback && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{deliverable.evaluation_feedback}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {deliverable.file_path && <button type="button" onClick={() => openProtectedFile(deliverable)} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#D0D5DD' }}>Ouvrir le fichier protégé</button>}
                    {deliverable.external_url && <a href={deliverable.external_url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#D0D5DD' }}>Ouvrir le lien</a>}
                    <button disabled={drawerBusy} type="button" onClick={() => evaluateDeliverable(deliverable, 'changes_requested')} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#BF8813', color: '#76520A' }}>Demander des corrections</button>
                    <button disabled={drawerBusy} type="button" onClick={() => evaluateDeliverable(deliverable, 'rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Refuser</button>
                    <button disabled={drawerBusy} type="button" onClick={() => evaluateDeliverable(deliverable, 'accepted')} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: '#087A55' }}><Check size={13} /> Valider</button>
                  </div>
                </div>
              ))}</div> : <p className="mt-4 text-sm text-slate-600">Aucun livrable reçu.</p>}
            </section>

            <section className="mt-8 border-t pt-7" style={{ borderColor: '#EEF0F3' }}>
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><Mail size={19} style={{ color: '#BF8813' }} /> Invitation contrôlée</h3>
              <p className="mt-1 text-sm text-slate-600">Utile pour les projets privés ou sur invitation. L’accès n’est actif qu’après acceptation.</p>
              <form onSubmit={inviteParticipant} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto]">
                <input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="Email de l’utilisateur inscrit" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                <button disabled={drawerBusy} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#BF8813' }}>Inviter</button>
                <input value={inviteMessage} onChange={event => setInviteMessage(event.target.value)} placeholder="Message facultatif" className="rounded-lg border bg-white px-3 py-2.5 text-sm sm:col-span-2" style={{ borderColor: '#D0D5DD' }} />
              </form>
            </section>

            <section id="candidatures" className="scroll-mt-40 mt-8 border-t pt-7" style={{ borderColor: '#EEF0F3' }}>
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#002050' }}><ClipboardList size={19} style={{ color: '#BF8813' }} /> Candidatures</h3>
              {applicationsLoading ? <div className="mt-5 h-48 animate-pulse rounded-xl bg-slate-100" /> : applications.length ? <div className="mt-5 space-y-4">{applications.map(application => <div key={application.id} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-slate-900">{application.applicant?.full_name || 'Candidat'}</h4><p className="mt-1 text-sm text-slate-600">{application.applicant?.email} · {application.application_mode === 'team' ? application.team?.name || 'Équipe' : 'Individuel'}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{application.status}</span></div>{application.motivation && <p className="mt-4 text-sm leading-6 text-slate-700">{application.motivation}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={() => review(application, 'under_review')} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#D0D5DD' }}>En analyse</button><button onClick={() => review(application, 'waitlisted')} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#D0D5DD' }}>Liste d’attente</button><button onClick={() => review(application, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><X size={13} /> Refuser</button><button onClick={() => review(application, 'selected')} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: '#002050' }}><Check size={13} /> Sélectionner</button></div></div>)}</div> : <div className="mt-5 rounded-xl bg-slate-50 px-5 py-10 text-center"><ClipboardList className="mx-auto" size={32} style={{ color: '#BF8813' }} /><p className="mt-3 font-semibold text-slate-800">Aucune candidature reçue</p></div>}
            </section>
          </div>
        </div>
      )}
    </OwnerWorkspaceFrame>
  );
}
