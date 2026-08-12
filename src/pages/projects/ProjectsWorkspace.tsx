import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock3, FileCheck2, FolderKanban, Mail, RefreshCw, Send, Upload, Users, X } from 'lucide-react';
import {
  getMyProjectsWorkspace,
  getProjectsContext,
  getProjectDetail,
  inviteProjectTeamMember,
  ProjectApplication,
  ProjectDeliverable,
  ProjectInvitation,
  ProjectMilestone,
  ProjectTeam,
  respondProjectInvitation,
  respondProjectTeamInvite,
  submitProjectDeliverable,
  uploadProjectFile,
} from '../../lib/projectsApi';
import { ProjectsWorkspaceFrame } from '../../components/projects/ProjectUi';

const APPLICATION_LABELS: Record<string, string> = {
  submitted: 'Envoyée', under_review: 'En analyse', waitlisted: 'Liste d’attente', selected: 'Sélectionnée', rejected: 'Non retenue', withdrawn: 'Retirée', cancelled: 'Annulée', draft: 'Brouillon',
};

const DELIVERABLE_LABELS: Record<string, string> = {
  submitted: 'Déposé', changes_requested: 'Corrections demandées', accepted: 'Validé', rejected: 'Refusé', draft: 'Brouillon', withdrawn: 'Retiré',
};

type Membership = { id: string; member_role?: string; team: ProjectTeam };
type ParticipationOption = { key: string; projectId: string; projectTitle: string; teamId?: string; label: string };

