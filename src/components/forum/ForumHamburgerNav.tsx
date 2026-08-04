import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Home, Menu, MessageCircle } from 'lucide-react';
import { getDashboardPath } from '../SubspaceHamburgerLayout';

const BLUE='#002050', GOLD='#BF8813';
const ITEMS=[
  {label:'Accueil Communauté',path:'/forum',icon:Home,exact:true},
  {label:'Espace Général',path:'/forum/general',icon:MessageCircle},
  {label:'Carrière & Emploi',path:'/forum/carriere',icon:Briefcase},
];

export default function ForumHamburgerNav(){
  const [open,setOpen]=useState(false); const location=useLocation(); const navigate=useNavigate();
  const user=useMemo(()=>{try{return JSON.parse(localStorage.getItem('omnia_user')||'null')}catch{return null}},[]);
  const dashboard=getDashboardPath(user?.roles||[]);
  useEffect(()=>{if(!open)return; const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[open]);
  useEffect(()=>setOpen(false),[location.pathname,location.search]);
  return <>
    <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
      <div className="flex items-center gap-3"><button onClick={()=>setOpen(v=>!v)} aria-label="Ouvrir le menu Omnia Communauté" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100" style={{color:open?GOLD:BLUE}}><Menu size={23}/></button><span className="text-lg font-bold"><span style={{color:BLUE}}>Omnia</span> <span style={{color:GOLD}}>Communauté</span></span></div>
      {user&&<button onClick={()=>navigate(dashboard)} className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-slate-100 sm:flex" style={{color:BLUE}}><ArrowLeft size={16}/>Retour au Dashboard</button>}
    </header>
    {open&&<div className="fixed inset-0 z-50"><button className="absolute inset-0 bg-slate-950/25" onClick={()=>setOpen(false)} aria-label="Fermer le menu"/><aside className="absolute bottom-0 left-0 top-0 w-[286px] max-w-[86vw] bg-white shadow-2xl">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5"><img src="/IMG_0349.png" className="h-12 w-12 rounded-xl object-cover" alt="Omnia Global Academy"/><div><div className="font-bold tracking-wide" style={{color:BLUE}}>OMNIA</div><div className="text-[10px] font-semibold tracking-[.15em] text-slate-500">GLOBAL ACADEMY</div></div></div>
      <div className="px-5 pb-2 pt-5 text-xs font-bold uppercase tracking-[.14em]" style={{color:GOLD}}>Omnia Communauté</div>
      <nav className="space-y-1 px-3 py-3">{ITEMS.map((item,i)=>{const Icon=item.icon;const active=item.exact?location.pathname===item.path:location.pathname.startsWith(item.path);return <Link key={`${item.label}-${i}`} to={item.path} onClick={()=>setOpen(false)} className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-50" style={{color:active?BLUE:'#526074',background:active?'rgba(191,136,19,.08)':undefined}}>{active&&<span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full" style={{background:GOLD}}/>}<Icon size={18} style={{color:active?GOLD:'#64748B'}}/>{item.label}</Link>})}</nav>
      {user&&<div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 p-3"><button onClick={()=>{setOpen(false);navigate(dashboard)}} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-50" style={{color:BLUE}}><ArrowLeft size={18}/>Retour au Dashboard</button></div>}
    </aside></div>}
  </>;
}
