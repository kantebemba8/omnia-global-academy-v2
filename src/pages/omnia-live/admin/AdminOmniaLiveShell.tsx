import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AdminLayout } from '../../../components/AdminLayout';
import { LayoutDashboard, ListChecks, Radio, Users, Building2, Film, Wallet, Settings, RotateCcw } from 'lucide-react';

const NAV = [
  ['/admin/omnia-live','Vue d’ensemble',LayoutDashboard,true],
  ['/admin/omnia-live/validation','Validation',ListChecks],
  ['/admin/omnia-live/evenements','Événements',Radio],
  ['/admin/omnia-live/organisateurs','Organisateurs',Users],
  ['/admin/omnia-live/structures','Structures & Packs',Building2],
  ['/admin/omnia-live/medias','Médias & Replays',Film],
  ['/admin/omnia-live/finance','Finance & Payouts',Wallet],
  ['/admin/omnia-live/operations','Opérations',RotateCcw],
  ['/admin/omnia-live/parametres','Paramètres',Settings],
] as const;

export default function AdminOmniaLiveShell({children,title,subtitle}:{children:ReactNode;title:string;subtitle?:string}){
 return <AdminLayout><div className="p-5 md:p-8">
  <div className="mb-6"><h1 className="text-3xl font-black text-[#002050]">{title}</h1>{subtitle&&<p className="mt-2 text-slate-600">{subtitle}</p>}</div>
  <div className="mb-7 overflow-x-auto"><div className="flex min-w-max gap-2 rounded-2xl border bg-white p-2">{NAV.map(([path,label,Icon,exact])=><NavLink key={path} to={path} end={Boolean(exact)} className={({isActive})=>`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isActive?'bg-[#002050] text-white':'text-slate-600 hover:bg-slate-50'}`}><Icon size={16}/>{label}</NavLink>)}</div></div>
  {children}
 </div></AdminLayout>
}
