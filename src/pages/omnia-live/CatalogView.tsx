import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Radio, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import LiveCard from './LiveCard';
import LiveRail from './LiveRail';
import { LiveItem, liveApi } from './liveApi';

export default function CatalogView({ title, subtitle, filter }: { title: string; subtitle: string; filter?: string }) {
  const [searchParams] = useSearchParams();
  const search = (searchParams.get('q') || '').trim().toLowerCase();
  const [items, setItems] = useState<LiveItem[]>([]); const [loading,setLoading]=useState(true); const[error,setError]=useState('');
  const params=useMemo(()=>filter==='live'?{status:'live'}:filter==='training'?{delivery_type:'synchronous_training'}:filter==='video'?{delivery_type:'recorded_video'}:{},[filter]);
  useEffect(()=>{setLoading(true);setError('');liveApi('list',{},params).then(d=>{let next=(d.items||[]) as LiveItem[];if(filter==='upcoming'){const now=Date.now();next=next.filter(i=>i.starts_at&&new Date(i.starts_at).getTime()>now&&i.status==='published')}setItems(next)}).catch(e=>{setItems([]);setError(e instanceof Error?e.message:'Impossible de charger le catalogue.')}).finally(()=>setLoading(false))},[filter,params]);
  const filtered=useMemo(()=>!search?items:items.filter(i=>[i.title,i.short_description,i.long_description,i.organizer_display_name,i.event_type,i.delivery_type,i.language,i.level].filter(Boolean).join(' ').toLowerCase().includes(search)),[items,search]);
  const spotlight=useMemo(()=>filtered.filter(i=>i.status==='live'||i.featured).slice(0,10),[filtered]);const ids=useMemo(()=>new Set(spotlight.map(i=>i.id)),[spotlight]);const rest=useMemo(()=>filtered.filter(i=>!ids.has(i.id)),[filtered,ids]);
  return <OmniaLiveLayout><section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-5 lg:px-6"><div className="grid gap-6 border-b border-[#E7E6F2] pb-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#5C55C8]">{filter==='live'?<Radio size={13}/>:<CalendarDays size={13}/>} Programmation Omnia Live</div><h1 className="mt-3 text-4xl font-black tracking-[-.04em] text-[#002050] md:text-5xl">{title}</h1><p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{subtitle}</p>{search&&<p className="mt-4 text-sm font-bold text-[#5C55C8]">Résultats pour « {searchParams.get('q')} »</p>}</div><div className="flex items-center gap-2 rounded-xl border border-[#E7E6F2] bg-white px-3 py-2 text-xs font-bold text-slate-500"><SlidersHorizontal size={14}/> Les filtres métier restent sur la page ; la recherche est dans l’en-tête.</div></div>
  {loading?<div className="py-16 text-slate-500">Chargement de la programmation...</div>:error?<div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>:filtered.length?<div className="mt-9 space-y-12">{spotlight.length>0&&<LiveRail title={filter==='live'?'En direct maintenant':'En direct et à la une'} subtitle="Les contenus prioritaires défilent comme une programmation." items={spotlight}/>}<section><div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#5C55C8]">Catalogue</p><h2 className="mt-1 text-2xl font-black text-[#002050]">{spotlight.length?'Toute la programmation':title}</h2></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{(rest.length?rest:filtered).map(item=><LiveCard key={item.id} item={item}/>)}</div></section></div>:<div className="mt-10 rounded-[28px] border border-dashed border-[#D7D4ED] bg-[#F7F6FD] p-12 text-center"><h2 className="font-black text-[#002050]">Aucun contenu disponible pour le moment</h2><p className="mt-2 text-sm text-slate-500">Les nouveaux événements apparaîtront ici automatiquement après publication.</p></div>}
  </section></OmniaLiveLayout>
}
