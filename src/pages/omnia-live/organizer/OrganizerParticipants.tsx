import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { liveApi } from '../liveApi';
import OrganizerShell from './OrganizerShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

export default function OrganizerParticipants(){
 const [params]=useSearchParams();const [events,setEvents]=useState<any[]>([]),[eventId,setEventId]=useState(params.get('event')||''),[rows,setRows]=useState<any[]>([]),[wait,setWait]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('organizer_events').then(d=>{setEvents(d.items||[]);if(!eventId&&d.items?.[0])setEventId(d.items[0].id)})},[]);
 useEffect(()=>{if(eventId)liveApi('organizer_participants',{}, {event_id:eventId}).then(d=>{setRows(d.participants||[]);setWait(d.waitlist||[])}).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[eventId]);
 return <OrganizerShell title="Participants" subtitle="Inscriptions, paiements, présence et liste d’attente."><select value={eventId} onChange={e=>setEventId(e.target.value)} className="mb-5 rounded-xl border px-4 py-2"><option value="">Choisir un événement</option>{events.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Participant</th><th className="p-4">Statut</th><th className="p-4">Paiement</th><th className="p-4">Présence</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} className="border-t"><td className="p-4 font-semibold">{x.users?.full_name||x.users?.email}</td><td className="p-4">{liveStatusLabel(x.status)}</td><td className="p-4">{liveStatusLabel(x.order?.payment_status)}</td><td className="p-4">{Math.floor(Number(x.attendance_seconds||0)/60)} min</td></tr>)}</tbody></table></div></div>{wait.length>0&&<div className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold text-[#002050]">Liste d’attente ({wait.length})</h2><div className="mt-3 space-y-2">{wait.map(x=><div key={x.id} className="rounded-xl bg-slate-50 p-3">{x.users?.full_name||x.users?.email} · position {x.position} · {liveStatusLabel(x.status)}</div>)}</div></div>}</OrganizerShell>
}
