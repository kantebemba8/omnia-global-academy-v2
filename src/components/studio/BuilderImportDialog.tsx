import { useMemo, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { uploadCourseImportFile } from '../../lib/courseImportUpload';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const IMPORT_EXTENSIONS = ['pdf','docx','xlsx','pptx','zip','txt','md','csv'];
type ImportMode = 'faithful'|'structured'|'enriched';
type TargetType = 'module'|'lesson'|'block';

async function call(action:string, body:Record<string,unknown>={}){
  const response=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action,...body})});
  const data=await response.json().catch(()=>({success:false,error:'INVALID_RESPONSE'}));
  if(!response.ok||data.success===false) throw new Error(data.message||data.error||'Une erreur est survenue');
  return data;
}
function ext(name:string){return name.split('.').pop()?.toLowerCase().trim()||'';}

export default function BuilderImportDialog({open,onClose,courseId,targetType,targetId,creatorContext,onApplied}:{
  open:boolean; onClose:()=>void; courseId:string; targetType:TargetType; targetId:string; creatorContext:'professeur'|'structure'|'admin'; onApplied:()=>void|Promise<void>;
}){
  const [file,setFile]=useState<File|null>(null);
  const [mode,setMode]=useState<ImportMode>('structured');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [preview,setPreview]=useState<any|null>(null);
  const title=useMemo(()=>targetType==='module'?'Importer dans ce module':targetType==='lesson'?'Importer dans cette leçon':'Remplir ce bloc depuis un document',[targetType]);
  if(!open) return null;

  function validate(f:File){
    if(!IMPORT_EXTENSIONS.includes(ext(f.name))) throw new Error('Format non pris en charge. Utilisez PDF, DOCX, XLSX, PPTX, ZIP, TXT, MD ou CSV.');
    if(f.size<=0) throw new Error('Le fichier sélectionné est vide.');
    if(f.size>MAX_IMPORT_BYTES) throw new Error('Le fichier dépasse la limite de 25 Mo.');
  }
  async function analyze(){
    if(!file) return setError('Sélectionnez un document.');
    setError('');setPreview(null);
    try{
      validate(file);setBusy(true);setStatus('Téléversement sécurisé…');
      const prepared=await call('prepare_course_import_upload',{creator_context:creatorContext,original_name:file.name,file_size:file.size,file_mime:file.type||'application/octet-stream'});
      await uploadCourseImportFile({bucket:prepared.bucket,path:prepared.path,token:prepared.token,upload_mime:prepared.upload_mime},file);
      setStatus('Analyse du document…');
      const data=await call('analyze_course_import',{creator_context:creatorContext,course_id:courseId,target_type:targetType,target_id:targetId,bucket_name:prepared.bucket,storage_path:prepared.path,original_name:file.name,file_size:file.size,file_mime:file.type||'application/octet-stream',mode,allow_ai:mode!=='faithful'});
      setPreview(data);setStatus('Analyse terminée. Vérifiez avant insertion.');
    }catch(e){setError(e instanceof Error?e.message:'Impossible d’analyser ce document.');setStatus('');}
    finally{setBusy(false);}
  }
  async function apply(){
    if(!preview?.job_id)return;
    setError('');
    try{
      setBusy(true);setStatus('Insertion dans le Builder…');
      await call('apply_course_import',{job_id:preview.job_id,creator_context:creatorContext,course_id:courseId,blueprint:preview.blueprint});
      await onApplied();setFile(null);setPreview(null);setStatus('');onClose();
    }catch(e){setError(e instanceof Error?e.message:'Impossible d’appliquer cet import.');setStatus('');}
    finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><h2 className="font-semibold text-[#002050]">{title}</h2><p className="mt-0.5 text-xs text-gray-500">Analyse → aperçu → insertion. Rien n’est ajouté avant votre confirmation.</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-2 hover:bg-gray-100"><X size={18}/></button></div>
      <div className="space-y-5 p-5">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 p-5 text-center"><FileUp size={24} className="text-[#002050]"/><span className="mt-2 text-sm font-semibold text-[#002050]">Sélectionner un document</span><span className="mt-1 text-xs text-gray-500">PDF, DOCX, XLSX, PPTX, ZIP, TXT, MD, CSV · 25 Mo maximum</span><input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.pptx,.zip,.txt,.md,.csv" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setError('');}}/></label>
        {file&&<div className="rounded-lg border px-3 py-2 text-sm"><strong>{file.name}</strong><span className="ml-2 text-xs text-gray-500">{(file.size/1024/1024).toFixed(2)} Mo</span></div>}
        <div><p className="text-sm font-semibold text-[#002050]">Mode</p><div className="mt-2 grid gap-2 md:grid-cols-3">{[['faithful','Fidèle','Conserver le document au plus près.'],['structured','Structuré','Organiser sans ajouter de connaissances.'],['enriched','Enrichi','Proposer aussi activités et enrichissements à vérifier.']].map(([value,label,help])=><button type="button" key={value} onClick={()=>{setMode(value as ImportMode);setPreview(null);}} className="rounded-xl border p-3 text-left" style={{borderColor:mode===value?'#BF8813':'#E4E7EC',background:mode===value?'#FFFBEB':'#fff'}}><span className="block text-sm font-semibold text-[#002050]">{label}</span><span className="mt-1 block text-xs text-gray-500">{help}</span></button>)}</div></div>
        {preview&&<div className="rounded-xl border bg-slate-50 p-4"><p className="text-sm font-semibold text-[#002050]">Aperçu détecté</p><p className="mt-1 text-xs text-gray-500">{preview.detected?.modules||0} module(s) · {preview.detected?.lessons||0} leçon(s) · {preview.detected?.suggested_questions||0} activité(s)/question(s) proposée(s){(preview.detected?.slides||preview.detected?.images||preview.detected?.tables) ? ` · ${preview.detected?.slides||0} diapositive(s) · ${preview.detected?.images||0} image(s) · ${preview.detected?.tables||0} tableau(x)` : ''}</p><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{(preview.blueprint?.modules||[]).map((m:any,mi:number)=><div key={mi} className="rounded-lg border bg-white p-3"><input value={m.title||''} onChange={e=>{const b=structuredClone(preview.blueprint);b.modules[mi].title=e.target.value;setPreview({...preview,blueprint:b});}} className="w-full border-0 p-0 text-sm font-semibold text-[#002050] outline-none"/>{(m.lessons||[]).map((l:any,li:number)=><input key={li} value={l.title||''} onChange={e=>{const b=structuredClone(preview.blueprint);b.modules[mi].lessons[li].title=e.target.value;setPreview({...preview,blueprint:b});}} className="mt-1.5 w-full rounded-md border px-2 py-1.5 text-xs"/>)}</div>)}</div></div>}
        {status&&<p className="text-sm font-medium text-[#002050]">{status}</p>}{error&&<div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-5 py-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-medium">Annuler</button><button type="button" onClick={preview?apply:analyze} disabled={busy||(!preview&&!file)} className="rounded-lg bg-[#BF8813] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Traitement…':preview?'Insérer après vérification':'Analyser le document'}</button></div>
    </div>
  </div>;
}