export default function ProjectsWorkspace() {
  const navigate = useNavigate();
  const [accessChecked, setAccessChecked] = useState(false);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Array<{ id: string; invited_at: string; team: ProjectTeam }>>([]);
  const [projectInvitations, setProjectInvitations] = useState<ProjectInvitation[]>([]);
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [participationKey, setParticipationKey] = useState('');
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestoneId, setMilestoneId] = useState('');
  const [deliverableTitle, setDeliverableTitle] = useState('');
  const [deliverableDescription, setDeliverableDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getMyProjectsWorkspace();
      setApplications(result.applications);
      setMemberships(result.memberships as Membership[]);
      setInvitations(result.invitations as Array<{ id: string; invited_at: string; team: ProjectTeam }>);
      setProjectInvitations(result.project_invitations || []);
      setDeliverables(result.deliverables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger votre espace Projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const previewMode = new URLSearchParams(window.location.search).get('preview') === 'true';
    getProjectsContext()
      .then(context => {
        if (!active) return;
        if (context.is_admin || context.roles.includes('super_admin')) {
          if (previewMode) { setAccessChecked(true); setLoading(false); return; }
          navigate('/admin/projects', { replace: true });
          return;
        }
        if (context.roles.includes('professeur')) {
          navigate('/professeur/projects', { replace: true });
          return;
        }
        if (context.roles.includes('structure') || context.organization_id) {
          navigate('/structure/projects', { replace: true });
          return;
        }
        setAccessChecked(true);
        load();
      })
      .catch(() => {
        if (!active) return;
        setAccessChecked(true);
        load();
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const pendingProjectInvitations = useMemo(
    () => projectInvitations.filter(invitation => invitation.status === 'pending'),
    [projectInvitations],
  );

  const acceptedProjectInvitations = useMemo(
    () => projectInvitations.filter(invitation => invitation.status === 'accepted'),
    [projectInvitations],
  );

  const participationOptions = useMemo<ParticipationOption[]>(() => {
    const options: ParticipationOption[] = [];
    const keys = new Set<string>();
    applications.filter(item => item.status === 'selected' && item.application_mode === 'individual' && item.project).forEach(item => {
      const key = `individual:${item.project_id}`;
      if (!keys.has(key)) {
        keys.add(key);
        options.push({ key, projectId: item.project_id, projectTitle: item.project!.title, label: `${item.project!.title} — individuel` });
      }
    });
    memberships.forEach(item => {
      if (!item.team?.project_id || !item.team.project) return;
      const key = `team:${item.team.id}`;
      if (!keys.has(key)) {
        keys.add(key);
        options.push({ key, projectId: item.team.project_id, projectTitle: item.team.project.title, teamId: item.team.id, label: `${item.team.project.title} — équipe ${item.team.name}` });
      }
    });
    acceptedProjectInvitations.forEach(invitation => {
      if (!invitation.project || invitation.team_id) return;
      const key = `invitation:${invitation.project_id}`;
      if (!keys.has(key)) {
        keys.add(key);
        options.push({
          key,
          projectId: invitation.project_id,
          projectTitle: invitation.project.title,
          label: `${invitation.project.title} — invitation acceptée`,
        });
      }
    });
    return options;
  }, [applications, memberships, acceptedProjectInvitations]);

  const selectedParticipation = participationOptions.find(item => item.key === participationKey) || null;

  const selectParticipation = async (key: string) => {
    setParticipationKey(key);
    setMilestoneId('');
    setMilestones([]);
    const option = participationOptions.find(item => item.key === key);
    if (!option) return;
    try {
      const detail = await getProjectDetail({ project_id: option.projectId });
      setMilestones(detail.milestones || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Impossible de charger les jalons.');
    }
  };

  const respond = async (id: string, response: 'accepted' | 'declined') => {
    setMessage('');
    try {
      await respondProjectTeamInvite(id, response);
      setMessage(response === 'accepted' ? 'Invitation acceptée.' : 'Invitation refusée.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action impossible.');
    }
  };

  const respondProject = async (id: string, response: 'accepted' | 'declined') => {
    setMessage('');
    try {
      await respondProjectInvitation(id, response);
      setMessage(response === 'accepted' ? 'Invitation au projet acceptée.' : 'Invitation au projet refusée.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action impossible.');
    }
  };

  const sendInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteTeamId || !inviteEmail) return;
    setMessage('');
    try {
      await inviteProjectTeamMember(inviteTeamId, inviteEmail);
      setInviteEmail('');
      setMessage('Invitation envoyée. Le membre devra l’accepter avant de rejoindre l’équipe.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Invitation impossible.');
    }
  };

  const submitDeliverable = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedParticipation || !deliverableTitle.trim()) return;
    if (!deliverableFile && !externalUrl.trim() && !deliverableDescription.trim()) {
      setMessage('Ajoutez un fichier protégé, un lien ou une description du livrable.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const uploaded = deliverableFile ? await uploadProjectFile(selectedParticipation.projectId, deliverableFile) : null;
      await submitProjectDeliverable(selectedParticipation.projectId, {
        team_id: selectedParticipation.teamId || null,
        milestone_id: milestoneId || null,
        title: deliverableTitle.trim(),
        description: deliverableDescription.trim(),
        external_url: externalUrl.trim() || null,
        ...(uploaded || {}),
        confidentiality_level: 'project',
        portfolio_visibility: 'not_allowed',
      });
      setDeliverableTitle('');
      setDeliverableDescription('');
      setExternalUrl('');
      setDeliverableFile(null);
      setMilestoneId('');
      setMessage('Livrable déposé. Il reste privé jusqu’à son évaluation et ne sera pas publié automatiquement.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Dépôt du livrable impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!accessChecked) {
    return <div className="min-h-[50vh] bg-slate-50" />;
  }

  return (
    <ProjectsWorkspaceFrame>
      <div className="mx-auto max-w-7xl bg-[#F7F4EE] p-5 sm:p-8">
        <div className="overflow-hidden rounded-[26px] border border-[#E6DED1] bg-white p-6 shadow-[0_16px_45px_rgba(0,32,80,.06)] sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#BF8813' }}>Omnia Projects</p>
            <h1 className="mt-2 text-3xl font-bold" style={{ color: '#002050' }}>Mes projets et équipes</h1>
            <p className="mt-2 text-slate-600">Suivez vos candidatures, invitations, équipes et livrables.</p>
          </div>
          <Link to="/projects/explorer" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#002050' }}>
            <FolderKanban size={17} /> Explorer les projets
          </Link>
        </div><div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span className="rounded-full bg-[#F3EBDD] px-3 py-1.5 text-[#87530F]">Candidatures</span><span className="rounded-full bg-[#EDF4F5] px-3 py-1.5 text-[#0D5D6A]">Équipes</span><span className="rounded-full bg-[#EEF1F5] px-3 py-1.5 text-[#43566E]">Livrables</span></div></div>

        {message && <div className="mt-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#E7D4A1', background: '#FFFBF0', color: '#6E4C08' }}>{message}</div>}
        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white" /> : (
          <div className="mt-8 space-y-8">
            {!!pendingProjectInvitations.length && (
              <section id="invitations" className="scroll-mt-40 border bg-white p-5 sm:p-6" style={{ borderColor: '#DCE4EF', borderRadius: 18 }}>
                <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><Mail size={20} style={{ color: '#BF8813' }} /> Invitations à des projets</h2>
                <p className="mt-1 text-sm text-slate-600">L’accès n’est accordé qu’après votre consentement explicite.</p>
                <div className="mt-5 space-y-3">
                  {pendingProjectInvitations.map(invitation => (
                    <div key={invitation.id} className="flex flex-col gap-4 border-t pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#EEF0F3' }}>
                      <div><p className="font-bold text-slate-900">{invitation.project?.title || 'Projet Omnia'}</p><p className="mt-1 text-sm text-slate-600">{invitation.project?.organization_name || 'Organisation partenaire'} · Rôle proposé : {invitation.invitation_role.split('_').join(' ')}</p>{invitation.message && <p className="mt-2 text-sm text-slate-500">{invitation.message}</p>}</div>
                      <div className="flex gap-2"><button onClick={() => respondProject(invitation.id, 'declined')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}><X size={15} /> Refuser</button><button onClick={() => respondProject(invitation.id, 'accepted')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: '#002050' }}><Check size={15} /> Accepter</button></div>
                    </div>
                  ))}
                </div>
              </section>
            )}


            {!!acceptedProjectInvitations.length && (
              <section className="border bg-white p-5 sm:p-6" style={{ borderColor: '#D7E8DE', borderRadius: 18 }}>
                <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><Check size={20} style={{ color: '#1E7A52' }} /> Projets accessibles sur invitation</h2>
                <p className="mt-1 text-sm text-slate-600">Ces invitations ont été acceptées et restent accessibles dans votre espace Projects.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {acceptedProjectInvitations.map(invitation => (
                    <div key={invitation.id} className="rounded-xl border p-4" style={{ borderColor: '#D7E8DE', background: '#F7FCF9' }}>
                      <Link to={`/projects/${invitation.project?.slug || ''}`} className="font-bold hover:underline" style={{ color: '#002050' }}>
                        {invitation.project?.title || 'Projet Omnia'}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">{invitation.project?.organization_name || 'Organisation partenaire'}</p>
                      <p className="mt-3 text-xs font-semibold text-emerald-700">Accès accepté · {invitation.invitation_role.split('_').join(' ')}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!!invitations.length && (
              <section className="border bg-white p-5 sm:p-6" style={{ borderColor: '#E7D4A1', borderRadius: 18 }}>
                <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><Mail size={20} style={{ color: '#BF8813' }} /> Invitations en attente</h2>
                <div className="mt-5 space-y-3">
                  {invitations.map(invitation => (
                    <div key={invitation.id} className="flex flex-col gap-4 border-t pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#EEF0F3' }}>
                      <div><p className="font-bold text-slate-900">{invitation.team?.name}</p><p className="mt-1 text-sm text-slate-600">Projet : {invitation.team?.project?.title || 'Projet Omnia'}</p></div>
                      <div className="flex gap-2"><button onClick={() => respond(invitation.id, 'declined')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}><X size={15} /> Refuser</button><button onClick={() => respond(invitation.id, 'accepted')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: '#002050' }}><Check size={15} /> Accepter</button></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section id="candidatures" className="scroll-mt-40 border bg-white p-5 sm:p-6" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
              <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold" style={{ color: '#002050' }}>Mes candidatures</h2><p className="mt-1 text-sm text-slate-600">Le statut est mis à jour par le porteur du projet.</p></div><button onClick={load} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50" aria-label="Actualiser"><RefreshCw size={18} /></button></div>
              {applications.length ? <div className="mt-5 divide-y" style={{ borderColor: '#EEF0F3' }}>{applications.map(application => (
                <div key={application.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div><Link to={`/projects/${application.project?.slug || ''}`} className="font-bold hover:underline" style={{ color: '#002050' }}>{application.project?.title || 'Projet Omnia'}</Link><p className="mt-1 text-sm text-slate-600">{application.project?.organization_name || 'Organisation partenaire'} · {application.application_mode === 'team' ? 'Équipe' : 'Individuel'}</p></div>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"><Clock3 size={13} /> {APPLICATION_LABELS[application.status] || application.status}</span>
                </div>
              ))}</div> : <div className="mt-6 rounded-xl bg-slate-50 px-5 py-10 text-center"><p className="font-semibold text-slate-800">Aucune candidature</p><p className="mt-1 text-sm text-slate-600">Explorez les projets disponibles pour commencer.</p></div>}
            </section>

            <section id="equipes" className="scroll-mt-40 border bg-white p-5 sm:p-6" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
              <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><Users size={20} style={{ color: '#BF8813' }} /> Mes équipes</h2>
              {memberships.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{memberships.map(membership => (
                <div key={membership.id} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}><p className="font-bold text-slate-900">{membership.team?.name}</p><p className="mt-1 text-sm text-slate-600">{membership.team?.project?.title || 'Projet Omnia'}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{membership.team?.status}</span>{membership.team?.invitation_code && <span className="font-mono">{membership.team.invitation_code}</span>}</div></div>
              ))}</div> : <p className="mt-5 text-sm text-slate-600">Vous n’avez encore rejoint aucune équipe.</p>}

              {!!memberships.length && (
                <form onSubmit={sendInvite} className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[220px_1fr_auto]">
                  <select value={inviteTeamId} onChange={event => setInviteTeamId(event.target.value)} required className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="">Choisir une équipe</option>{memberships.map(item => <option key={item.team.id} value={item.team.id}>{item.team.name}</option>)}</select>
                  <input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} required placeholder="Email du membre" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                  <button className="rounded-lg px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#BF8813' }}>Inviter</button>
                </form>
              )}
            </section>

            <section className="border bg-white p-5 sm:p-6" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
              <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><Upload size={20} style={{ color: '#BF8813' }} /> Déposer un livrable</h2>
              <p className="mt-1 text-sm text-slate-600">Les fichiers sont enregistrés dans un espace privé. Un livrable reste privé jusqu’à sa publication explicite.</p>
              {participationOptions.length ? (
                <form onSubmit={submitDeliverable} className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <select required value={participationKey} onChange={event => selectParticipation(event.target.value)} className="rounded-lg border bg-white px-3 py-2.5 text-sm sm:col-span-2" style={{ borderColor: '#D0D5DD' }}><option value="">Choisir le projet et le mode de participation</option>{participationOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
                  <select value={milestoneId} onChange={event => setMilestoneId(event.target.value)} className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="">Livrable général / aucun jalon</option>{milestones.map(milestone => <option key={milestone.id} value={milestone.id}>{milestone.sequence_no}. {milestone.title}</option>)}</select>
                  <input required value={deliverableTitle} onChange={event => setDeliverableTitle(event.target.value)} placeholder="Titre du livrable" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                  <textarea value={deliverableDescription} onChange={event => setDeliverableDescription(event.target.value)} rows={3} placeholder="Description ou note de remise" className="rounded-lg border bg-white px-3 py-2.5 text-sm sm:col-span-2" style={{ borderColor: '#D0D5DD' }} />
                  <input type="url" value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="Lien externe sécurisé (facultatif)" className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} />
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-700" style={{ borderColor: '#D0D5DD' }}><Upload size={16} /><span className="truncate">{deliverableFile?.name || 'Choisir un fichier protégé'}</span><input type="file" className="sr-only" onChange={event => setDeliverableFile(event.target.files?.[0] || null)} /></label>
                  <button disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white sm:col-span-2" style={{ background: '#002050' }}><Send size={16} /> {submitting ? 'Dépôt en cours...' : 'Déposer le livrable'}</button>
                </form>
              ) : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Le dépôt sera disponible après votre sélection sur un projet ou l’acceptation dans une équipe.</p>}
            </section>

            <section id="livrables" className="scroll-mt-40 border bg-white p-5 sm:p-6" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
              <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><FileCheck2 size={20} style={{ color: '#BF8813' }} /> Mes livrables</h2>
              {deliverables.length ? <div className="mt-5 space-y-3">{deliverables.map(deliverable => (
                <div key={deliverable.id} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">{deliverable.title}</p><p className="mt-1 text-sm text-slate-600">{deliverable.project?.title || 'Projet'}{deliverable.milestone?.title ? ` · ${deliverable.milestone.title}` : ''}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{DELIVERABLE_LABELS[deliverable.status] || deliverable.status}</span></div>
                  {deliverable.evaluation_feedback && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{deliverable.evaluation_feedback}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">{deliverable.file_name && <span>Fichier : {deliverable.file_name}</span>}{deliverable.external_url && <a href={deliverable.external_url} target="_blank" rel="noreferrer" className="font-semibold underline">Ouvrir le lien</a>}{deliverable.evaluation_score != null && <span>Score : {deliverable.evaluation_score}/100</span>}</div>
                </div>
              ))}</div> : <p className="mt-5 text-sm text-slate-600">Aucun livrable déposé.</p>}
            </section>
          </div>
        )}
      </div>
    </ProjectsWorkspaceFrame>
  );
}
