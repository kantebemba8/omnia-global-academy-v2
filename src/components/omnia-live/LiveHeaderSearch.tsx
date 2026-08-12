import { FormEvent, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function LiveHeaderSearch(){
  const location=useLocation(); const navigate=useNavigate(); const[value,setValue]=useState('');
  useEffect(()=>{if(['/omnia-live/explorer','/omnia-live/en-direct','/omnia-live/a-venir','/omnia-live/formations','/omnia-live/videos'].includes(location.pathname))setValue(new URLSearchParams(location.search).get('q')||'')},[location.pathname,location.search]);
  function submit(event:FormEvent){event.preventDefault();const current=new URLSearchParams(location.search);const next=new URLSearchParams();const q=value.trim();if(q)next.set('q',q);if(current.get('preview')==='true'){next.set('preview','true');const role=current.get('role');if(role)next.set('role',role)}navigate(`/omnia-live/explorer${next.toString()?`?${next.toString()}`:''}`)}
  return <form onSubmit={submit} className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#5C55C8] focus-within:ring-2 focus-within:ring-[#5C55C8]/15"><Search size={16} className="shrink-0 text-slate-400"/><input value={value} onChange={e=>setValue(e.target.value)} type="search" className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Rechercher un Live, un expert, un sujet..." aria-label="Rechercher dans Omnia Live"/>{value&&<button type="button" onClick={()=>setValue('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Effacer la recherche"><X size={13}/></button>}</form>
}
