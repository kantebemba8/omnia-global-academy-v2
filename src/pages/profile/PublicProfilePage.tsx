import { useEffect, useState, type ElementType, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Briefcase,
  ExternalLink,
  Globe,
  Languages,
  Link2 as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { PageFooter } from '../../components/PageFooter';
import { getPublicProfile, ProfileApiError, type PublicProfile } from '../../lib/profileApi';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super-admin', moderateur: 'Modérateur', structure: 'Structure', recruteur_structure: 'Recruteur de structure',
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
    setLoading(true); setError('');
    getPublicProfile(userId)
      .then(result => { if (active) { setProfile(result.profile); setIsOwner(result.is_owner); } })
      .catch(reason => { if (active) setError(errorLabel(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  return <div className="min-h-screen bg-slate-50">
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {loading && <div className="flex min-h-[55vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#002050] border-t-transparent" /></div>}
      {!loading && error && <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"><AlertTriangle className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-4 text-2xl font-black text-[#002050]">Profil non accessible</h1><p className="mt-2 text-slate-600">{error}</p><div className="mt-6 flex justify-center gap-3"><Link to="/forum" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Omnia Communauté</Link><Link to="/connexion" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#002050]">Se connecter</Link></div></div>}
      {!loading && profile && <div className="space-y-6">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-32 bg-[#002050]" />
          <div className="px-5 pb-7 sm:px-8">
            <div className="-mt-16 flex flex-col gap-5 sm:flex-row sm:items-end">
              {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} className="h-32 w-32 rounded-3xl border-4 border-white object-cover shadow-xl" /> : <div className="flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-white bg-[#BF8813] text-3xl font-black text-[#002050] shadow-xl">{initials(profile.display_name)}</div>}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap gap-2">{profile.roles.map(role => <span key={role} className="rounded-full bg-[#002050]/5 px-3 py-1 text-xs font-bold text-[#002050]">{ROLE_LABELS[role] || role}</span>)}</div>
                <h1 className="mt-2 text-3xl font-black text-[#002050]">{profile.display_name}</h1>
                {profile.headline && <p className="mt-1 text-base text-slate-600">{profile.headline}</p>}
              </div>
              {isOwner && <Link to="/mon-profil" className="rounded-xl bg-[#BF8813] px-4 py-2.5 text-sm font-bold text-[#002050]">Modifier mon profil</Link>}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Card title="À propos" icon={User}>{profile.bio ? <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{profile.bio}</p> : <p className="text-sm text-slate-500">Ce membre n’a pas encore ajouté de présentation.</p>}</Card>
            {profile.skills.length > 0 && <Card title="Compétences" icon={Award}><Tags values={profile.skills} /></Card>}
            {profile.interests.length > 0 && <Card title="Centres d’intérêt" icon={Users}><Tags values={profile.interests} /></Card>}
            <RoleDetails profile={profile} />
          </div>
          <div className="space-y-6">
            <Card title="Informations" icon={Globe}><div className="space-y-3">
              {(profile.city || profile.country_code) && <Line icon={MapPin} label="Localisation" value={[profile.city, profile.country_code].filter(Boolean).join(', ')} />}
              {profile.languages.length > 0 && <Line icon={Languages} label="Langues" value={profile.languages.join(', ')} />}
              {profile.availability_text && <Line icon={Briefcase} label="Disponibilité" value={profile.availability_text} />}
              {profile.email && <Line icon={Mail} label="E-mail public" value={profile.email} />}
              {profile.phone && <Line icon={Phone} label="Téléphone public" value={profile.phone} />}
            </div></Card>
            {(profile.website_url || profile.linkedin_url || profile.portfolio_url || profile.github_url) && <Card title="Liens" icon={LinkIcon}><div className="space-y-2">{[
              ['Site web', profile.website_url], ['LinkedIn', profile.linkedin_url], ['Portfolio', profile.portfolio_url], ['GitHub', profile.github_url],
            ].filter((item): item is [string, string] => Boolean(item[1])).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold text-[#002050] hover:border-[#BF8813]"><span>{label}</span><ExternalLink size={15} /></a>)}</div></Card>}
            <Card title="Protection du membre" icon={Shield}><p className="text-sm text-slate-600">Seules les informations que ce membre a choisi de rendre visibles sont affichées. Les coordonnées du compte, permissions et données administratives restent privées.</p></Card>
          </div>
        </div>
      </div>}
    </main>
    <PageFooter />
  </div>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#002050]"><Icon size={20} />{title}</h2>{children}</section>; }
function Tags({ values }: { values: string[] }) { return <div className="flex flex-wrap gap-2">{values.map(value => <span key={value} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-[#002050]">{value}</span>)}</div>; }
function Line({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) { return <div className="flex items-start gap-3"><Icon className="mt-0.5 h-4 w-4 flex-none text-[#BF8813]" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 break-words text-sm font-semibold text-[#002050]">{value}</p></div></div>; }
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
  return <Card title="Parcours et domaines" icon={Briefcase}><div className="grid gap-3 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-[#002050]">{Array.isArray(value) ? value.join(', ') : String(value)}</p></div>)}</div></Card>;
}
