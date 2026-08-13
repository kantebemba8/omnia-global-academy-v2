import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

export default function OmniaLiveUpload(){
  const {liveId}=useParams(); const navigate=useNavigate();
  const [file,setFile]=useState<File|null>(null),[type,setType]=useState('recorded_video'),[title,setTitle]=useState(''),[sequenceNo,setSequenceNo]=useState('1'),[uploading,setUploading]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState('');

  async function upload(){
    if(!liveId||!file){setMessage('Choisissez un fichier.');return}
    setUploading(true);setMessage('');setProgress(0);
    try{
      const prepared=await liveApi('upload_prepare',{method:'POST',body:JSON.stringify({
        event_id:liveId,media_type:type,file_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,title:title||file.name,sequence_no:['recorded_video','replay'].includes(type)?Math.max(1,Number(sequenceNo||1)):null
      })});
      const xhr=new XMLHttpRequest();
      await new Promise<void>((resolve,reject)=>{
        xhr.open('PUT',prepared.upload.url);
        xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
        xhr.upload.onprogress=(e)=>{if(e.lengthComputable)setProgress(Math.round((e.loaded/e.total)*100))};
        xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(`Upload R2 échoué (${xhr.status})`));
        xhr.onerror=()=>reject(new Error('Upload R2 interrompu'));
        xhr.send(file);
      });
      await liveApi('upload_complete',{method:'POST',body:JSON.stringify({media_id:prepared.media.id})});
      setMessage('Fichier téléversé dans le stockage Omnia.');
      setProgress(100);
    }catch(e){setMessage(e instanceof Error?e.message:'Téléversement impossible.')}finally{setUploading(false)}
  }

  return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10 md:px-8">
    <button onClick={()=>navigate(-1)} className="mb-5 text-sm font-semibold" style={{color:BLUE}}>← Retour</button>
    <h1 className="text-3xl font-black" style={{color:BLUE}}>Téléverser un média</h1>
    <p className="mt-2 text-slate-600">Le fichier est envoyé directement vers le stockage privé Omnia/R2 avec une URL temporaire sécurisée.</p>
    <div className="mt-8 space-y-5 rounded-3xl border bg-white p-6">
      <div><label className="mb-2 block font-semibold">Type</label><select value={type} onChange={e=>setType(e.target.value)} className="w-full rounded-xl border p-3"><option value="recorded_video">Vidéo préenregistrée</option><option value="replay">Replay</option><option value="document">Document</option><option value="cover">Couverture</option><option value="subtitle">Sous-titres</option><option value="audio">Audio</option></select></div>
      <div><label className="mb-2 block font-semibold">Titre</label><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border p-3"/></div>
      {['recorded_video','replay'].includes(type)&&<div><label className="mb-2 block font-semibold">Position dans le parcours vidéo</label><input type="number" min="1" value={sequenceNo} onChange={e=>setSequenceNo(e.target.value)} className="w-full rounded-xl border p-3"/><p className="mt-1 text-xs text-slate-500">Utilisé pour ordonner plusieurs vidéos/Replays constituant une même formation Omnia Live.</p></div>}
      <div><label className="mb-2 block font-semibold">Fichier</label><input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} className="w-full rounded-xl border p-3"/></div>
      {uploading&&<div><div className="mb-2 flex justify-between text-sm"><span>Téléversement</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full" style={{width:`${progress}%`,background:BLUE}}/></div></div>}
      <button onClick={upload} disabled={uploading||!file} className="rounded-xl px-5 py-3 font-bold text-white disabled:opacity-50" style={{background:BLUE}}>{uploading?'Téléversement...':'Téléverser'}</button>
      {message&&<div className="rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
    </div>
  </section></OmniaLiveLayout>
}
