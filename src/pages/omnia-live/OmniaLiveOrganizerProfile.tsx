import { useEffect, useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveOrganizerProfile(){
 const [name,setName]=useState(''),[bio,setBio]=useState(''),[country,setCountry]=useState(''),[website,setWebsite]=useState(''),[message,setMessage]=useState('');
 async function save(){try{await liveApi('organizer_profile_upsert',{method:'POST',body:JSON.stringify({display_name:name,bio,country,website})});setMessage('Profil organisateur enregistré.')}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Profil organisateur</h1><div className="mt-7 space-y-4 rounded-2xl border bg-white p-6"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom public" className="w-full rounded-xl border p-3"/><textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Présentation" rows={5} className="w-full rounded-xl border p-3"/><input value={country} onChange={e=>setCountry(e.target.value)} placeholder="Pays" className="w-full rounded-xl border p-3"/><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="Site web" className="w-full rounded-xl border p-3"/><button onClick={save} className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">Enregistrer</button>{message&&<div className="rounded-xl bg-slate-50 p-3 text-sm">{message}</div>}</div></section></OmniaLiveLayout>
}
