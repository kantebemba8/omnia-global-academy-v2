import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Award, Building2, CalendarDays, CheckCircle2, Clock3,
  FileText, Flag, Languages, LockKeyhole, MapPin, ShieldCheck, Target, Users,
} from 'lucide-react';
import {
  acceptProjectAgreement,
  applyToProject,
  createProjectTeam,
  getProjectDetail,
  OmniaProject,
  ProjectApplication,
  ProjectMilestone,
  ProjectTeam,
  PROJECT_LEVEL_LABELS,
  reportProject,
} from '../../lib/projectsApi';
import { ProjectStatusBadge, ProjectTypeBadge, ProjectsPublicLayout } from '../../components/projects/ProjectUi';

function formatDate(value?: string | null) {
  if (!value) return 'À définir';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'À définir' : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const REWARD_LABELS: Record<string, string> = {
  participation_certificate: 'Certificat de participation',
  badge: 'Badge',
  recommendation: 'Recommandation',
  omnia_credit: 'Crédit Omnia',
  financial_prize: 'Prix financier',
  partner_interview: 'Entretien avec le partenaire',
  internship_opportunity: 'Opportunité de stage',
  job_opportunity: 'Opportunité d’emploi',
  training_access: 'Accès à une formation',
  portfolio_publication: 'Publication validée dans le portfolio',
  multiple: 'Plusieurs formes de reconnaissance',
};

function getRewardDetails(project: OmniaProject) {
  const details = project.reward_details || {};
  const description = typeof details.description === 'string' ? details.description.trim() : '';
  const amountMinor = typeof details.amount_minor === 'number'
    ? details.amount_minor
    : Number(details.amount_minor || 0);
  const currency = typeof details.currency === 'string' ? details.currency : '';
  const amount = Number.isFinite(amountMinor) && amountMinor > 0 && currency
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amountMinor / 100)
    : '';
  return { description, amount };
}

