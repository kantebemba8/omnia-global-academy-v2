import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { LayoutDashboard, Radio, Users, Film, BarChart3, Wallet, UserRound, Settings2, PlusCircle } from 'lucide-react';

const NAV=[
 ['/omnia-live/organisateur','Tableau de bord',LayoutDashboard,true],
 ['/omnia-live/organisateur/evenements','Mes événements',Radio],
 ['/omnia-live/proposer','Créer',PlusCircle],
 ['/omnia-live/organisateur/participants','Participants',Users],
 ['/omnia-live/organisateur/medias','Médias & Replays',Film],
 ['/omnia-live/organisateur/statistiques','Statistiques',BarChart3],
 ['/omnia-live/revenus','Revenus',Wallet],
 ['/omnia-live/organisateur/payouts','Payouts',Wallet],
 ['/omnia-live/profil-organisateur','Profil',UserRound],
 ['/omnia-live/organisateur/parametres','Paramètres',Settings2],
] as const;

export default function OrganizerShell({children,title,subtitle}:{children:ReactNode;title:string;subtitle?:string}){
 return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
  <div className="mb-6"><h1 className="text-3xl font-black text-[#002050]">{title}</h1>{subtitle&&<p className="mt-2 text-slate-600">{subtitle}</p>}</div>
  <div className="mb-7 overflow-x-auto"><div className="flex min-w-max gap-2 rounded-2xl border bg-white p-2">{NAV.map(([path,label,Icon,exact])=><NavLink key={path} to={path} end={Boolean(exact)} className={({isActive})=>`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isActive?'bg-[#002050] text-white':'text-slate-600 hover:bg-slate-50'}`}><Icon size={16}/>{label}</NavLink>)}</div></div>
  {children}
 </section></OmniaLiveLayout>
}
