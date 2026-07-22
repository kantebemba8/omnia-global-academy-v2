import { useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Eye, Radio, Award, BadgeCheck } from 'lucide-react';

const BLUE='#002050', GOLD='#BF8813';

type Model = {
  id:string; label:string; family:string; documentType:string; issuer:string; source:'course'|'omnia_live'; tone:string;
};

const MODELS:Model[]=[
  {id:'oga',label:'OGA Classique',family:'Formation',documentType:'Certificat de réussite',issuer:'Omnia Global Academy',source:'course',tone:'classique'},
  {id:'prof',label:'Professeur',family:'Formation',documentType:'Certificat de réussite',issuer:'Professeur indépendant',source:'course',tone:'professeur'},
  {id:'structure',label:'Structure',family:'Formation',documentType:'Certificat de réussite',issuer:'Structure partenaire',source:'course',tone:'structure'},
  {id:'live-participation',label:'Omnia Live — Participation',family:'Omnia Live',documentType:'Attestation de participation',issuer:'Omnia Global Academy',source:'omnia_live',tone:'live'},
  {id:'live-attendance',label:'Omnia Live — Présence',family:'Omnia Live',documentType:'Attestation de présence',issuer:'Omnia Global Academy',source:'omnia_live',tone:'live'},
  {id:'live-success',label:'Omnia Live — Réussite',family:'Omnia Live',documentType:'Certificat de réussite',issuer:'Omnia Global Academy',source:'omnia_live',tone:'live'},
  {id:'open-cpd',label:'Open CPD',family:'Accréditation',documentType:'Certificat CPD',issuer:'Omnia Global Academy',source:'course',tone:'cpd'},
];

export default function AdminCertificatePreview(){
 const [selected,setSelected]=useState(MODELS[0].id);
 const [badges,setBadges]=useState(true);
 const model=useMemo(()=>MODELS.find(m=>m.id===selected)!,[selected]);
 const isLive=model.source==='omnia_live';
 return <AdminLayout>
  <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
    <header className="border-b border-gray-200 pb-5">
      <p className="text-xs uppercase tracking-[.14em] font-semibold" style={{color:GOLD}}>Certificats & attestations</p>
      <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Aperçu & tests</h1>
      <p className="text-sm text-gray-500 mt-1">Tous les modèles sont prévisualisables ici. Les données affichées sont fictives et aucun document réel n’est créé.</p>
    </header>

    <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
      <aside className="border-t border-gray-200">
        {['Formation','Omnia Live','Accréditation'].map(group=><div key={group}>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 pt-4 pb-2">{group}</p>
          {MODELS.filter(m=>m.family===group).map(m=><button key={m.id} onClick={()=>setSelected(m.id)}
            className={`w-full text-left py-3 border-b border-gray-100 text-sm ${selected===m.id?'font-bold':''}`}
            style={{color:selected===m.id?BLUE:'#4B5563'}}>
            <span className="inline-flex items-center gap-2">{m.source==='omnia_live'?<Radio size={14}/>:m.id==='open-cpd'?<BadgeCheck size={14}/>:<Award size={14}/>} {m.label}</span>
            <span className="block text-xs text-gray-400 mt-1">{m.documentType}</span>
          </button>)}
        </div>)}
        <label className="flex items-center gap-2 mt-5 text-sm text-gray-600">
          <input type="checkbox" checked={badges} onChange={e=>setBadges(e.target.checked)}/>
          Afficher les badges/accréditations validés
        </label>
      </aside>

      <main>
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-5">
          <div><p className="font-black" style={{color:BLUE}}>{model.label}</p><p className="text-xs text-gray-400">{model.documentType} · {model.family}</p></div>
          <Eye size={18} className="text-gray-400"/>
        </div>

        <div className="mx-auto max-w-[860px] aspect-[1.414/1] border-2 p-10 flex flex-col justify-between bg-white" style={{borderColor:BLUE}}>
          <div className="flex justify-between items-start">
            <div><div className="font-black tracking-wide text-xl" style={{color:BLUE}}>OMNIA</div><div className="text-[10px] tracking-[.2em]" style={{color:GOLD}}>GLOBAL ACADEMY</div></div>
            <div className="text-right text-xs text-gray-500">{model.issuer}</div>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[.3em]" style={{color:GOLD}}>{model.documentType}</p>
            <h2 className="text-4xl font-black mt-5" style={{color:BLUE}}>Amadou Coulibaly</h2>
            <p className="text-sm text-gray-500 mt-3">{isLive?'pour sa participation et son accomplissement de':'pour avoir complété avec succès la formation'}</p>
            <p className="text-xl font-bold mt-2" style={{color:BLUE}}>{isLive?'Masterclass Leadership & Innovation':'Data Science & Intelligence Artificielle'}</p>
            {!isLive&&<div className="flex justify-center gap-8 mt-6 text-xs text-gray-500"><span>Niveau : Avancé</span><span>Catégorie : Data & IA</span></div>}
          </div>
          <div className="grid grid-cols-3 items-end text-xs text-gray-500">
            <div><div className="border-t pt-2 w-40">Signature autorisée</div></div>
            <div className="text-center">
              {badges&&<div className="inline-flex gap-2 items-center border rounded-full px-3 py-1"><BadgeCheck size={14}/> Badges validés</div>}
              <p className="mt-3">ID : CERT-TEST-2026</p>
            </div>
            <div className="text-right"><div className="border-t pt-2 ml-auto w-40">Direction académique</div></div>
          </div>
        </div>
      </main>
    </div>
  </div>
 </AdminLayout>
}
