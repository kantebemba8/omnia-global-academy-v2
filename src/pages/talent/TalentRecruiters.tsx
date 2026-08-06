import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Check, Clock3, Search, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { getStoredUser } from '../../lib/session';
import { TalentLayout } from '../../components/talent/TalentLayout';
import { loadRecruiterStatus, RecruiterStatus } from './talentApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type StoredUser = { roles?: string[] };

export default function TalentRecruiters() {
  const user = getStoredUser<StoredUser>();
  const [profile, setProfile] = useState<RecruiterStatus | null>(null);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadRecruiterStatus()
      .then(result => { if (active) setProfile(result.profile); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Statut recruteur indisponible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const roles = user?.roles || [];
  const learnerOnly = roles.includes('apprenant') && !roles.some(role => ['recruteur_independant', 'recruteur', 'recruteur_structure', 'super_admin'].includes(role));
  const approved = profile?.status === 'approved' || roles.some(role => ['recruteur_independant', 'recruteur', 'recruteur_structure', 'super_admin'].includes(role));
  const dashboardPath = profile?.recruiter_type === 'structure' ? '/structure/recrutement/dashboard' : '/talent/recruteur/dashboard';

  return (
    <TalentLayout>
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8">
        <header className="border-b border-gray-200 pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Omnia Talent · Recrutement</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight" style={{ color: BLUE }}>Un espace professionnel distinct pour recruter les talents Omnia</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">Le recruteur indépendant crée un compte professionnel soumis à validation. Les recruteurs d’une Structure sont invités et gérés directement par le responsable de cette Structure.</p>
        </header>

        {error && <div className="mt-6 border-l-4 border-red-500 py-2 pl-4 text-sm text-red-700">{error}</div>}
        {loading && <p className="mt-7 text-sm text-gray-500">Chargement du statut recruteur…</p>}

        {!loading && approved && (
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 py-6">
            <div><p className="font-semibold" style={{ color: BLUE }}>Votre accès recrutement est actif.</p><p className="mt-1 text-sm text-gray-500">Ouvrez votre espace pour rechercher des talents et suivre vos opérations.</p></div>
            <Link to={dashboardPath} className="inline-flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}><Briefcase size={17}/>Ouvrir mon espace</Link>
          </div>
        )}

        {!loading && user && profile && !approved && (
          <div className="flex items-start gap-3 border-b border-gray-200 py-6">
            <Clock3 size={21} style={{ color: GOLD, flexShrink: 0 }}/>
            <div><p className="font-semibold" style={{ color: BLUE }}>Dossier recruteur : {profile.status}</p><p className="mt-1 text-sm leading-6 text-gray-500">{profile.status === 'pending' ? 'Votre dossier attend la validation du Super-admin.' : profile.rejection_reason || (profile.status === 'suspended' ? 'Votre accès recruteur est suspendu.' : 'Votre dossier n’a pas été validé.')}</p></div>
          </div>
        )}

        {!loading && learnerOnly && (
          <div className="border-b border-gray-200 py-6">
            <p className="font-semibold" style={{ color: BLUE }}>Un compte apprenant ne peut pas être transformé en compte recruteur.</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">Créez un compte professionnel distinct avec une autre adresse email. Cette séparation protège les données des candidats et les permissions de recrutement.</p>
            <Link to="/inscription/recruteur" className="mt-4 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}><UserPlus size={17}/>Créer un compte recruteur distinct</Link>
          </div>
        )}

        {!user && (
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 py-6">
            <Link to="/inscription/recruteur" className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}><UserPlus size={17}/>Devenir recruteur indépendant</Link>
            <Link to="/connexion" className="border px-5 py-3 text-sm font-semibold" style={{ borderColor: '#D0D5DD', color: BLUE }}>Se connecter</Link>
          </div>
        )}

        <section className="py-8">
          {[
            { icon: Search, title: 'Rechercher', text: 'Filtrer les profils publics selon les compétences, secteurs, langues et disponibilité.' },
            { icon: UsersRound, title: 'Sélectionner', text: 'Consulter uniquement les informations que les talents ont choisi de rendre visibles.' },
            { icon: Briefcase, title: 'Recruter', text: 'Publier des offres, suivre les candidatures et organiser les entretiens.' },
          ].map(item => (
            <div key={item.title} className="grid gap-2 border-b border-gray-200 py-5 md:grid-cols-[40px_180px_1fr] md:items-start">
              <item.icon size={20} style={{ color: GOLD }}/><h2 className="font-semibold" style={{ color: BLUE }}>{item.title}</h2><p className="text-sm leading-6 text-gray-500">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-gray-200 pt-7">
          <div className="flex items-center gap-3"><ShieldCheck size={21} style={{ color: GOLD }}/><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Validation et confiance</h2></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{['Email professionnel vérifié', 'Validation du compte par le Super-admin', 'Traçabilité des prises de contact', 'Respect de la visibilité choisie par le talent'].map(text => <div key={text} className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} style={{ color: GOLD }}/>{text}</div>)}</div>
        </section>
      </div>
    </TalentLayout>
  );
}
