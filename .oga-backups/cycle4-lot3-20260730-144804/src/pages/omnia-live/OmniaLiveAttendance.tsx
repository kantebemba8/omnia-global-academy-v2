import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveAttendance(){
 const {liveId}=useParams(); const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{if(!liveId)return;liveApi('attendance_summary',{}, {event_id:liveId}).then(d=>setRows(d.participants||[])).catch(e=>setError(e instanceof Error?e.message:'Erreur'))},[liveId]);
 return <OmniaLiveLayout><section className="mx-auto max-w-5xl px-4 py-10 md:px-8"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Présence</h1>{error&&<div className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}<div className="mt-6 overflow-hidden rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Participant</th><th className="p-4">Durée cumulée</th><th className="p-4">Reconnexions</th></tr></thead><tbody>{rows.map(r=><tr key={r.user_id} className="border-t"><td className="p-4 font-semibold">{r.user?.full_name||r.user_id}</td><td className="p-4">{Math.floor(r.duration_seconds/3600)}h {Math.floor((r.duration_seconds%3600)/60)}min</td><td className="p-4">{r.segments}</td></tr>)}</tbody></table>{!rows.length&&<div className="p-8 text-center text-slate-500">Aucune donnée de présence.</div>}</div></section></OmniaLiveLayout>
}
