import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as XLSX from "npm:xlsx@0.18.5";
import { PRIVATE_COURSE_BUCKET_SET, createSignedObjectUrl, parseStorageLocator } from "../_shared/protected-storage.ts";
import { signedStreamManifest } from "../_shared/cloudflare-stream.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { canPreviewCourse } from "../_shared/course-preview-access.ts";
import { loadCourseCurriculum } from "../_shared/course-curriculum.ts";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
function scormAssetMime(path:string){const ext=String(path||"").split(".").pop()?.toLowerCase()||"";const map:Record<string,string>={html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",js:"application/javascript; charset=utf-8",mjs:"application/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json; charset=utf-8",xml:"application/xml; charset=utf-8",txt:"text/plain; charset=utf-8",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",mp3:"audio/mpeg",mp4:"video/mp4",webm:"video/webm",pdf:"application/pdf",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf"};return map[ext]||"application/octet-stream"}
function safeScormRelative(value:string){const clean=decodeURIComponent(String(value||"")).replace(/\\/g,"/").replace(/^\/+|\?.*$/g,"");if(!clean||clean.split("/").includes("..")||/[\u0000-\u001F]/.test(clean))return "";return clean}
function scormProgress(data:Record<string,string>){const measured=Number(data["cmi.progress_measure"]);if(Number.isFinite(measured))return Math.max(0,Math.min(100,measured*100));if(data["cmi.completion_status"]==="completed"||data["cmi.success_status"]==="passed")return 100;return 0}
function scormSeconds(value:string){const iso=String(value||"").match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);if(iso)return Math.round(Number(iso[1]||0)*3600+Number(iso[2]||0)*60+Number(iso[3]||0));const hms=String(value||"").match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);return hms?Math.round(Number(hms[1])*3600+Number(hms[2])*60+Number(hms[3])):0}
function scormBridgeScript(runtime:any,preview=false){
 const state=JSON.stringify(runtime?.cmi_data||{}).replace(/</g,"\\u003c");const token=JSON.stringify(String(runtime?.runtime_token||""));const endpoint=JSON.stringify(`${Deno.env.get("SUPABASE_URL")}/functions/v1/lesson-content`);const previewFlag=preview?"true":"false";
 return `<script>(function(){var data=Object.assign({},${state});var token=${token};var endpoint=${endpoint};var preview=${previewFlag};function post(type,payload){try{parent.postMessage(Object.assign({type:type},payload||{}),'*')}catch(e){}}function progress(){var m=parseFloat(data['cmi.progress_measure']);var p=!isNaN(m)?Math.max(0,Math.min(100,Math.round(m*100))):0;if(data['cmi.completion_status']==='completed'||data['cmi.success_status']==='passed')p=100;post('omnia-scorm-progress',{progress:p});return p;}function commit(){try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'scorm_commit',runtime_token:token,package_type:'scorm_2004',cmi_data:data,preview:preview}),keepalive:true})}catch(e){}progress();return 'true';}function complete(){var ok=data['cmi.completion_status']==='completed'||data['cmi.success_status']==='passed';if(ok)post('omnia-scorm-complete',{score:parseFloat(data['cmi.score.raw'])||null});}window.API_1484_11={Initialize:function(){return 'true'},Terminate:function(){complete();return commit()},GetValue:function(k){return data[k]||''},SetValue:function(k,v){data[k]=String(v==null?'':v);progress();return 'true'},Commit:commit,GetLastError:function(){return '0'},GetErrorString:function(){return ''},GetDiagnostic:function(){return ''}};post('omnia-scorm-ready',{packageType:'scorm_2004',progress:progress()});})();</script>`;
}

