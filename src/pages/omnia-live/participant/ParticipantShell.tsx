import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { LayoutDashboard, Compass, CalendarDays, Library, ReceiptText, FileBadge, Bell, RotateCcw, KeyRound } from 'lucide-react';

const NAV=[
 ['/omnia-live/participant','Accueil',LayoutDashboard,true],
 ['/omnia-live/explorer','Explorer',Compass],
 ['/omnia-live/participant/mes-lives','Mes Lives',CalendarDays],
 ['/omnia-live/participant/bibliotheque','Bibliothèque',Library],
 ['/omnia-live/mes-achats','Achats & factures',ReceiptText],
 ['/omnia-live/mes-documents','Documents',FileBadge],
 ['/omnia-live/participant/notifications','Notifications',Bell],
 ['/omnia-live/participant/remboursements','Remboursements',RotateCcw],
 ['/omnia-live/acces-prive','Accès privé',KeyRound],
] as const;

export default function ParticipantShell({children,title,subtitle}:{children:ReactNode;title:string;subtitle?:string}){
 return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
  <div className="mb-6"><h1 className="text-3xl font-black text-[#002050]">{title}</h1>{subtitle&&<p className="mt-2 text-slate-600">{subtitle}</p>}</div>
  <div className="mb-7 overflow-x-auto"><div className="flex min-w-max gap-2 rounded-2xl border bg-white p-2">{NAV.map(([path,label,Icon,exact])=><NavLink key={path} to={path} end={Boolean(exact)} className={({isActive})=>`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isActive?'bg-[#002050] text-white':'text-slate-600 hover:bg-slate-50'}`}><Icon size={16}/>{label}</NavLink>)}</div></div>
  {children}
 </section></OmniaLiveLayout>
}
