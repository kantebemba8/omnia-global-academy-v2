import { Eye, Link2, ShieldCheck, UsersRound } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';
const BLUE='#002050'; const GOLD='#BF8813'; const BORDER='#E4E7EC';
export default function TalentAbout(){return <TalentLayout><div className="mx-auto max-w-5xl px-5 py-10 md:px-8"><h1 className="text-3xl font-semibold" style={{color:BLUE}}>À propos de Omnia Talent</h1><p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">Omnia Talent est la vitrine professionnelle de l’écosystème Omnia Global Academy. Elle ne crée pas un second profil : elle affiche uniquement les informations publiques choisies par l’apprenant dans son Profil carrière.</p><div className="mt-10 grid gap-4 md:grid-cols-2">{[
{icon:Link2,title:'Une seule source de données',text:'Profil principal, Omnia Career et Talent utilisent les mêmes informations synchronisées.'},
{icon:Eye,title:'Visibilité contrôlée',text:'Un profil privé reste absent de Talent. L’apprenant décide ce que les recruteurs peuvent consulter.'},
{icon:UsersRound,title:'Découverte professionnelle',text:'Les recruteurs trouvent des profils publics sans créer une deuxième communauté ni un second annuaire.'},
{icon:ShieldCheck,title:'Contacts encadrés',text:'Les prises de contact sont enregistrées afin de protéger les apprenants et renforcer la confiance.'},
].map(item=><div key={item.title} className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><item.icon size={20} color={GOLD}/><h2 className="mt-3 text-base font-semibold" style={{color:BLUE}}>{item.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p></div>)}</div></div></TalentLayout>}
