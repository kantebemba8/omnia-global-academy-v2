import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PRIVATE_COURSE_BUCKET_SET, createSignedObjectUrl, parseStorageLocator } from "../_shared/protected-storage.ts";
import { signedStreamManifest } from "../_shared/cloudflare-stream.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
function scormAssetMime(path:string){const ext=String(path||"").split(".").pop()?.toLowerCase()||"";const map:Record<string,string>={html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",js:"application/javascript; charset=utf-8",mjs:"application/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json; charset=utf-8",xml:"application/xml; charset=utf-8",txt:"text/plain; charset=utf-8",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",mp3:"audio/mpeg",mp4:"video/mp4",webm:"video/webm",pdf:"application/pdf",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf"};return map[ext]||"application/octet-stream"}
function safeScormRelative(value:string){const clean=decodeURIComponent(String(value||"")).replace(/\\/g,"/").replace(/^\/+|\?.*$/g,"");if(!clean||clean.split("/").includes("..")||/[\u0000-\u001F]/.test(clean))return "";return clean}
function scormProgress(data:Record<string,string>){const measured=Number(data["cmi.progress_measure"]);if(Number.isFinite(measured))return Math.max(0,Math.min(100,measured*100));if(data["cmi.completion_status"]==="completed"||data["cmi.success_status"]==="passed")return 100;return 0}
function scormSeconds(value:string){const iso=String(value||"").match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);if(iso)return Math.round(Number(iso[1]||0)*3600+Number(iso[2]||0)*60+Number(iso[3]||0));const hms=String(value||"").match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);return hms?Math.round(Number(hms[1])*3600+Number(hms[2])*60+Number(hms[3])):0}
function scormBridgeScript(runtime:any){
 const state=JSON.stringify(runtime?.cmi_data||{}).replace(/</g,"\\u003c");const token=JSON.stringify(String(runtime?.runtime_token||""));const endpoint=JSON.stringify(`${Deno.env.get("SUPABASE_URL")}/functions/v1/lesson-content`);
 return `<script>(function(){var data=Object.assign({},${state});var token=${token};var endpoint=${endpoint};function post(type,payload){try{parent.postMessage(Object.assign({type:type},payload||{}),'*')}catch(e){}}function progress(){var m=parseFloat(data['cmi.progress_measure']);var p=!isNaN(m)?Math.max(0,Math.min(100,Math.round(m*100))):0;if(data['cmi.completion_status']==='completed'||data['cmi.success_status']==='passed')p=100;post('omnia-scorm-progress',{progress:p});return p;}function commit(){try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'scorm_commit',runtime_token:token,package_type:'scorm_2004',cmi_data:data}),keepalive:true})}catch(e){}progress();return 'true';}function complete(){var ok=data['cmi.completion_status']==='completed'||data['cmi.success_status']==='passed';if(ok)post('omnia-scorm-complete',{score:parseFloat(data['cmi.score.raw'])||null});}window.API_1484_11={Initialize:function(){return 'true'},Terminate:function(){complete();return commit()},GetValue:function(k){return data[k]||''},SetValue:function(k,v){data[k]=String(v==null?'':v);progress();return 'true'},Commit:commit,GetLastError:function(){return '0'},GetErrorString:function(){return ''},GetDiagnostic:function(){return ''}};post('omnia-scorm-ready',{packageType:'scorm_2004',progress:progress()});})();</script>`;
}

