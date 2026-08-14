import { useEffect, useState, type ElementType, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  Globe,
  Languages,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  User,
  Users,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { PageFooter } from '../../components/PageFooter';
import { getPublicProfile, ProfileApiError, type PublicProfile } from '../../lib/profileApi';


const ROLE_LABELS: Record<string, string> = {
  moderateur: 'Modérateur',
  structure: 'Structure',
  organisateur: 'Organisateur Omnia Live',
  organizer: 'Organisateur Omnia Live',
  recruteur: 'Recruteur',
  recruteur_independant: 'Recruteur',
  professeur: 'Professeur',
  formateur: 'Professeur',
  coach: 'Coach',
  apprenant: 'Apprenant',
};

function initials(name: string) {
  const values = name.trim().split(/\s+/).filter(Boolean);
  if (!values.length) return '?';
  return (values.length > 1 ? `${values[0][0]}${values[1][0]}` : values[0].slice(0, 2)).toUpperCase();
}

function errorLabel(error: unknown) {
  if (!(error instanceof ProfileApiError)) return 'Ce profil est momentanément indisponible.';
  if (error.code === 'PROFILE_PRIVATE') return 'Ce membre a choisi de garder son profil privé.';
  if (error.code === 'MEMBER_ACCESS_REQUIRED') return 'Connectez-vous pour consulter ce profil réservé aux membres Omnia.';
  if (error.code === 'PROFILE_NOT_FOUND') return 'Ce profil n’existe pas ou n’est plus disponible.';
  if (error.code === 'PROFILE_SUSPENDED') return 'Ce profil est temporairement indisponible.';
  return error.message || 'Ce profil est momentanément indisponible.';
}

function visibilityLabel(value: PublicProfile['visibility']) {
  if (value === 'public') return 'Visible publiquement';
  if (value === 'members') return 'Visible par les membres';
  return 'Profil privé';
}

function asNumber(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export default function PublicProfilePage() {
  const { userId = '' } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getPublicProfile(userId)
      .then(result => {
        if (!active) return;
        setProfile(result.profile);
        setIsOwner(result.is_owner);
      })
      .catch(reason => {
        if (active) setError(errorLabel(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        {loading && (
          <div className="flex min-h-[55vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#002050] border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto max-w-2xl rounded-[28px] border border-amber-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
            <h1 className="mt-4 text-2xl font-black text-[#002050]">Profil non accessible</h1>
            <p className="mt-2 text-slate-600">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/forum" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Omnia Communauté</Link>
              <Link to="/connexion" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#002050]">Se connecter</Link>
            </div>
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-5">
            {isOwner && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BF8813]/25 bg-[#BF8813]/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#002050]">
                  <CheckCircle2 size={17} className="text-[#BF8813]" />
                  Aperçu exact · {visibilityLabel(profile.visibility)}
                </div>
                <Link to="/mon-profil?tab=visibilite" className="rounded-xl bg-[#002050] px-4 py-2 text-sm font-bold text-white">
                  Modifier la visibilité
                </Link>
              </div>
            )}

            <ProfileHero profile={profile} isOwner={isOwner} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,.75fr)]">
              <div className="space-y-5">
                {(profile.bio || profile.skills.length > 0) && (
                  <ProfileSection title="Présentation" icon={User}>
                    {profile.bio && <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{profile.bio}</p>}
                    {profile.skills.length > 0 && <div className={profile.bio ? 'mt-5' : ''}><Tags values={profile.skills} /></div>}
                  </ProfileSection>
                )}

                <RoleDetails profile={profile} />
                <PublicMetrics profile={profile} />

                {profile.interests.length > 0 && (
                  <ProfileSection title="Centres d’intérêt" icon={Sparkles}>
                    <Tags values={profile.interests} muted />
                  </ProfileSection>
                )}
              </div>

              <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                <ProfileInformation profile={profile} />
                <StructureSummary profile={profile} />
                <PublicLinks profile={profile} />
              </aside>
            </div>
          </div>
        )}
      </main>
      <PageFooter />
    </div>
  );
}

function ProfileHero({ profile, isOwner }: { profile: PublicProfile; isOwner: boolean }) {
  const hasStructureManagementDelegation = profile.roles.includes('gestionnaire_structure');
  const visibleRoles = profile.roles.filter(role => !['super_admin', 'gestionnaire_structure'].includes(role));
  const location = [profile.city, profile.country_code].filter(Boolean).join(', ');

  return (
    <header className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(0,32,80,0.08)]">
      <div className="relative h-28 overflow-hidden bg-[#002050] sm:h-36">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[#BF8813]" />
        <div className="absolute -right-12 -top-20 h-52 w-52 rounded-full border-[28px] border-white/5" />
        <div className="absolute right-16 top-7 h-24 w-24 rounded-full border-[16px] border-[#BF8813]/20" />
      </div>

      <div className="px-5 pb-7 sm:px-8 sm:pb-8">
        <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={profile.display_name} className="h-28 w-28 flex-none rounded-[26px] border-4 border-white bg-white object-cover shadow-xl sm:h-32 sm:w-32" />
            : <div className="flex h-28 w-28 flex-none items-center justify-center rounded-[26px] border-4 border-white bg-[#BF8813] text-3xl font-black text-[#002050] shadow-xl sm:h-32 sm:w-32">{initials(profile.display_name)}</div>}

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap gap-2">
              {visibleRoles.map(role => <span key={role} className="rounded-full border border-[#BF8813]/35 bg-[#BF8813]/10 px-3 py-1 text-xs font-extrabold text-[#805A0C]">{ROLE_LABELS[role] || role}</span>)}{hasStructureManagementDelegation && isOwner && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-[#002050]">Accès interne à une Structure</span>}
            </div>
            <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-[#002050] sm:text-4xl">{profile.display_name}</h1>
            {profile.headline && <p className="mt-1.5 max-w-3xl text-base leading-6 text-slate-600">{profile.headline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              {location && <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-[#BF8813]" />{location}</span>}
              {profile.languages.length > 0 && <span className="inline-flex items-center gap-1.5"><Languages size={15} className="text-[#BF8813]" />{profile.languages.slice(0, 3).join(' · ')}</span>}
              {profile.availability_text && <span className="inline-flex items-center gap-1.5"><Briefcase size={15} className="text-[#BF8813]" />{profile.availability_text}</span>}
            </div>
          </div>

          <div className="flex flex-none flex-wrap gap-2 sm:pb-1">
            {isOwner && <Link to="/mon-profil" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#002050]">Modifier</Link>}
          </div>
        </div>
      </div>
    </header>
  );
}

function ProfileInformation({ profile }: { profile: PublicProfile }) {
  const items: Array<{ icon: ElementType; label: string; value: string; href?: string }> = [];
  const location = [profile.city, profile.country_code].filter(Boolean).join(', ');
  if (location) items.push({ icon: MapPin, label: 'Localisation', value: location });
  if (profile.languages.length) items.push({ icon: Languages, label: 'Langues', value: profile.languages.join(', ') });
  if (profile.availability_text) items.push({ icon: Briefcase, label: 'Disponibilité', value: profile.availability_text });
  if (profile.email) items.push({ icon: Mail, label: 'E-mail', value: profile.email, href: `mailto:${profile.email}` });
  if (profile.phone) items.push({ icon: Phone, label: 'Téléphone', value: profile.phone, href: `tel:${profile.phone}` });

  if (!items.length) return null;
  return (
    <ProfileSection title="Informations" icon={Globe} compact>
      <div className="space-y-4">
        {items.map(item => <InfoLine key={item.label} {...item} />)}
      </div>
    </ProfileSection>
  );
}

function PublicLinks({ profile }: { profile: PublicProfile }) {
  const links = [
    ['Site web', profile.website_url],
    ['LinkedIn', profile.linkedin_url],
    ['Portfolio', profile.portfolio_url],
    ['GitHub', profile.github_url],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!links.length) return null;

  return (
    <ProfileSection title="Liens" icon={Link2} compact>
      <div className="space-y-2">
        {links.map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#002050] transition hover:border-[#BF8813] hover:bg-[#BF8813]/5">
            <span>{label}</span><ExternalLink size={15} />
          </a>
        ))}
      </div>
    </ProfileSection>
  );
}

function StructureSummary({ profile }: { profile: PublicProfile }) {
  const structure = profile.structure as Record<string, unknown> | null | undefined;
  if (!structure) return null;
  const name = String(structure.name || '');
  if (!name) return null;
  const location = [structure.city, structure.country].filter(Boolean).map(String).join(', ');

  return (
    <ProfileSection title="Structure associée" icon={Users} compact>
      <div className="flex items-center gap-3">
        {structure.logo_url
          ? <img src={String(structure.logo_url)} alt="" className="h-12 w-12 rounded-xl border border-slate-200 object-contain" />
          : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#002050]/5 text-[#002050]"><Users size={20} /></div>}
        <div className="min-w-0">
          <p className="truncate font-extrabold text-[#002050]">{name}</p>
          {structure.type && <p className="text-xs text-slate-500">{String(structure.type)}</p>}
          {location && <p className="mt-0.5 text-xs text-slate-500">{location}</p>}
        </div>
      </div>
    </ProfileSection>
  );
}

function PublicMetrics({ profile }: { profile: PublicProfile }) {
  const organizer = profile.organizer_profile as Record<string, unknown> | null | undefined;
  const coach = profile.coach_profile as Record<string, unknown> | null | undefined;
  const metrics: Array<{ label: string; value: string | number; icon: ElementType }> = [];

  if (organizer) {
    const rating = asNumber(organizer.public_rating);
    const events = asNumber(organizer.completed_events);
    const reviews = asNumber(organizer.review_count);
    if (rating) metrics.push({ label: 'Note Omnia Live', value: rating.toFixed(1), icon: Star });
    if (events) metrics.push({ label: 'Événements réalisés', value: events, icon: CalendarCheck });
    if (reviews) metrics.push({ label: 'Avis reçus', value: reviews, icon: MessageCircle });
  }

  if (coach) {
    const rating = asNumber(coach.average_rating);
    const sessions = asNumber(coach.completed_sessions_count);
    const reviews = asNumber(coach.rating_count);
    if (rating) metrics.push({ label: 'Note coaching', value: rating.toFixed(1), icon: Star });
    if (sessions) metrics.push({ label: 'Séances réalisées', value: sessions, icon: CalendarCheck });
    if (reviews) metrics.push({ label: 'Avis reçus', value: reviews, icon: MessageCircle });
  }

  if (!metrics.length) return null;
  return (
    <ProfileSection title="Repères professionnels" icon={Award}>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <Icon size={18} className="text-[#BF8813]" />
            <p className="mt-3 text-2xl font-black text-[#002050]">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

function ProfileSection({ title, icon: Icon, children, compact = false }: { title: string; icon: ElementType; children: ReactNode; compact?: boolean }) {
  return (
    <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${compact ? 'p-5' : 'p-6'}`}>
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-black text-[#002050]"><span className="rounded-xl bg-[#002050]/5 p-2 text-[#002050]"><Icon size={18} /></span>{title}</h2>
      {children}
    </section>
  );
}

function Tags({ values, muted = false }: { values: string[]; muted?: boolean }) {
  return <div className="flex flex-wrap gap-2">{values.map(value => <span key={value} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${muted ? 'bg-slate-100 text-slate-700' : 'border border-[#002050]/10 bg-[#002050]/5 text-[#002050]'}`}>{value}</span>)}</div>;
}

function InfoLine({ icon: Icon, label, value, href }: { icon: ElementType; label: string; value: string; href?: string }) {
  const content = <><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-0.5 break-words text-sm font-semibold leading-6 text-[#002050]">{value}</p></>;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-[#BF8813]/10 p-1.5"><Icon className="h-4 w-4 text-[#BF8813]" /></span>
      <div className="min-w-0">{href ? <a href={href} className="hover:underline">{content}</a> : content}</div>
    </div>
  );
}

function RoleDetails({ profile }: { profile: PublicProfile }) {
  const details = profile.role_details || {};
  const candidates: Array<[string, unknown]> = [
    ['Objectif professionnel', details.career_goal],
    ['Niveau d’étude', details.education_level],
    ['Domaine d’étude', details.field_of_study],
    ['Postes recherchés', details.target_roles],
    ['Secteurs ciblés', details.target_sectors],
    ['Types de contrat', details.contract_preferences],
    ['Domaine d’expertise', details.expertise_domain],
    ['Années d’expérience', details.years_experience],
    ['Expérience', details.experience_summary],
    ['Langues d’enseignement', details.teaching_languages],
    ['Qualifications', details.qualifications],
    ['Formats d’enseignement', details.teaching_formats],
    ['Type d’organisateur', details.organizer_type],
    ['Organisation', details.organization_name],
    ['Thématiques d’événements', details.event_topics],
    ['Domaines de modération', details.moderation_domains],
    ['Secteurs de recrutement', details.recruitment_sectors],
    ['Pays de recrutement', details.recruitment_countries],
    ['Thématiques de coaching', details.coaching_topics],
    ['Langues de session', details.session_languages],
  ];
  const values = candidates.filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  if (!values.length) return null;

  return (
    <ProfileSection title="Parcours et domaines" icon={Briefcase}>
      <div className="grid gap-3 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-[#002050]">{Array.isArray(value) ? value.join(', ') : String(value)}</p>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}
