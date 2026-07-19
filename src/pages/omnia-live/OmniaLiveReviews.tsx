import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveReviews(){
 const {liveId}=useParams();const [rows,setRows]=useState<any[]>([]),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[avg,setAvg]=useState(0),[message,setMessage]=useState('');
 const load=()=>liveApi('reviews_list',{}, {event_id:liveId||''}).then(d=>{setRows(d.reviews||[]);setAvg(d.average_rating||0)});
 useEffect(()=>{if(liveId)load()},[liveId]);
 async function send(){try{await liveApi('review_create',{method:'POST',body:JSON.stringify({event_id:liveId,rating,comment})});setComment('');await load()}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-5xl px-4 py-10"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Avis vérifiés</h1><div className="mt-3 text-lg font-bold">{avg.toFixed(1)} / 5 · {rows.length} avis</div><div className="mt-6 rounded-2xl border bg-white p-5"><select value={rating} onChange={e=>setRating(Number(e.target.value))} className="rounded-xl border p-3">{[5,4,3,2,1].map(x=><option key={x} value={x}>{x}/5</option>)}</select><textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} className="mt-3 w-full rounded-xl border p-3" placeholder="Votre avis"/><button onClick={send} className="mt-3 rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">Publier mon avis</button>{message&&<div className="mt-3 text-sm">{message}</div>}</div><div className="mt-6 space-y-3">{rows.map(r=><div key={r.id} className="rounded-2xl border bg-white p-5"><div className="font-bold">{r.users?.full_name||'Participant'} · {r.rating}/5</div><p className="mt-2 text-sm text-slate-600">{r.comment}</p>{r.verified_participant&&<div className="mt-2 text-xs font-semibold text-emerald-700">Participant vérifié</div>}</div>)}</div></section></OmniaLiveLayout>
}
