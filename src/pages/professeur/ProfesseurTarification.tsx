import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Download, Calculator, CheckCircle2, RefreshCcw } from 'lucide-react';
import { getApiBase } from '../../lib/config';

type PricingCourse = {
  id:string; title:string; pricing_status:string; score_calcule:number;
  prix_provisoire_xof:number; desired_price_amount:number|null;
  admin_selected_price_source:string|null; admin_selected_price_xof:number|null;
  pricing_revision_comment:string|null;
};

export default function ProfesseurTarification(){
  const [courses,setCourses]=useState<PricingCourse[]>([]);
  const [loading,setLoading]=useState(true);
  const [comment,setComment]=useState<Record<string,string>>({});
  const token=()=>localStorage.getItem('omnia_session_token')||'';

  async function load(){
    setLoading(true);
    try{
      const r=await fetch(`${getApiBase()}/course-pricing-workflow`,{headers:{Authorization:`Bearer ${token()}`}});
      const d=await r.json(); setCourses(d.courses||[]);
    }finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function action(course_id:string,action:string){
    await fetch(`${getApiBase()}/course-pricing-workflow`,{
      method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},
      body:JSON.stringify({course_id,action,comment:comment[course_id]||undefined})
    });
    await load();
  }

  return <DashboardLayout role="professeur">
    <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{color:'#002050'}}>Tarification des formations</h1>
        <p className="mt-1 text-sm text-gray-500">Lisez le fonctionnement du calcul avant de créer votre formation.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <img src="/tarification-formations-infographie.svg" alt="Résumé du calcul de tarification" className="w-full h-auto" />
        <div className="flex flex-wrap gap-3 border-t border-gray-100 p-4">
          <a href="/guide-tarification-formations.pdf" download
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{backgroundColor:'#002050'}}>
            <Download className="w-4 h-4"/> Télécharger le guide PDF
          </a>
          <a href="/professeur/courses/new"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{borderColor:'#BF8813',color:'#BF8813'}}>
            <Calculator className="w-4 h-4"/> Créer une formation
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold" style={{color:'#002050'}}>Vos décisions tarifaires en attente</h2>
        {loading ? <p className="text-sm text-gray-400 mt-4">Chargement…</p> :
        courses.length===0 ? <p className="text-sm text-gray-400 mt-4">Aucune décision tarifaire en attente.</p> :
        <div className="mt-4 space-y-4">
          {courses.map(c=><div key={c.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-gray-800">{c.title}</p>
                <p className="mt-1 text-xs text-gray-500">Score {c.score_calcule ?? '—'} · Prix automatique {(c.prix_provisoire_xof||0).toLocaleString()} XOF · Votre prix {(c.desired_price_amount||0).toLocaleString()} XOF</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700">{c.pricing_status.replaceAll('_',' ')}</span>
            </div>
            {c.pricing_status==='en_attente_acceptation_prix_professeur' && <>
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-sm font-semibold text-emerald-800">Prix retenu par Omnia : {(c.admin_selected_price_xof||0).toLocaleString()} XOF</p>
                {c.pricing_revision_comment && <p className="text-xs text-emerald-700 mt-1">{c.pricing_revision_comment}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={()=>action(c.id,'professor_accept')} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{backgroundColor:'#1E7A52'}}>
                  <CheckCircle2 className="w-4 h-4"/> Accepter le prix et soumettre
                </button>
                <button onClick={()=>action(c.id,'professor_revision')} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold" style={{borderColor:'#BF8813',color:'#BF8813'}}>
                  <RefreshCcw className="w-4 h-4"/> Demander une révision
                </button>
              </div>
            </>}
          </div>)}
        </div>}
      </div>
    </div>
  </DashboardLayout>;
}
