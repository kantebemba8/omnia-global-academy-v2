import { useEffect,useState } from 'react';
import { AdminLayout } from '../../../components/AdminLayout';
import { liveApi } from '../liveApi';

export default function AdminOmniaLiveSecurity(){
 const [policies,setPolicies]=useState<any[]>([]),[flags,setFlags]=useState<any[]>([]),[permissions,setPermissions]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=async()=>{try{const [p,f,r]=await Promise.all([liveApi('security_policies_list'),liveApi('feature_flags_list'),liveApi('role_permissions_list')]);setPolicies(p.policies||[]);setFlags(f.flags||[]);setPermissions(r.permissions||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};
 useEffect(()=>{load()},[]);
 async function toggleFlag(flag:any){await liveApi('feature_flag_save',{method:'POST',body:JSON.stringify({...flag,enabled:!flag.enabled})});await load()}
 async function togglePerm(p:any){await liveApi('role_permission_save',{method:'POST',body:JSON.stringify({...p,enabled:!p.enabled})});await load()}
 return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black text-[#002050]">Sécurité & Permissions Omnia Live</h1><p className="mt-2 text-slate-600">Contrôle central des droits, politiques et activations production.</p>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
 <div className="mt-7 grid gap-6 xl:grid-cols-3"><section className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Feature flags</h2><div className="mt-4 space-y-3">{flags.map(f=><label key={f.flag_key} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><b className="text-sm">{f.flag_key}</b><div className="text-xs text-slate-500">{f.enabled?'Actif':'Inactif'}</div></div><input type="checkbox" checked={!!f.enabled} onChange={()=>toggleFlag(f)}/></label>)}</div></section>
 <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Politiques sécurité</h2><div className="mt-4 space-y-3">{policies.map(p=><div key={p.policy_key} className="rounded-xl bg-slate-50 p-3"><b className="text-sm">{p.policy_key}</b><div className="mt-1 text-xs text-slate-500">{JSON.stringify(p.config)}</div></div>)}</div></section>
 <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Permissions</h2><div className="mt-4 max-h-[650px] space-y-2 overflow-auto">{permissions.map(p=><label key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><b className="text-xs">{p.role_key}</b><div className="text-xs text-slate-500">{p.permission_key} · {p.scope}</div></div><input type="checkbox" checked={!!p.enabled} onChange={()=>togglePerm(p)}/></label>)}</div></section></div></div></AdminLayout>
}