import {useEffect,useMemo,useState} from 'react';
import {liveApi} from '../liveApi';
import OrganizerShell from './OrganizerShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OrganizerAccessCodes(){
 const [events,setEvents]=useState<any[]>([]);
 const [eventId,setEventId]=useState('');
 const [codes,setCodes]=useState<any[]>([]);
 const [msg,setMsg]=useState('');
 const [accessType,setAccessType]=useState('private');
 const [maxUses,setMaxUses]=useState('');
 const [expiresAt,setExpiresAt]=useState('');
 const [structureId,setStructureId]=useState('');

 useEffect(()=>{
  liveApi('organizer_events').then(d=>{
   const rows=d.items||[];
   setEvents(rows);
   if(rows[0])setEventId(rows[0].id);
  }).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 },[]);

 async function load(id=eventId){
  if(!id){setCodes([]);return}
  try{
   const d=await liveApi('organizer_access_codes',{}, {event_id:id});
   setCodes(d.codes||[]);
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 useEffect(()=>{load()},[eventId]);

 const event=useMemo(()=>events.find(x=>x.id===eventId),[events,eventId]);

 async function createCode(){
  if(!eventId)return;
  const limit=maxUses.trim()?Number(maxUses):null;
  if(limit!==null&&(!Number.isInteger(limit)||limit<=0)){setMsg('La limite d’utilisation doit être un nombre entier supérieur à zéro.');return}
  if(accessType==='structure'&&!structureId.trim()){setMsg('Sélectionnez ou renseignez la Structure autorisée.');return}

  const r=await omniaDialog({
   title:'Créer un code d’accès',
   message:`Ce code sera lié uniquement à « ${event?.title||'cet événement'} ».`,
   confirmLabel:'Créer le code'
  });
  if(!r.confirmed)return;

  try{
   await liveApi('private_code_create',{method:'POST',body:JSON.stringify({
    event_id:eventId,
    access_type:accessType,
    max_uses:limit,
    expires_at:expiresAt?new Date(expiresAt).toISOString():null,
    structure_id:accessType==='structure'?structureId.trim():null
   })});
   setMsg('Code d’accès créé.');
   setMaxUses('');setExpiresAt('');
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <OrganizerShell title="Codes privés" subtitle="Créez des accès privés, par invitation ou réservés à une Structure.">
  <div className="border-b border-slate-200 pb-6">
   <div className="grid gap-4 md:grid-cols-2">
    <label><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Événement</span>
     <select value={eventId} onChange={e=>setEventId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm">
      <option value="">Choisir un événement</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
     </select>
    </label>
    <label><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Type d’accès</span>
     <select value={accessType} onChange={e=>setAccessType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm">
      <option value="private">Privé</option><option value="invitation">Invitation</option><option value="structure">Réservé à une Structure</option>
     </select>
    </label>
    <label><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Nombre maximum d’utilisations</span>
     <input type="number" min="1" value={maxUses} onChange={e=>setMaxUses(e.target.value)} placeholder="Vide = sans limite définie" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm"/>
    </label>
    <label><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Expiration</span>
     <input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm"/>
    </label>
    {accessType==='structure'&&<label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Structure autorisée</span>
     <input value={structureId} onChange={e=>setStructureId(e.target.value)} placeholder="Identifiant de la Structure" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm"/>
     <span className="mt-1 block text-xs text-slate-500">Le backend devra vérifier que l’utilisateur qui utilise le code appartient réellement à cette Structure.</span>
    </label>}
   </div>
   <button onClick={createCode} disabled={!eventId} className="mt-4 rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Créer le code d’accès</button>
  </div>

  {msg&&<div className="my-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}

  {codes.length?(
   <div className="overflow-x-auto pt-2"><div className="min-w-[820px]">
    <div className="grid grid-cols-[1fr_.7fr_.7fr_.8fr_.7fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase text-slate-400"><div>Code</div><div>Type</div><div>Utilisations</div><div>Expiration</div><div>État</div></div>
    {codes.map(c=><div key={c.id} className="grid grid-cols-[1fr_.7fr_.7fr_.8fr_.7fr] border-b border-slate-200 py-4 text-sm">
     <div className="font-mono font-semibold" style={{color:BLUE}}>{c.code}</div>
     <div>{c.access_type==='structure'?'Structure':c.access_type==='invitation'?'Invitation':'Privé'}</div>
     <div>{c.used_count??0}{c.max_uses?` / ${c.max_uses}`:''}</div>
     <div>{c.expires_at?new Date(c.expires_at).toLocaleString('fr-FR'):'Sans expiration'}</div>
     <div style={{color:c.status==='active'?GOLD:undefined}}>{liveStatusLabel(c.status)}</div>
    </div>)}
   </div></div>
  ):<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucun code d’accès pour cet événement.</div>}
 </OrganizerShell>
}
