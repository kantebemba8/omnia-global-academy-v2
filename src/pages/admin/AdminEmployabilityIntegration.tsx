import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Briefcase, Eye, MessageSquare, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { employabilityRequest } from '../../lib/employabilityApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type Tab = 'profiles' | 'matches' | 'contacts' | 'access';

export default function AdminEmployabilityIntegration() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('profiles');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try { setData(await employabilityRequest<any>('admin_dashboard')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Chargement impossible.'); }
  };
  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    profiles: data?.profile_count || 0,
    active: data?.profiles?.filter((item:any)=>item.status==='active').length || 0,
    matches: data?.matches?.length || 0,
    contacts: data?.contact_requests?.filter((item:any)=>item.status==='pending').length || 0,
  }), [data]);

  return <AdminLayout><main className="p-5 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><p className="text-xs font-bold uppercase tracking-[.18em]" style={{color:GOLD}}>Programme 2 · GM5</p><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Supervision de l’employabilité intégrée</h1><p className="mt-2 max-w-3xl text-sm text-gray-600">Contrôlez les consentements, le matching, les demandes de contact et les accès recruteurs sans ouvrir les contenus privés.</p></div><button onClick={load} className="flex items-center gap-2 border px-4 py-2 text-sm font-bold"><RefreshCw size={16}/>Actualiser</button></div>
    {error&&<p className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Users/>} label="Profils" value={metrics.profiles}/><Metric icon={<ShieldCheck/>} label="Profils actifs" value={metrics.active}/><Metric icon={<Briefcase/>} label="Correspondances" value={metrics.matches}/><Metric icon={<MessageSquare/>} label="Contacts en attente" value={metrics.contacts}/></section>
    <div className="mt-7 flex flex-wrap gap-2 border-b">{([['profiles','Profils'],['matches','Correspondances'],['contacts','Demandes de contact'],['access','Accès recruteurs']] as [Tab,string][]).map(([value,label])=><button key={value} onClick={()=>setTab(value)} className="border-b-2 px-4 py-3 text-sm font-bold" style={{borderColor:tab===value?GOLD:'transparent',color:tab===value?BLUE:'#6b7280'}}>{label}</button>)}</div>
    <section className="overflow-x-auto">
      {tab==='profiles'&&<table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b"><Th>Utilisateur</Th><Th>État</Th><Th>Visibilité</Th><Th>Sources</Th><Th>Matching</Th><Th>Contact</Th><Th>Mise à jour</Th></tr></thead><tbody>{(data?.profiles||[]).map((item:any)=><tr key={item.user_id} className="border-b"><Td><strong>{item.user?.full_name||item.user?.email||'Utilisateur'}</strong><br/><span className="text-xs text-gray-500">{item.user_id}</span></Td><Td>{item.status}</Td><Td>{item.talent_visibility}</Td><Td>{[['Projet',item.use_project_evidence],['Passport',item.use_skills_passport],['CLR',item.use_learning_record],['Career',item.use_career_documents]].filter(([,ok])=>ok).map(([name])=>name).join(', ')||'Aucune'}</Td><Td>{item.allow_opportunity_matching?'Oui':'Non'}</Td><Td>{item.allow_recruiter_contact?'Oui':'Non'}</Td><Td>{new Date(item.updated_at).toLocaleDateString('fr-FR')}</Td></tr>)}</tbody></table>}
      {tab==='matches'&&<table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b"><Th>Talent</Th><Th>Offre</Th><Th>Score</Th><Th>Statut</Th><Th>Générée</Th></tr></thead><tbody>{(data?.matches||[]).map((item:any)=><tr key={item.id} className="border-b"><Td>{item.user?.full_name||item.user?.email||item.user_id}</Td><Td>{item.job?.title||item.job_id}</Td><Td>{Math.round(Number(item.match_score||0))}%</Td><Td>{item.status}</Td><Td>{new Date(item.generated_at).toLocaleString('fr-FR')}</Td></tr>)}</tbody></table>}
      {tab==='contacts'&&<table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b"><Th>Recruteur</Th><Th>Talent</Th><Th>Objet</Th><Th>Statut</Th><Th>Date</Th></tr></thead><tbody>{(data?.contact_requests||[]).map((item:any)=><tr key={item.id} className="border-b"><Td>{item.recruiter?.full_name||item.recruiter?.email||item.recruiter_user_id}</Td><Td>{item.talent?.full_name||item.talent?.email||item.talent_user_id}</Td><Td><strong>{item.subject||'Demande'}</strong><br/><span className="line-clamp-2 max-w-md text-xs text-gray-500">{item.message}</span></Td><Td>{item.status}</Td><Td>{new Date(item.requested_at).toLocaleString('fr-FR')}</Td></tr>)}</tbody></table>}
      {tab==='access'&&<table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b"><Th>Recruteur</Th><Th>Talent</Th><Th>Action</Th><Th>Finalité</Th><Th>Date</Th></tr></thead><tbody>{(data?.access_log||[]).map((item:any)=><tr key={item.id} className="border-b"><Td>{item.recruiter?.full_name||item.recruiter?.email||item.recruiter_user_id}</Td><Td>{item.talent?.full_name||item.talent?.email||item.talent_user_id}</Td><Td className="flex items-center gap-2"><Eye size={14}/>{item.action}</Td><Td>{item.purpose||'Non précisée'}</Td><Td>{new Date(item.created_at).toLocaleString('fr-FR')}</Td></tr>)}</tbody></table>}
    </section>
  </main></AdminLayout>;
}

function Metric({icon,label,value}:{icon:ReactNode;label:string;value:number}){return <div className="border bg-white p-5"><span style={{color:GOLD}}>{icon}</span><p className="mt-3 text-3xl font-black" style={{color:BLUE}}>{value}</p><p className="text-sm text-gray-500">{label}</p></div>}
function Th({children}:{children:ReactNode}){return <th className="p-3 font-bold" style={{color:BLUE}}>{children}</th>}
function Td({children}:{children:ReactNode}){return <td className="p-3 align-top">{children}</td>}