const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function computeLessonGate(sb:any,userId:string,courseId:string,lessonId:string){
 const {data:lesson}=await sb.from("course_lessons").select("id,cpd_calculated_time_seconds").eq("id",lessonId).maybeSingle();
 if(!lesson)return {completed:false,cpdReached:false,timeSpent:0,required:0,trainingPassed:false,trainingRequired:0,trainingPassedCount:0,assessmentPassed:false,assessmentRequired:false};
 const {data:progress}=await sb.from("user_lesson_progress").select("time_spent_seconds,quiz_passed,is_completed").eq("user_id",userId).eq("lesson_id",lessonId).maybeSingle();
 const timeSpent=Number(progress?.time_spent_seconds||0),required=Number(lesson.cpd_calculated_time_seconds||0),cpdReached=required===0||timeSpent>=required;
 const {data:trainingBlocks}=await sb.from("lesson_blocks").select("id,training_passing_score,training_is_graded,is_required").eq("lesson_id",lessonId).eq("interaction_mode","training").eq("is_required",true);
 const requiredIds=(trainingBlocks||[]).map((b:any)=>b.id);const satisfiedIds=new Set<string>();
 if(requiredIds.length){const {data:attempts}=await sb.from("training_attempts").select("block_id,passed").eq("user_id",userId).eq("lesson_id",lessonId).in("block_id",requiredIds);const attemptedIds=new Set((attempts||[]).map((a:any)=>String(a.block_id)));const passedIds=new Set((attempts||[]).filter((a:any)=>a.passed===true).map((a:any)=>String(a.block_id)));for(const block of trainingBlocks||[]){const id=String(block.id);if(block.training_is_graded===false?attemptedIds.has(id):passedIds.has(id))satisfiedIds.add(id);}}
 const trainingRequired=requiredIds.length,trainingPassedCount=satisfiedIds.size,trainingPassed=trainingRequired===0||trainingPassedCount===trainingRequired;
 const {data:assessment}=await sb.from("course_assessments").select("id,required").eq("course_id",courseId).eq("lesson_id",lessonId).eq("scope","lesson").eq("is_active",true).maybeSingle();
 let assessmentPassed=false;if(assessment){const {data:passed}=await sb.from("assessment_attempts").select("id").eq("assessment_id",assessment.id).eq("user_id",userId).eq("passed",true).limit(1).maybeSingle();assessmentPassed=!!passed;}
 const assessmentRequired=Boolean(assessment?.required);
 const completed=cpdReached&&trainingPassed&&(!assessmentRequired||assessmentPassed);
 const quizPassed=!assessmentRequired||assessmentPassed;
 if(completed!==Boolean(progress?.is_completed)||quizPassed!==Boolean(progress?.quiz_passed)){await sb.from("user_lesson_progress").upsert({user_id:userId,course_id:courseId,lesson_id:lessonId,time_spent_seconds:timeSpent,quiz_passed:quizPassed,is_completed:completed,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});}
 return {completed,cpdReached,timeSpent,required,trainingPassed,trainingRequired,trainingPassedCount,assessmentPassed,assessmentRequired};
}


function excelPreview(bytes:Uint8Array){try{const workbook=XLSX.read(bytes,{type:"array",cellDates:false});const sheetName=workbook.SheetNames?.[0]||"";if(!sheetName)return {sheet:"",headers:[],preview_rows:[]};const sheet=workbook.Sheets[sheetName];const rows=XLSX.utils.sheet_to_json<any[]>(sheet,{header:1,defval:"",raw:false}).slice(0,31).map((row:any[])=>row.slice(0,20).map((cell:any)=>String(cell??"").slice(0,500)));if(!rows.length)return {sheet:sheetName,headers:[],preview_rows:[]};const headers=(rows[0]||[]).map((cell:string,index:number)=>String(cell||`Colonne ${index+1}`));return {sheet:sheetName,headers,preview_rows:rows.slice(1)};}catch{return {sheet:"",headers:[],preview_rows:[]}}}

