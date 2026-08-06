import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';
export default function OmniaLiveMediaVersions(){
 const {mediaId}=useParams();const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{if(mediaId)liveApi('media_admin_versions',{}, {media_id:mediaId}).then(d=>setRows(d.versions||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[mediaId]);
 return <OmniaLiveLayout><section className="mx-auto max-w-5xl px-4 py-10"><h1 className="text-3xl font-black text-[#002050]">Versions du média</h1>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="mt-6 space-y-3">{rows.map(x=><div key={x.id} className="rounded-2xl border bg-white p-5"><div className="font-bold">Version {x.revision_number||x.version}</div><div className="text-sm text-slate-500">{liveStatusLabel(x.status)} · {liveStatusLabel(x.processing_status)} · {new Date(x.created_at).toLocaleString('fr-FR')}</div>{x.review_required&&<div className="mt-2 text-xs text-amber-700">Nouvelle validation de l’Administration Omnia requise</div>}</div>)}</div></section></OmniaLiveLayout>
}
