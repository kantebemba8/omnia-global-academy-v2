import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { ArrowLeft, Eye, Users } from 'lucide-react';

const BLUE='#002050', GOLD='#BF8813';

type Member={id:string;name:string;email:string;created_at:string|null};
const TEST_EMAILS=new Set([
 'apprenant.test@omniaglobalacademy.com',
 'mod.test@omniaglobalacademy.com',
 'prof.test@omniaglobalacademy.com',
 'structure.test@omniaglobalacademy.com',
 'organisateur.test@omniaglobalacademy.com',
 'recruteur.test@omniaglobalacademy.com',
 'coach.test@omniaglobalacademy.com'
]);
type Payload={role:string;count:number;members:Member[]};

const LABELS:Record<string,string>={
  apprenant:'Apprenants',professeur:'Professeurs',structure:'Structures',
  organisateur:'Organisateurs',moderateur:'Modérateurs',
  recruteur_independant:'Recruteurs indépendants',coach:'Coachs'
};

export default function AdminRoleUsers(){
  const {roleKey=''}=useParams();
  const navigate=useNavigate();
  const [data,setData]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{(async()=>{
    setLoading(true);setError('');
    try{
      const token=localStorage.getItem('omnia_session_token');
      if(!token)throw new Error('Session expirée.');
      const r=await fetch(`${ENDPOINTS.dashboardAdmin}?role=${encodeURIComponent(roleKey)}`,{
        headers:{Authorization:`Bearer ${token}`}
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||d.error||'Chargement impossible');
      setData(d);
    }catch(e){setError(e instanceof Error?e.message:'Erreur');}
    finally{setLoading(false);}
  })()},[roleKey]);

  return <AdminLayout>
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <div className="border-b border-gray-200 pb-5">
        <button onClick={()=>navigate('/admin/dashboard')} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 mb-4">
          <ArrowLeft size={15}/> Retour au tableau de bord
        </button>
        <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Tableau de bord · Utilisateurs par rôle</p>
        <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>{LABELS[roleKey]||data?.role||roleKey}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Seules les informations administratives minimales sont affichées : nom, e-mail et date d’inscription.</p>
          {roleKey==='recruteur_independant'&&<button type="button" onClick={()=>navigate('/talent/recruteur/dashboard?preview=true')} className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{color:BLUE,borderColor:GOLD}}><Eye size={16}/>Prévisualiser l’espace recruteur</button>}
          {roleKey==='coach'&&<button type="button" onClick={()=>navigate('/coach/dashboard?preview=true')} className="inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold" style={{color:BLUE,borderColor:GOLD}}><Eye size={16}/>Prévisualiser l’espace coach</button>}
        </div>
      </div>

      {error&&<div className="border-l-4 border-red-500 pl-4 py-2 text-sm text-red-700">{error}</div>}
      {loading?<div className="py-16 text-center text-sm text-gray-400">Chargement…</div>:
      !data||data.members.length===0?<div className="border-y border-gray-200 py-14 text-center">
        <Users size={28} className="mx-auto text-gray-300 mb-2"/>
        <p className="text-sm text-gray-500">Aucun utilisateur pour ce rôle.</p>
      </div>:
      <div className="overflow-x-auto border-t border-gray-200">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200">
            <th className="py-3">Nom et prénom</th><th>E-mail</th><th>Date d’inscription</th>
          </tr></thead>
          <tbody>{[...data.members].sort((a,b)=>Number(TEST_EMAILS.has(b.email.toLowerCase()))-Number(TEST_EMAILS.has(a.email.toLowerCase()))).map(m=><tr key={m.id} className="border-b border-gray-100">
            <td className="py-3 font-semibold" style={{color:BLUE}}>{m.name||'Non renseigné'}{TEST_EMAILS.has(m.email.toLowerCase())&&<span className="ml-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50">Test</span>}</td>
            <td className="text-gray-600">{m.email||'—'}</td>
            <td className="text-gray-500">{m.created_at?new Date(m.created_at).toLocaleDateString('fr-FR'):'—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  </AdminLayout>
}
