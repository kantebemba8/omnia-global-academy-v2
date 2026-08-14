import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

type PreparedUpload = {
  media: { id: string };
  upload: {
    url: string;
    method?: string;
    protocol?: 'r2_put' | 'stream_basic' | 'stream_tus';
    headers?: Record<string,string>;
    chunk_size_bytes?: number | null;
    provider?: string;
  };
};

function xhrUpload(options: {
  url: string;
  method: string;
  body: XMLHttpRequestBodyInit;
  headers?: Record<string,string>;
  onProgress?: (loaded: number, total: number) => void;
}) {
  return new Promise<void>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open(options.method,options.url);
    for(const [key,value] of Object.entries(options.headers||{})) xhr.setRequestHeader(key,value);
    xhr.upload.onprogress=(event)=>{
      if(event.lengthComputable) options.onProgress?.(event.loaded,event.total);
    };
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(`Téléversement échoué (${xhr.status})`));
    xhr.onerror=()=>reject(new Error('Téléversement interrompu'));
    xhr.send(options.body);
  });
}

async function uploadPrepared(file: File, prepared: PreparedUpload, setProgress: (value:number)=>void) {
  const protocol=prepared.upload.protocol||'r2_put';
  if(protocol==='stream_basic'){
    const form=new FormData();
    form.append('file',file,file.name);
    await xhrUpload({
      url:prepared.upload.url,
      method:'POST',
      body:form,
      headers:prepared.upload.headers,
      onProgress:(loaded,total)=>setProgress(Math.min(99,Math.round((loaded/Math.max(1,total))*100))),
    });
    return;
  }

  if(protocol==='stream_tus'){
    const chunkSize=Math.max(5*1024*1024,Number(prepared.upload.chunk_size_bytes||50*1024*1024));
    let offset=0;
    while(offset<file.size){
      const end=Math.min(file.size,offset+chunkSize);
      const chunk=file.slice(offset,end);
      const currentOffset=offset;
      await xhrUpload({
        url:prepared.upload.url,
        method:'PATCH',
        body:chunk,
        headers:{
          'Tus-Resumable':'1.0.0',
          'Upload-Offset':String(offset),
          'Content-Type':'application/offset+octet-stream',
          ...(prepared.upload.headers||{}),
        },
        onProgress:(loaded)=>setProgress(Math.min(99,Math.round(((currentOffset+loaded)/Math.max(1,file.size))*100))),
      });
      offset=end;
    }
    return;
  }

  await xhrUpload({
    url:prepared.upload.url,
    method:'PUT',
    body:file,
    headers:{'Content-Type':file.type||'application/octet-stream',...(prepared.upload.headers||{})},
    onProgress:(loaded,total)=>setProgress(Math.min(99,Math.round((loaded/Math.max(1,total))*100))),
  });
}

export default function OmniaLiveUpload(){
  const {liveId}=useParams(); const navigate=useNavigate();
  const [file,setFile]=useState<File|null>(null),[type,setType]=useState('recorded_video'),[title,setTitle]=useState(''),[sequenceNo,setSequenceNo]=useState('1'),[uploading,setUploading]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState('');

  async function upload(){
    if(!liveId||!file){setMessage('Choisissez un fichier.');return}
    setUploading(true);setMessage('');setProgress(0);
    try{
      const prepared=await liveApi('upload_prepare',{method:'POST',body:JSON.stringify({
        event_id:liveId,media_type:type,file_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,title:title||file.name,sequence_no:['recorded_video','replay'].includes(type)?Math.max(1,Number(sequenceNo||1)):null
      })}) as PreparedUpload;
      await uploadPrepared(file,prepared,setProgress);
      const completed=await liveApi('upload_complete',{method:'POST',body:JSON.stringify({media_id:prepared.media.id})});
      setProgress(100);
      const provider=prepared.upload.provider==='cloudflare_stream'?'Cloudflare Stream':'le stockage privé Omnia/R2';
      setMessage(completed?.processing_required
        ? `Fichier envoyé vers ${provider}. Le traitement sécurisé se poursuit côté fournisseur.`
        : `Fichier téléversé avec succès vers ${provider}.`);
    }catch(e){setMessage(e instanceof Error?e.message:'Téléversement impossible.')}finally{setUploading(false)}
  }

  return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10 md:px-8">
    <button onClick={()=>navigate(-1)} className="mb-5 text-sm font-semibold" style={{color:BLUE}}>← Retour</button>
    <h1 className="text-3xl font-black" style={{color:BLUE}}>Téléverser un média</h1>
    <p className="mt-2 text-slate-600">Les vidéos et Replays utilisent Cloudflare Stream lorsqu’il est configuré. Les autres médias restent dans le stockage privé Omnia/R2.</p>
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
