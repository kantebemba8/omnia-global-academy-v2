import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, MapPin, Search, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';
import { loadPublicJobs, loadPublicTalents, PublicJob, PublicTalent } from './talentApi';
import { usePublicPageContent } from '../../hooks/usePublicPageContent';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

export default function TalentHome() {
  const [talents, setTalents] = useState<PublicTalent[]>([]);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const pageContent = usePublicPageContent().talent || {};

  useEffect(() => {
    Promise.allSettled([loadPublicTalents(), loadPublicJobs()]).then(([talentResult, jobResult]) => {
      if (talentResult.status === 'fulfilled') setTalents(talentResult.value);
      if (jobResult.status === 'fulfilled') setJobs(jobResult.value);
      setLoading(false);
    });
  }, []);

  const companies = useMemo(() => new Set(jobs.map(job => job.company_name).filter(Boolean)).size, [jobs]);

  return (
    <TalentLayout>
      <section className="border-b bg-white px-5 py-10 md:px-8 md:py-14" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,.12)', color: GOLD }}>
              <Sparkles size={14} /> {pageContent.badge || 'La vitrine professionnelle d’Omnia Global Academy'}
            </span>
            <h1 className="mt-5 text-3xl font-semibold leading-tight md:text-4xl" style={{ color: BLUE }}>
              {pageContent.title || 'Découvrez les talents qui ont choisi de rendre leur profil visible'}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              {pageContent.subtitle || 'Omnia Talent permet aux recruteurs de repérer des profils publics, consulter leurs compétences et prendre contact dans un environnement vérifié.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/talent/explorer" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>
                <Search size={17} /> {pageContent.primary_cta || 'Explorer les talents'}
              </Link>
              <Link to="/talent/recruteurs" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold" style={{ borderColor: GOLD, color: BLUE }}>
                {pageContent.secondary_cta || 'Espace recruteurs'} <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Profils publics', value: talents.length, icon: UsersRound },
              { label: 'Offres disponibles', value: jobs.length, icon: Briefcase },
              { label: 'Organisations visibles', value: companies, icon: Building2 },
            ].map(item => (
              <div key={item.label} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <item.icon size={18} color={GOLD} />
                </div>
                <p className="mt-2 text-2xl font-semibold" style={{ color: BLUE }}>{loading ? '—' : item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: BLUE }}>{pageContent.recent_talents_title || 'Talents récemment visibles'}</h2>
              <p className="mt-1 text-sm text-gray-500">{pageContent.recent_talents_subtitle || 'Profils issus directement du Profil carrière Omnia.'}</p>
            </div>
            <Link to="/talent/explorer?tab=talents" className="text-sm font-semibold" style={{ color: GOLD }}>Voir tous</Link>
          </div>

          {loading ? (
            <div className="mt-5 rounded-xl border bg-white p-10 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}>Chargement des profils…</div>
          ) : talents.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed bg-white p-10 text-center" style={{ borderColor: BORDER }}>
              <UserRound className="mx-auto" color="#9CA3AF" />
              <p className="mt-3 text-sm font-medium" style={{ color: BLUE }}>Aucun profil public pour le moment</p>
              <p className="mt-1 text-sm text-gray-500">Les apprenants apparaîtront ici après avoir activé la visibilité dans Omnia Career.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {talents.slice(0, 3).map(talent => <TalentCard key={talent.id} talent={talent} />)}
            </div>
          )}
        </div>
      </section>

      <section className="border-y bg-white px-5 py-10 md:px-8" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: BLUE }}>{pageContent.recent_jobs_title || 'Offres récentes'}</h2>
              <p className="mt-1 text-sm text-gray-500">{pageContent.recent_jobs_subtitle || 'Les mêmes offres que dans l’espace Emploi et le Forum Communauté.'}</p>
            </div>
            <Link to="/talent/explorer?tab=offres" className="text-sm font-semibold" style={{ color: GOLD }}>Explorer</Link>
          </div>
          {jobs.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}>Aucune offre publique disponible.</div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.slice(0, 3).map(job => (
                <Link key={job.id} to={`/emploi/${job.id}`} className="rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm" style={{ borderColor: BORDER }}>
                  <p className="text-sm font-semibold" style={{ color: BLUE }}>{job.title || 'Offre sans titre'}</p>
                  <p className="mt-1 text-sm text-gray-500">{job.company_name || 'Organisation non renseignée'}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                    {job.location && <span className="flex items-center gap-1"><MapPin size={13} />{job.location}</span>}
                    {job.contract_type && <span className="rounded-full bg-gray-100 px-2 py-1">{job.contract_type}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Profils sous contrôle', text: 'Seuls les profils rendus visibles par les apprenants apparaissent dans Talent.' },
            { icon: UsersRound, title: 'Une donnée unique', text: 'Le profil principal et Omnia Career alimentent la même fiche publique, sans double saisie.' },
            { icon: Briefcase, title: 'Contact encadré', text: 'Les demandes de contact sont enregistrées et peuvent être suivies par le Super Admin.' },
          ].map(item => (
            <div key={item.title} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <item.icon size={20} color={GOLD} />
              <h3 className="mt-3 text-base font-semibold" style={{ color: BLUE }}>{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </TalentLayout>
  );
}

function TalentCard({ talent }: { talent: PublicTalent }) {
  return (
    <Link to={`/talent/profil/${talent.id}`} className="rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm" style={{ borderColor: BORDER }}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-white" style={{ background: BLUE }}>
          {talent.photo_url ? <img src={talent.photo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <UserRound size={20} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: BLUE }}>{talent.full_name}</p>
          <p className="truncate text-sm text-gray-500">{talent.professional_title || 'Titre professionnel non renseigné'}</p>
          {talent.location && <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><MapPin size={12} />{talent.location}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(talent.skills || []).slice(0, 4).map(skill => <span key={skill} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{skill}</span>)}
      </div>
    </Link>
  );
}
