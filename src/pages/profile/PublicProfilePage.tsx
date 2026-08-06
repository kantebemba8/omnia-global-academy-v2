import { useEffect, useState, type ElementType, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, Award, Briefcase, ExternalLink, Globe, Languages, Link2,
  Mail, MapPin, Phone, ShieldCheck, Sparkles, User, Users,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { PageFooter } from '../../components/PageFooter';
import { getPublicProfile, ProfileApiError, type PublicProfile } from '../../lib/profileApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

const ROLE_LABELS: Record<string, string> = {
  moderateur: 'Modérateur', structure: 'Structure', recruteur_structure: 'Recruteur de structure',
  organisateur: 'Organisateur Omnia Live', organizer: 'Organisateur Omnia Live', recruteur: 'Recruteur',
  recruteur_independant: 'Recruteur', professeur: 'Professeur', formateur: 'Professeur', coach: 'Coach', apprenant: 'Apprenant',
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
  return error.message || 'Ce profil est momentanément indisponible.';
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
      .catch(reason => { if (active) setError(errorLabel(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {loading && <div className="flex min-h-[55vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#002050] border-t-transparent" /></div>}

        {!loading && error && (
          <div className="mx-auto max-w-2xl rounded-[28px] border border-amber-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
            <h1 className="mt-4 text-2xl font-black text-[#002050]">Profil non accessible</h1>
            <p className="mt-2 text-slate-600">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/forum" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Omnia Communauté</Link>
              <Link to="/connexion" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#002050]">Se connecter</Link>
            </div>
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-6">
            <ProfileHero profile={profile} isOwner={isOwner} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.8fr)]">
              <div className="space-y-6">
                <ProfileSection title="À propos" icon={User}>
                  {profile.bio
                    ? <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{profile.bio}</p>
                    : <EmptyValue text="Aucune présentation publique." />}
                </ProfileSection>

                {profile.skills.length > 0 && (
                  <ProfileSection title="Compétences" icon={Sparkles}><Tags values={profile.skills} /></ProfileSection>
                )}

                <RoleDetails profile={profile} />

                {profile.interests.length > 0 && (
                  <ProfileSection title="Centres d’intérêt" icon={Users}><Tags values={profile.interests} muted /></ProfileSection>
                )}
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                <ProfileSection title="Informations" icon={Globe} compact>
                  <div className="space-y-4">
                    {(profile.city || profile.country_code) && <InfoLine icon={MapPin} label="Localisation" value={[profile.city, profile.country_code].filter(Boolean).join(', ')} />}
                    {profile.languages.length > 0 && <InfoLine icon={Languages} label="Langues" value={profile.languages.join(', ')} />}
                    {profile.availability_text && <InfoLine icon={Briefcase} label="Disponibilité" value={profile.availability_text} />}
                    {profile.email && <InfoLine icon={Mail} label="E-mail public" value={profile.email} />}
                    {profile.phone && <InfoLine icon={Phone} label="Téléphone public" value={profile.phone} />}
                    {!profile.city && !profile.country_code && !profile.languages.length && !profile.availability_text && !profile.email && !profile.phone && <EmptyValue text="Aucune information complémentaire publique." />}
                  </div>
                </ProfileSection>

                <PublicLinks profile={profile} />

                <div className="rounded-[24px] border border-[#002050]/10 bg-[#002050] p-5 text-white shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-white/10 p-2"><ShieldCheck size={20} style={{ color: GOLD }} /></span>
                    <div>
                      <h2 className="font-extrabold">Confidentialité maîtrisée</h2>
                      <p className="mt-1 text-sm leading-6 text-white/70">Seules les informations rendues publiques par ce membre apparaissent ici.</p>
                    </div>
                  </div>
                </div>
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
  const visibleRoles = profile.roles.filter(role => role !== 'super_admin');
  return (
    <header className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(0,32,80,0.08)]">
      <div className="absolute inset-x-0 top-0 h-24 bg-[#002050] sm:h-28" />
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[36px] border-[#BF8813]/25" />
      <div className="relative px-5 pb-7 pt-14 sm:px-8 sm:pb-8 sm:pt-16">
        <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-lg sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.display_name} className="h-28 w-28 flex-none rounded-[24px] border-4 border-white object-cover shadow-xl sm:h-32 sm:w-32" />
              : <div className="flex h-28 w-28 flex-none items-center justify-center rounded-[24px] border-4 border-white bg-[#BF8813] text-3xl font-black text-[#002050] shadow-xl sm:h-32 sm:w-32">{initials(profile.display_name)}</div>}

            <div className="min-w-0 flex-1">
              {visibleRoles.length > 0 && <div className="flex flex-wrap gap-2">{visibleRoles.map(role => <span key={role} className="rounded-full border border-[#BF8813]/35 bg-[#BF8813]/10 px-3 py-1 text-xs font-extrabold text-[#805A0C]">{ROLE_LABELS[role] || role}</span>)}</div>}
              <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-[#002050] sm:text-4xl">{profile.display_name}</h1>
              {profile.headline && <p className="mt-2 max-w-3xl text-base leading-6 text-slate-600">{profile.headline}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                {(profile.city || profile.country_code) && <span className="inline-flex items-center gap-1.5"><MapPin size={15} style={{ color: GOLD }} />{[profile.city, profile.country_code].filter(Boolean).join(', ')}</span>}
                {profile.languages.length > 0 && <span className="inline-flex items-center gap-1.5"><Languages size={15} style={{ color: GOLD }} />{profile.languages.slice(0, 3).join(' · ')}</span>}
              </div>
            </div>

            {isOwner && <Link to="/mon-profil" className="inline-flex flex-none items-center justify-center rounded-xl bg-[#BF8813] px-4 py-2.5 text-sm font-extrabold text-[#002050] transition hover:brightness-95">Modifier mon profil</Link>}
          </div>
        </div>
      </div>
    </header>
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

function PublicLinks({ profile }: { profile: PublicProfile }) {
  const links = [
    ['Site web', profile.website_url], ['LinkedIn', profile.linkedin_url], ['Portfolio', profile.portfolio_url], ['GitHub', profile.github_url],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!links.length) return null;
  return (
    <ProfileSection title="Liens" icon={Link2} compact>
      <div className="space-y-2">{links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#002050] transition hover:border-[#BF8813] hover:bg-[#BF8813]/5"><span>{label}</span><ExternalLink size={15} /></a>)}</div>
    </ProfileSection>
  );
}

function Tags({ values, muted = false }: { values: string[]; muted?: boolean }) {
  return <div className="flex flex-wrap gap-2">{values.map(value => <span key={value} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${muted ? 'bg-slate-100 text-slate-700' : 'border border-[#002050]/10 bg-[#002050]/5 text-[#002050]'}`}>{value}</span>)}</div>;
}

function InfoLine({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-[#BF8813]/10 p-1.5"><Icon className="h-4 w-4 text-[#BF8813]" /></span><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-0.5 break-words text-sm font-semibold leading-6 text-[#002050]">{value}</p></div></div>;
}

function EmptyValue({ text }: { text: string }) {
  return <p className="text-sm leading-6 text-slate-500">{text}</p>;
}

function RoleDetails({ profile }: { profile: PublicProfile }) {
  const details = profile.role_details || {};
  const candidates: Array<[string, unknown]> = [
    ['Objectif professionnel', details.career_goal], ['Niveau d’étude', details.education_level], ['Domaine d’étude', details.field_of_study],
    ['Postes recherchés', details.target_roles], ['Secteurs ciblés', details.target_sectors], ['Domaine d’expertise', details.expertise_domain],
    ['Expérience', details.experience_summary], ['Langues d’enseignement', details.teaching_languages], ['Qualifications', details.qualifications],
    ['Thématiques d’événements', details.event_topics], ['Domaines de modération', details.moderation_domains],
    ['Secteurs de recrutement', details.recruitment_sectors], ['Pays de recrutement', details.recruitment_countries],
    ['Thématiques de coaching', details.coaching_topics], ['Langues de session', details.session_languages],
  ];
  const values = candidates.filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  if (!values.length) return null;
  return (
    <ProfileSection title="Parcours et domaines" icon={Briefcase}>
      <div className="grid gap-3 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-1.5 text-sm font-semibold leading-6 text-[#002050]">{Array.isArray(value) ? value.join(', ') : String(value)}</p></div>)}</div>
    </ProfileSection>
  );
}
