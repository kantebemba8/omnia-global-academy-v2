import { Activity, BarChart3, Briefcase, CalendarDays, Contact, Eye, FileText, Heart, UsersRound } from 'lucide-react';
import type { TalentAnalytics } from '../../pages/talent/talentApi';

const BLUE='#002050'; const GOLD='#BF8813'; const BORDER='#E4E7EC';

export function PeriodSelector({value,onChange}:{value:number;onChange:(value:number)=>void}) {
  return <div className="inline-flex rounded-lg border bg-white p-1" style={{borderColor:BORDER}}>{[7,30,90,365].map(days=><button key={days} type="button" onClick={()=>onChange(days)} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{background:value===days?BLUE:'transparent',color:value===days?'white':'#667085'}}>{days===365?'1 an':`${days} j`}</button>)}</div>;
}

export default function TalentAnalyticsPanel({analytics,loading=false,mode='recruiter'}:{analytics:TalentAnalytics|null;loading?:boolean;mode?:'recruiter'|'structure'|'admin'}) {
  const m=analytics?.metrics;
  const cards = mode==='admin' ? [
    ['Profils publics',m?.public_profiles||0,UsersRound],['Recruteurs validés',m?.approved_recruiters||0,UsersRound],['Structures actives',m?.recruiting_structures||0,Briefcase],['Offres actives',m?.active_jobs||0,Briefcase],['Contacts',m?.contacts||0,Contact],['Entretiens',m?.interviews||0,CalendarDays],
  ] : [
    ['Offres actives',m?.active_jobs||0,Briefcase],['Candidatures',m?.applications||0,FileText],['Profils consultés',m?.profile_views||0,Eye],['Favoris',m?.favorites||0,Heart],['Contacts',m?.contacts||0,Contact],['Entretiens',m?.interviews||0,CalendarDays],
  ];
  const max=Math.max(1,...(analytics?.series||[]).map(x=>x.profile_views+x.contacts+x.interviews+x.applications));
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,Icon]:any)=><div key={label} className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold" style={{color:BLUE}}>{loading?'—':value}</p></div><div className="rounded-lg p-3" style={{background:'rgba(191,136,19,.10)'}}><Icon size={20} color={GOLD}/></div></div></div>)}</div>
    {mode!=='admin' && <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><p className="text-sm text-gray-500">Taux de réponse</p><p className="mt-2 text-2xl font-semibold" style={{color:BLUE}}>{loading?'—':`${m?.response_rate||0}%`}</p></div><div className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><p className="text-sm text-gray-500">Recrutements finalisés</p><p className="mt-2 text-2xl font-semibold" style={{color:BLUE}}>{loading?'—':m?.hires||0}</p></div></div>}
    <section className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center gap-2"><BarChart3 size={18} color={GOLD}/><h3 className="font-semibold" style={{color:BLUE}}>Évolution de l’activité</h3></div>{!analytics?.series?.length?<p className="mt-5 text-sm text-gray-500">Aucune activité sur cette période.</p>:<div className="mt-5 space-y-3">{analytics.series.slice(-14).map(row=>{const total=row.profile_views+row.contacts+row.interviews+row.applications;return <div key={row.date} className="grid grid-cols-[78px_1fr_34px] items-center gap-3 text-xs"><span className="text-gray-500">{new Date(row.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span><div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{width:`${Math.max(3,total/max*100)}%`,background:GOLD}}/></div><span className="text-right font-medium" style={{color:BLUE}}>{total}</span></div>})}</div>}</section>
    <section className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center gap-2"><Activity size={18} color={GOLD}/><h3 className="font-semibold" style={{color:BLUE}}>Activité récente</h3></div>{!analytics?.recent_activity?.length?<p className="mt-5 text-sm text-gray-500">Aucune activité enregistrée.</p>:<div className="mt-4 divide-y">{analytics.recent_activity.slice(0,10).map(item=><div key={item.id} className="py-3"><p className="text-sm font-medium" style={{color:BLUE}}>{humanize(item.action)}</p><p className="mt-1 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('fr-FR')}</p></div>)}</div>}</section>
  </div>;
}
function humanize(value:string){return value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())}
