import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, UserRoundCheck } from 'lucide-react';
import { coachingRequest, type CoachProfile } from '../../lib/coachingApi';

type CoachApplicationStatus = {
  status?: string;
  admin_message?: string | null;
  rejection_reason?: string | null;
};

type CoachEligibility = {
  eligible: boolean;
  source: 'existing_coach' | 'professor' | 'structure_designation' | 'none' | string;
  organization_id?: string | null;
  message: string;
};

type CoachSelfStatus = {
  success: true;
  application: CoachApplicationStatus | null;
  profile: CoachProfile | null;
  roles: string[];
  eligibility: CoachEligibility;
};

type Props = {
  disabled?: boolean;
};

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function CoachOpportunityNotice({ disabled = false }: Props) {
  const [status, setStatus] = useState<CoachSelfStatus | null>(null);

  useEffect(() => {
    if (disabled) return;
    let active = true;
    coachingRequest<CoachSelfStatus>('self_status')
      .then(result => { if (active) setStatus(result); })
      .catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, [disabled]);

  if (disabled || !status) return null;

  const applicationStatus = String(status.application?.status || '');
  const hasActiveCoachSpace = Boolean(status.profile) || status.roles.includes('coach') || applicationStatus === 'approved';

  let title = '';
  let text = '';
  let actionLabel = '';
  let actionPath = '/coaching/devenir-coach';
  let Icon = UserRoundCheck;

  if (hasActiveCoachSpace) {
    title = 'Votre espace Coach Omnia est disponible';
    text = 'Accédez à vos offres, disponibilités, sessions et outils de coaching.';
    actionLabel = 'Ouvrir mon espace Coach';
    actionPath = '/home?role=coach';
    Icon = CheckCircle2;
  } else if (['pending', 'under_review'].includes(applicationStatus)) {
    title = 'Votre candidature Coach est en cours d’examen';
    text = 'Vous pouvez consulter l’état de votre candidature pendant son examen par l’Administration Omnia.';
    actionLabel = 'Voir ma candidature';
    Icon = Clock3;
  } else if (applicationStatus === 'changes_requested') {
    title = 'Votre candidature Coach nécessite des modifications';
    text = status.application?.admin_message || 'L’Administration Omnia vous a demandé de compléter ou corriger votre candidature.';
    actionLabel = 'Mettre à jour ma candidature';
  } else if (applicationStatus === 'rejected') {
    title = 'Votre candidature Coach peut être revue';
    text = status.application?.rejection_reason || 'Consultez la décision et, si le formulaire le permet, mettez votre candidature à jour.';
    actionLabel = 'Consulter ma candidature';
  } else if (applicationStatus === 'draft') {
    title = 'Votre candidature Coach est à terminer';
    text = 'Complétez votre dossier avant de le transmettre à l’Administration Omnia.';
    actionLabel = 'Continuer ma candidature';
  } else if (status.eligibility?.eligible) {
    title = status.eligibility.source === 'structure_designation'
      ? 'Votre Structure vous autorise à candidater comme Coach Omnia'
      : 'Vous pouvez devenir Coach Omnia';
    text = status.eligibility.source === 'structure_designation'
      ? 'Votre désignation vous permet de présenter votre expertise. La validation finale reste assurée par l’Administration Omnia.'
      : 'Valorisez votre expertise en proposant des accompagnements individuels ou professionnels sur Omnia Coaching.';
    actionLabel = 'Présenter ma candidature';
  } else {
    return null;
  }

  return (
    <div className="mb-8 flex flex-col gap-4 border-y border-slate-200 bg-white py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: 'rgba(191,136,19,.10)' }}>
          <Icon size={19} style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: BLUE }}>{title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{text}</p>
        </div>
      </div>
      <Link
        to={actionPath}
        className="inline-flex flex-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: BLUE }}
      >
        {actionLabel} <ArrowRight size={15} />
      </Link>
    </div>
  );
}