async function signNestedMediaRefs(sb:any,value:any,depth=0):Promise<any>{
 if(depth>5||value==null)return value;
 if(typeof value==="string"){const locator=parseStorageLocator(value);if(locator&&PRIVATE_COURSE_BUCKET_SET.has(locator.bucket)){const signed=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);return signed||null;}return value;}
 if(Array.isArray(value))return await Promise.all(value.map(item=>signNestedMediaRefs(sb,item,depth+1)));
 if(typeof value!=="object")return value;
 const out:any={};for(const [key,item] of Object.entries(value))out[key]=await signNestedMediaRefs(sb,item,depth+1);return out;
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
 const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
 const url=new URL(req.url);

 // Proxy privé SCORM : le token opaque et expirant est limité à un apprenant + un bloc.
 if(req.method==="GET"&&url.pathname.includes("/scorm/")){
  try{
   const marker="/scorm/";const idx=url.pathname.indexOf(marker);const tail=url.pathname.slice(idx+marker.length);const slash=tail.indexOf("/");if(slash<1)return json({error:"SCORM_ASSET_NOT_FOUND"},404);
   const runtimeToken=tail.slice(0,slash);const asset=safeScormRelative(tail.slice(slash+1));if(!asset)return json({error:"SCORM_ASSET_PATH_INVALID"},400);
   const {data:runtime}=await sb.from("scorm_runtime_sessions").select("runtime_token,package_prefix,launch_path,package_type,cmi_data,expires_at").eq("runtime_token",runtimeToken).gt("expires_at",new Date().toISOString()).maybeSingle();if(!runtime)return json({error:"SCORM_RUNTIME_EXPIRED"},403);
   const objectPath=`${runtime.package_prefix}/${asset}`;const download=await sb.storage.from("course-scorm").download(objectPath);if(download.error||!download.data)return json({error:"SCORM_ASSET_NOT_FOUND"},404);
   const mime=scormAssetMime(asset);
   if(asset===String(runtime.launch_path)&&mime.startsWith("text/html")){
    let html=await download.data.text();const previewRuntime=url.searchParams.get('preview')==='1';const bridge=scormBridgeScript(previewRuntime?{...runtime,cmi_data:{}}:runtime,previewRuntime);html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,`${bridge}</head>`):`${bridge}${html}`;
    return new Response(html,{status:200,headers:{...corsHeaders,"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
   }
   return new Response(await download.data.arrayBuffer(),{status:200,headers:{...corsHeaders,"Content-Type":mime,"Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});
  }catch(error){console.error("lesson-content scorm asset",error);return json({error:"SCORM_ASSET_ERROR"},500)}
 }

 if(req.method==="POST"){
  try{
   const body=await req.json().catch(()=>({})) as Record<string,any>;
   if(body.action==="scorm_commit"&&String(body.runtime_token||"").trim()){
    const runtimeToken=String(body.runtime_token||"").trim();const cmiData=body.cmi_data&&typeof body.cmi_data==="object"?body.cmi_data:{};
    const {data:runtime}=await sb.from("scorm_runtime_sessions").select("*").eq("runtime_token",runtimeToken).gt("expires_at",new Date().toISOString()).maybeSingle();if(!runtime)return json({error:"SCORM_RUNTIME_INVALID"},403);
    if(body.preview===true)return json({success:true,preview:true,progress_percent:scormProgress(cmiData),completed:false});
    const packageType="scorm_2004";const progress=scormProgress(cmiData);const completion=String(cmiData["cmi.completion_status"]||"");const success=String(cmiData["cmi.success_status"]||"");const scoreRaw=cmiData["cmi.score.raw"];const score=Number.isFinite(Number(scoreRaw))?Number(scoreRaw):null;const seconds=scormSeconds(String(cmiData["cmi.session_time"]||""));
    const {error:updateError}=await sb.from("scorm_runtime_sessions").update({cmi_data:cmiData,progress_percent:progress,completion_status:completion||null,success_status:success||null,score,total_time_seconds:Math.max(Number(runtime.total_time_seconds||0),seconds),last_commit_at:new Date().toISOString(),updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+12*3600000).toISOString()}).eq("id",runtime.id);if(updateError)throw updateError;
    const scormCompleted=progress>=100||completion==="completed"||success==="passed";
    const {data:lessonProgress}=await sb.from("user_lesson_progress").select("time_spent_seconds,quiz_passed,is_completed").eq("user_id",runtime.user_id).eq("lesson_id",runtime.lesson_id).maybeSingle();
    const {error:lessonProgressError}=await sb.from("user_lesson_progress").upsert({user_id:runtime.user_id,course_id:runtime.course_id,lesson_id:runtime.lesson_id,time_spent_seconds:Number(lessonProgress?.time_spent_seconds||0),quiz_passed:lessonProgress?.quiz_passed===true,is_completed:lessonProgress?.is_completed===true,scorm_progress_percent:progress,scorm_completed:scormCompleted,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});if(lessonProgressError)throw lessonProgressError;
    return json({success:true,progress_percent:progress,completed:scormCompleted});
   }
   // Les autres POST restent authentifiés ci-dessous.
   (req as any)._omniaBody=body;
  }catch(error){console.error("lesson-content scorm commit",error);return json({error:"SCORM_COMMIT_ERROR"},500)}
 }

 const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();if(!token)return json({error:"AUTH_REQUIRED"},401);
 try{
  const {data:sess}=await getActiveOmniaSessionResult(sb, token);if(!sess)return json({error:"SESSION_INVALID"},401);const userId=sess.user_id;

  if(req.method==="POST"){
   const body=((req as any)._omniaBody||{}) as Record<string,any>;
   const action=String(body.action||"");
   const courseId=String(body.course_id||"").trim(),lessonId=String(body.lesson_id||"").trim(),blockId=String(body.block_id||"").trim();
   if(!courseId||!lessonId||!blockId)return json({error:"course_id + lesson_id + block_id requis"},400);
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",courseId).maybeSingle();if(!enroll)return json({error:"NOT_ENROLLED"},403);
   const {data:block}=await sb.from("lesson_blocks").select("id,lesson_id,block_type,interaction_mode,is_required,training_passing_score,training_is_graded,content_json").eq("id",blockId).eq("lesson_id",lessonId).maybeSingle();if(!block)return json({error:"BLOCK_NOT_FOUND"},404);
   if(action==="prepare_training_upload"){
    if(block.interaction_mode!=="training")return json({error:"BLOCK_UPLOAD_NOT_ALLOWED"},409);
    const blockType=String(block.block_type);const legacyMode=block.content_json?.learner_upload_required===true?"file":"text";const responseMode=String(block.content_json?.response_mode||legacyMode);
    const uploadAllowed=blockType==="assignment_upload"||(["exercise","case_study"].includes(blockType)&&["file","text_file"].includes(responseMode));
    if(!uploadAllowed)return json({error:"BLOCK_UPLOAD_NOT_ALLOWED"},409);
    const name=String(body.file_name||"fichier").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-160);const size=Math.max(0,Number(body.size_bytes||0));const maxMb=Math.max(1,Math.min(50,Number(block.content_json?.max_size_mb||10)));if(size>maxMb*1024*1024)return json({error:"FILE_TOO_LARGE",message:`Le fichier dépasse ${maxMb} Mo.`},413);
    const ext=name.includes(".")?name.split(".").pop()!.toLowerCase():"";const accepted=(Array.isArray(block.content_json?.accepted_types)?block.content_json.accepted_types:[]).map((x:any)=>String(x).toLowerCase().replace(/^\./,""));if(accepted.length&&ext&&!accepted.includes(ext)&&!(ext==="jpeg"&&accepted.includes("jpg"))&&!(ext==="jpg"&&accepted.includes("jpeg")))return json({error:"FILE_TYPE_NOT_ALLOWED",message:"Ce format de fichier n'est pas autorisé."},400);
    const path=`${userId}/${courseId}/training/${blockId}/${crypto.randomUUID()}-${name}`;const {data,error}=await sb.storage.from("assessment-submissions").createSignedUploadUrl(path,{upsert:false});if(error)throw error;return json({success:true,...data,bucket:"assessment-submissions",path});
   }
   if(action==="training_submit"){
    if(block.interaction_mode!=="training")return json({error:"BLOCK_NOT_TRAINING"},409);
    const answer=body.answer&&typeof body.answer==="object"?body.answer:{};const files=Array.isArray(answer.files)?answer.files:[];const blockType=String(block.block_type);const legacyMode=block.content_json?.learner_upload_required===true?"file":"text";const responseMode=blockType==="assignment_upload"?"file":String(block.content_json?.response_mode||legacyMode);const responseLayout=String(block.content_json?.response_layout||"per_question");
    if(["exercise","case_study"].includes(blockType)){const hasFile=files.length>0;const hasSingleText=String(answer.text||"").trim().length>0;const questionCount=Array.isArray(block.content_json?.questions)?block.content_json.questions.filter((x:any)=>String(typeof x==="string"?x:x?.question||x?.text||"").trim()).length:0;const suppliedAnswers=answer.answers&&typeof answer.answers==="object"?answer.answers:{};const hasPerQuestionText=questionCount>0&&Array.from({length:questionCount}).every((_:any,i:number)=>String(suppliedAnswers[String(i)]||"").trim().length>0);const hasText=responseLayout==="single"||questionCount===0?hasSingleText:hasPerQuestionText;if((responseMode==="text"&&!hasText)||(responseMode==="file"&&!hasFile)||(responseMode==="text_file"&&(!hasText||!hasFile)))return json({error:"TRAINING_SUBMISSION_INCOMPLETE",message:"La remise ne correspond pas au mode de réponse défini pour cette activité."},400);}
    if(blockType==="assignment_upload"&&!files.length)return json({error:"TRAINING_FILE_REQUIRED"},400);if(files.length){const expectedPrefix=`${userId}/${courseId}/training/${blockId}/`;for(const file of files){if(String(file?.bucket_name||"")!=="assessment-submissions"||!String(file?.storage_path||"").startsWith(expectedPrefix))return json({error:"INVALID_TRAINING_FILE"},400);}}
    const graded=block.training_is_graded!==false;const rawScore=Math.max(0,Math.min(100,Number(body.score||0)));const threshold=graded?Math.max(0,Math.min(100,Number(block.training_passing_score??80))):null;const score=graded?rawScore:0;const passed=graded?rawScore>=Number(threshold):true;
    const {data:last}=await sb.from("training_attempts").select("attempt_number").eq("user_id",userId).eq("block_id",blockId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
    const {error}=await sb.from("training_attempts").insert({user_id:userId,course_id:courseId,lesson_id:lessonId,block_id:blockId,attempt_number:Number(last?.attempt_number||0)+1,score,passed,answer_json:{...answer,_graded:graded},completed_at:new Date().toISOString()});if(error)throw error;
    const gate=await computeLessonGate(sb,userId,courseId,lessonId);return json({success:true,graded,score:graded?rawScore:null,threshold,passed,lesson_gate:gate});
   }
   if(action==="block_state_save"){
    const state=body.state&&typeof body.state==="object"?body.state:{};const completed=Boolean(body.completed);const {error}=await sb.from("learner_block_state").upsert({user_id:userId,course_id:courseId,lesson_id:lessonId,block_id:blockId,state_json:state,completed,updated_at:new Date().toISOString()},{onConflict:"user_id,block_id"});if(error)throw error;
    return json({success:true});
   }
   return json({error:"UNKNOWN_ACTION"},400);
  }
  if(req.method!=="GET")return json({error:"METHOD_NOT_ALLOWED"},405);
  const lessonId=url.searchParams.get("lesson_id"),courseId=url.searchParams.get("course_id"),previewMode=String(url.searchParams.get("preview")||"").toLowerCase(),preview=["learner","admin"].includes(previewMode);if(!lessonId||!courseId)return json({error:"lesson_id + course_id requis"},400);
  const previewAllowed=preview&&await canPreviewCourse(sb,userId,courseId);if(preview&&!previewAllowed)return json({error:"PREVIEW_FORBIDDEN"},403);
  const enroll=previewAllowed?null:(await sb.from("user_enrollments").select("id,enrolled_at").eq("user_id",userId).eq("course_id",courseId).maybeSingle()).data;if(!previewAllowed&&!enroll)return json({error:"NOT_ENROLLED"},403);
  const {data:course}=await sb.from("courses").select("learning_design_settings").eq("id",courseId).maybeSingle();if(!course)return json({error:"COURSE_NOT_FOUND"},404);
  const design=(course.learning_design_settings||{}) as Record<string,unknown>;
  const {data:lesson}=await sb.from("course_lessons").select("id,title,content_text,video_url,audio_url,lesson_summary,cpd_calculated_time_seconds,cloudflare_stream_uid,position,module_id,is_free_preview,is_external,external_url,is_intro,is_module_intro,is_conclusion,is_final_exam,is_required,stage_type").eq("id",lessonId).maybeSingle();if(!lesson)return json({error:"LESSON_NOT_FOUND"},404);
  const curriculum=await loadCourseCurriculum(sb,courseId);const modules=curriculum.modules;const sorted=curriculum.orderedLessons;const index=sorted.findIndex((l:any)=>String(l.id)===String(lessonId));if(index<0)return json({error:"LESSON_NOT_IN_COURSE"},404);if(curriculum.orphanLessonIds.length)console.warn("lesson-content orphan lessons",courseId,curriculum.orphanLessonIds);
  const cohortStartRaw=String(design.cohort_start_at||"").trim();const cohortStart=cohortStartRaw?new Date(cohortStartRaw):null;
  if(!previewAllowed&&cohortStart&&!Number.isNaN(cohortStart.getTime())&&cohortStart.getTime()>Date.now())return json({error:"COURSE_NOT_STARTED",message:"Cette cohorte n'a pas encore commencé.",available_at:cohortStart.toISOString()},403);
  if(!previewAllowed&&design.drip_enabled===true){const interval=Math.max(1,Number(design.drip_interval_days||7));const moduleIndex=Math.max(0,(modules??[]).findIndex((m:any)=>m.id===lesson.module_id));const base=cohortStart&&!Number.isNaN(cohortStart.getTime())?cohortStart:new Date(enroll.enrolled_at||Date.now());const releaseAt=new Date(base.getTime()+moduleIndex*interval*86400000);if(releaseAt.getTime()>Date.now())return json({error:"LESSON_NOT_RELEASED",message:"Ce module sera disponible selon le calendrier de diffusion.",available_at:releaseAt.toISOString()},403);}
  if(!previewAllowed&&design.require_sequential_progress!==false&&index>0){const previousRequired=sorted.slice(0,index).reverse().find((candidate:any)=>candidate.is_required!==false);if(previousRequired){const {data:previousProgress}=await sb.from("user_lesson_progress").select("is_completed").eq("user_id",userId).eq("lesson_id",previousRequired.id).maybeSingle();if(previousProgress?.is_completed!==true)return json({error:"LESSON_LOCKED",message:"Complétez la leçon obligatoire précédente d'abord."},403);}}
  if(!previewAllowed&&design.require_sequential_progress!==false){
   const realModules=(modules||[]).filter((m:any)=>String(m.section_type||"module")==="module").sort((a:any,b:any)=>Number(a.position||0)-Number(b.position||0));const targetModuleIndex=realModules.findIndex((m:any)=>String(m.id)===String(lesson.module_id));
   if(targetModuleIndex>0){const previousModule=realModules[targetModuleIndex-1];const previousLessons=sorted.filter((l:any)=>String(l.module_id)===String(previousModule.id)&&String(l.stage_type||"lesson")==="lesson"&&l.is_required!==false);if(previousLessons.length){const {data:prevProgress}=await sb.from("user_lesson_progress").select("lesson_id,is_completed").eq("user_id",userId).in("lesson_id",previousLessons.map((l:any)=>l.id));const completed=new Set((prevProgress||[]).filter((p:any)=>p.is_completed===true).map((p:any)=>String(p.lesson_id)));if(previousLessons.some((l:any)=>!completed.has(String(l.id))))return json({error:"MODULE_LOCKED",message:"Terminez les leçons obligatoires du module précédent."},403);}
    const {data:moduleAssessment}=await sb.from("course_assessments").select("id,required").eq("course_id",courseId).eq("module_id",previousModule.id).eq("scope","module").eq("is_active",true).maybeSingle();if(moduleAssessment?.required!==false&&moduleAssessment){const {data:passed}=await sb.from("assessment_attempts").select("id").eq("assessment_id",moduleAssessment.id).eq("user_id",userId).eq("passed",true).limit(1).maybeSingle();if(!passed)return json({error:"MODULE_ASSESSMENT_REQUIRED",message:"Réussissez l'évaluation du module précédent avant de continuer."},403);}
   }
   const stageType=String(lesson.stage_type||"lesson");if(["conclusion","final_exam"].includes(stageType)){for(const mod of realModules){const requiredLessons=sorted.filter((l:any)=>String(l.module_id)===String(mod.id)&&String(l.stage_type||"lesson")==="lesson"&&l.is_required!==false);if(requiredLessons.length){const {data:ps}=await sb.from("user_lesson_progress").select("lesson_id,is_completed").eq("user_id",userId).in("lesson_id",requiredLessons.map((l:any)=>l.id));const done=new Set((ps||[]).filter((x:any)=>x.is_completed===true).map((x:any)=>String(x.lesson_id)));if(requiredLessons.some((l:any)=>!done.has(String(l.id))))return json({error:"COURSE_SEQUENCE_LOCKED",message:"Terminez les modules obligatoires avant la conclusion."},403);}const {data:ma}=await sb.from("course_assessments").select("id,required").eq("course_id",courseId).eq("module_id",mod.id).eq("scope","module").eq("is_active",true).maybeSingle();if(ma?.required!==false&&ma){const {data:passed}=await sb.from("assessment_attempts").select("id").eq("assessment_id",ma.id).eq("user_id",userId).eq("passed",true).limit(1).maybeSingle();if(!passed)return json({error:"COURSE_SEQUENCE_LOCKED",message:"Réussissez les évaluations obligatoires des modules avant la conclusion."},403);}}
   }
  }
  const gate=previewAllowed?{timeSpent:0,required:Number(lesson.cpd_calculated_time_seconds||0),cpdReached:false,completed:false,assessmentPassed:false,assessmentRequired:false,trainingPassed:false,trainingRequired:0,trainingPassedCount:0}:await computeLessonGate(sb,userId,courseId,lessonId);
  const {timeSpent,required,cpdReached,completed,assessmentPassed,assessmentRequired,trainingPassed,trainingRequired,trainingPassedCount}=gate;
  const quizPassed=!assessmentRequired||assessmentPassed;
  const [{data:viewerUser},{data:viewerProfile}]=await Promise.all([
    sb.from("users").select("country_code").eq("id",userId).maybeSingle(),
    sb.from("user_profiles").select("preferred_pedagogical_currency,preferred_language").eq("user_id",userId).maybeSingle(),
  ]);
  const countryCode=String(viewerUser?.country_code||"").toUpperCase();
  let suggestedCurrency:string|null=null;
  if(countryCode){const {data:countryLoc}=await sb.from("country_localization_settings").select("default_currency_code").eq("country_code",countryCode).eq("is_active",true).maybeSingle();suggestedCurrency=countryLoc?.default_currency_code?String(countryLoc.default_currency_code).toUpperCase():null;}
  const preferredCurrency=viewerProfile?.preferred_pedagogical_currency?String(viewerProfile.preferred_pedagogical_currency).toUpperCase():null;
  const pedagogicalCurrency=preferredCurrency||suggestedCurrency||null;
  const pedagogicalLocale=String(viewerProfile?.preferred_language||"fr")==="en"?"en-GB":String(viewerProfile?.preferred_language||"fr")==="de"?"de-DE":String(viewerProfile?.preferred_language||"fr")==="es"?"es-ES":String(viewerProfile?.preferred_language||"fr")==="pt"?"pt-PT":"fr-FR";

  // Source de vérité : lesson_blocks. Les colonnes historiques has_blocks/block_count peuvent être obsolètes
  // après une édition du Builder et ne doivent jamais empêcher le rendu apprenant.
  let blocks:any[]=[];{const {data:raw,error:blockError}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,settings_json,file_url,file_name,file_size,file_mime,storage_path,bucket_name,source_type,ai_generated,interaction_mode,is_required,training_passing_score,training_is_graded,rag_enabled,source_provenance").eq("lesson_id",lessonId).order("position");if(blockError)throw blockError;blocks=raw??[];blocks=await Promise.all(blocks.map(async(block:any)=>{const content={...(block.content_json||{})};
   if(block.block_type==="scorm"&&content.scorm_ready===true&&content.scorm_package_prefix&&content.launch_path){
    const {data:existing}=await sb.from("scorm_runtime_sessions").select("*").eq("user_id",userId).eq("block_id",block.id).maybeSingle();
    const runtimeToken=existing?.runtime_token||crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
    const payload={runtime_token:runtimeToken,user_id:userId,course_id:courseId,lesson_id:lessonId,block_id:block.id,package_type:"scorm_2004",package_prefix:String(content.scorm_package_prefix),launch_path:String(content.launch_path),expires_at:new Date(Date.now()+12*3600000).toISOString(),updated_at:new Date().toISOString()};
    const {data:runtime,error:runtimeError}=await sb.from("scorm_runtime_sessions").upsert(payload,{onConflict:"user_id,block_id"}).select("*").single();if(runtimeError)throw runtimeError;
    const encodedLaunch=String(content.launch_path).split("/").map((part:string)=>encodeURIComponent(part)).join("/");const launchUrl=`${Deno.env.get("SUPABASE_URL")}/functions/v1/lesson-content/scorm/${runtime.runtime_token}/${encodedLaunch}${previewAllowed?'?preview=1':''}`;
    return {...block,file_url:launchUrl,content_json:{...content,url:launchUrl,runtime_session_token:runtime.runtime_token,runtime_state:runtime.cmi_data||{}},_signed:true,_scorm:true};
   }
   const streamUid=String(content.cloudflare_stream_uid||"").trim();if(streamUid){try{const signed=await signedStreamManifest(streamUid,900);const nested=await signNestedMediaRefs(sb,content);return {...block,file_url:signed.iframe_url,content_json:{...nested,url:signed.iframe_url,provider:"cloudflare_stream"},_signed:true,_stream:true};}catch{const nested=await signNestedMediaRefs(sb,content);return {...block,file_url:null,content_json:{...nested,url:null,provider:"cloudflare_stream"},_signed:false,_stream:true};}}let enrichedContent=content;if(block.block_type==="excel"&&(!Array.isArray(content.preview_rows)||content.preview_rows.length===0)){const excelBucket=String(block.bucket_name||content.bucket||inferBucket(block.block_type));const excelLocator=parseStorageLocator(block.storage_path||block.file_url,excelBucket);if(excelLocator&&PRIVATE_COURSE_BUCKET_SET.has(excelLocator.bucket)){try{const downloaded=await sb.storage.from(excelLocator.bucket).download(excelLocator.path);if(!downloaded.error&&downloaded.data){const bytes=new Uint8Array(await downloaded.data.arrayBuffer());enrichedContent={...content,...excelPreview(bytes)};}}catch{/* L'absence d'aperçu ne bloque jamais la ressource. */}}}const signedContent=await signNestedMediaRefs(sb,enrichedContent);const bucket=String(block.bucket_name||enrichedContent.bucket||inferBucket(block.block_type));if(!PRIVATE_COURSE_BUCKET_SET.has(bucket))return {...block,content_json:signedContent};const locator=parseStorageLocator(block.storage_path||block.file_url,bucket);if(!locator)return {...block,file_url:null,content_json:signedContent};const signedUrl=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);if(!signedUrl)return {...block,file_url:null,content_json:signedContent};return {...block,file_url:signedUrl,content_json:{...signedContent,url:signedUrl},_signed:true};}));}
  const blockIds=blocks.map((b:any)=>b.id);if(blockIds.length){const {data:links,error:linksError}=await sb.from("lesson_block_links").select("source_block_id,target_block_id,relation_type").in("source_block_id",blockIds);if(linksError)throw linksError;const relMap=new Map<string,string[]>();for(const link of links||[]){const key=String(link.source_block_id);relMap.set(key,[...(relMap.get(key)||[]),String(link.target_block_id)]);}blocks=blocks.map((block:any)=>({...block,linked_block_ids:relMap.get(String(block.id))||[]}));}let blockStates:any[]=[];let latestTraining:any[]=[];if(!previewAllowed&&blockIds.length){const statesRes=await sb.from("learner_block_state").select("block_id,state_json,completed,updated_at").eq("user_id",userId).eq("lesson_id",lessonId).in("block_id",blockIds);blockStates=statesRes.data||[];const attemptsRes=await sb.from("training_attempts").select("block_id,attempt_number,score,passed,completed_at").eq("user_id",userId).eq("lesson_id",lessonId).in("block_id",blockIds).order("attempt_number",{ascending:false});const seen=new Set<string>();for(const a of attemptsRes.data||[]){if(!seen.has(String(a.block_id))){seen.add(String(a.block_id));latestTraining.push(a);}}}
  const availableCurrencySet=new Set<string>();for(const block of blocks){const amounts=Array.isArray(block.settings_json?.pedagogical_localization?.amounts)?block.settings_json.pedagogical_localization.amounts:[];for(const amount of amounts){const ref=String(amount?.reference_currency||"").toUpperCase();if(ref)availableCurrencySet.add(ref);for(const code of Object.keys(amount?.variants||{})){if(/^[A-Z]{3}$/.test(String(code).toUpperCase()))availableCurrencySet.add(String(code).toUpperCase());}}}
  const availablePedagogicalCurrencies=[...availableCurrencySet];
  const derivedContentType=lesson.is_external?"external":(lesson.cloudflare_stream_uid||lesson.video_url)?"video":lesson.audio_url?"audio":"text";const lessonForResponse:any={...lesson,text_content:lesson.content_text||"",duration_seconds:Number(lesson.cpd_calculated_time_seconds||0),external_partner:null,has_blocks:blocks.length>0,block_count:blocks.length,content_type:derivedContentType};delete lessonForResponse.content_text;for(const field of ["video_url","audio_url"]){const raw=lessonForResponse[field];const locator=parseStorageLocator(raw);if(locator&&PRIVATE_COURSE_BUCKET_SET.has(locator.bucket))lessonForResponse[field]=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);}
  return json({preview:previewAllowed,preview_mode:previewAllowed?previewMode:null,lesson:lessonForResponse,blocks,localization:{country_code:countryCode||null,preferred_currency:preferredCurrency,suggested_currency:suggestedCurrency,currency_code:pedagogicalCurrency,locale:pedagogicalLocale,available_currencies:availablePedagogicalCurrencies},progress:{time_spent_seconds:timeSpent,quiz_passed:quizPassed,is_completed:completed},required_seconds:required,cpd_time_reached:cpdReached,training:{required_count:trainingRequired,passed_count:trainingPassedCount,passed:trainingPassed,latest_attempts:latestTraining},block_states:blockStates,questions:[],next_lesson_id:index<sorted.length-1?sorted[index+1].id:null});
 }catch(error){console.error("lesson-content",error);return json({error:"SERVER_ERROR",message:(error as Error).message},500);}
});
function inferBucket(type:string){switch(type){case"video":return"course-videos";case"audio":return"course-audios";case"pdf":case"word":return"course-documents";case"excel":return"course-excel";case"scorm":return"course-scorm";default:return"course-resources";}}
