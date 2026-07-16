import { Link } from 'react-router-dom';
import { getStoredUser } from '../../lib/session';
import { Briefcase, Check, Search, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

export default function TalentRecruiters() {
  const user = getStoredUser<{ roles?: string[] }>();
  const canOpenDashboard = !!user?.roles?.some(role => role === 'recruteur' || role === 'super_admin');
  return <TalentLayout><div className="mx-auto max-w-6xl px-5 py-10 md:px-8"><div className="max-w-3xl"><span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,.12)', color: GOLD }}>Pour les recruteurs</span><h1 className="mt-5 text-3xl font-semibold leading-tight" style={{ color: BLUE }}>Repérez des talents et recrutez dans un environnement Omnia vérifié</h1><p className="mt-4 text-base leading-7 text-gray-600">Le compte recruteur est destiné aux professionnels indépendants du recrutement. Les recruteurs membres d’une Structure utilisent le module Recrutement de leur Dashboard Structure.</p><div className="mt-7 flex flex-wrap gap-3">{canOpenDashboard ? <Link to="/talent/recruteur/dashboard" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}><Briefcase size={17} />Ouvrir mon espace recruteur</Link> : <><Link to="/recruteur" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}><UserPlus size={17} />Créer un compte recruteur</Link><Link to="/connexion" className="rounded-lg border px-5 py-3 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Se connecter</Link></>}</div></div><div className="mt-10 grid gap-4 md:grid-cols-3">{[
    { icon: Search, title: 'Rechercher', text: 'Filtrer les profils publics selon les compétences, secteurs, langues et disponibilité.' },
    { icon: UsersRound, title: 'Sélectionner', text: 'Consulter les profils autorisés et enregistrer des candidats potentiels.' },
    { icon: Briefcase, title: 'Recruter', text: 'Publier des offres, suivre les candidatures et organiser les entretiens.' },
  ].map(item => <div key={item.title} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><item.icon size={20} color={GOLD} /><h2 className="mt-3 text-base font-semibold" style={{ color: BLUE }}>{item.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p></div>)}</div><div className="mt-10 rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}><div className="flex items-center gap-3"><ShieldCheck color={GOLD} /><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Validation et confiance</h2></div><ul className="mt-5 grid gap-3 md:grid-cols-2">{['Email professionnel vérifié', 'Validation du compte par le Super Admin', 'Traçabilité des prises de contact', 'Respect de la visibilité choisie par l’apprenant'].map(text => <li key={text} className="flex items-center gap-2 text-sm text-gray-600"><Check size={16} color={GOLD} />{text}</li>)}</ul></div></div></TalentLayout>;
}