export default function ProjectDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<OmniaProject | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [ownApplication, setOwnApplication] = useState<ProjectApplication | null>(null);
  const [memberships, setMemberships] = useState<Array<{ id: string; member_role: string; team: ProjectTeam }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [approach, setApproach] = useState('');
  const [availability, setAvailability] = useState('');
  const [agreement, setAgreement] = useState(false);
  const [applicationMode, setApplicationMode] = useState<'individual' | 'team'>('individual');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState('other');
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    getProjectDetail({ slug })
      .then(result => {
        setProject(result.project);
        setMilestones(result.milestones);
        setOwnApplication(result.own_application);
        setMemberships(result.memberships as Array<{ id: string; member_role: string; team: ProjectTeam }>);
        setApplicationMode(result.project.participation_mode === 'team' ? 'team' : 'individual');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Projet introuvable.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault();
    if (!project) return;
    const token = localStorage.getItem('omnia_session_token');
    if (!token) {
      navigate(`/connexion?redirect=${encodeURIComponent(`/projects/${project.slug}`)}`);
      return;
    }
    if (!agreement) {
      setMessage('Vous devez accepter les règles de participation et de confidentialité.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      if (project.nda_required) await acceptProjectAgreement(project.id, 'nda');
      let teamId = applicationMode === 'team' ? selectedTeamId : '';
      if (applicationMode === 'team' && !teamId && newTeamName.trim()) {
        const created = await createProjectTeam(project.id, { name: newTeamName.trim(), max_members: project.max_team_size || 10 });
        teamId = created.team.id;
        setMemberships(current => [...current, { id: `local-${created.team.id}`, member_role: 'leader', team: created.team }]);
        setSelectedTeamId(teamId);
      }
      if (applicationMode === 'team' && !teamId) {
        setMessage('Choisissez une équipe existante ou créez-en une avant d’envoyer la candidature.');
        setSubmitting(false);
        return;
      }
      const result = await applyToProject(project.id, {
        application_mode: applicationMode,
        team_id: teamId || undefined,
        motivation,
        proposed_approach: approach,
        availability,
        consent_confirmed: true,
      });
      setOwnApplication(result.application);
      setShowApply(false);
      setMessage('Votre candidature a été envoyée.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'La candidature n’a pas pu être envoyée.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!project || !reportDescription.trim()) return;
    const token = localStorage.getItem('omnia_session_token');
    if (!token) {
      navigate(`/connexion?redirect=${encodeURIComponent(`/projects/${project.slug}`)}`);
      return;
    }
    setReporting(true);
    setMessage('');
    try {
      await reportProject(project.id, reportType, reportDescription.trim());
      setShowReport(false);
      setReportDescription('');
      setMessage('Votre signalement a été transmis au Super Admin.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Le signalement n’a pas pu être envoyé.');
    } finally {
      setReporting(false);
    }
  };

  if (loading) return <ProjectsPublicLayout><div className="mx-auto max-w-6xl px-5 py-20"><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div></ProjectsPublicLayout>;
  if (error || !project) return <ProjectsPublicLayout><div className="mx-auto max-w-3xl px-5 py-20 text-center"><AlertCircle className="mx-auto" size={38} style={{ color: '#BF8813' }} /><h1 className="mt-4 text-2xl font-bold" style={{ color: '#002050' }}>Projet inaccessible</h1><p className="mt-2 text-slate-600">{error || 'Ce projet n’est pas disponible.'}</p><Link to="/projects" className="mt-6 inline-flex items-center gap-2 font-bold" style={{ color: '#002050' }}><ArrowLeft size={17} /> Retour à Omnia Projects</Link></div></ProjectsPublicLayout>;

  const canApply = ['published', 'selection'].includes(project.status) && !ownApplication;
  const reward = getRewardDetails(project);
  const leaderMemberships = memberships.filter(item => item.member_role === 'leader');

  return (
    <ProjectsPublicLayout>
      <section className="px-5 py-12 sm:px-8" style={{ background: 'linear-gradient(135deg, #00183E, #06336F)' }}>
        <div className="mx-auto max-w-6xl">
          <Link to="/projects/explorer" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-100"><ArrowLeft size={16} /> Retour aux projets</Link>
          <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <div className="flex flex-wrap gap-2"><ProjectTypeBadge type={project.project_type} /><ProjectStatusBadge status={project.status} /></div>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl">{project.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-blue-100">{project.short_description || project.description}</p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-blue-50">
                <span className="inline-flex items-center gap-2"><Building2 size={17} style={{ color: '#E8C76E' }} /> {project.organization_name || 'Omnia Global Academy'}</span>
                <span className="inline-flex items-center gap-2"><MapPin size={17} style={{ color: '#E8C76E' }} /> {[project.city, project.country_code].filter(Boolean).join(', ') || 'Zone définie par le porteur'}</span>
                <span className="inline-flex items-center gap-2"><Languages size={17} style={{ color: '#E8C76E' }} /> {(project.languages || ['fr']).join(', ').toUpperCase()}</span>
              </div>
            </div>
            <div className="border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm" style={{ borderRadius: 18 }}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-200">Candidatures</p>
              <p className="mt-2 text-2xl font-bold">Jusqu’au {formatDate(project.application_closes_at)}</p>
              <p className="mt-2 text-sm text-blue-100">{project.participation_mode === 'individual' ? 'Candidature individuelle' : project.participation_mode === 'team' ? 'Candidature en équipe' : 'Individuel ou équipe'}</p>
              {ownApplication ? (
                <div className="mt-5 rounded-xl bg-emerald-400/15 px-4 py-3 text-sm font-semibold"><CheckCircle2 size={17} className="mr-2 inline" /> Candidature : {ownApplication.status}</div>
              ) : canApply ? (
                <button onClick={() => { setApplicationMode(project.participation_mode === 'team' ? 'team' : 'individual'); setShowApply(true); }} className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#BF8813' }}>Candidater</button>
              ) : (
                <div className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm">Les candidatures ne sont pas ouvertes.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {message && <div className="mx-auto mt-6 max-w-6xl px-5 sm:px-8"><div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#E7D4A1', background: '#FFFBF0', color: '#6E4C08' }}>{message}</div></div>}

      <section className="px-5 py-12 sm:px-8 lg:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            <section><h2 className="text-2xl font-bold" style={{ color: '#002050' }}>La mission</h2><div className="mt-4 whitespace-pre-line leading-7 text-slate-700">{project.description}</div></section>
            {project.problem_statement && <section><h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: '#002050' }}><Target size={22} style={{ color: '#BF8813' }} /> Problématique</h2><div className="mt-4 whitespace-pre-line leading-7 text-slate-700">{project.problem_statement}</div></section>}
            {project.objectives && <section><h2 className="text-2xl font-bold" style={{ color: '#002050' }}>Objectifs</h2><div className="mt-4 whitespace-pre-line leading-7 text-slate-700">{project.objectives}</div></section>}
            {project.deliverables_summary && <section><h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: '#002050' }}><FileText size={22} style={{ color: '#BF8813' }} /> Livrables attendus</h2><div className="mt-4 whitespace-pre-line leading-7 text-slate-700">{project.deliverables_summary}</div></section>}
            {!!milestones.length && <section><h2 className="text-2xl font-bold" style={{ color: '#002050' }}>Étapes et jalons</h2><div className="mt-5 border-l-2 pl-6" style={{ borderColor: '#BF8813' }}>{milestones.map((milestone, index) => <div key={milestone.id} className="relative pb-7 last:pb-0"><span className="absolute -left-[34px] flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: '#BF8813' }} /><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Étape {index + 1} · {formatDate(milestone.due_at)}</div><h3 className="mt-1 font-bold text-slate-900">{milestone.title}</h3>{milestone.description && <p className="mt-1 text-sm leading-6 text-slate-600">{milestone.description}</p>}</div>)}</div></section>}
            <section className="border p-6" style={{ borderColor: '#DCE4EF', background: '#F8FAFD', borderRadius: 18 }}><h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><ShieldCheck size={21} style={{ color: '#BF8813' }} /> Confidentialité et propriété intellectuelle</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Confidentialité</p><p className="mt-1 text-sm text-slate-700">{project.confidentiality_level.split('_').join(' ')}</p>{project.nda_required && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-amber-800"><LockKeyhole size={15} /> Engagement requis avant accès.</p>}</div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Propriété intellectuelle</p><p className="mt-1 text-sm text-slate-700">{project.ip_policy.split('_').join(' ')}</p></div></div></section>
          </div>

          <aside className="space-y-5">
            <div className="border bg-white p-5" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}><h3 className="font-bold" style={{ color: '#002050' }}>Informations clés</h3><div className="mt-4 space-y-4 text-sm"><div className="flex gap-3"><CalendarDays size={18} style={{ color: '#BF8813' }} /><div><p className="font-semibold text-slate-800">Période</p><p className="text-slate-600">{formatDate(project.starts_at)} — {formatDate(project.ends_at)}</p></div></div><div className="flex gap-3"><Clock3 size={18} style={{ color: '#BF8813' }} /><div><p className="font-semibold text-slate-800">Charge estimée</p><p className="text-slate-600">{project.estimated_hours ? `${project.estimated_hours} heures` : 'À définir'}</p></div></div><div className="flex gap-3"><Users size={18} style={{ color: '#BF8813' }} /><div><p className="font-semibold text-slate-800">Participants</p><p className="text-slate-600">{project.min_participants}{project.max_participants ? ` à ${project.max_participants}` : '+'}</p></div></div><div className="flex gap-3"><Target size={18} style={{ color: '#BF8813' }} /><div><p className="font-semibold text-slate-800">Niveau</p><p className="text-slate-600">{PROJECT_LEVEL_LABELS[project.level]}</p></div></div></div></div>
            {!!project.required_skills?.length && <div className="border bg-white p-5" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}><h3 className="font-bold" style={{ color: '#002050' }}>Compétences recherchées</h3><div className="mt-4 flex flex-wrap gap-2">{project.required_skills.map(skill => <span key={skill} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{skill}</span>)}</div></div>}
            {project.reward_type !== 'none' && <div className="border p-5" style={{ borderColor: '#E7D4A1', background: '#FFFBF0', borderRadius: 18 }}><h3 className="flex items-center gap-2 font-bold" style={{ color: '#6E4C08' }}><Award size={19} /> Reconnaissance prévue</h3><p className="mt-2 text-sm font-semibold text-amber-950">{REWARD_LABELS[project.reward_type] || project.reward_type.split('_').join(' ')}</p>{reward.amount && <p className="mt-1 text-lg font-bold text-amber-950">{reward.amount}</p>}{reward.description && <p className="mt-2 text-sm leading-6 text-amber-900">{reward.description}</p>}<p className="mt-3 text-xs leading-5 text-amber-800">Toute récompense dépend du travail réellement accompli et des validations prévues.</p></div>}
            {project.recruitment_opportunity && <div className="border p-5" style={{ borderColor: '#DCE4EF', background: '#F8FAFD', borderRadius: 18 }}><h3 className="font-bold" style={{ color: '#002050' }}>Opportunité possible</h3><p className="mt-2 text-sm leading-6 text-slate-600">{project.recruitment_disclaimer}</p></div>}
            <button onClick={() => setShowReport(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-600" style={{ borderColor: '#D0D5DD' }}><Flag size={16} /> Signaler ce projet</button>
          </aside>
        </div>
      </section>

      {showApply && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setShowApply(false); }}>
          <form onSubmit={submitApplication} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6 sm:p-8" style={{ borderRadius: 20 }}>
            <h2 className="text-2xl font-bold" style={{ color: '#002050' }}>Candidater à ce projet</h2>
            <p className="mt-2 text-sm text-slate-600">Présentez votre motivation et votre manière d’aborder la mission.</p>
            <div className="mt-6 space-y-5">
              {project.participation_mode === 'individual_or_team' && <div><span className="text-sm font-semibold text-slate-700">Mode de candidature</span><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setApplicationMode('individual')} className="rounded-xl border px-3 py-2.5 text-sm font-semibold" style={{ borderColor: applicationMode === 'individual' ? '#002050' : '#D0D5DD', background: applicationMode === 'individual' ? '#EFF5FF' : '#FFFFFF', color: '#002050' }}>Individuel</button><button type="button" onClick={() => setApplicationMode('team')} className="rounded-xl border px-3 py-2.5 text-sm font-semibold" style={{ borderColor: applicationMode === 'team' ? '#002050' : '#D0D5DD', background: applicationMode === 'team' ? '#EFF5FF' : '#FFFFFF', color: '#002050' }}>En équipe</button></div></div>}
              {applicationMode === 'team' && <div className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC', background: '#F8FAFD' }}><p className="text-sm font-bold" style={{ color: '#002050' }}>Équipe candidate</p>{leaderMemberships.length ? <select value={selectedTeamId} onChange={event => setSelectedTeamId(event.target.value)} className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="">Choisir une équipe</option>{leaderMemberships.map(item => <option key={item.team.id} value={item.team.id}>{item.team.name}</option>)}</select> : null}{project.team_creation_mode !== 'owner' && <input value={newTeamName} onChange={event => setNewTeamName(event.target.value)} className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} placeholder={leaderMemberships.length ? 'Ou créer une nouvelle équipe' : 'Nom de la nouvelle équipe'} />}{project.team_creation_mode === 'owner' && !leaderMemberships.length && <p className="mt-3 text-sm text-amber-800">Le porteur constitue les équipes. Vous devez d’abord recevoir et accepter une invitation.</p>}<p className="mt-3 text-xs leading-5 text-slate-500">Aucun membre n’est ajouté automatiquement : chaque invitation doit être acceptée.</p></div>}
              <label className="block"><span className="text-sm font-semibold text-slate-700">Motivation *</span><textarea value={motivation} onChange={event => setMotivation(event.target.value)} required rows={5} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#D0D5DD' }} /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">Approche proposée</span><textarea value={approach} onChange={event => setApproach(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#D0D5DD' }} /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">Disponibilité</span><input value={availability} onChange={event => setAvailability(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#D0D5DD' }} placeholder="Ex. 8 heures par semaine" /></label>
              <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={agreement} onChange={event => setAgreement(event.target.checked)} className="mt-1" /><span className="text-sm leading-6 text-slate-700">Je consens à participer, à respecter la confidentialité et les règles de propriété intellectuelle définies pour ce projet. Je comprends qu’aucun recrutement ni récompense n’est garanti.</span></label>
            </div>
            <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setShowApply(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}>Annuler</button><button disabled={submitting} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: '#002050' }}>{submitting ? 'Envoi...' : 'Envoyer la candidature'}</button></div>
          </form>
        </div>
      )}
      {showReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setShowReport(false); }}>
          <form onSubmit={submitReport} className="w-full max-w-xl bg-white p-6 sm:p-8" style={{ borderRadius: 20 }}>
            <h2 className="text-2xl font-bold" style={{ color: '#002050' }}>Signaler ce projet</h2>
            <p className="mt-2 text-sm text-slate-600">Le signalement sera examiné par le Super Admin et restera associé à votre compte.</p>
            <label className="mt-6 block"><span className="text-sm font-semibold text-slate-700">Motif</span><select value={reportType} onChange={event => setReportType(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }}><option value="misleading_information">Informations trompeuses</option><option value="unfunded_reward">Récompense non financée</option><option value="confidentiality">Confidentialité</option><option value="intellectual_property">Propriété intellectuelle</option><option value="abuse">Abus</option><option value="discrimination">Discrimination</option><option value="technical">Problème technique</option><option value="other">Autre</option></select></label>
            <label className="mt-5 block"><span className="text-sm font-semibold text-slate-700">Description *</span><textarea required value={reportDescription} onChange={event => setReportDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#D0D5DD' }} /></label>
            <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setShowReport(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: '#D0D5DD' }}>Annuler</button><button disabled={reporting} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: '#002050' }}>{reporting ? 'Envoi...' : 'Envoyer le signalement'}</button></div>
          </form>
        </div>
      )}

    </ProjectsPublicLayout>
  );
}
