import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, BellRing, Building2, CalendarDays, ChevronDown,
  ClipboardCheck, FileBadge2, Film, Gauge, ListChecks, LockKeyhole,
  Radio, RefreshCcw, Settings, ShieldCheck, SlidersHorizontal, Users, Wallet,
} from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Item={path:string;label:string;icon:any;exact?:boolean};
type Group={label:string;items:Item[]};
const GROUPS:Group[]=[
 {label:'Pilotage',items:[
  {path:'/admin/omnia-live',label:'Vue d’ensemble',icon:Gauge,exact:true},
  {path:'/admin/omnia-live/validation',label:'Validation & événements',icon:ListChecks},
  {path:'/admin/omnia-live/evenements',label:'Tous les événements',icon:CalendarDays},
 ]},
 {label:'Gestion',items:[
  {path:'/admin/omnia-live/organisateurs',label:'Organisateurs',icon:Users},
  {path:'/admin/omnia-live/structures',label:'Structures',icon:Building2},
  {path:'/admin/omnia-live/medias',label:'Médias, replays & documents',icon:Film},
  {path:'/admin/omnia-live/documents',label:'Certificats & attestations',icon:FileBadge2},
  {path:'/admin/omnia-live/communications',label:'Communication',icon:BellRing},
 ]},
 {label:'Finance & opérations',items:[
  {path:'/admin/omnia-live/finance',label:'Finance & Payouts',icon:Wallet},
  {path:'/admin/omnia-live/operations',label:'Opérations & automatisations',icon:RefreshCcw},
  {path:'/admin/omnia-live/automatisations',label:'Règles automatiques',icon:SlidersHorizontal},
 ]},
 {label:'Contrôle',items:[
  {path:'/admin/omnia-live/analytics',label:'Analytique',icon:BarChart3},
  {path:'/admin/omnia-live/rapports',label:'Rapports & exports',icon:ClipboardCheck},
  {path:'/admin/omnia-live/securite',label:'Sécurité & intégrité',icon:LockKeyhole},
  {path:'/admin/omnia-live/integrite',label:'Contrôles d’intégrité',icon:ShieldCheck},
  {path:'/admin/omnia-live/parametres',label:'Paramètres',icon:Settings},
 ]},
];

function Navigation({mobile=false}:{mobile?:boolean}){
 const [open,setOpen]=useState<Record<string,boolean>>(()=>Object.fromEntries(GROUPS.map((g,i)=>[g.label,i===0])));
 if(mobile)return <nav className="flex min-w-max gap-2">{GROUPS.flatMap(g=>g.items).map(({path,label,icon:Icon,exact})=><NavLink key={path} to={path} end={Boolean(exact)} className={({isActive})=>`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isActive?'text-white':'bg-white text-slate-600'}`} style={({isActive})=>isActive?{background:BLUE}:{border:`1px solid ${BORDER}`}}><Icon size={16}/>{label}</NavLink>)}</nav>;
 return <nav className="space-y-2">{GROUPS.map(group=><section key={group.label} className="border-b border-white/10 pb-2">
  <button onClick={()=>setOpen(v=>({...v,[group.label]:!v[group.label]}))} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white/55"><span>{group.label}</span><ChevronDown size={14} className={`transition ${open[group.label]?'rotate-180':''}`}/></button>
  {open[group.label]&&<div className="space-y-1">{group.items.map(({path,label,icon:Icon,exact})=><NavLink key={path} to={path} end={Boolean(exact)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition" style={({isActive})=>isActive?{background:'rgba(191,136,19,.18)',color:GOLD}:{color:'rgba(255,255,255,.78)'}}><Icon size={16}/>{label}</NavLink>)}</div>}
 </section>)}</nav>;
}

export default function AdminOmniaLiveShell({children,title,subtitle}:{children:ReactNode;title:string;subtitle?:string}){
 return <div className="h-screen overflow-hidden bg-slate-50">
  <header className="h-[65px] border-b bg-white" style={{borderColor:BORDER}}><div className="flex h-full items-center justify-between gap-4 px-4 md:px-6"><div className="flex items-center gap-3"><img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 rounded-lg object-contain"/><div><p className="text-base font-bold leading-tight" style={{color:BLUE}}>Omnia</p><p className="text-base font-bold leading-tight" style={{color:GOLD}}>Live</p></div></div><div className="flex items-center gap-2"><Link to="/omnia-live" className="hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold sm:inline-flex" style={{borderColor:BORDER,color:BLUE}}><Radio size={15}/>Voir Omnia Live</Link><Link to="/admin/omnia-live/creer" className="rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{background:GOLD}}>+ Créer un Live</Link><Link to="/admin/dashboard" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{background:BLUE}}><ArrowLeft size={15}/><span className="hidden md:inline">Retour au Dashboard</span></Link></div></div></header>
  <div className="flex h-[calc(100vh-65px)] overflow-hidden">
   <aside className="hidden h-full w-[250px] flex-shrink-0 flex-col overflow-hidden lg:flex" style={{background:BLUE}}><div className="flex items-center gap-3 border-b border-white/10 p-5"><img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 object-contain"/><div><p className="font-bold text-white">Omnia</p><p className="font-bold" style={{color:GOLD}}>Live</p></div></div><div className="min-h-0 flex-1 overflow-y-auto p-3" style={{scrollbarColor:`${GOLD} rgba(255,255,255,.08)`,scrollbarWidth:'thin'}}><Navigation/></div><div className="flex-shrink-0 border-t border-white/10 p-3"><Link to="/admin/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{color:GOLD}}><ArrowLeft size={16}/>Retour au Dashboard</Link></div></aside>
   <main className="h-full min-w-0 flex-1 overflow-y-auto"><div className="border-b px-3 py-2 lg:hidden" style={{borderColor:BORDER}}><div className="overflow-x-auto"><Navigation mobile/></div></div><div className="p-4 md:p-6 lg:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6 border-b pb-5" style={{borderColor:BORDER}}><p className="text-xs font-semibold uppercase tracking-[.16em]" style={{color:GOLD}}>Gestion Omnia Live</p><h1 className="mt-1 text-2xl font-bold" style={{color:BLUE}}>{title}</h1>{subtitle&&<p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>}</header>{children}</div></div></main>
  </div>
 </div>;
}