const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});

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
    let html=await download.data.text();const bridge=scormBridgeScript(runtime);html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,`${bridge}</head>`):`${bridge}${html}`;
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

  if(req.method==="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(req.method!=="GET")return json({error:"METHOD_NOT_ALLOWED"},405);
  const lessonId=url.searchParams.get("lesson_id"),courseId=url.searchParams.get("course_id");if(!lessonId||!courseId)return json({error:"lesson_id + course_id requis"},400);
  const {data:enroll}=await sb.from("user_enrollments").select("id,enrolled_at").eq("user_id",userId).eq("course_id",courseId).maybeSingle();if(!enroll)return json({error:"NOT_ENROLLED"},403);
  const {data:course}=await sb.from("courses").select("learning_design_settings").eq("id",courseId).maybeSingle();if(!course)return json({error:"COURSE_NOT_FOUND"},404);
  const design=(course.learning_design_settings||{}) as Record<string,unknown>;
  const {data:lesson}=await sb.from("course_lessons").select("id,title,content_type,video_url,audio_url,text_content,lesson_summary,duration_seconds,cloudflare_stream_uid,position,module_id,has_blocks,block_count,word_count,is_free_preview,is_external,external_url,external_partner").eq("id",lessonId).maybeSingle();if(!lesson)return json({error:"LESSON_NOT_FOUND"},404);
  const {data:modules}=await sb.from("course_modules").select("id,position").eq("course_id",courseId).order("position");const modulePosition:Record<string,number>={};for(const m of modules??[])modulePosition[(m as any).id]=(m as any).position;
  const moduleIds=(modules??[]).map((m:any)=>m.id);const {data:allLessons}=moduleIds.length?await sb.from("course_lessons").select("id,position,module_id").in("module_id",moduleIds):{data:[]};const sorted=(allLessons??[]).sort((a:any,b:any)=>(modulePosition[a.module_id]-modulePosition[b.module_id])||(a.position-b.position));const index=sorted.findIndex((l:any)=>l.id===lessonId);if(index<0)return json({error:"LESSON_NOT_IN_COURSE"},404);
  const cohortStartRaw=String(design.cohort_start_at||"").trim();const cohortStart=cohortStartRaw?new Date(cohortStartRaw):null;
  if(cohortStart&&!Number.isNaN(cohortStart.getTime())&&cohortStart.getTime()>Date.now())return json({error:"COURSE_NOT_STARTED",message:"Cette cohorte n'a pas encore commencé.",available_at:cohortStart.toISOString()},403);
  if(design.drip_enabled===true){const interval=Math.max(1,Number(design.drip_interval_days||7));const moduleIndex=Math.max(0,(modules??[]).findIndex((m:any)=>m.id===lesson.module_id));const base=cohortStart&&!Number.isNaN(cohortStart.getTime())?cohortStart:new Date(enroll.enrolled_at||Date.now());const releaseAt=new Date(base.getTime()+moduleIndex*interval*86400000);if(releaseAt.getTime()>Date.now())return json({error:"LESSON_NOT_RELEASED",message:"Ce module sera disponible selon le calendrier de diffusion.",available_at:releaseAt.toISOString()},403);}
  if(design.require_sequential_progress!==false&&index>0){const previous=sorted[index-1];const {data:previousProgress}=await sb.from("user_lesson_progress").select("is_completed").eq("user_id",userId).eq("lesson_id",previous.id).maybeSingle();if(previousProgress?.is_completed!==true)return json({error:"LESSON_LOCKED",message:"Complétez la leçon précédente d'abord."},403);}
  const {data:progress}=await sb.from("user_lesson_progress").select("time_spent_seconds,quiz_passed,is_completed").eq("user_id",userId).eq("lesson_id",lessonId).maybeSingle();const timeSpent=Number(progress?.time_spent_seconds||0),required=Number(lesson.duration_seconds||0),cpdReached=required===0||timeSpent>=required;
  const {data:assessment}=await sb.from("course_assessments").select("id").eq("course_id",courseId).eq("lesson_id",lessonId).eq("scope","lesson").eq("is_active",true).maybeSingle();let assessmentPassed=false;if(assessment){const {data:passed}=await sb.from("assessment_attempts").select("id").eq("assessment_id",assessment.id).eq("user_id",userId).eq("passed",true).limit(1).maybeSingle();assessmentPassed=!!passed;}
  const quizPassed=assessmentPassed||!!progress?.quiz_passed;const completed=cpdReached&&(!assessment||quizPassed);
  if(completed!==!!progress?.is_completed||quizPassed!==!!progress?.quiz_passed){await sb.from("user_lesson_progress").upsert({user_id:userId,course_id:courseId,lesson_id:lessonId,time_spent_seconds:timeSpent,quiz_passed:quizPassed,is_completed:completed,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});}
  let blocks:any[]=[];if(lesson.has_blocks&&Number(lesson.block_count||0)>0){const {data:raw}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,settings_json,file_url,file_name,file_size,file_mime,storage_path,bucket_name,source_type,ai_generated").eq("lesson_id",lessonId).order("position");blocks=raw??[];blocks=await Promise.all(blocks.map(async(block:any)=>{const content={...(block.content_json||{})};
   if(block.block_type==="scorm"&&content.scorm_ready===true&&content.scorm_package_prefix&&content.launch_path){
    const {data:existing}=await sb.from("scorm_runtime_sessions").select("*").eq("user_id",userId).eq("block_id",block.id).maybeSingle();
    const runtimeToken=existing?.runtime_token||crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
    const payload={runtime_token:runtimeToken,user_id:userId,course_id:courseId,lesson_id:lessonId,block_id:block.id,package_type:"scorm_2004",package_prefix:String(content.scorm_package_prefix),launch_path:String(content.launch_path),expires_at:new Date(Date.now()+12*3600000).toISOString(),updated_at:new Date().toISOString()};
    const {data:runtime,error:runtimeError}=await sb.from("scorm_runtime_sessions").upsert(payload,{onConflict:"user_id,block_id"}).select("*").single();if(runtimeError)throw runtimeError;
    const encodedLaunch=String(content.launch_path).split("/").map((part:string)=>encodeURIComponent(part)).join("/");const launchUrl=`${Deno.env.get("SUPABASE_URL")}/functions/v1/lesson-content/scorm/${runtime.runtime_token}/${encodedLaunch}`;
    return {...block,file_url:launchUrl,content_json:{...content,url:launchUrl,runtime_session_token:runtime.runtime_token,runtime_state:runtime.cmi_data||{}},_signed:true,_scorm:true};
   }
   const streamUid=String(content.cloudflare_stream_uid||"").trim();if(streamUid){try{const signed=await signedStreamManifest(streamUid,900);const nested=await signNestedMediaRefs(sb,content);return {...block,file_url:signed.iframe_url,content_json:{...nested,url:signed.iframe_url,provider:"cloudflare_stream"},_signed:true,_stream:true};}catch{const nested=await signNestedMediaRefs(sb,content);return {...block,file_url:null,content_json:{...nested,url:null,provider:"cloudflare_stream"},_signed:false,_stream:true};}}const signedContent=await signNestedMediaRefs(sb,content);const bucket=String(block.bucket_name||content.bucket||inferBucket(block.block_type));if(!PRIVATE_COURSE_BUCKET_SET.has(bucket))return {...block,content_json:signedContent};const locator=parseStorageLocator(block.storage_path||block.file_url,bucket);if(!locator)return {...block,file_url:null,content_json:signedContent};const signedUrl=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);if(!signedUrl)return {...block,file_url:null,content_json:signedContent};return {...block,file_url:signedUrl,content_json:{...signedContent,url:signedUrl},_signed:true};}));}
  const lessonForResponse:any={...lesson,content_type:lesson.content_type||(lesson.has_blocks?"blocks":"text")};for(const field of ["video_url","audio_url"]){const raw=lessonForResponse[field];const locator=parseStorageLocator(raw);if(locator&&PRIVATE_COURSE_BUCKET_SET.has(locator.bucket))lessonForResponse[field]=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);}
  return json({lesson:lessonForResponse,blocks,progress:{time_spent_seconds:timeSpent,quiz_passed:quizPassed,is_completed:completed},required_seconds:required,cpd_time_reached:cpdReached,questions:[],next_lesson_id:index<sorted.length-1?sorted[index+1].id:null});
 }catch(error){console.error("lesson-content",error);return json({error:"SERVER_ERROR",message:(error as Error).message},500);}
});
function inferBucket(type:string){switch(type){case"video":return"course-videos";case"audio":return"course-audios";case"pdf":case"word":return"course-documents";case"excel":return"course-excel";case"scorm":return"course-scorm";default:return"course-resources";}}
