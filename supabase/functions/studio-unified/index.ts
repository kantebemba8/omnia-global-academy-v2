import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hasStructurePermission, validatedStructureAccess } from "../_shared/structure-access.ts";
import { PRIVATE_COURSE_BUCKET_SET, createSignedObjectUrl, normalizeAssistedDocument, parseStorageLocator, signAssistedDocuments } from "../_shared/protected-storage.ts";
import JSZip from "npm:jszip@3.10.1";
import * as XLSX from "npm:xlsx@0.18.5";
import { extractText as extractPdfDocumentText, getDocumentProxy } from "npm:unpdf@0.10.1";

import { getActiveOmniaSessionResult, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { getAnthropicApiKey, getAnthropicFastModel, getOpenAIImageModel } from "../_shared/ai-models.ts";
import { cloudflareStreamConfigured, createDirectStreamUpload, deleteStreamVideo, getStreamVideo, signedStreamManifest } from "../_shared/cloudflare-stream.ts";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-omnia-session-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

const STUDIO_UPLOAD_BUCKETS=new Set<string>(["course-images",...PRIVATE_COURSE_BUCKET_SET]);
function validCourseStoragePath(courseId:string,path:unknown){const clean=String(path||"").trim().replace(/^\/+/,"");return clean&&clean.startsWith(`${courseId}/`)?clean:""}
async function decorateStudioBlock(sb:any,block:any){
 const content={...(block?.content_json||{})};
 const streamUid=String(content.cloudflare_stream_uid||"").trim();
 if(streamUid){
  try{const signed=await signedStreamManifest(streamUid,900);return {...block,file_url:signed.iframe_url,content_json:{...content,url:signed.iframe_url,provider:"cloudflare_stream"},_signed:true,_stream:true};}
  catch{return {...block,file_url:null,content_json:{...content,url:null,provider:"cloudflare_stream"},_signed:false,_stream:true};}
 }
 const bucket=String(block?.bucket_name||"");if(!PRIVATE_COURSE_BUCKET_SET.has(bucket))return block;const locator=parseStorageLocator(block.storage_path||block.file_url,bucket);if(!locator)return {...block,file_url:null,content_json:{...content,url:null}};const signed=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);return {...block,file_url:signed,content_json:{...content,url:signed},_signed:!!signed}
}

async function sessionUser(sb:any, req:Request, bodyToken=""){
 const token=(bodyToken||req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token) return null;
 const {data}=await getActiveOmniaSessionResult(sb, token);
 if(data?.user_id) return data.user_id;
 // Compatibilité avec les jetons Supabase Auth utilisés par certaines pages.
 const {data:authData}=await sb.auth.getUser(token);
 return authData?.user?.id||null;
}
async function roles(sb:any,userId:string){const {data}=await sb.from("user_roles").select("role").eq("user_id",userId);return (data||[]).map((r:any)=>r.role)}
async function owns(sb:any,userId:string,courseId:string,permission="can_edit_courses"){const {data}=await sb.from("courses").select("creator_id,creator_context,structure_id").eq("id",courseId).maybeSingle();if(!data)return false;const rs=await roles(sb,userId);if(rs.includes("super_admin"))return true;if(String(data.creator_id)!==userId)return false;if(String(data.creator_context||"")!=="structure")return true;if(!data.structure_id)return false;const access=await validatedStructureAccess(sb,userId,String(data.structure_id));return hasStructurePermission(access,permission)}
function coursePermissionForAction(action:string){if(action==="submit_course")return "can_submit_courses";if(["create_module","create_lesson","create_block","update_block","delete_block","reorder_blocks","ensure_special_sections","ensure_assessments","assessment_policy_update"].includes(action))return "can_manage_lessons";if(["prepare_upload","upload_block_file","prepare_assessment_correction_upload"].includes(action))return "can_upload_files";return "can_edit_courses"}
async function log(sb:any,courseId:string,userId:string,action:string,details:any={}){await Promise.allSettled([sb.from("course_studio_logs").insert({course_id:courseId,user_id:userId,action,details}),sb.from("course_audit_log").insert({course_id:courseId,actor_id:userId,action,entity_type:"course",metadata:details})])}


function stripMarkup(value:unknown){return String(value||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function wordCount(value:unknown){const text=stripMarkup(value);return text?text.split(/\s+/).filter(Boolean).length:0}
function blockActiveMinutes(block:any){
 const c=block?.content_json||{};const type=String(block?.block_type||"");
 const explicit=Math.max(0,Number(c.duration_min||c.duration_minutes||0));
 if(["video","audio","scorm"].includes(type)&&explicit>0)return explicit;
 if(type==="qcm"||type==="true_false")return 1.5;
 if(type==="open_question")return Math.max(3,Number(c.estimated_minutes||5));
 if(type==="exercise")return Math.max(5,Number(c.estimated_minutes||10));
 if(type==="assignment_upload")return Math.max(10,Number(c.estimated_minutes||15));
 if(type==="case_study")return Math.max(8,Number(c.estimated_minutes||10));
 if(type==="flashcards")return Math.max(1,(Array.isArray(c.cards)?c.cards.length:0)*0.5);
 if(type==="accordion")return Math.max(0.5,wordCount((c.items||[]).map((x:any)=>`${x?.title||""} ${x?.content||""}`).join(" "))/200);
 if(type==="interactive_table")return Math.max(0.5,(Array.isArray(c.rows)?c.rows.length:0)*0.35);
 if(type==="timeline")return Math.max(0.5,(Array.isArray(c.steps)?c.steps.length:0)*0.5);
 const textual=[c.html,c.text,c.content,c.definition,c.example,c.summary,c.instructions,c.task,c.description,c.transcription,c.code,c.latex,(c.points||[]).join?.(" "),(c.items||[]).map?.((x:any)=>typeof x==="string"?x:x?.text||"").join(" ")].filter(Boolean).join(" ");
 const words=wordCount(textual);
 return words>0?Math.max(0.5,words/200):0;
}
async function recalculateCourseDuration(sb:any,courseId:string){
 const [{data:blocks},{data:assessments}]=await Promise.all([
  sb.from("lesson_blocks").select("block_type,content_json").eq("course_id",courseId),
  sb.from("course_assessments").select("estimated_minutes,required,is_active").eq("course_id",courseId)
 ]);
 const blockMinutes=(blocks||[]).reduce((sum:number,block:any)=>sum+blockActiveMinutes(block),0);
 const assessmentMinutes=(assessments||[]).filter((a:any)=>a.is_active!==false&&a.required!==false).reduce((sum:number,a:any)=>sum+Math.max(0,Number(a.estimated_minutes||0)),0);
 const minutes=Math.max(1,Math.ceil(blockMinutes+assessmentMinutes));
 await sb.from("courses").update({calculated_duration_minutes:minutes,updated_at:new Date().toISOString()}).eq("id",courseId);
 return minutes;
}
function normalizeScormPath(value:unknown){
 const path=String(value||"").replace(/\\/g,"/").replace(/^\/+/,"");
 if(!path||path.split("/").includes("..")||/[\u0000-\u001F]/.test(path))throw new Error("SCORM_UNSAFE_PATH");
 return path;
}
function scormMime(path:string){
 const ext=path.split(".").pop()?.toLowerCase()||"";
 const map:Record<string,string>={html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",js:"application/javascript; charset=utf-8",mjs:"application/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json; charset=utf-8",xml:"application/xml; charset=utf-8",txt:"text/plain; charset=utf-8",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",mp3:"audio/mpeg",mp4:"video/mp4",webm:"video/webm",pdf:"application/pdf",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf"};
 return map[ext]||"application/octet-stream";
}
function parseIsoMinutes(value:string){
 const m=String(value||"").match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
 if(!m)return 0;return Number(m[1]||0)*1440+Number(m[2]||0)*60+Number(m[3]||0)+Number(m[4]||0)/60;
}
function scormManifestInfo(xml:string){
 const lower=xml.toLowerCase();
 if(!/2004|1\.3|adlcp_v1p3|imsss/.test(lower))throw new Error("SCORM_2004_REQUIRED");const packageType="scorm_2004";
 const itemRef=xml.match(/<item\b[^>]*\bidentifierref\s*=\s*["']([^"']+)["']/i)?.[1]||"";
 const resources=[...xml.matchAll(/<resource\b([^>]*)>/gi)].map(match=>{
  const attrs=match[1]||"";return {id:attrs.match(/\bidentifier\s*=\s*["']([^"']+)["']/i)?.[1]||"",href:attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||""};
 }).filter(r=>r.href);
 const resource=resources.find(r=>itemRef&&r.id===itemRef)||resources[0];
 if(!resource?.href)throw new Error("SCORM_LAUNCH_FILE_NOT_FOUND");
 const launchPath=normalizeScormPath(decodeXmlEntities(resource.href));
 const durationCandidates=[
  ...[...xml.matchAll(/\battemptAbsoluteDurationLimit\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1]),
  ...[...xml.matchAll(/<adlcp:maxtimeallowed[^>]*>([^<]+)</gi)].map(x=>x[1]),
 ].map(String);
 let durationMin=0;for(const value of durationCandidates){const iso=parseIsoMinutes(value);if(iso>0){durationMin=iso;break}const hhmmss=value.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);if(hhmmss){durationMin=Number(hhmmss[1])*60+Number(hhmmss[2])+Number(hhmmss[3])/60;break}}
 return {packageType,launchPath,durationMin:durationMin>0?Math.ceil(durationMin):0};
}
async function ingestScormPackage(sb:any,block:any,zipPath:string){
 const download=await sb.storage.from("course-scorm").download(zipPath);if(download.error||!download.data)throw download.error||new Error("SCORM_ZIP_DOWNLOAD_FAILED");
 const bytes=new Uint8Array(await download.data.arrayBuffer());
 const archive=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const files=Object.values(archive.files).filter((entry:any)=>!entry.dir) as any[];
 if(!files.length||files.length>1200)throw new Error("SCORM_PACKAGE_FILE_COUNT_INVALID");
 let total=0;for(const entry of files){const name=normalizeScormPath(entry.name);if(name.toLowerCase().endsWith(".exe")||name.toLowerCase().endsWith(".dll")||name.toLowerCase().endsWith(".bat")||name.toLowerCase().endsWith(".cmd")||name.toLowerCase().endsWith(".ps1"))throw new Error("SCORM_UNSAFE_FILE");total+=Math.max(0,Number(entry?._data?.uncompressedSize||0));if(total>600*1024*1024)throw new Error("SCORM_UNCOMPRESSED_SIZE_LIMIT");}
 const manifestEntry=files.find((entry:any)=>normalizeScormPath(entry.name).toLowerCase().endsWith("imsmanifest.xml"));
 if(!manifestEntry)throw new Error("SCORM_MANIFEST_MISSING");
 const manifestPath=normalizeScormPath(manifestEntry.name);const manifestXml=await manifestEntry.async("string");
 const info=scormManifestInfo(manifestXml);const baseDir=manifestPath.includes("/")?manifestPath.slice(0,manifestPath.lastIndexOf("/")+1):"";
 const launchRelative=normalizeScormPath(`${baseDir}${info.launchPath}`);
 if(!files.some((entry:any)=>normalizeScormPath(entry.name)===launchRelative))throw new Error("SCORM_LAUNCH_FILE_MISSING");
 const prefix=`${block.course_id}/${block.module_id}/${block.lesson_id}/${block.id}/package`;
 const existing=await sb.storage.from("course-scorm").list(prefix,{limit:1000});if(existing.data?.length){const paths=existing.data.filter((x:any)=>x.name).map((x:any)=>`${prefix}/${x.name}`);if(paths.length)await sb.storage.from("course-scorm").remove(paths).catch(()=>{});}
 for(const entry of files){
  const relative=normalizeScormPath(entry.name);const body=await entry.async("uint8array");
  const target=`${prefix}/${relative}`;const uploaded=await sb.storage.from("course-scorm").upload(target,body,{contentType:scormMime(relative),upsert:true,cacheControl:"3600"});if(uploaded.error)throw uploaded.error;
 }
 const old=block.content_json||{};const content={...old,url:null,provider:"scorm_private_proxy",scorm_ready:true,package_type:info.packageType,manifest_path:`${prefix}/${manifestPath}`,launch_path:launchRelative,scorm_package_prefix:prefix,duration_min:info.durationMin||Math.max(0,Number(old.duration_min||0)),duration_source:info.durationMin>0?"manifest":"manual_fallback"};
 const updated=await sb.from("lesson_blocks").update({file_url:zipPath,storage_path:zipPath,bucket_name:"course-scorm",content_json:content,updated_at:new Date().toISOString()}).eq("id",block.id).select("*").single();if(updated.error)throw updated.error;
 await recalculateCourseDuration(sb,String(block.course_id));
 return updated.data;
}


async function triggerCertificate(userId:string,courseId:string,source:string){
 try{
  const url=`${Deno.env.get("SUPABASE_URL")}/functions/v1/certificate-generate`;
  const response=await fetch(url,{method:"POST",headers:omniaInternalHeaders(),body:JSON.stringify({user_id:userId,course_id:courseId,source,internal_request:true})});
  if(!response.ok){const detail=await response.text().catch(()=>"");console.warn("certificate_generate_deferred",response.status,detail.slice(0,500));}
 }catch(error){console.warn("certificate_generate_unavailable",error instanceof Error?error.message:String(error));}
}
async function syncCompetencyLedger(sb:any,att:any,assessment:any,score:number,actorUserId:string,verificationStatus="verified",inputResults:any[]=[]){
 const {data:mappings}=await sb.from("assessment_competency_mappings").select("*,competency:competency_definitions(*),level:competency_levels(*)").eq("assessment_id",assessment.id);
 const passing=Number(assessment.passing_score||70);
 const resultById=new Map<string,any>();const resultByName=new Map<string,any>();
 for(const item of Array.isArray(inputResults)?inputResults:[]){if(item?.competency_id)resultById.set(String(item.competency_id),item);if(item?.competency_name||item?.name)resultByName.set(String(item.competency_name||item.name).trim().toLowerCase(),item);}
 if((mappings||[]).length){
  for(const mapping of mappings||[]){
   const competency=mapping.competency||{};if(!competency.id)continue;
   const submitted=resultById.get(String(competency.id))||resultByName.get(String(competency.name||"").trim().toLowerCase());
   const competencyScore=Number.isFinite(Number(submitted?.score))?Math.min(100,Math.max(0,Number(submitted.score))):score;
   const threshold=Number(mapping.passing_score??passing);const validated=competencyScore>=threshold;
   const publishedAt=new Date().toISOString();let validUntil=null;if(competency.validity_months){const d=new Date(publishedAt);d.setMonth(d.getMonth()+Number(competency.validity_months));validUntil=d.toISOString();}
   const {data:framework}=await sb.from("competency_frameworks").select("version").eq("id",competency.framework_id).maybeSingle();
   await sb.from("assessment_result_competencies").upsert({attempt_id:att.id,assessment_id:assessment.id,user_id:att.user_id,competency_name:String(competency.name),competency_id:competency.id,competency_level_id:mapping.target_level_id||null,framework_version:framework?.version||null,score:competencyScore,status:validated?"validated":"not_validated",verification_status:validated?verificationStatus:"evaluated",valid_until:validUntil,validated_by:validated?actorUserId:null,validated_at:validated?publishedAt:null},{onConflict:"attempt_id,competency_name"});
   await sb.from("learner_competency_records").upsert({user_id:att.user_id,competency_id:competency.id,competency_level_id:mapping.target_level_id||null,source_type:verificationStatus==="jury_validated"?"jury":"assessment",source_id:String(att.id),assessment_id:assessment.id,attempt_id:att.id,score:competencyScore,status:validated?"validated":"not_validated",framework_version:framework?.version||null,valid_from:publishedAt,valid_until:validUntil,evidence:[{type:"assessment",attempt_id:att.id,assessment_id:assessment.id,score:competencyScore}],verified_by:validated?actorUserId:null,verified_at:validated?publishedAt:null,updated_at:publishedAt},{onConflict:"user_id,competency_id,source_type,source_id"});
  }
  return;
 }
 const labels=Array.isArray(assessment.competency_labels)?assessment.competency_labels:[];
 if(labels.length){const rows=labels.map((name:any)=>{const submitted=resultByName.get(String(name).trim().toLowerCase());const competencyScore=Number.isFinite(Number(submitted?.score))?Math.min(100,Math.max(0,Number(submitted.score))):score;return {attempt_id:att.id,assessment_id:assessment.id,user_id:att.user_id,competency_name:String(name),score:competencyScore,status:competencyScore>=passing?"validated":"not_validated",verification_status:competencyScore>=passing?verificationStatus:"evaluated",validated_by:competencyScore>=passing?actorUserId:null,validated_at:competencyScore>=passing?new Date().toISOString():null};});await sb.from("assessment_result_competencies").upsert(rows,{onConflict:"attempt_id,competency_name"});}
}


const DEFAULT_PRICING_RULES:any={
 module_points:2,lesson_points:.5,hour_points:1,
 level_points:{debutant:2,intermediaire:5,avance:8,expert:12},
 validation_points:{qcm:3,projet_soumettre:8,projet_corriger:12},oral_exam_points:6,resource_global_cap:5,
 resources:{pdf_fiche:{points:.5,max:4},url_externe:{points:.3,max:5},glossaire:{points:1,max:1},exercice_pratique:{points:.5,max:3},audio:{points:.5,max:2},template:{points:.7,max:3},etude_de_cas:{points:1,max:2}}
};
const norm=(v:any)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g,"_");
const CATEGORY_ALIASES:Record<string,string>={
 "data_&_ia":"Data & Intelligence Artificielle","intelligence_artificielle":"Data & Intelligence Artificielle","informatique":"Informatique & Développement","informatique_de_gestion":"Informatique & Développement","bureautique_&_productivite":"Informatique & Développement","developpement_web":"Informatique & Développement","cybersecurite":"Cybersécurité & Réseaux","business":"Business & Entrepreneuriat","entrepreneuriat":"Business & Entrepreneuriat","gestion_de_projet":"Business & Entrepreneuriat","management_&_leadership":"Business & Entrepreneuriat","ressources_humaines":"Business & Entrepreneuriat","commerce_international":"Business & Entrepreneuriat","comptabilite_&_finance":"Finance & Comptabilité","finance":"Finance & Comptabilité","comptabilite":"Finance & Comptabilité","fiscalite":"Finance & Comptabilité","banque_&_microfinance":"Finance & Comptabilité","droit":"Droit & Juridique","juridique":"Droit & Juridique","marketing":"Marketing & Communication","marketing_digital":"Marketing & Communication","communication_professionnelle":"Marketing & Communication","vente_&_negociation":"Marketing & Communication","sante":"Santé & Médecine","sante_&_securite_au_travail":"Santé & Médecine","architecture":"Architecture & BTP","education":"Éducation & Pédagogie","langues":"Langues & Linguistique","agriculture":"Agriculture & Agro-business","agriculture_&_agribusiness":"Agriculture & Agro-business","tourisme":"Tourisme & Hôtellerie","energie_&_environnement":"Environnement & Développement durable","environnement":"Environnement & Développement durable","developpement_personnel":"Bien-être & Développement personnel","bien_etre":"Bien-être & Développement personnel","artisanat":"Artisanat & Métiers manuels","cuisine":"Cuisine & Gastronomie","mode":"Mode & Stylisme","elevage":"Élevage & Pêche","arts":"Arts & Créativité","musique":"Musique & Audio","loisirs":"Loisirs & Hobbies"
};
async function settingJson(sb:any,key:string,fallback:any){const {data}=await sb.from("site_settings").select("value").eq("key",key).maybeSingle();if(!data?.value)return fallback;try{return typeof data.value==="string"?{...fallback,...JSON.parse(data.value)}:{...fallback,...data.value}}catch{return fallback}}
async function calculateCoursePricing(sb:any,courseId:string){
 const [{data:course},{data:mods},{data:lessons},{data:blocks},{data:finalAssessment}]=await Promise.all([
  sb.from("courses").select("*").eq("id",courseId).single(),
  sb.from("course_modules").select("id,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId),
  sb.from("course_lessons").select("id,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId),
  sb.from("lesson_blocks").select("block_type").eq("course_id",courseId),
  sb.from("course_assessments").select("*").eq("course_id",courseId).eq("scope","final").maybeSingle()
 ]);
 const rules=await settingJson(sb,"course_pricing_rules",DEFAULT_PRICING_RULES);
 const moduleCount=(mods||[]).filter((x:any)=>!x.is_intro&&!x.is_conclusion&&!x.is_final_exam).length;
 const lessonCount=(lessons||[]).filter((x:any)=>!x.is_intro&&!x.is_module_intro&&!x.is_conclusion&&!x.is_final_exam).length;
 const level=norm(course?.level);const validation=norm(finalAssessment?.assessment_type||finalAssessment?.correction_mode||"qcm");
 const durationHours=Math.max(Number(course?.cpd_hours||0),Number(course?.total_duration_seconds||0)/3600,Number(course?.calculated_duration_minutes||0)/60);
 const resourceAliases:any={pdf:"pdf_fiche",link_button:"url_externe",embed:"url_externe",definition:"glossaire",exercise:"exercice_pratique",assignment_upload:"exercice_pratique",audio:"audio",download:"template",case_study:"etude_de_cas"};
 const resourceCounts:any={};for(const block of blocks||[]){const key=resourceAliases[block.block_type];if(key)resourceCounts[key]=(resourceCounts[key]||0)+1}
 let resourceBonus=0;for(const [key,count] of Object.entries(resourceCounts)){const cfg=rules.resources?.[key];if(cfg)resourceBonus+=Math.min(Number(count),Number(cfg.max||0))*Number(cfg.points||0)}resourceBonus=Math.min(resourceBonus,Number(rules.resource_global_cap||5));
 const breakdown:any={modules:moduleCount*Number(rules.module_points||2),lessons:lessonCount*Number(rules.lesson_points||.5),cpd_hours:durationHours*Number(rules.hour_points||1),level:Number(rules.level_points?.[level]||0),validation:Number(rules.validation_points?.[validation]||rules.validation_points?.qcm||0),oral_exam:String(finalAssessment?.delivery_mode||"")==="oral"?Number(rules.oral_exam_points||6):0,resources_bonus:resourceBonus};
 const subtotal=Object.values(breakdown).reduce((sum:any,value:any)=>Number(sum)+Number(value),0);
 const {data:multipliers}=await sb.from("category_multipliers").select("category_name,multiplier");
 const categoryNorm=norm(course?.category);const alias=CATEGORY_ALIASES[categoryNorm];const categoryRow=(multipliers||[]).find((x:any)=>norm(x.category_name)===categoryNorm||(alias&&x.category_name===alias));const multiplier=Number(categoryRow?.multiplier||1);
 const score=Math.round(subtotal*multiplier*10)/10;
 const {data:tiers}=await sb.from("pricing_tiers").select("id,label,score_min,score_max,price_xof").order("score_min");
 const tier=(tiers||[]).find((x:any)=>score>=Number(x.score_min)&&(x.score_max==null||score<=Number(x.score_max)))||{id:null,label:"Non configuré",price_xof:0};
 return {score,price_xof:Number(tier.price_xof||0),tier_id:tier.id,palier:tier.label,multiplier,multiplier_category:categoryRow?.category_name||course?.category||null,breakdown:{...breakdown,subtotal_before_multiplier:Math.round(subtotal*10)/10,multiplier_applied:multiplier},counts:{modules:moduleCount,lessons:lessonCount,duration_hours:Math.round(durationHours*10)/10,resources:resourceCounts},calculated_at:new Date().toISOString()};
}

const defaults:Record<string,any>={
 heading:{text:"Nouveau titre",level:1,alignment:"left"},subheading:{text:"Sous-titre",level:2,alignment:"left"},text:{html:"<p>Saisissez votre texte ici...</p>"},separator:{style:"line"},callout:{type:"info",content:"Information importante..."},remember:{title:"À retenir",points:[""]},objective:{title:"Objectif pédagogique",html:"<p>À la fin de cette leçon, vous serez capable de...</p>"},example:{title:"Exemple",html:"<p>Décrivez ici un exemple concret...</p>"},summary:{title:"Résumé",html:"<p>Dans cette leçon, vous avez appris...</p>"},image:{url:"",alt:"",caption:""},video:{url:"",eco_data:true},audio:{url:"",description:"",transcription:""},pdf:{url:"",title:"",description:"",downloadable:true},word:{url:"",title:"",description:""},excel:{url:"",title:"",sheet:"",preview_rows:[]},scorm:{url:"",title:"",package_type:"scorm_2004",duration_min:0,duration_source:"automatic",scorm_ready:false},download:{url:"",title:"",description:""},qcm:{question:"",options:["","","",""],correctIndex:0,explanation:""},true_false:{statement:"",answer:true,explanation:""},open_question:{question:"",guidance:"",expected_answer:"",points:10,required:true},exercise:{title:"Exercice",instructions:"",task:"",resources:[],accepted_types:["pdf","doc","docx","xls","xlsx"],learner_upload_required:true,points:20},accordion:{items:[{id:crypto.randomUUID(),title:"Section 1",content:""}]},flashcards:{cards:[{id:crypto.randomUUID(),front:"Recto",back:"Verso"}]},interactive_table:{headers:["Colonne 1","Colonne 2"],rows:[["",""]],style:"table"},timeline:{steps:[{id:crypto.randomUUID(),title:"Étape 1",description:""}]},columns:{columns:[{id:crypto.randomUUID(),content:""},{id:crypto.randomUUID(),content:""}]},important:{title:"Important",html:"<p>Saisissez l’information importante...</p>"},case_study:{context:"",data:"",task:"",questions:[]},definition:{term:"",definition:"",example:""},correction:{title:"Correction",html:"<p>Saisissez ici la correction détaillée...</p>",key_points:[]},bullet_list:{items:[""]},numbered_list:{items:[""]},quote:{text:"Citation ou témoignage",author:""},code:{language:"text",code:""},checklist:{items:[{id:crypto.randomUUID(),text:"Action à réaliser",checked:false}]},link_button:{label:"Ouvrir le lien",url:"",open_new_tab:true},embed:{url:"",title:"Contenu intégré"},gallery:{images:[]},formula:{latex:""},chart:{chart_type:"bar",labels:["A","B"],values:[0,0]},assignment_upload:{title:"Travail à remettre",instructions:"",accepted_types:["pdf","docx"],max_size_mb:10},rubric:{criteria:[{name:"Critère 1",description:"",points:10}]}
};


type RegistryAssetResolution = {
 organization_id?: string | null;
 recognition_partner_id?: string | null;
 recognition_program_id?: string | null;
 logo_permission_id?: string | null;
 certification_type: string;
 organization_name: string;
 certification_name: string;
 credit_value?: number | null;
 credit_unit?: string | null;
 logo_url?: string | null;
 badge_url?: string | null;
 signature_url?: string | null;
 stamp_url?: string | null;
 verification_url?: string | null;
 partner_website_url?: string | null;
 partner_description?: string | null;
 course_logo_authorized: boolean;
 certificate_logo_authorized: boolean;
 permission_snapshot: Record<string, unknown>;
};

function permissionIsCurrent(row:any){
 const today=new Date().toISOString().slice(0,10);
 return row?.status==='authorized'&&(!row.valid_from||row.valid_from<=today)&&(!row.valid_until||row.valid_until>=today);
}

async function certificationOrganizationOptions(sb:any,courseId:string){
 const options:any[]=[];
 const {data:organizations}=await sb.from('certification_organizations').select('*').eq('is_active',true).order('name');
 for(const org of organizations||[]){
  options.push({key:`organization:${org.id}`,source:'certification_organization',organization_id:org.id,name:org.name,type:org.organization_type||'other',logo_url:org.logo_authorized&&org.course_display_authorized?org.logo_url:null,badge_url:org.logo_authorized&&org.certificate_display_authorized?org.badge_url:null,signature_url:org.certificate_display_authorized?org.signature_url:null,stamp_url:org.certificate_display_authorized?org.stamp_url:null,website_url:org.website_url||org.verification_url||null,description:org.description||null,course_logo_authorized:!!(org.logo_authorized&&org.course_display_authorized),certificate_logo_authorized:!!(org.logo_authorized&&org.certificate_display_authorized),default_certification_name:org.organization_type==='omnia'?'Certification Omnia':null});
 }
 const {data:partners}=await sb.from('recognition_partners').select('*').eq('status','active').order('name');
 for(const partner of partners||[]){
  const {data:programs}=await sb.from('recognition_programs').select('*').eq('partner_id',partner.id).eq('status','approved').or(`course_id.eq.${courseId},course_id.is.null`).order('course_id',{ascending:false}).order('created_at',{ascending:false});
  const {data:permissions}=await sb.from('recognition_logo_permissions').select('*').eq('partner_id',partner.id).in('scope',['course','certificate']);
  const current=(permissions||[]).filter(permissionIsCurrent);
  const basePrograms=(programs||[]).length?programs:[null];
  for(const program of basePrograms){
   const relevant=current.filter((perm:any)=>!perm.program_id||!program?.id||perm.program_id===program.id);
   const coursePermission=relevant.find((perm:any)=>perm.scope==='course');
   const certificatePermission=relevant.find((perm:any)=>perm.scope==='certificate');
   options.push({key:`partner:${partner.id}:${program?.id||'general'}`,source:'recognition_partner',recognition_partner_id:partner.id,recognition_program_id:program?.id||null,name:partner.name,type:partner.partner_type==='cpd'?'cpd':'partner',logo_url:coursePermission?partner.logo_url:null,badge_url:certificatePermission?partner.logo_url:null,website_url:partner.website||null,description:partner.description||null,course_logo_authorized:!!coursePermission,certificate_logo_authorized:!!certificatePermission,default_certification_name:program?.certificate_label||program?.title||null,credit_value:program?.credit_value??null,credit_unit:program?.credit_unit||null});
  }
 }
 return options;
}

async function resolveCertificationRegistry(sb:any,courseId:string,input:any):Promise<RegistryAssetResolution>{
 const organizationId=String(input.organization_id||'').trim();
 if(organizationId){
  const {data:org,error}=await sb.from('certification_organizations').select('*').eq('id',organizationId).eq('is_active',true).maybeSingle();
  if(error)throw error;if(!org)throw new Error('CERTIFICATION_ORGANIZATION_NOT_FOUND');
  const courseAuthorized=!!(org.logo_authorized&&org.course_display_authorized);
  const certificateAuthorized=!!(org.logo_authorized&&org.certificate_display_authorized);
  return {organization_id:org.id,recognition_partner_id:org.recognition_partner_id||null,certification_type:org.organization_type||input.type||'other',organization_name:org.name,certification_name:String(input.certification_name||'').trim(),credit_value:input.credit_value==null?null:Number(input.credit_value),credit_unit:input.credit_unit||null,logo_url:courseAuthorized?org.logo_url:null,badge_url:certificateAuthorized?(org.badge_url||org.logo_url):null,signature_url:certificateAuthorized?org.signature_url:null,stamp_url:certificateAuthorized?org.stamp_url:null,verification_url:String(input.verification_url||org.verification_url||org.website_url||'').trim()||null,partner_website_url:org.website_url||null,partner_description:org.description||null,course_logo_authorized:courseAuthorized,certificate_logo_authorized:certificateAuthorized,permission_snapshot:{source:'certification_organization',organization_id:org.id,logo_authorized:!!org.logo_authorized,course_display_authorized:!!org.course_display_authorized,certificate_display_authorized:!!org.certificate_display_authorized,authorization_snapshot:org.authorization_snapshot||{}}};
 }
 const partnerId=String(input.recognition_partner_id||'').trim();
 if(partnerId){
  const {data:partner,error}=await sb.from('recognition_partners').select('*').eq('id',partnerId).eq('status','active').maybeSingle();if(error)throw error;if(!partner)throw new Error('RECOGNITION_PARTNER_NOT_FOUND');
  const programId=String(input.recognition_program_id||'').trim();let program:any=null;
  if(programId){const result=await sb.from('recognition_programs').select('*').eq('id',programId).eq('partner_id',partnerId).eq('status','approved').maybeSingle();if(result.error)throw result.error;program=result.data;if(!program)throw new Error('RECOGNITION_PROGRAM_NOT_APPROVED');if(program.course_id&&program.course_id!==courseId)throw new Error('RECOGNITION_PROGRAM_COURSE_MISMATCH');}
  const {data:permissions}=await sb.from('recognition_logo_permissions').select('*').eq('partner_id',partnerId).in('scope',['course','certificate']);
  const relevant=(permissions||[]).filter((perm:any)=>permissionIsCurrent(perm)&&(!perm.program_id||!programId||perm.program_id===programId));
  const coursePermission=relevant.find((perm:any)=>perm.scope==='course');const certificatePermission=relevant.find((perm:any)=>perm.scope==='certificate');
  return {recognition_partner_id:partner.id,recognition_program_id:program?.id||null,logo_permission_id:(certificatePermission||coursePermission)?.id||null,certification_type:partner.partner_type==='cpd'?'cpd':String(input.type||'partner'),organization_name:partner.name,certification_name:String(input.certification_name||program?.certificate_label||program?.title||'').trim(),credit_value:input.credit_value==null?(program?.credit_value??null):Number(input.credit_value),credit_unit:input.credit_unit||program?.credit_unit||null,logo_url:coursePermission?partner.logo_url:null,badge_url:certificatePermission?partner.logo_url:null,verification_url:String(input.verification_url||partner.website||'').trim()||null,partner_website_url:partner.website||null,partner_description:partner.description||null,course_logo_authorized:!!coursePermission,certificate_logo_authorized:!!certificatePermission,permission_snapshot:{source:'recognition_partner',partner_id:partner.id,program_id:program?.id||null,course_permission:coursePermission||null,certificate_permission:certificatePermission||null,captured_at:new Date().toISOString()}};
 }
 return {certification_type:String(input.type||'other'),organization_name:String(input.organization_name||'').trim(),certification_name:String(input.certification_name||'').trim(),credit_value:input.credit_value==null?null:Number(input.credit_value),credit_unit:input.credit_unit||null,logo_url:null,badge_url:null,signature_url:null,stamp_url:null,verification_url:String(input.verification_url||'').trim()||null,partner_website_url:null,partner_description:null,course_logo_authorized:false,certificate_logo_authorized:false,permission_snapshot:{source:'custom_request',assets_blocked_until_admin_validation:true,captured_at:new Date().toISOString()}};
}


type CourseImportQuestion={question:string;options:string[];correctIndex:number;explanation?:string};
type CourseImportLesson={title:string;objective?:string;content:string;summary?:string;questions?:CourseImportQuestion[]};
type CourseImportModule={title:string;objective?:string;lessons:CourseImportLesson[]};
type CourseImportBlueprint={title:string;short_description:string;objectives:string[];target_audience:string;learning_outcomes:string[];modules:CourseImportModule[]};

const COURSE_IMPORT_BUCKET="course-imports";
const COURSE_IMPORT_MAX_BYTES=25*1024*1024;
const COURSE_IMPORT_MAX_TEXT=120000;
const COURSE_IMPORT_ALLOWED=new Set(["pdf","docx","xlsx","zip","txt","md","csv"]);
const COURSE_IMPORT_DANGEROUS=new Set(["exe","dll","msi","bat","cmd","com","scr","ps1","psm1","vbs","js","mjs","cjs","jar","apk","ipa","sh","php","py","rb"]);

function importExtension(name:string){const clean=String(name||"").split(/[?#]/)[0];const part=clean.split(".").pop();return part&&part!==clean?part.toLowerCase():""}
function safeImportName(name:string){const ext=importExtension(name);const base=String(name||"document").replace(/\.[^.]+$/,"" ).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"document";return ext?`${base}.${ext}`:base}
function cleanImportedText(value:string){return String(value||"").replace(/\u0000/g,"").replace(/\r\n?/g,"\n").replace(/[\t ]+\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").replace(/[ \t]{2,}/g," ").trim().slice(0,COURSE_IMPORT_MAX_TEXT)}
function decodeXmlEntities(value:string){return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))}
function stripOfficeXml(xml:string){return cleanImportedText(decodeXmlEntities(xml.replace(/<w:tab\/?\s*>/gi,"\t").replace(/<w:br\/?\s*>/gi,"\n").replace(/<\/w:p>/gi,"\n").replace(/<\/w:tr>/gi,"\n").replace(/<\/w:tc>/gi,"\t").replace(/<[^>]+>/g," ")))}
function escapeHtml(value:string){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function textToHtml(value:string){const paragraphs=cleanImportedText(value).split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).slice(0,80);return paragraphs.map(p=>`<p>${escapeHtml(p).replace(/\n/g,"<br>")}</p>`).join("")||"<p>Contenu à vérifier et compléter.</p>"}
function titleFromFilename(name:string){return String(name||"Nouvelle formation").replace(/\.[^.]+$/,"" ).replace(/[_-]+/g," ").replace(/\s+/g," ").trim().slice(0,500)||"Nouvelle formation"}
function firstSentence(value:string,max=240){const clean=cleanImportedText(value);const sentence=clean.split(/(?<=[.!?])\s+/)[0]||clean;return sentence.slice(0,max)}
function stringList(value:any,limit=12){return (Array.isArray(value)?value:[]).map(x=>String(x||"").trim()).filter(Boolean).slice(0,limit)}

async function extractPdfText(bytes:Uint8Array){
 const document=await getDocumentProxy(bytes);const extracted=await extractPdfDocumentText(document,{mergePages:true});
 return cleanImportedText(Array.isArray(extracted.text)?extracted.text.join("\n\n"):String(extracted.text||""));
}
async function extractDocxText(bytes:Uint8Array){
 const archive=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const names=Object.keys(archive.files).filter(name=>/^word\/(document|header\d+|footer\d+)\.xml$/i.test(name)).slice(0,30);
 const parts:string[]=[];for(const name of names){const file=archive.file(name);if(file)parts.push(stripOfficeXml(await file.async("string")))}
 return cleanImportedText(parts.join("\n\n"));
}
function extractXlsxText(bytes:Uint8Array){
 const workbook=XLSX.read(bytes,{type:"array",cellDates:false});const parts:string[]=[];
 for(const sheetName of workbook.SheetNames.slice(0,30)){
  const sheet=workbook.Sheets[sheetName];if(!sheet)continue;
  const csv=XLSX.utils.sheet_to_csv(sheet,{FS:"\t",RS:"\n",blankrows:false});
  if(csv.trim())parts.push(`Feuille : ${sheetName}\n${csv}`);
 }
 return cleanImportedText(parts.join("\n\n"));
}
async function extractZipText(bytes:Uint8Array,depth=0){
 if(depth>1)throw new Error("Les archives ZIP imbriquées ne sont pas prises en charge.");
 const archive=await JSZip.loadAsync(bytes,{checkCRC32:true});const entries=Object.values(archive.files).filter((entry:any)=>!entry.dir);
 if(entries.length>60)throw new Error("L’archive contient trop de fichiers. Limite : 60.");
 let expanded=0;const parts:string[]=[];let supportedCount=0;
 for(const entry of entries as any[]){
  const normalized=String(entry.name||"").replace(/\\/g,"/");
  if(normalized.startsWith("/")||normalized.split("/").includes(".."))throw new Error("L’archive contient un chemin de fichier non sécurisé.");
  const extension=importExtension(normalized);
  if(COURSE_IMPORT_DANGEROUS.has(extension))throw new Error(`Fichier dangereux refusé dans l’archive : ${normalized}`);
  if(!COURSE_IMPORT_ALLOWED.has(extension))continue;
  const size=Number(entry?._data?.uncompressedSize||0);expanded+=Math.max(0,size);
  if(expanded>40*1024*1024)throw new Error("Le contenu décompressé dépasse la limite de sécurité de 40 Mo.");
  const nestedBytes=await entry.async("uint8array");const text=await extractCourseImportText(nestedBytes,normalized,depth+1);
  if(text.trim()){parts.push(`DOCUMENT : ${normalized}\n${text}`);supportedCount++}
  if(parts.join("\n\n").length>=COURSE_IMPORT_MAX_TEXT||supportedCount>=20)break;
 }
 if(!supportedCount)throw new Error("L’archive ne contient aucun document pris en charge.");
 return cleanImportedText(parts.join("\n\n"));
}
async function extractCourseImportText(bytes:Uint8Array,name:string,depth=0){
 const extension=importExtension(name);if(!COURSE_IMPORT_ALLOWED.has(extension))throw new Error("Format de fichier non pris en charge.");
 if(extension==="pdf")return await extractPdfText(bytes);
 if(extension==="docx")return await extractDocxText(bytes);
 if(extension==="xlsx")return extractXlsxText(bytes);
 if(extension==="zip")return await extractZipText(bytes,depth);
 return cleanImportedText(new TextDecoder("utf-8",{fatal:false}).decode(bytes));
}

function heuristicImportBlueprint(text:string,suggestedTitle:string):CourseImportBlueprint{
 const clean=cleanImportedText(text);const rawLines=clean.split("\n").map(x=>x.trim()).filter(Boolean);
 const modules:CourseImportModule[]=[];let currentModule:CourseImportModule={title:"Module 1",objective:"Comprendre et appliquer les notions du document importé",lessons:[]};
 let lessonTitle="Leçon 1";let buffer:string[]=[];
 const flushLesson=()=>{const content=cleanImportedText(buffer.join("\n"));if(!content)return;currentModule.lessons.push({title:lessonTitle,objective:firstSentence(content,180),content,summary:firstSentence(content,320)});buffer=[];lessonTitle=`Leçon ${currentModule.lessons.length+1}`};
 const flushModule=()=>{flushLesson();if(currentModule.lessons.length)modules.push(currentModule);currentModule={title:`Module ${modules.length+1}`,objective:"Approfondir les notions extraites du document",lessons:[]};lessonTitle="Leçon 1"};
 for(const line of rawLines){
  const moduleMatch=line.match(/^(module|partie|chapitre)\s*([0-9ivx.-]*)\s*[:\-–]?\s*(.*)$/i);
  const lessonMatch=line.match(/^(le[cç]on|section|unit[eé])\s*([0-9ivx.-]*)\s*[:\-–]?\s*(.*)$/i);
  if(moduleMatch&&line.length<180){flushModule();currentModule.title=(moduleMatch[3]||line).trim().slice(0,500);continue}
  if(lessonMatch&&line.length<180){flushLesson();lessonTitle=(lessonMatch[3]||line).trim().slice(0,500);continue}
  buffer.push(line);
  if(buffer.join(" ").length>3500)flushLesson();
 }
 flushModule();
 if(!modules.length){
  const chunks=clean.match(/[\s\S]{1,3200}(?:\s|$)/g)||[clean];
  const lessons=chunks.filter(Boolean).slice(0,18).map((chunk,index)=>({title:`Leçon ${index+1}`,objective:firstSentence(chunk,180),content:cleanImportedText(chunk),summary:firstSentence(chunk,320)}));
  for(let index=0;index<lessons.length;index+=3)modules.push({title:`Module ${Math.floor(index/3)+1}`,objective:"Étudier les contenus importés et les mettre en pratique",lessons:lessons.slice(index,index+3)});
 }
 const bounded=modules.slice(0,8).map((module,index)=>({...module,title:module.title||`Module ${index+1}`,lessons:module.lessons.slice(0,10)}));
 const title=suggestedTitle.trim()||titleFromFilename(suggestedTitle)||"Formation importée";
 return {title,short_description:`Brouillon créé à partir d’un document importé. ${firstSentence(clean,260)}`.slice(0,500),objectives:["Comprendre les notions principales du document importé","Appliquer les acquis dans des situations pratiques"],target_audience:"Public à préciser par le créateur",learning_outcomes:["Identifier les notions essentielles","Mettre en pratique les contenus étudiés"],modules:bounded};
}

function normalizeImportBlueprint(value:any,fallback:CourseImportBlueprint):CourseImportBlueprint{
 const source=value&&typeof value==="object"?value:{};const modules=(Array.isArray(source.modules)?source.modules:[]).slice(0,8).map((module:any,moduleIndex:number)=>({
  title:String(module?.title||`Module ${moduleIndex+1}`).trim().slice(0,500),
  objective:String(module?.objective||"").trim().slice(0,2000),
  lessons:(Array.isArray(module?.lessons)?module.lessons:[]).slice(0,10).map((lesson:any,lessonIndex:number)=>({
   title:String(lesson?.title||`Leçon ${lessonIndex+1}`).trim().slice(0,500),objective:String(lesson?.objective||"").trim().slice(0,1000),content:cleanImportedText(String(lesson?.content||lesson?.text||"" )).slice(0,7000),summary:cleanImportedText(String(lesson?.summary||"" )).slice(0,1200),questions:(Array.isArray(lesson?.questions)?lesson.questions:[]).slice(0,2).map((question:any)=>({question:String(question?.question||"").trim().slice(0,1000),options:stringList(question?.options,4).map(x=>x.slice(0,500)),correctIndex:Math.min(3,Math.max(0,Number(question?.correctIndex)||0)),explanation:String(question?.explanation||"").trim().slice(0,1500)})).filter((question:any)=>question.question&&question.options.length===4)
  })).filter((lesson:any)=>lesson.content)
 })).filter((module:any)=>module.lessons.length);
 return {title:String(source.title||fallback.title).trim().slice(0,500)||fallback.title,short_description:String(source.short_description||fallback.short_description).trim().slice(0,500),objectives:stringList(source.objectives,12).length?stringList(source.objectives,12):fallback.objectives,target_audience:String(source.target_audience||fallback.target_audience).trim().slice(0,2000),learning_outcomes:stringList(source.learning_outcomes,12).length?stringList(source.learning_outcomes,12):fallback.learning_outcomes,modules:modules.length?modules:fallback.modules};
}
async function aiImportBlueprint(text:string,fallback:CourseImportBlueprint){
 const key=getAnthropicApiKey();if(!key)return {blueprint:fallback,ai_used:false};
 const excerpt=cleanImportedText(text).slice(0,50000);const prompt=`Transforme le contenu suivant en brouillon de formation éditable. N'invente aucun fait. Réponds uniquement avec un JSON valide, sans Markdown, conforme à ce schéma : {"title":"","short_description":"","objectives":[""],"target_audience":"","learning_outcomes":[""],"modules":[{"title":"","objective":"","lessons":[{"title":"","objective":"","content":"texte brut","summary":"","questions":[{"question":"","options":["","","",""],"correctIndex":0,"explanation":""}]}]}]}. Limites : 8 modules, 10 leçons par module, 2 QCM par leçon. Les questions sont facultatives si le contenu ne permet pas une réponse certaine. Le résultat reste un brouillon non publié.\n\nTITRE SUGGÉRÉ : ${fallback.title}\n\nCONTENU :\n${excerpt}`;
 try{
  const response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:getAnthropicFastModel(),max_tokens:5000,messages:[{role:"user",content:prompt}]})});
  if(!response.ok)return {blueprint:fallback,ai_used:false};const output=await response.json();const raw=String(output?.content?.[0]?.text||"");const start=raw.indexOf("{");const end=raw.lastIndexOf("}");if(start<0||end<=start)return {blueprint:fallback,ai_used:false};
  return {blueprint:normalizeImportBlueprint(JSON.parse(raw.slice(start,end+1)),fallback),ai_used:true};
 }catch{return {blueprint:fallback,ai_used:false}}
}
async function sha256Hex(bytes:Uint8Array){const input=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;const digest=await crypto.subtle.digest("SHA-256",input);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("")}

async function createImportedCourse(sb:any,userId:string,creatorContext:string,blueprint:CourseImportBlueprint,source:any,aiUsed:boolean){
 let structureId:string|null=null;if(creatorContext==="structure"){const access=await validatedStructureAccess(sb,userId);if(!access)throw new Error("STRUCTURE_NOT_VALIDATED");if(!hasStructurePermission(access,"can_create_courses"))throw new Error("STRUCTURE_COURSE_PERMISSION_REQUIRED");structureId=access.organizationId}
 const thresholdDefaults=await settingJson(sb,"assessment_threshold_defaults",{lesson_passing_score:80,module_passing_score:80,final_passing_score:70,competency_mastery_score:80,default_retry_cooldown_hours:24,default_remediation_after_attempts:3});
 const wordCount=blueprint.modules.flatMap(module=>module.lessons).reduce((sum,lesson)=>sum+cleanImportedText(lesson.content).split(/\s+/).filter(Boolean).length,0);
 const learningDesign={delivery_mode:"self_paced",drip_enabled:false,drip_interval_days:7,cohort_start_at:null,estimated_effort_hours:0,completion_policy:"all_required",require_sequential_progress:true,require_video_completion:false,accessibility:{captions:false,transcript:false,keyboard_checked:false,contrast_checked:false,alt_text_checked:false},learner_persona:"",success_outcome:"",import_source:{bucket:source.bucket,path:source.path,name:source.name,mime:source.mime,size:source.size,sha256:source.sha256,imported_at:new Date().toISOString(),ai_assisted:aiUsed}};
 const insert:any={title:blueprint.title||"Formation importée",creator_id:userId,instructor_id:userId,creator_context:creatorContext,structure_id:structureId,template_used:"file_import",studio_mode:"simple",studio_status:"draft",is_published:false,short_description:blueprint.short_description||"Brouillon créé depuis un fichier",long_description:"",language:"fr",prerequisites:"",objectives:blueprint.objectives,target_audience:blueprint.target_audience,learning_outcomes:blueprint.learning_outcomes,course_intro_title:"Bienvenue dans cette formation",course_intro_summary:"Cette formation a été préparée depuis un document importé. Vérifiez chaque contenu avant soumission.",free_preview_mode:"introduction",lesson_passing_score:Math.min(100,Math.max(1,Number(thresholdDefaults.lesson_passing_score??80))),module_passing_score:Math.min(100,Math.max(1,Number(thresholdDefaults.module_passing_score??80))),final_passing_score:Math.min(100,Math.max(1,Number(thresholdDefaults.final_passing_score??70))),assessment_policy:{default_retry_cooldown_hours:Number(thresholdDefaults.default_retry_cooldown_hours??24),default_remediation_after_attempts:Number(thresholdDefaults.default_remediation_after_attempts??3),competency_mastery_score:Number(thresholdDefaults.competency_mastery_score??80)},learning_design_settings:learningDesign,quality_status:"incomplete",ready_to_submit:false,current_version:"1.0",word_count:wordCount,estimated_read_min:Math.max(1,Math.ceil(wordCount/200))};
 if(creatorContext==="super_admin")insert.creator_type="plateforme";
 const {data:course,error:courseError}=await sb.from("courses").insert(insert).select("*").single();if(courseError)throw courseError;
 const moduleRows:any[]=[];
 const {data:introModule,error:introModuleError}=await sb.from("course_modules").insert({course_id:course.id,title:"Introduction",objective:"Présenter la formation importée et les vérifications attendues",position:-1,is_intro:true}).select("*").single();if(introModuleError)throw introModuleError;
 const {data:introLesson,error:introLessonError}=await sb.from("course_lessons").insert({course_id:course.id,module_id:introModule.id,title:"Bienvenue dans cette formation",position:0,is_intro:true}).select("*").single();if(introLessonError)throw introLessonError;
 const introBlocks=[{block_type:"heading",content_json:{text:"Bienvenue dans cette formation",level:1,alignment:"left"}},{block_type:"text",content_json:{html:"<p>Ce brouillon a été généré depuis un fichier. Contrôlez les titres, les explications, les évaluations et les droits d’utilisation avant toute soumission.</p>"}},{block_type:"callout",content_json:{type:"warning",content:`Document source : ${escapeHtml(source.name)}. Aucune publication automatique n’a été effectuée.`}}];
 for(const [position,block] of introBlocks.entries()){const {error}=await sb.from("lesson_blocks").insert({course_id:course.id,module_id:introModule.id,lesson_id:introLesson.id,block_type:block.block_type,position,content_json:block.content_json,settings_json:{},source_type:"file_import",ai_generated:false,created_by:userId});if(error)throw error}
 moduleRows.push({...introModule,lessons:[{...introLesson,has_blocks:true,block_count:introBlocks.length}]});
 for(const [moduleIndex,module] of blueprint.modules.entries()){
  const {data:moduleRow,error:moduleError}=await sb.from("course_modules").insert({course_id:course.id,title:module.title||`Module ${moduleIndex+1}`,objective:module.objective||"",position:moduleIndex,is_intro:false}).select("*").single();if(moduleError)throw moduleError;const lessonRows:any[]=[];
  for(const [lessonIndex,lesson] of module.lessons.entries()){
   const {data:lessonRow,error:lessonError}=await sb.from("course_lessons").insert({course_id:course.id,module_id:moduleRow.id,title:lesson.title||`Leçon ${lessonIndex+1}`,position:lessonIndex,is_intro:false,is_module_intro:false,content_text:lesson.content,lesson_summary:lesson.summary||""}).select("*").single();if(lessonError)throw lessonError;
   const blocks:any[]=[{block_type:"heading",content_json:{text:lesson.title||`Leçon ${lessonIndex+1}`,level:1,alignment:"left"}}];
   if(lesson.objective)blocks.push({block_type:"objective",content_json:{title:"Objectif pédagogique",html:textToHtml(lesson.objective)}});
   blocks.push({block_type:"text",content_json:{html:textToHtml(lesson.content)}});
   if(lesson.summary)blocks.push({block_type:"summary",content_json:{title:"Résumé",html:textToHtml(lesson.summary)}});
   for(const question of lesson.questions||[])blocks.push({block_type:"qcm",content_json:{question:question.question,options:question.options,correctIndex:question.correctIndex,explanation:question.explanation||""}});
   for(const [position,block] of blocks.entries()){const {error}=await sb.from("lesson_blocks").insert({course_id:course.id,module_id:moduleRow.id,lesson_id:lessonRow.id,block_type:block.block_type,position,content_json:block.content_json,settings_json:{draft_from_import:true},source_type:"file_import",ai_generated:aiUsed,created_by:userId});if(error)throw error}
   lessonRows.push({...lessonRow,has_blocks:true,block_count:blocks.length});
  }
  moduleRows.push({...moduleRow,lessons:lessonRows});
 }
 await log(sb,course.id,userId,"course_import_completed",{source_name:source.name,source_mime:source.mime,source_size:source.size,source_sha256:source.sha256,ai_used:aiUsed,module_count:blueprint.modules.length,lesson_count:blueprint.modules.reduce((sum,module)=>sum+module.lessons.length,0),draft_only:true});
 return {course,modules:moduleRows,summary:{modules:blueprint.modules.length,lessons:blueprint.modules.reduce((sum,module)=>sum+module.lessons.length,0),questions:blueprint.modules.reduce((sum,module)=>sum+module.lessons.reduce((lessonSum,lesson)=>lessonSum+(lesson.questions?.length||0),0),0),ai_used:aiUsed,draft_only:true}};
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const b=await req.json(); const action=b.action;

  // Action publique : aperçu gratuit de l’introduction avant achat.
  if(action==="public_course_preview"){
   const courseId=String(b.course_id||""); if(!courseId)return json({success:false,error:"COURSE_ID_REQUIRED"},400);
   const {data:course,error:courseError}=await sb.from("courses").select("id,title,short_description,long_description,cover_image_url,category,level,language,target_audience,objectives,learning_outcomes,course_intro_title,course_intro_summary,sale_mode,desired_price_amount,sale_currency,free_preview_mode,studio_status,is_published,creator_id,current_version").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const token=(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
   const viewerId=token?await sessionUser(sb,req):null; const viewerRoles=viewerId?await roles(sb,viewerId):[];
   const privileged=!!viewerId&&(viewerId===course.creator_id||viewerRoles.includes("super_admin"));
   if(!course.is_published&&!privileged)return json({success:false,error:"NOT_FOUND"},404);
   const {data:modules,error:moduleError}=await sb.from("course_modules").select("id,title,objective,position,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");if(moduleError)throw moduleError;
   const moduleIds=(modules||[]).map((m:any)=>m.id);
   const {data:lessons,error:lessonError}=moduleIds.length?await sb.from("course_lessons").select("id,module_id,title,position,is_intro,is_module_intro,is_conclusion,is_final_exam").in("module_id",moduleIds).order("position"):{data:[],error:null};if(lessonError)throw lessonError;
   const introLesson=(lessons||[]).find((l:any)=>l.is_intro);
   let blocks:any[]=[];
   if(course.free_preview_mode!=="none"&&introLesson){const {data,error}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,settings_json,file_url,file_name,file_size,file_mime,storage_path,bucket_name").eq("lesson_id",introLesson.id).order("position");if(error)throw error;blocks=await Promise.all((data||[]).map((row:any)=>decorateStudioBlock(sb,row)))}
   const program=(modules||[]).filter((m:any)=>!m.is_intro).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id&&!l.is_module_intro).map((l:any)=>({id:l.id,title:l.title,position:l.position,locked:true}))}));
   return json({success:true,course,preview_enabled:course.free_preview_mode!=="none",introduction:introLesson?{...introLesson,blocks}:null,program,privileged});
  }

  const userId=await sessionUser(sb,req,String(b.session_token||"")); if(!userId)return json({success:false,error:"AUTH_REQUIRED"},401);
  const userRoles=await roles(sb,userId); const isAdmin=userRoles.includes("super_admin");

  // Gouvernance Studio 4D fusionnée dans studio-unified afin d'économiser un emplacement Edge Function.
  if(action==="health"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("studio_course_health").select("*").order("updated_at",{ascending:false});if(error)throw error;
   const rows=(data||[]).map((x:any)=>{
     const issues:string[]=[];
     if(x.never_purchased)issues.push("Jamais achetée");
     if(x.high_abandon)issues.push("Abandon élevé");
     if(x.certification_expiring)issues.push("Certification à renouveler");
     if(Number(x.pending_assisted||0)>0)issues.push("Saisie assistée en attente");
     if(x.stale_content)issues.push("Contenu ancien");
     const health_evaluable=Boolean(x.is_published)||Number(x.enrollments||0)>0||issues.length>0;
     const score=health_evaluable?Math.max(0,100-issues.length*20):null;
     return {...x,issues,score,health_evaluable};
   });
   return json({success:true,rows,summary:{
     total:rows.length,
     critical:rows.filter((x:any)=>x.health_evaluable&&Number(x.score)<60).length,
     healthy:rows.filter((x:any)=>x.health_evaluable&&Number(x.score)>=80).length,
     pending_assisted:rows.reduce((n:number,x:any)=>n+Number(x.pending_assisted||0),0)
   }});
  }
  if(action==="audit"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   let q=sb.from("course_audit_log").select("*,users:actor_id(full_name,email),courses(title)").order("created_at",{ascending:false}).limit(300);
   if(b.course_id)q=q.eq("course_id",b.course_id);if(b.audit_action)q=q.eq("action",b.audit_action);
   const {data,error}=await q;if(error)throw error;return json({success:true,rows:data||[]});
  }
  if(action==="structure_dashboard"){
   const structureRoles=["structure","responsable_structure","gestionnaire_structure","gestionnaire_partenaire","structure_admin","directeur","etablissement_directeur"];
   if(!isAdmin&&!userRoles.some((r:string)=>structureRoles.includes(r)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:manager,error:managerError}=await sb.from("partner_managers").select("organization_id,status").eq("user_id",userId).in("status",["actif","active"]).order("is_primary",{ascending:false}).limit(1).maybeSingle();
   if(managerError)throw managerError;
   let organization:any=null;
   if(manager?.organization_id){
    const {data,error}=await sb.from("partner_organizations").select("id,org_name,org_type,status,logo_url,admin_comment,modification_note").eq("id",manager.organization_id).maybeSingle();if(error)throw error;organization=data;
   }
   if(!manager?.organization_id)return json({success:false,error:"NO_ACTIVE_STRUCTURE"},404);
   const organizationId=String(manager.organization_id);
   const [memberCountResult,codeCountResult,courseCountResult,pendingResult]=await Promise.all([
    sb.from("partner_code_users").select("id",{count:"exact",head:true}).eq("organization_id",organizationId).in("status",["validated","approved","active","actif"]),
    sb.from("partner_codes").select("id",{count:"exact",head:true}).eq("organization_id",organizationId).in("status",["validated","active","actif"]),
    sb.from("courses").select("id",{count:"exact",head:true}).eq("structure_id",organizationId),
    sb.from("partner_code_users").select("id,user_id,code_id,status,created_at,users:user_id(id,full_name,email)").eq("organization_id",organizationId).eq("status","pending").order("created_at",{ascending:false}).limit(8),
   ]);
   for(const result of [memberCountResult,codeCountResult,courseCountResult,pendingResult])if(result.error)throw result.error;
   const pendingMembers=(pendingResult.data||[]).map((row:any)=>({...row,requested_at:row.created_at}));
   return json({success:true,structure:organization?{id:organization.id,name:organization.org_name,display_name:organization.org_name,structure_type:organization.org_type||"autre",status:organization.status||"pending_validation",status_label:organization.status||"pending_validation",logo_url:organization.logo_url,admin_comment:organization.admin_comment,modification_note:organization.modification_note}:null,stats:{members:memberCountResult.count||0,active_codes:codeCountResult.count||0,courses:courseCountResult.count||0},pending_members:pendingMembers});
  }
  if(action==="admin_catalogue"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("courses")
    .select("id,title,studio_status,category,level,is_published,creator_context,updated_at,submitted_at,assisted_status,certification_requested,current_version")
    .order("updated_at",{ascending:false});
   if(error)throw error;
   return json({success:true,courses:data||[]});
  }
  if(action==="admin_list_external_courses"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("external_courses").select("*").order("display_order").order("created_at",{ascending:false});if(error)throw error;return json({success:true,courses:data||[]});
  }
  if(action==="admin_save_external_course"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const input=b.course||{};const id=String(input.id||"").trim();const externalUrl=String(input.external_url||"").trim();
   const registrationUrl=String(input.registration_url||"").trim();const contactEmail=String(input.contact_email||"").trim().toLowerCase();const contactPhone=String(input.contact_phone||"").trim();
   const accessMode=["public","registered","premium","paid"].includes(String(input.access_mode))?String(input.access_mode):"public";
   const deliveryMethods=Array.isArray(input.delivery_methods)?[...new Set(input.delivery_methods.map((x:any)=>String(x)).filter((x:string)=>["private_link","access_code","manual_registration"].includes(x)))]:[];
   const accessCodeMode=["none","provider","personal"].includes(String(input.access_code_mode))?String(input.access_code_mode):"none";
   const priceXof=Math.max(0,Math.round(Number(input.price_xof||0)));
   const registrationDeadline=String(input.registration_deadline||"").trim()||null;
   if(!String(input.title||"").trim()||!String(input.provider_name||"").trim()||!/^https:\/\//i.test(externalUrl))return json({success:false,error:"INVALID_EXTERNAL_COURSE",message:"Titre, fournisseur et URL HTTPS valides sont obligatoires."},400);
   if(registrationUrl&&!/^https:\/\//i.test(registrationUrl))return json({success:false,error:"INVALID_REGISTRATION_URL",message:"Le lien d’inscription doit utiliser HTTPS."},400);
   if(contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return json({success:false,error:"INVALID_CONTACT_EMAIL",message:"L’email de contact est invalide."},400);
   if(accessMode==="paid"){
    if(priceXof<=0)return json({success:false,error:"EXTERNAL_COURSE_PRICE_REQUIRED",message:"Indiquez un prix supérieur à zéro pour une formation externe payante."},400);
    if(!deliveryMethods.length)return json({success:false,error:"DELIVERY_METHOD_REQUIRED",message:"Choisissez au moins un mode d’accès après paiement."},400);
    if(deliveryMethods.includes("private_link")&&!/^https:\/\//i.test(String(input.private_access_url||"").trim()))return json({success:false,error:"PRIVATE_ACCESS_URL_REQUIRED",message:"Le lien privé HTTPS est requis pour ce mode d’accès."},400);
    if(deliveryMethods.includes("access_code")&&accessCodeMode==="none")return json({success:false,error:"ACCESS_CODE_MODE_REQUIRED",message:"Choisissez code fournisseur ou code personnel."},400);
    if(deliveryMethods.includes("access_code")&&accessCodeMode==="provider"&&!String(input.provider_access_code||"").trim())return json({success:false,error:"PROVIDER_ACCESS_CODE_REQUIRED",message:"Le code fournisseur est requis."},400);
   }
   const contentUsageConfirmed=input.content_usage_confirmed===true;
   if(String(input.status)==="published"){
    if(!contentUsageConfirmed)return json({success:false,error:"EXTERNAL_COURSE_VERIFICATION_REQUIRED",message:"Confirmez la vérification du lien, des conditions d’accès et des droits d’utilisation avant publication."},400);
    if(!registrationDeadline)return json({success:false,error:"REGISTRATION_DEADLINE_REQUIRED",message:"La date limite d’inscription est requise avant publication."},400);
    if(!registrationUrl&&!contactEmail&&!contactPhone)return json({success:false,error:"REGISTRATION_CONTACT_REQUIRED",message:"Indiquez un lien d’inscription ou un contact avant publication."},400);
   }
   const payload:any={
    title:String(input.title).trim().slice(0,500),short_description:String(input.short_description||"").trim().slice(0,4000)||null,provider_name:String(input.provider_name).trim().slice(0,240),external_url:externalUrl.slice(0,3000),cover_image_url:String(input.cover_image_url||"").trim().slice(0,3000)||null,category:String(input.category||"").trim().slice(0,200)||null,level:String(input.level||"").trim().slice(0,100)||null,language:String(input.language||"fr").trim().slice(0,20),duration_label:String(input.duration_label||"").trim().slice(0,100)||null,total_duration_seconds:Math.max(0,Math.round(Number(input.total_duration_seconds||0))),certificate_available:!!input.certificate_available,
    is_free:accessMode==="paid"?false:input.is_free!==false,access_mode:accessMode,premium_benefit_key:"external_course_premium_access",status:["draft","published","archived"].includes(String(input.status))?String(input.status):"draft",is_featured:!!input.is_featured,display_order:Math.round(Number(input.display_order||0)),admin_notes:String(input.admin_notes||"").trim().slice(0,4000)||null,content_usage_confirmed:contentUsageConfirmed,
    registration_deadline:registrationDeadline,registration_url:registrationUrl.slice(0,3000)||null,contact_name:String(input.contact_name||"").trim().slice(0,240)||null,contact_email:contactEmail.slice(0,320)||null,contact_phone:contactPhone.slice(0,80)||null,contact_address:String(input.contact_address||"").trim().slice(0,2000)||null,
    price_xof:accessMode==="paid"?priceXof:0,delivery_methods:accessMode==="paid"?deliveryMethods:[],private_access_url:accessMode==="paid"&&deliveryMethods.includes("private_link")?String(input.private_access_url||"").trim().slice(0,3000)||null:null,access_code_mode:accessMode==="paid"&&deliveryMethods.includes("access_code")?accessCodeMode:"none",provider_access_code:accessMode==="paid"&&deliveryMethods.includes("access_code")&&accessCodeMode==="provider"?String(input.provider_access_code||"").trim().slice(0,500)||null:null,
    updated_by:userId,updated_at:new Date().toISOString()
   };
   if(contentUsageConfirmed){payload.last_verified_at=new Date().toISOString();payload.last_verified_by=userId;}
   if(payload.status==="published")payload.published_at=new Date().toISOString();
   const result=id?await sb.from("external_courses").update(payload).eq("id",id).select("*").single():await sb.from("external_courses").insert({...payload,created_by:userId}).select("*").single();if(result.error)throw result.error;
   await sb.from("course_audit_log").insert({actor_id:userId,action:id?"external_course_updated":"external_course_created",entity_type:"external_course",entity_id:result.data.id,metadata:{provider_name:payload.provider_name,access_mode:payload.access_mode,status:payload.status,price_xof:payload.price_xof,delivery_methods:payload.delivery_methods}}).then(()=>{}).catch(()=>{});
   return json({success:true,course:result.data});
  }
  if(action==="admin_archive_external_course"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);const id=String(b.external_course_id||"");if(!id)return json({success:false,error:"ID_REQUIRED"},400);
   const {data,error}=await sb.from("external_courses").update({status:"archived",updated_by:userId,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();if(error)throw error;return json({success:true,course:data});
  }
  if(action==="admin_list_external_access_grants"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   let q=sb.from("external_course_access_grants").select("*").order("created_at",{ascending:false}).limit(300);
   if(b.external_course_id)q=q.eq("external_course_id",String(b.external_course_id));
   const {data:grants,error}=await q;if(error)throw error;
   const userIds=[...new Set((grants||[]).map((x:any)=>x.user_id).filter(Boolean))];const courseIds=[...new Set((grants||[]).map((x:any)=>x.external_course_id).filter(Boolean))];
   const [usersResult,coursesResult]=await Promise.all([userIds.length?sb.from("users").select("id,full_name,email").in("id",userIds):Promise.resolve({data:[]}),courseIds.length?sb.from("external_courses").select("id,title,provider_name,delivery_methods,access_code_mode").in("id",courseIds):Promise.resolve({data:[]})]);
   if((usersResult as any).error)throw (usersResult as any).error;if((coursesResult as any).error)throw (coursesResult as any).error;
   const users=new Map(((usersResult as any).data||[]).map((x:any)=>[String(x.id),x]));const courses=new Map(((coursesResult as any).data||[]).map((x:any)=>[String(x.id),x]));
   return json({success:true,grants:(grants||[]).map((x:any)=>({...x,user:users.get(String(x.user_id))||null,course:courses.get(String(x.external_course_id))||null}))});
  }
  if(action==="admin_update_external_access_grant"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const grantId=String(b.grant_id||"");const status=String(b.status||"");if(!grantId||!["registration_in_progress","access_ready","revoked"].includes(status))return json({success:false,error:"INVALID_GRANT_UPDATE"},400);
   const {data:current,error:readError}=await sb.from("external_course_access_grants").select("*").eq("id",grantId).maybeSingle();if(readError)throw readError;if(!current)return json({success:false,error:"GRANT_NOT_FOUND"},404);
   const {data:course,error:courseError}=await sb.from("external_courses").select("delivery_methods,access_code_mode").eq("id",current.external_course_id).maybeSingle();if(courseError)throw courseError;if(!course)return json({success:false,error:"EXTERNAL_COURSE_NOT_FOUND"},404);
   const privateUrl=String(b.private_access_url??current.private_access_url??"").trim();const accessCode=String(b.access_code??current.access_code??"").trim();
   if(privateUrl&&!/^https:\/\//i.test(privateUrl))return json({success:false,error:"INVALID_PRIVATE_ACCESS_URL"},400);
   const methods=Array.isArray(course.delivery_methods)?course.delivery_methods.map((x:any)=>String(x)):[];
   if(status==="access_ready"&&methods.includes("private_link")&&!privateUrl)return json({success:false,error:"PRIVATE_ACCESS_URL_REQUIRED",message:"Renseignez le lien privé avant de marquer l’accès comme prêt."},400);
   if(status==="access_ready"&&methods.includes("access_code")&&String(course.access_code_mode)==="personal"&&!accessCode)return json({success:false,error:"PERSONAL_ACCESS_CODE_REQUIRED",message:"Renseignez le code personnel avant de marquer l’accès comme prêt."},400);
   if(status==="access_ready"&&methods.includes("access_code")&&String(course.access_code_mode)==="provider"&&!accessCode)return json({success:false,error:"PROVIDER_ACCESS_CODE_REQUIRED",message:"Le code fournisseur est manquant pour cet accès."},400);
   const update:any={status,private_access_url:privateUrl||null,access_code:accessCode||null,admin_note:String(b.admin_note||"").trim().slice(0,2000)||null,updated_by:userId,updated_at:new Date().toISOString(),ready_at:status==="access_ready"?(current.ready_at||new Date().toISOString()):null};
   const {data,error}=await sb.from("external_course_access_grants").update(update).eq("id",grantId).select("*").single();if(error)throw error;
   await sb.from("course_audit_log").insert({actor_id:userId,action:"external_course_access_updated",entity_type:"external_course_access",entity_id:grantId,metadata:{external_course_id:current.external_course_id,user_id:current.user_id,status}}).then(()=>{}).catch(()=>{});
   return json({success:true,grant:data});
  }
  if(action==="get_my_courses"){
   const context=String(b.creator_context||"").trim();
   let q=sb.from("courses").select("id,title,studio_status,category,level,cover_image_url,creator_id,creator_context,structure_id,created_at,updated_at,word_count,estimated_read_min,last_autosave_at,admin_comment,template_used,submitted_at").order("updated_at",{ascending:false});
   if(!isAdmin) q=q.eq("creator_id",userId);
   if(context) q=q.eq("creator_context",context);
   const {data,error}=await q;if(error)throw error;return json({success:true,courses:data||[]});
  }
  if(action==="delete_course"){
   const courseId=String(b.course_id||""); if(!courseId)return json({success:false,error:"COURSE_ID_REQUIRED"},400);
   const {data:course,error:readError}=await sb.from("courses").select("id,title,creator_id,studio_status,creator_context").eq("id",courseId).maybeSingle();
   if(readError)throw readError;if(!course)return json({success:false,error:"NOT_FOUND"},404);
   if(!isAdmin&&course.creator_id!==userId)return json({success:false,error:"FORBIDDEN"},403);
   if(!isAdmin&&String(course.creator_context||"")==="structure"&&!(await owns(sb,userId,courseId,"can_edit_courses")))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);
   if(!isAdmin&&!["draft","brouillon"].includes(String(course.studio_status||"")))return json({success:false,error:"ONLY_DRAFT_CAN_BE_DELETED",message:"Seuls les brouillons peuvent être supprimés par leur créateur."},409);
   if(b.creator_context&&course.creator_context!==b.creator_context)return json({success:false,error:"CONTEXT_MISMATCH"},403);
   if(isAdmin){
     const [{count:enrollments},{count:certificates},{count:orders}]=await Promise.all([
       sb.from("user_enrollments").select("course_id",{count:"exact",head:true}).eq("course_id",courseId),
       sb.from("certificates").select("course_id",{count:"exact",head:true}).eq("course_id",courseId),
       sb.from("orders").select("course_id",{count:"exact",head:true}).eq("course_id",courseId)
     ]);
     if(Number(enrollments||0)>0||Number(certificates||0)>0||Number(orders||0)>0)
       return json({success:false,error:"COURSE_HAS_BUSINESS_HISTORY",message:"Cette formation possède des inscriptions, certificats ou commandes et ne peut pas être supprimée définitivement."},409);
   }
   await log(sb,courseId,userId,"course_deleted",{creator_context:course.creator_context,title:course.title});
   const {error}=await sb.from("courses").delete().eq("id",courseId);if(error)throw error;
   return json({success:true});
  }
  if(action==="get_pending_courses"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("courses").select("id,title,studio_status,category,level,cover_image_url,creator_id,submitted_at,updated_at,admin_comment,word_count").eq("studio_status","pending_validation").order("submitted_at",{ascending:true});if(error)throw error;return json({success:true,courses:data||[]});
  }
  if(action==="create_course"){
   const requestedStructureContext=String(b.creator_context||"")==="structure";
   if(requestedStructureContext&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access)return json({success:false,error:"STRUCTURE_NOT_VALIDATED"},403);if(!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);}
   if(b.client_draft_key){
    const requestedContext=["professeur","structure","super_admin"].includes(String(b.creator_context))?String(b.creator_context):(isAdmin?"super_admin":"professeur");
    const {data:existing}=await sb.from("courses").select("*").eq("creator_id",userId).eq("creator_context",requestedContext).eq("client_draft_key",b.client_draft_key).maybeSingle();
    if(existing){
      const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",existing.id).order("position");
      const ids=(mods||[]).map((m:any)=>m.id); const {data:lessons}=ids.length?await sb.from("course_lessons").select("*").in("module_id",ids).order("position"):{data:[]};
      return json({success:true,course:existing,modules:(mods||[]).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id)})),reused:true});
    }
   }
   const requestedCreatorContext=["professeur","structure","super_admin"].includes(String(b.creator_context))?String(b.creator_context):(isAdmin?"super_admin":"professeur");
   // Anti-doublon serveur : protège contre un double clic / double requête lorsque la clé client n'a pas encore été persistée.
   if(!b.client_draft_key && String(b.title||"").trim()){
     const since=new Date(Date.now()-15000).toISOString();
     const {data:recent}=await sb.from("courses")
       .select("*")
       .eq("creator_id",userId)
       .eq("creator_context",requestedCreatorContext)
       .eq("studio_status","draft")
       .eq("title",String(b.title).trim())
       .gte("created_at",since)
       .order("created_at",{ascending:false})
       .limit(1)
       .maybeSingle();
     if(recent){
       const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",recent.id).order("position");
       const ids=(mods||[]).map((m:any)=>m.id);
       const {data:lessons}=ids.length?await sb.from("course_lessons").select("*").in("module_id",ids).order("position"):{data:[]};
       return json({success:true,course:recent,modules:(mods||[]).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id)})),reused:true});
     }
   }
   const creatorContext=requestedCreatorContext;
   let structureId:string|null=null;
   if(creatorContext==="structure"){const access=await validatedStructureAccess(sb,userId);if(!access)return json({success:false,error:"STRUCTURE_NOT_VALIDATED"},403);if(!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);structureId=access.organizationId;}
   const thresholdDefaults=await settingJson(sb,"assessment_threshold_defaults",{lesson_passing_score:80,module_passing_score:80,final_passing_score:70,competency_mastery_score:80,default_retry_cooldown_hours:24,default_remediation_after_attempts:3});
   const insert:any={
    title:b.title||"Nouvelle formation",creator_id:userId,instructor_id:userId,creator_context:creatorContext,structure_id:structureId,client_draft_key:b.client_draft_key||null,template_used:b.template_used||"simple_textual",
    studio_mode:b.studio_mode||"simple",studio_status:"draft",short_description:b.short_description||"",
    long_description:b.long_description||"",category:b.category||null,level:b.level||null,language:b.language||"fr",
    prerequisites:b.prerequisites||"",objectives:b.objectives||[],target_audience:b.target_audience||"",
    learning_outcomes:b.learning_outcomes||[],cover_image_url:b.cover_image_url||null,
    cover_image_prompt:b.cover_image_prompt||"",course_intro_title:b.course_intro_title||"Bienvenue dans cette formation",
    course_intro_summary:b.course_intro_summary||"",free_preview_mode:"introduction",
    lesson_passing_score:Math.min(100,Math.max(1,Number(b.lesson_passing_score??thresholdDefaults.lesson_passing_score??80))),module_passing_score:Math.min(100,Math.max(1,Number(b.module_passing_score??thresholdDefaults.module_passing_score??80))),final_passing_score:Math.min(100,Math.max(1,Number(b.final_passing_score??thresholdDefaults.final_passing_score??70))),
    assessment_policy:{default_retry_cooldown_hours:Number(thresholdDefaults.default_retry_cooldown_hours??24),default_remediation_after_attempts:Number(thresholdDefaults.default_remediation_after_attempts??3),competency_mastery_score:Number(thresholdDefaults.competency_mastery_score??80)},
    learning_design_settings:b.learning_design_settings||{delivery_mode:"self_paced",drip_enabled:false,drip_interval_days:7,cohort_start_at:null,estimated_effort_hours:0,completion_policy:"all_required",require_sequential_progress:true,require_video_completion:false,accessibility:{captions:false,transcript:false,keyboard_checked:false,contrast_checked:false,alt_text_checked:false},learner_persona:"",success_outcome:""},
    quality_status:"incomplete",ready_to_submit:false,current_version:"1.0"
   };
   if(creatorContext==="super_admin")insert.creator_type="plateforme";
   const {data,error}=await sb.from("courses").insert(insert).select("*").single(); if(error)throw error;
   let modules:any[]=[];
   if(b.create_introduction!==false){
    const {data:introModule,error:moduleError}=await sb.from("course_modules").insert({course_id:data.id,title:"Introduction",objective:"Présenter la formation et préparer l’apprenant",position:-1,is_intro:true}).select("*").single();if(moduleError)throw moduleError;
    const {data:introLesson,error:lessonError}=await sb.from("course_lessons").insert({course_id:data.id,module_id:introModule.id,title:b.course_intro_title||"Bienvenue dans cette formation",position:0,is_intro:true}).select("*").single();if(lessonError)throw lessonError;
    const introBlocks=[
      {block_type:"heading",content_json:{text:b.course_intro_title||"Bienvenue dans cette formation",level:1,alignment:"left"}},
      {block_type:"text",content_json:{html:`<p>${String(b.course_intro_summary||"Présentez ici le fonctionnement de la formation et les conseils pour réussir.").replace(/[<>]/g,"")}</p>`}},
      {block_type:"objective",content_json:{text:"Découvrez les objectifs, le déroulement et les ressources de cette formation."}}
    ];
    for(const [i,blk] of introBlocks.entries()) await sb.from("lesson_blocks").insert({course_id:data.id,module_id:introModule.id,lesson_id:introLesson.id,block_type:blk.block_type,position:i,content_json:blk.content_json,settings_json:{},created_by:userId});
    modules=[{...introModule,lessons:[{...introLesson,has_blocks:true,block_count:introBlocks.length}]}];
   }
   await log(sb,data.id,userId,"course_created",{template:data.template_used}); return json({success:true,course:data,modules});
  }

  if(action==="prepare_course_import_upload"){
   const requestedContext=String(b.creator_context||"");
   const creatorContext=requestedContext==="structure"?"structure":((requestedContext==="admin"||requestedContext==="super_admin")&&isAdmin?"super_admin":"professeur");
   if(creatorContext==="structure"&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access)return json({success:false,error:"STRUCTURE_NOT_VALIDATED"},403);if(!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);}
   const originalName=String(b.original_name||"").trim();const extension=importExtension(originalName);const fileSize=Number(b.file_size||0);
   if(!originalName||!COURSE_IMPORT_ALLOWED.has(extension))return json({success:false,error:"UNSUPPORTED_IMPORT_FORMAT",message:"Utilisez PDF, DOCX, XLSX, ZIP, TXT, MD ou CSV."},400);
   if(fileSize<=0||fileSize>COURSE_IMPORT_MAX_BYTES)return json({success:false,error:"IMPORT_SIZE_INVALID",message:"Le fichier doit être compris entre 1 octet et 25 Mo."},400);
   const safeName=safeImportName(originalName);const path=`imports/${userId}/${crypto.randomUUID()}/${safeName}`;
   const {data,error}=await sb.storage.from(COURSE_IMPORT_BUCKET).createSignedUploadUrl(path,{upsert:false});if(error)throw error;
   return json({success:true,signedUrl:data.signedUrl,token:data.token,path,bucket:COURSE_IMPORT_BUCKET,creator_context:creatorContext,max_bytes:COURSE_IMPORT_MAX_BYTES,allowed_extensions:Array.from(COURSE_IMPORT_ALLOWED)});
  }
  if(action==="convert_course_import"){
   const requestedContext=String(b.creator_context||"");
   const creatorContext=requestedContext==="structure"?"structure":((requestedContext==="admin"||requestedContext==="super_admin")&&isAdmin?"super_admin":"professeur");
   if(creatorContext==="structure"&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access)return json({success:false,error:"STRUCTURE_NOT_VALIDATED"},403);if(!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);}
   const bucket=String(b.bucket_name||"");const path=String(b.storage_path||"");const originalName=String(b.original_name||"").trim();const extension=importExtension(originalName);const declaredSize=Number(b.file_size||0);
   if(bucket!==COURSE_IMPORT_BUCKET||!path.startsWith(`imports/${userId}/`))return json({success:false,error:"INVALID_IMPORT_PATH",message:"Le fichier importé n’appartient pas à cette session."},403);
   if(!COURSE_IMPORT_ALLOWED.has(extension))return json({success:false,error:"UNSUPPORTED_IMPORT_FORMAT",message:"Format de fichier non pris en charge."},400);
   if(declaredSize<=0||declaredSize>COURSE_IMPORT_MAX_BYTES)return json({success:false,error:"IMPORT_SIZE_INVALID",message:"Le fichier dépasse la limite autorisée."},400);
   let createdCourseId:string|null=null;
   try{
    const {data:blob,error:downloadError}=await sb.storage.from(bucket).download(path);if(downloadError||!blob)throw downloadError||new Error("IMPORT_DOWNLOAD_FAILED");
    const bytes=new Uint8Array(await blob.arrayBuffer());if(bytes.byteLength<=0||bytes.byteLength>COURSE_IMPORT_MAX_BYTES)throw new Error("La taille réelle du fichier est invalide.");
    const sourceHash=await sha256Hex(bytes);
    const {data:recentLogs}=await sb.from("course_studio_logs").select("course_id,details").eq("user_id",userId).eq("action","course_import_completed").order("created_at",{ascending:false}).limit(100);
    const duplicate=(recentLogs||[]).find((row:any)=>String(row?.details?.source_sha256||"")===sourceHash);
    if(duplicate)return json({success:false,error:"DUPLICATE_IMPORT",message:"Ce fichier a déjà servi à créer un brouillon.",course_id:duplicate.course_id},409);
    const extracted=await extractCourseImportText(bytes,originalName);
    if(extracted.length<80)throw new Error("Aucun texte exploitable n’a été détecté. Pour un PDF scanné, utilisez un fichier contenant du texte sélectionnable.");
    const requestedTitle=String(b.title||"").trim()||titleFromFilename(originalName);const fallback=heuristicImportBlueprint(extracted,requestedTitle);fallback.title=requestedTitle;
    const generated=b.allow_ai===true?await aiImportBlueprint(extracted,fallback):{blueprint:fallback,ai_used:false};const blueprint=normalizeImportBlueprint(generated.blueprint,fallback);
    const source={bucket,path,name:originalName,mime:String(b.file_mime||blob.type||"application/octet-stream"),size:bytes.byteLength,sha256:sourceHash};
    const created=await createImportedCourse(sb,userId,creatorContext,blueprint,source,generated.ai_used);createdCourseId=created.course.id;
    return json({success:true,...created,message:"Brouillon créé. Vérifiez chaque contenu avant de le soumettre."});
   }catch(error){
    if(createdCourseId)await sb.from("courses").delete().eq("id",createdCourseId).then(()=>{}).catch(()=>{});
    await sb.storage.from(bucket).remove([path]).then(()=>{}).catch(()=>{});
    throw error;
   }
  }
  const courseId=b.course_id;
  if(["admin_validate","admin_publish","admin_request_changes","admin_reject","admin_archive"].includes(action)){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const map:any={admin_validate:"validated",admin_publish:"published",admin_request_changes:"changes_requested",admin_reject:"rejected",admin_archive:"archived"};
   const status=map[action]; const updates:any={studio_status:status,admin_comment:b.comment||null,updated_at:new Date().toISOString()};
   if(action==="admin_validate"){updates.validated_at=new Date().toISOString();updates.validated_by=userId}
   if(action==="admin_publish")updates.is_published=true;
   if(action==="admin_reject"||action==="admin_request_changes")updates.is_published=false;
   const {data,error}=await sb.from("courses").update(updates).eq("id",courseId).select("*").single();if(error)throw error;await log(sb,courseId,userId,action,{comment:b.comment||""});return json({success:true,course:data});
  }
  if(courseId && !["learner_get_assessment","learner_submit_assessment","prepare_assessment_submission_upload","learner_complete_remediation"].includes(action) && !(await owns(sb,userId,courseId,coursePermissionForAction(action))))return json({success:false,error:"FORBIDDEN"},403);
  if(action==="ensure_special_sections"){
   const {data:courseSettings}=await sb.from("courses").select("final_passing_score").eq("id",courseId).maybeSingle();const finalPassing=Math.min(100,Math.max(1,Number(courseSettings?.final_passing_score||70)));
   const {data:existing}=await sb.from("course_modules").select("*").eq("course_id",courseId).or("is_conclusion.eq.true,is_final_exam.eq.true");
   const result:any[]=[];
   if(!(existing||[]).some((m:any)=>m.is_conclusion)){
    const {data:m,error}=await sb.from("course_modules").insert({course_id:courseId,title:"Conclusion",objective:"Synthétiser la formation et préparer l’évaluation finale",position:9000,is_intro:false,is_conclusion:true,is_final_exam:false}).select("*").single();if(error)throw error;
    const {data:l}=await sb.from("course_lessons").insert({course_id:courseId,module_id:m.id,title:"Conclusion de la formation",position:0,is_conclusion:true,is_final_exam:false}).select("*").single();
    await sb.from("lesson_blocks").insert([{course_id:courseId,module_id:m.id,lesson_id:l.id,block_type:"heading",position:0,content_json:{text:"Conclusion",html:"Conclusion",level:1},settings_json:{},created_by:userId},{course_id:courseId,module_id:m.id,lesson_id:l.id,block_type:"summary",position:1,content_json:{title:"Résumé final",html:"<p>Résumez les acquis essentiels de la formation...</p>"},settings_json:{},created_by:userId}]); result.push(m);
   }
   if(!(existing||[]).some((m:any)=>m.is_final_exam)){
    const {data:m,error}=await sb.from("course_modules").insert({course_id:courseId,title:"Examen final",objective:"Évaluer les acquis de toute la formation",position:10000,is_intro:false,is_conclusion:false,is_final_exam:true}).select("*").single();if(error)throw error;
    const {data:l}=await sb.from("course_lessons").insert({course_id:courseId,module_id:m.id,title:"Examen final",position:0,is_conclusion:false,is_final_exam:true}).select("*").single();
    await sb.from("lesson_blocks").insert({course_id:courseId,module_id:m.id,lesson_id:l.id,block_type:"heading",position:0,content_json:{text:"Examen final",html:"Examen final",level:1},settings_json:{assessment_scope:"final",passing_score:finalPassing},created_by:userId}); result.push(m);
   }
   await log(sb,courseId,userId,"special_sections_ensured"); return json({success:true,created:result});
  }
  if(action==="get_course"){
   const {data:course}=await sb.from("courses").select("*").eq("id",courseId).maybeSingle(); if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const ids=(mods||[]).map((m:any)=>m.id); const {data:lessons}=ids.length?await sb.from("course_lessons").select("*").in("module_id",ids).order("position"):{data:[]};
   const lsIds=(lessons||[]).map((l:any)=>l.id); let counts:any[]=[]; if(lsIds.length){const {data}=await sb.from("lesson_blocks").select("lesson_id").in("lesson_id",lsIds);counts=data||[]}
   const modules=(mods||[]).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id).map((l:any)=>({...l,has_blocks:counts.some(x=>x.lesson_id===l.id),block_count:counts.filter(x=>x.lesson_id===l.id).length}))}));
   return json({success:true,course,modules});
  }
  if(action==="create_module"){
   const {data:normalMods}=await sb.from("course_modules").select("id").eq("course_id",courseId).eq("is_intro",false);
   const normalCount=(normalMods||[]).length;
   const {data,error}=await sb.from("course_modules").insert({course_id:courseId,title:b.title||`Module ${normalCount+1}`,objective:b.objective||"",position:normalCount,is_intro:false}).select("*").single();if(error)throw error;
   let introLesson:any=null;
   if(b.create_module_introduction!==false){
    const {data:lesson,error:lessonError}=await sb.from("course_lessons").insert({course_id:courseId,module_id:data.id,title:"Présentation du module",position:-1,is_intro:false,is_module_intro:true}).select("*").single();if(lessonError)throw lessonError;
    introLesson={...lesson,has_blocks:false,block_count:0};
   }
   await log(sb,courseId,userId,"module_created",{module_id:data.id,with_introduction:!!introLesson});return json({success:true,module:data,intro_lesson:introLesson});
  }
  if(action==="create_lesson"){
   const {data:normalLessons}=await sb.from("course_lessons").select("id").eq("module_id",b.module_id).eq("is_module_intro",false);const count=(normalLessons||[]).length;
   const {data,error}=await sb.from("course_lessons").insert({course_id:courseId,module_id:b.module_id,title:b.title||`Leçon ${count+1}`,position:count,is_intro:false,is_module_intro:false}).select("*").single();if(error)throw error;await log(sb,courseId,userId,"lesson_created",{lesson_id:data.id});return json({success:true,lesson:{...data,has_blocks:false,block_count:0}});
  }
  if(action==="get_blocks"){const {data,error}=await sb.from("lesson_blocks").select("*").eq("lesson_id",b.lesson_id).order("position");if(error)throw error;const blocks=await Promise.all((data||[]).map((row:any)=>decorateStudioBlock(sb,row)));return json({success:true,blocks})}
  if(action==="create_block"){
   const {count}=await sb.from("lesson_blocks").select("id",{count:"exact",head:true}).eq("lesson_id",b.lesson_id);const pos=Number.isInteger(b.position)?b.position:(count||0);
   const {data,error}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:b.module_id,lesson_id:b.lesson_id,block_type:b.block_type,position:pos,content_json:b.content_json||defaults[b.block_type]||{},settings_json:b.settings_json||{},created_by:userId,ai_generated:!!b.ai_generated,source_type:b.ai_generated?"ai":"manual"}).select("*").single();if(error)throw error;await recalculateCourseDuration(sb,courseId);await log(sb,courseId,userId,"block_created",{block_id:data.id,type:data.block_type});return json({success:true,block:data});
  }
  if(action==="update_block"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id,storage_path,bucket_name,content_json,block_type").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id,"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const allowed:any={updated_at:new Date().toISOString()};for(const k of ["title","content_json","settings_json","file_url","file_name","file_size","file_mime","source_type","ai_generated"])if(b[k]!==undefined)allowed[k]=b[k];
   const incomingContent=allowed.content_json&&typeof allowed.content_json==="object"?allowed.content_json:null;const streamUid=String(incomingContent?.cloudflare_stream_uid||blk.content_json?.cloudflare_stream_uid||"").trim();
   if(streamUid){allowed.file_url=null;allowed.content_json={...(blk.content_json||{}),...(incomingContent||{}),url:null,provider:"cloudflare_stream",cloudflare_stream_uid:streamUid};}
   else if(PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||""))&&blk.storage_path){allowed.file_url=String(blk.storage_path);if(incomingContent)allowed.content_json={...incomingContent,url:String(blk.storage_path)};}
   const {data,error}=await sb.from("lesson_blocks").update(allowed).eq("id",b.block_id).select("*").single();if(error)throw error;await recalculateCourseDuration(sb,String(blk.course_id));return json({success:true,block:await decorateStudioBlock(sb,data)});
  }
  if(action==="delete_block"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id,lesson_id,content_json,storage_path,bucket_name").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id,"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);const streamUid=String(blk.content_json?.cloudflare_stream_uid||"").trim();await sb.from("lesson_blocks").delete().eq("id",b.block_id);if(streamUid){await deleteStreamVideo(streamUid).catch(()=>{});const {data:remainingVideos}=await sb.from("lesson_blocks").select("content_json,position").eq("lesson_id",blk.lesson_id).eq("block_type","video").order("position",{ascending:false});const nextUid=String((remainingVideos||[]).map((row:any)=>row?.content_json?.cloudflare_stream_uid).find((value:any)=>String(value||"").trim())||"").trim()||null;await sb.from("course_lessons").update({cloudflare_stream_uid:nextUid,updated_at:new Date().toISOString()}).eq("id",blk.lesson_id);}if(blk.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||"")))await sb.storage.from(String(blk.bucket_name)).remove([String(blk.storage_path)]).then(()=>{}).catch(()=>{});await recalculateCourseDuration(sb,String(blk.course_id));await log(sb,blk.course_id,userId,"block_deleted",{block_id:b.block_id,stream_deleted:!!streamUid});return json({success:true});
  }
  if(action==="reorder_blocks"){
   const ids=b.ordered_ids||[];for(let i=0;i<ids.length;i++)await sb.from("lesson_blocks").update({position:i,updated_at:new Date().toISOString()}).eq("id",ids[i]).eq("lesson_id",b.lesson_id);return json({success:true});
  }
  if(action==="update_course"||action==="autosave"){
   const updates:any={updated_at:new Date().toISOString()};for(const k of ["title","short_description","long_description","category","level","language","prerequisites","objectives","target_audience","learning_outcomes","cover_image_url","cover_image_prompt","course_intro_title","course_intro_summary","studio_mode","template_used","word_count","sale_mode","desired_price_amount","sale_currency","promotion_price_amount","structure_payment_mode","structure_fixed_amount","certification_requested","is_assisted","assisted_status","assisted_request_id","learning_design_settings","lesson_passing_score","module_passing_score","final_passing_score","assessment_policy"])if(b[k]!==undefined)updates[k]=b[k]; updates.free_preview_mode="introduction";if(b.word_count!==undefined)updates.estimated_read_min=Math.max(1,Math.ceil(Number(b.word_count)/200));if(action==="autosave")updates.last_autosave_at=new Date().toISOString();
   const {data,error}=await sb.from("courses").update(updates).eq("id",courseId).select("*").single();if(error)throw error;if(action!=="autosave")await log(sb,courseId,userId,"course_updated");return json({success:true,course:data});
  }
  if(action==="apply_template"){
   const {data:t}=await sb.from("course_studio_templates").select("*").eq("key",b.template_key).eq("is_active",true).maybeSingle();if(!t)return json({success:false,error:"TEMPLATE_NOT_FOUND"},404);
   if(b.replace_existing){await sb.from("course_modules").delete().eq("course_id",courseId).eq("is_intro",false)}
   for(const [mi,m] of (t.blueprint.modules||[]).entries()){
    const {data:mod}=await sb.from("course_modules").insert({course_id:courseId,title:m.title,objective:m.objective||"",position:mi,is_intro:false}).select("*").single();
    await sb.from("course_lessons").insert({course_id:courseId,module_id:mod.id,title:"Présentation du module",position:-1,is_intro:false,is_module_intro:true});
    for(const [li,l] of (m.lessons||[]).entries()){
     const {data:lesson}=await sb.from("course_lessons").insert({course_id:courseId,module_id:mod.id,title:l.title,position:li,is_intro:false,is_module_intro:false}).select("*").single();
     for(const [bi,type] of (l.blocks||[]).entries())await sb.from("lesson_blocks").insert({course_id:courseId,module_id:mod.id,lesson_id:lesson.id,block_type:type,position:bi,content_json:defaults[type]||{},settings_json:{},created_by:userId});
    }
   }
   await sb.from("courses").update({template_used:b.template_key,studio_mode:t.mode,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"template_applied",{template:b.template_key});return json({success:true});
  }

  if(action==="ensure_assessments"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course,error:courseError}=await sb.from("courses").select("id,title,creator_id,studio_status,lesson_passing_score,module_passing_score,final_passing_score,assessment_policy,certification_requested,requested_cpd,cpd_accredited").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;
   if(!course)return json({success:false,error:"NOT_FOUND"},404);
   if(!isAdmin&&["pending_validation","validated","published"].includes(String(course.studio_status||"")))return json({success:false,error:"COURSE_LOCKED",message:"Cette formation doit être renvoyée en modification avant de changer ses évaluations."},409);

   const [{data:mods,error:modsError},{data:lessons,error:lessonsError},{data:blocks,error:blocksError}]=await Promise.all([
    sb.from("course_modules").select("id,title,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position"),
    sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position"),
    sb.from("lesson_blocks").select("id,lesson_id,block_type,position,content_json,file_url,file_name,storage_path,bucket_name").eq("course_id",courseId).order("position"),
   ]);
   if(modsError)throw modsError;
   if(lessonsError)throw lessonsError;
   if(blocksError)throw blocksError;

   const policy=course.assessment_policy&&typeof course.assessment_policy==="object"?course.assessment_policy:{};
   const defaultCooldown=Math.max(0,Number(policy.default_retry_cooldown_hours??24));
   const defaultRemediation=Math.max(1,Number(policy.default_remediation_after_attempts??3));
   const defaultMode=String(policy.default_remediation_mode||"review_module");
   const lessonRequired=policy.lesson_assessment_required===true;
   const moduleRequired=policy.module_assessment_required===true;
   const finalRequired=policy.final_assessment_required===true||course.certification_requested===true||course.requested_cpd===true||course.cpd_accredited===true;
   const evalTypes=["qcm","true_false","open_question","exercise","assignment_upload"];

   const ensureOne=async(scope:string,title:string,moduleId?:string,lessonId?:string,passing=80)=>{
    let q=sb.from("course_assessments").select("*").eq("course_id",courseId).eq("scope",scope);
    if(lessonId)q=q.eq("lesson_id",lessonId);else if(moduleId)q=q.eq("module_id",moduleId);else q=q.is("module_id",null).is("lesson_id",null);
    const existing=await q.maybeSingle();
    if(existing.error)throw existing.error;
    let assessment=existing.data;
    if(!assessment){
     const insertPayload:any={course_id:courseId,module_id:moduleId||null,lesson_id:lessonId||null,scope,title,passing_score:passing,max_attempts:defaultRemediation,remediation_after_attempts:defaultRemediation,retry_cooldown_hours:defaultCooldown,remediation_mode:scope==="lesson"?"review_lesson":defaultMode,attempts_unlimited_for_purchased:true,required:true,correction_mode:"mixed",created_by:userId,estimated_minutes:scope==="final"?45:scope==="module"?20:10};
     const inserted=await sb.from("course_assessments").insert(insertPayload).select("*").single();
     if(inserted.error)throw inserted.error;
     assessment=inserted.data;
    }

    const questionCount=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("assessment_id",assessment.id);
    if(questionCount.error)throw questionCount.error;
    if(!questionCount.count){
     const sourceLessonIds=lessonId?[lessonId]:moduleId?(lessons||[]).filter((lesson:any)=>lesson.module_id===moduleId&&!lesson.is_module_intro).map((lesson:any)=>lesson.id):(lessons||[]).filter((lesson:any)=>lesson.is_final_exam).map((lesson:any)=>lesson.id);
     const sourceBlocks=(blocks||[]).filter((block:any)=>sourceLessonIds.includes(block.lesson_id)&&evalTypes.includes(block.block_type));
     for(const [position,block] of sourceBlocks.entries()){
      const content=block.content_json||{};
      const questionType=block.block_type==="assignment_upload"?"exercise":block.block_type;
      const blockResource=block.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(block.bucket_name||""))?{name:block.file_name||"Ressource",bucket_name:block.bucket_name,storage_path:block.storage_path,url:null}:(block.file_url?{name:block.file_name||"Ressource",url:block.file_url}:null);const questionPayload:any={assessment_id:assessment.id,question_type:questionType,position,prompt:content.question||content.statement||content.title||content.instructions||"Question à compléter",points:Number(content.points||10),grading_mode:["qcm","true_false"].includes(questionType)?"automatic":(content.grading_mode||"human"),options:content.options||[],correct_answer:questionType==="qcm"?content.correctIndex:questionType==="true_false"?content.answer:content.expected_answer||null,explanation:content.explanation||"",resource_files:content.resources||(blockResource?[blockResource]:[]),accepted_submission_types:content.accepted_types||["pdf","doc","docx","xls","xlsx","zip","png","jpg"],rubric:content.rubric||[]};
      const {error:questionError}=await sb.from("assessment_questions").insert(questionPayload);
      if(questionError)throw questionError;
     }
    }
    return assessment;
   };

   if(lessonRequired)for(const lesson of lessons||[]){if(!lesson.is_intro&&!lesson.is_module_intro&&!lesson.is_conclusion&&!lesson.is_final_exam)await ensureOne("lesson",`Évaluation — ${lesson.title}`,lesson.module_id,lesson.id,course.lesson_passing_score||80)}
   if(moduleRequired)for(const module of mods||[]){if(!module.is_intro&&!module.is_conclusion&&!module.is_final_exam)await ensureOne("module",`Évaluation du module — ${module.title}`,module.id,undefined,course.module_passing_score||80)}
   if(finalRequired)await ensureOne("final",`Examen final — ${course.title}`,undefined,undefined,course.final_passing_score||70);

   const {data:all,error:allError}=await sb.from("course_assessments").select("*,assessment_questions(count)").eq("course_id",courseId).order("scope");
   if(allError)throw allError;
   return json({success:true,assessments:all||[],policy});
  }
  if(action==="assessment_policy_get"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course,error:courseError}=await sb.from("courses").select("assessment_policy").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;
   if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const {data:assessments,error:assessmentError}=await sb.from("course_assessments").select("id,title,scope,module_id,lesson_id,passing_score,max_attempts,time_limit_minutes,required,retry_cooldown_hours,remediation_after_attempts,remediation_mode,attempts_unlimited_for_purchased,attempts_per_period,attempt_period,retry_instructions,assessment_type,delivery_mode,security_level,session_required,identity_verification_required,proctoring_settings,result_release_mode,competency_labels,competency_framework_id,jury_required,jury_min_members,jury_decision_mode,appeal_enabled,appeal_deadline_days,allowed_materials,candidate_instructions,integrity_rules").eq("course_id",courseId).order("scope");
   if(assessmentError)throw assessmentError;
   const ids=(assessments||[]).map((item:any)=>item.id);
   let mappings:any[]=[];
   if(ids.length){
    const mappingResult=await sb.from("assessment_competency_mappings").select("*,competency:competency_definitions(id,name,code,framework_id),level:competency_levels(id,name,code,level_number)").in("assessment_id",ids);
    if(mappingResult.error)throw mappingResult.error;
    mappings=mappingResult.data||[];
   }
   return json({success:true,policy:course.assessment_policy||{},assessments:(assessments||[]).map((row:any)=>({...row,competency_mappings:mappings.filter((mapping:any)=>mapping.assessment_id===row.id),competency_ids:mappings.filter((mapping:any)=>mapping.assessment_id===row.id).map((mapping:any)=>mapping.competency_id)}))});
  }
  if(action==="assessment_policy_update"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:courseState,error:courseStateError}=await sb.from("courses").select("studio_status").eq("id",courseId).maybeSingle();
   if(courseStateError)throw courseStateError;
   if(!courseState)return json({success:false,error:"NOT_FOUND"},404);
   if(!isAdmin&&["pending_validation","validated","published"].includes(String(courseState.studio_status||"")))return json({success:false,error:"COURSE_LOCKED",message:"Cette formation doit être renvoyée en modification avant de changer ses règles."},409);

   const rows=Array.isArray(b.assessments)?b.assessments:[];
   const incomingIds=[...new Set(rows.map((item:any)=>String(item.id||"")).filter(Boolean))];
   if(incomingIds.length!==rows.length)return json({success:false,error:"INVALID_ASSESSMENT_IDS",message:"Une ou plusieurs évaluations sont invalides ou dupliquées."},400);
   if(incomingIds.length){
    const existingResult=await sb.from("course_assessments").select("id,scope").eq("course_id",courseId).in("id",incomingIds);
    if(existingResult.error)throw existingResult.error;
    const existingIds=new Set((existingResult.data||[]).map((item:any)=>String(item.id)));
    if(existingIds.size!==incomingIds.length)return json({success:false,error:"ASSESSMENT_OUTSIDE_COURSE",message:"Une évaluation n’appartient pas à cette formation."},400);
   }

   const allowedModes=["none","review_lesson","review_module","exercise","manual"],allowedPeriods=["day","week","month","subscription_period"],allowedTypes=["quiz","exam","case_study","project","practical","oral","assignment"],allowedDelivery=["asynchronous","scheduled_online","scheduled_in_person","hybrid"],allowedRelease=["immediate","after_review","manual"];
   const policy={...(b.policy&&typeof b.policy==="object"?b.policy:{}),purchased_access:"until_passed",certificate_requires_success:true};
   const nowIso=new Date().toISOString();

   for(const item of rows){
    const competencyInput=Array.isArray(item.competency_mappings)?item.competency_mappings:(Array.isArray(item.competency_ids)?item.competency_ids.map((id:any)=>({competency_id:id})):[]);
    const competencyIds=[...new Set(competencyInput.map((mapping:any)=>String(mapping.competency_id||"")).filter(Boolean))];
    let definitions:any[]=[];
    if(competencyIds.length){
     const definitionResult=await sb.from("competency_definitions").select("id,name,framework_id").in("id",competencyIds).eq("status","active");
     if(definitionResult.error)throw definitionResult.error;
     definitions=definitionResult.data||[];
    }
    const definitionMap=new Map(definitions.map((definition:any)=>[String(definition.id),definition]));
    const selected=competencyInput.filter((mapping:any)=>definitionMap.has(String(mapping.competency_id||""))).slice(0,30);
    const labels=selected.map((mapping:any)=>String(definitionMap.get(String(mapping.competency_id))?.name||"")).filter(Boolean);
    const frameworkId=item.competency_framework_id||(definitions[0]?.framework_id)||null;
    const juryMode=["majority","unanimous","president_final"].includes(item.jury_decision_mode)?item.jury_decision_mode:"majority";
    const juryRequired=item.jury_required===true;
    const timeLimit=Number(item.time_limit_minutes||0);
    const patch:any={passing_score:Math.min(100,Math.max(1,Number(item.passing_score||70))),max_attempts:Math.max(1,Number(item.max_attempts||item.remediation_after_attempts||3)),remediation_after_attempts:Math.max(1,Number(item.remediation_after_attempts||3)),retry_cooldown_hours:Math.max(0,Number(item.retry_cooldown_hours||0)),remediation_mode:allowedModes.includes(item.remediation_mode)?item.remediation_mode:"review_module",attempts_unlimited_for_purchased:true,time_limit_minutes:timeLimit>0?Math.max(1,timeLimit):null,required:item.required!==false,attempts_per_period:item.attempts_per_period?Math.max(1,Number(item.attempts_per_period)):null,attempt_period:allowedPeriods.includes(item.attempt_period)?item.attempt_period:null,retry_instructions:String(item.retry_instructions||""),assessment_type:allowedTypes.includes(item.assessment_type)?item.assessment_type:(item.scope==="final"?"exam":"quiz"),delivery_mode:allowedDelivery.includes(item.delivery_mode)?item.delivery_mode:"asynchronous",security_level:Math.min(4,Math.max(1,Number(item.security_level||1))),session_required:item.session_required===true,identity_verification_required:item.identity_verification_required===true,proctoring_settings:item.proctoring_settings&&typeof item.proctoring_settings==="object"?item.proctoring_settings:{},result_release_mode:juryRequired?"manual":(allowedRelease.includes(item.result_release_mode)?item.result_release_mode:"after_review"),competency_labels:labels.length?labels:(Array.isArray(item.competency_labels)?item.competency_labels.map((label:any)=>String(label).trim()).filter(Boolean).slice(0,30):[]),competency_framework_id:frameworkId,jury_required:juryRequired,jury_min_members:Math.min(15,Math.max(1,Number(item.jury_min_members||2))),jury_decision_mode:juryMode,appeal_enabled:item.appeal_enabled!==false,appeal_deadline_days:Math.min(90,Math.max(0,Number(item.appeal_deadline_days??7))),allowed_materials:String(item.allowed_materials||""),candidate_instructions:String(item.candidate_instructions||""),integrity_rules:String(item.integrity_rules||""),updated_at:nowIso};
    const updateResult=await sb.from("course_assessments").update(patch).eq("id",item.id).eq("course_id",courseId).select("id").maybeSingle();
    if(updateResult.error)throw updateResult.error;
    if(!updateResult.data)return json({success:false,error:"ASSESSMENT_UPDATE_FAILED",message:"Une évaluation n’a pas pu être mise à jour."},409);

    const deleteMappings=await sb.from("assessment_competency_mappings").delete().eq("assessment_id",item.id);
    if(deleteMappings.error)throw deleteMappings.error;
    if(selected.length){
     const mappingRows=selected.map((mapping:any)=>({assessment_id:item.id,competency_id:String(mapping.competency_id),target_level_id:mapping.target_level_id||null,weight:Math.min(100,Math.max(0.01,Number(mapping.weight||1))),passing_score:mapping.passing_score===null||mapping.passing_score===undefined?null:Math.min(100,Math.max(0,Number(mapping.passing_score))),required:mapping.required!==false,created_by:userId}));
     const {error:mappingError}=await sb.from("assessment_competency_mappings").insert(mappingRows);
     if(mappingError)throw mappingError;
    }
   }

   const first=(scope:string,fallback:number)=>Math.min(100,Math.max(1,Number(rows.find((item:any)=>item.scope===scope)?.passing_score||fallback)));
   const courseUpdate=await sb.from("courses").update({assessment_policy:policy,lesson_passing_score:first("lesson",80),module_passing_score:first("module",80),final_passing_score:first("final",70),assessment_rules_locked:false,updated_at:nowIso}).eq("id",courseId).select("id").maybeSingle();
   if(courseUpdate.error)throw courseUpdate.error;
   if(!courseUpdate.data)return json({success:false,error:"COURSE_UPDATE_FAILED",message:"Les règles n’ont pas été rattachées à la formation."},409);
   await log(sb,courseId,userId,"assessment_policy_updated",{count:rows.length});
   return json({success:true,updated_assessments:rows.length});
  }
  if(action==="prepare_assessment_submission_upload"){
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation administrative Omnia ne crée aucune copie."},403);
   const assessmentId=String(b.assessment_id||"");const questionId=String(b.question_id||"");const fileName=String(b.file_name||"fichier").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-160);const size=Math.max(0,Number(b.size_bytes||0));
   if(!assessmentId||!questionId||size>52428800)return json({success:false,error:size>52428800?"FILE_TOO_LARGE":"ASSESSMENT_QUESTION_REQUIRED"},400);
   const {data:a}=await sb.from("course_assessments").select("id,course_id").eq("id",assessmentId).maybeSingle();if(!a)return json({success:false,error:"ASSESSMENT_NOT_FOUND"},404);
   const {data:question}=await sb.from("assessment_questions").select("id,question_type,accepted_submission_types").eq("id",questionId).eq("assessment_id",assessmentId).maybeSingle();if(!question||question.question_type!=="exercise")return json({success:false,error:"SUBMISSION_NOT_ALLOWED"},400);
   const accepted=(Array.isArray(question.accepted_submission_types)?question.accepted_submission_types:[]).map((x:any)=>String(x).toLowerCase().replace(/^\./,""));const ext=fileName.includes(".")?fileName.split(".").pop()!.toLowerCase():"";if(accepted.length&&ext&&!accepted.includes(ext)&&!(ext==="jpeg"&&accepted.includes("jpg"))&&!(ext==="jpg"&&accepted.includes("jpeg")))return json({success:false,error:"FILE_TYPE_NOT_ALLOWED",file_name:fileName},400);
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll)return json({success:false,error:"NOT_ENROLLED"},403);
   const path=`${userId}/${a.course_id}/${assessmentId}/${crypto.randomUUID()}-${fileName}`;const {data,error}=await sb.storage.from("assessment-submissions").createSignedUploadUrl(path,{upsert:false});if(error)throw error;return json({success:true,...data,bucket:"assessment-submissions",path});
  }
  if(action==="learner_get_assessment"){
   let q=sb.from("course_assessments").select("*").eq("is_active",true);
   if(b.assessment_id)q=q.eq("id",String(b.assessment_id));else{q=q.eq("course_id",courseId).eq("scope",b.scope||"lesson");if(b.lesson_id)q=q.eq("lesson_id",b.lesson_id);else if(b.module_id)q=q.eq("module_id",b.module_id);else q=q.is("lesson_id",null).is("module_id",null);}
   const {data:a}=await q.maybeSingle();if(!a)return json({success:true,assessment:null});
   if(!isAdmin){const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll)return json({success:false,error:"NOT_ENROLLED"},403);}
   let session:any=null;
   if(a.session_required){const sessionId=String(b.session_id||"");if(!sessionId)return json({success:false,error:"SESSION_REQUIRED",message:"Cette évaluation doit être ouverte depuis une session programmée."},409);const {data:sess}=await sb.from("assessment_sessions").select("*").eq("id",sessionId).eq("assessment_id",a.id).maybeSingle();if(!sess)return json({success:false,error:"SESSION_NOT_FOUND"},404);const {data:accommodation}=isAdmin?{data:null}:await sb.from("assessment_accommodations").select("extra_time_minutes").eq("session_id",sessionId).eq("user_id",userId).eq("status","approved").maybeSingle();const effectiveEnd=new Date(new Date(sess.ends_at).getTime()+Math.max(0,Number(accommodation?.extra_time_minutes||0))*60000).toISOString();session={...sess,effective_ends_at:effectiveEnd};const now=Date.now(),start=new Date(sess.starts_at).getTime(),end=new Date(effectiveEnd).getTime();if(!isAdmin&&(now<start-15*60000||now>end||!["scheduled","open","in_progress"].includes(String(sess.status))))return json({success:false,error:"SESSION_NOT_OPEN"},409);const {data:candidate}=isAdmin?{data:null}:await sb.from("assessment_session_candidates").select("status,started_at").eq("session_id",sessionId).eq("user_id",userId).maybeSingle();if(!isAdmin&&!candidate?.started_at)return json({success:false,error:"SESSION_NOT_STARTED",message:"Confirmez d’abord votre identité et démarrez la session."},409);}
   const {data:qs}=await sb.from("assessment_questions").select("id,question_type,position,prompt,options,explanation,points,resource_files,accepted_submission_types").eq("assessment_id",a.id).order("position");const signedQuestions=await Promise.all((qs||[]).map(async(question:any)=>{const resources=await Promise.all((Array.isArray(question.resource_files)?question.resource_files:[]).map(async(resource:any)=>{let bucket=String(resource?.bucket_name||""),path=String(resource?.storage_path||"");if((!bucket||!path)&&resource?.url){const locator=parseStorageLocator(resource.url);if(locator){bucket=locator.bucket;path=locator.path}}if(PRIVATE_COURSE_BUCKET_SET.has(bucket)&&path){const signed=await createSignedObjectUrl(sb,bucket,path,900);return {...resource,bucket_name:bucket,storage_path:path,url:signed}}return resource;}));return {...question,resource_files:resources};}));
   const {data:last}=isAdmin?{data:null}:await sb.from("assessment_attempts").select("id,score,passed,status,attempt_number,retry_available_at,remediation_required,remediation_completed_at,feedback,submitted_at").eq("assessment_id",a.id).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   let correction:any=null;if(last?.id){const {data:c}=await sb.from("assessment_corrections").select("score,max_score,comment,corrected_bucket_name,corrected_storage_path,corrected_file_name,published_at").eq("attempt_id",last.id).eq("status","published").order("published_at",{ascending:false}).limit(1).maybeSingle();if(c){let signed_url=null;if(c.corrected_bucket_name&&c.corrected_storage_path){const {data:signed}=await sb.storage.from(c.corrected_bucket_name).createSignedUrl(c.corrected_storage_path,3600);signed_url=signed?.signedUrl||null}correction={...c,signed_url}}}
   const now=Date.now();const retryAt=last?.retry_available_at?new Date(last.retry_available_at).getTime():0;const pending=last&&["pending_review","submitted","in_progress"].includes(last.status);const remediationBlocked=!!last?.remediation_required&&!last?.remediation_completed_at;
   return json({success:true,assessment:{...a,session,questions:signedQuestions,latest_attempt:last||null,correction,can_retry:!pending&&!remediationBlocked&&(!retryAt||retryAt<=now),retry_blocked_until:retryAt>now?last.retry_available_at:null,remediation_blocked:remediationBlocked}});
  }
  if(action==="learner_complete_remediation"){
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation administrative Omnia ne modifie aucune progression."},403);
   const assessmentId=String(b.assessment_id||"");
   const {data:a}=await sb.from("course_assessments").select("course_id,remediation_mode,is_active").eq("id",assessmentId).maybeSingle();if(!a||a.is_active===false)return json({success:false,error:"ASSESSMENT_NOT_FOUND"},404);
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll)return json({success:false,error:"NOT_ENROLLED"},403);
   if(a.remediation_mode==="manual")return json({success:false,error:"MANUAL_REMEDIATION_REQUIRED",message:"Le formateur doit autoriser la nouvelle tentative."},409);
   const {data:last}=await sb.from("assessment_attempts").select("id,remediation_required").eq("assessment_id",assessmentId).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();if(!last?.remediation_required)return json({success:true});
   const {error}=await sb.from("assessment_attempts").update({remediation_completed_at:new Date().toISOString(),remediation_note:String(b.note||"Contenu révisé par l’apprenant")}).eq("id",last.id);if(error)throw error;return json({success:true});
  }
  if(action==="learner_submit_assessment"){
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation administrative Omnia ne crée aucune tentative."},403);
   const assessmentId=String(b.assessment_id||"");const {data:a,error:ae}=await sb.from("course_assessments").select("*").eq("id",assessmentId).eq("is_active",true).single();if(ae)throw ae;
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll&&!isAdmin)return json({success:false,error:"NOT_ENROLLED"},403);
   const {data:last}=await sb.from("assessment_attempts").select("id,status,retry_available_at,remediation_required,remediation_completed_at,attempt_number").eq("assessment_id",assessmentId).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   if(last&&["pending_review","submitted","in_progress"].includes(last.status))return json({success:false,error:"ATTEMPT_PENDING_REVIEW",message:"Une copie est déjà en attente de correction."},409);
   if(last?.retry_available_at&&new Date(last.retry_available_at)>new Date())return json({success:false,error:"RETRY_COOLDOWN",retry_available_at:last.retry_available_at,message:"La nouvelle tentative sera disponible après le délai prévu."},429);
   if(last?.remediation_required&&!last?.remediation_completed_at)return json({success:false,error:"REMEDIATION_REQUIRED",message:"Revoyez d’abord le contenu demandé avant de recommencer."},409);
   const {data:qs}=await sb.from("assessment_questions").select("*").eq("assessment_id",assessmentId).order("position");const attemptNo=Number(last?.attempt_number||0)+1;
   const answers=Array.isArray(b.answers)?b.answers:[];let earned=0,total=0,pending=false;
   for(const qn of qs||[]){const ans=answers.find((x:any)=>x.question_id===qn.id)?.answer;const files=Array.isArray(ans?.files)?ans.files:[];const expectedPrefix=`${userId}/${a.course_id}/${assessmentId}/`;const accepted=(Array.isArray(qn.accepted_submission_types)?qn.accepted_submission_types:[]).map((x:any)=>String(x).toLowerCase().replace(/^\./,""));for(const f of files){const path=String(f?.storage_path||"");const name=String(f?.file_name||f?.name||"");const ext=name.includes(".")?name.split(".").pop()!.toLowerCase():"";if((f?.bucket_name||"assessment-submissions")!=="assessment-submissions"||!path.startsWith(expectedPrefix))return json({success:false,error:"INVALID_SUBMISSION_FILE"},400);if(Number(f?.size_bytes||f?.size||0)>52428800)return json({success:false,error:"FILE_TOO_LARGE"},400);if(accepted.length&&ext&&!accepted.includes(ext)&&!(ext==="jpeg"&&accepted.includes("jpg"))&&!(ext==="jpg"&&accepted.includes("jpeg")))return json({success:false,error:"FILE_TYPE_NOT_ALLOWED",file_name:name},400);}}
   let session:any=null;if(a.session_required){const sessionId=String(b.session_id||"");const {data:sess}=await sb.from("assessment_sessions").select("*").eq("id",sessionId).eq("assessment_id",assessmentId).maybeSingle();if(!sess)return json({success:false,error:"SESSION_REQUIRED"},409);const {data:accommodation}=await sb.from("assessment_accommodations").select("extra_time_minutes").eq("session_id",sessionId).eq("user_id",userId).eq("status","approved").maybeSingle();const effectiveEnd=new Date(new Date(sess.ends_at).getTime()+Math.max(0,Number(accommodation?.extra_time_minutes||0))*60000);const now=Date.now();if(now<new Date(sess.starts_at).getTime()-15*60000||now>effectiveEnd.getTime()||!["scheduled","open","in_progress"].includes(String(sess.status)))return json({success:false,error:"SESSION_CLOSED"},409);session={...sess,effective_ends_at:effectiveEnd.toISOString()};const {data:candidate}=await sb.from("assessment_session_candidates").select("started_at").eq("session_id",sessionId).eq("user_id",userId).maybeSingle();if(!candidate?.started_at)return json({success:false,error:"SESSION_NOT_STARTED"},409);}
   const {data:attempt,error:attErr}=await sb.from("assessment_attempts").insert({assessment_id:assessmentId,course_id:a.course_id,user_id:userId,attempt_number:attemptNo,status:"submitted",submitted_at:new Date().toISOString(),session_id:session?.id||null,result_status:"pending_review",identity_verified_at:session?.identity_verification_required?new Date().toISOString():null,security_snapshot:{security_level:session?.security_level||a.security_level||1,proctoring_settings:session?.proctoring_settings||a.proctoring_settings||{}}}).select("*").single();if(attErr)throw attErr;
   for(const qn of qs||[]){total+=Number(qn.points||0);const ans=answers.find((x:any)=>x.question_id===qn.id)?.answer;let autoScore:null|number=null;let review="not_required";
    if(qn.question_type==="qcm")autoScore=Number(ans)===Number(qn.correct_answer)?Number(qn.points):0;
    else if(qn.question_type==="true_false"){const expected=typeof qn.correct_answer==="boolean"?qn.correct_answer:String(qn.correct_answer).toLowerCase()==="true";const received=typeof ans==="boolean"?ans:String(ans).toLowerCase()==="true";autoScore=received===expected?Number(qn.points):0;}
    else {pending=true;review="pending";}
    if(autoScore!==null)earned+=autoScore;
    const files=Array.isArray(ans?.files)?ans.files:[];
    const {data:answerRow,error:answerError}=await sb.from("assessment_answers").insert({attempt_id:attempt.id,question_id:qn.id,answer_json:ans===undefined?null:ans,submission_files:files,auto_score:autoScore,final_score:autoScore,review_status:review}).select("id").single();if(answerError)throw answerError;
    for(const f of files){if(!f?.storage_path)continue;const {error:fileError}=await sb.from("assessment_submission_files").insert({attempt_id:attempt.id,answer_id:answerRow.id,owner_user_id:userId,bucket_name:"assessment-submissions",storage_path:f.storage_path,file_name:f.file_name||f.name||"fichier",mime_type:f.mime_type||f.type||null,size_bytes:Number(f.size_bytes||f.size||0)});if(fileError)throw fileError;}
   }
   const score=total?Math.round((earned/total)*10000)/100:0;const passed=!pending&&score>=Number(a.passing_score);const failedCount=attemptNo;const remediationRequired=!pending&&!passed&&String(a.remediation_mode||"none")!=="none"&&failedCount>=Number(a.remediation_after_attempts||a.max_attempts||3);const retryAvailableAt=!pending&&!passed&&Number(a.retry_cooldown_hours||0)>0?new Date(Date.now()+Number(a.retry_cooldown_hours)*3600000).toISOString():null;
   const releaseNow=!pending&&!a.jury_required&&String(a.result_release_mode||"after_review")==="immediate";await sb.from("assessment_attempts").update({score,passed,status:pending?"pending_review":passed?"passed":"failed",retry_available_at:retryAvailableAt,remediation_required:remediationRequired,remediation_completed_at:null,result_status:releaseNow?"published":"pending_review",result_published_at:releaseNow?new Date().toISOString():null,result_published_by:null}).eq("id",attempt.id);if(releaseNow){await syncCompetencyLedger(sb,{...attempt,user_id:userId,assessment_id:a.id},a,score,null,"verified",[]);}if(session?.id){await sb.from("assessment_activity_events").insert({session_id:session.id,assessment_id:a.id,attempt_id:attempt.id,user_id:userId,event_type:"submitted",metadata:{score,pending_review:pending}});await sb.from("assessment_session_candidates").update({status:"completed",completed_at:new Date().toISOString()}).eq("session_id",session.id).eq("user_id",userId);}
   if(passed&&a.scope==="lesson"&&a.lesson_id){const {data:lesson}=await sb.from("course_lessons").select("duration_seconds").eq("id",a.lesson_id).maybeSingle();const {data:prog}=await sb.from("user_lesson_progress").select("time_spent_seconds").eq("user_id",userId).eq("lesson_id",a.lesson_id).maybeSingle();const reached=Number(lesson?.duration_seconds||0)===0||Number(prog?.time_spent_seconds||0)>=Number(lesson?.duration_seconds||0);await sb.from("user_lesson_progress").upsert({user_id:userId,course_id:a.course_id,lesson_id:a.lesson_id,quiz_passed:true,quiz_score:Math.round(score),is_completed:reached,completed_at:reached?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});}
   if(passed&&a.scope==="final")triggerCertificate(userId,a.course_id,"final_exam_passed");
   return json({success:true,attempt_id:attempt.id,score,passed,pending_review:pending,passing_score:a.passing_score,retry_available_at:retryAvailableAt,remediation_required:remediationRequired});
  }
  if(action==="grader_release_remediation"){
   const attemptId=String(b.attempt_id||"");const {data:att,error}=await sb.from("assessment_attempts").select("id,course_id,remediation_required,course_assessments(remediation_mode)").eq("id",attemptId).single();if(error)throw error;if(!(await owns(sb,userId,att.course_id)))return json({success:false,error:"FORBIDDEN"},403);const assessment=(att as any).course_assessments||{};if(!att.remediation_required||assessment.remediation_mode!=="manual")return json({success:false,error:"MANUAL_REMEDIATION_NOT_REQUIRED"},409);const note=String(b.note||"Nouvelle tentative autorisée par le formateur");const {error:updateError}=await sb.from("assessment_attempts").update({remediation_completed_at:new Date().toISOString(),remediation_note:note}).eq("id",attemptId);if(updateError)throw updateError;await log(sb,att.course_id,userId,"assessment_manual_remediation_released",{attempt_id:attemptId,note});return json({success:true});
  }
  if(action==="grader_list_attempts"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("assessment_attempts").select("*,course_assessments(title,scope,lesson_id,module_id,passing_score,remediation_mode),users!assessment_attempts_user_id_fkey(full_name,email),assessment_corrections(status,score,updated_at)").eq("course_id",courseId).in("status",["pending_review","submitted","failed","passed"]).order("submitted_at",{ascending:true});if(error)throw error;const attempts=(data||[]).filter((item:any)=>item.result_status==="pending_review"||["pending_review","submitted"].includes(item.status)||(item.status==="failed"&&item.remediation_required&&!item.remediation_completed_at&&item.course_assessments?.remediation_mode==="manual"));return json({success:true,attempts});
  }
  if(action==="grader_get_attempt"){
   const attemptId=String(b.attempt_id||"");const {data:att,error}=await sb.from("assessment_attempts").select("*,course_assessments(id,title,scope,course_id,passing_score,remediation_mode,competency_labels),users!assessment_attempts_user_id_fkey(full_name,email)").eq("id",attemptId).single();if(error)throw error;if(!(await owns(sb,userId,att.course_id)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:answers}=await sb.from("assessment_answers").select("*,assessment_questions(id,prompt,question_type,points,rubric)").eq("attempt_id",attemptId).order("created_at");
   const {data:files}=await sb.from("assessment_submission_files").select("*").eq("attempt_id",attemptId).order("uploaded_at");const signedFiles=[];for(const f of files||[]){const {data:signed}=await sb.storage.from(f.bucket_name).createSignedUrl(f.storage_path,3600);signedFiles.push({...f,signed_url:signed?.signedUrl||null});}
   const {data:correction}=await sb.from("assessment_corrections").select("*").eq("attempt_id",attemptId).eq("grader_id",userId).maybeSingle();let correctionSigned=null;if(correction?.corrected_bucket_name&&correction?.corrected_storage_path){const {data:signed}=await sb.storage.from(correction.corrected_bucket_name).createSignedUrl(correction.corrected_storage_path,3600);correctionSigned=signed?.signedUrl||null;}
   return json({success:true,attempt:att,answers:answers||[],files:signedFiles,correction:correction?{...correction,signed_url:correctionSigned}:null});
  }
  if(action==="prepare_assessment_correction_upload"){
   const attemptId=String(b.attempt_id||"");const {data:att}=await sb.from("assessment_attempts").select("course_id").eq("id",attemptId).maybeSingle();if(!att||!(await owns(sb,userId,att.course_id,"can_upload_files")))return json({success:false,error:"FORBIDDEN"},403);const fileName=String(b.file_name||"correction").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-160);if(Number(b.size_bytes||0)>52428800)return json({success:false,error:"FILE_TOO_LARGE"},400);const path=`${att.course_id}/${attemptId}/${userId}/${crypto.randomUUID()}-${fileName}`;const {data,error}=await sb.storage.from("assessment-corrections").createSignedUploadUrl(path,{upsert:false});if(error)throw error;return json({success:true,...data,bucket:"assessment-corrections",path});
  }
  if(action==="grader_save_correction"){
   const attemptId=String(b.attempt_id||"");
   const {data:att,error:attemptError}=await sb.from("assessment_attempts").select("*,course_assessments(id,passing_score,scope,course_id,lesson_id,retry_cooldown_hours,remediation_after_attempts,remediation_mode,result_release_mode,competency_labels,jury_required,appeal_enabled,appeal_deadline_days)").eq("id",attemptId).single();
   if(attemptError)throw attemptError;if(!(await owns(sb,userId,att.course_id)))return json({success:false,error:"FORBIDDEN"},403);
   const assessment=(att as any).course_assessments||{};if(b.publish===true&&assessment.jury_required===true)return json({success:false,error:"JURY_DECISION_REQUIRED",message:"Cette évaluation exige une décision du jury. Enregistrez la correction en brouillon puis transmettez la copie au jury."},409);const status=b.publish===true?"published":"draft";const score=Math.min(100,Math.max(0,Number(b.score||0)));const file=b.corrected_file||{};
   if(file.storage_path){const expectedPrefix=`${att.course_id}/${attemptId}/${userId}/`;if((file.bucket_name||"assessment-corrections")!=="assessment-corrections"||!String(file.storage_path).startsWith(expectedPrefix))return json({success:false,error:"INVALID_CORRECTION_FILE"},400);if(Number(file.size_bytes||file.size||0)>52428800)return json({success:false,error:"FILE_TOO_LARGE"},400);}
   const {count:submissionFileCount}=await sb.from("assessment_submission_files").select("id",{count:"exact",head:true}).eq("attempt_id",attemptId);
   const {data:existingCorrection}=await sb.from("assessment_corrections").select("corrected_storage_path").eq("attempt_id",attemptId).eq("grader_id",userId).maybeSingle();
   if(status==="published"&&Number(submissionFileCount||0)>0&&!file.storage_path&&!existingCorrection?.corrected_storage_path)return json({success:false,error:"CORRECTED_FILE_REQUIRED",message:"Joignez la copie corrigée avant de publier la note."},400);
   const payload:any={attempt_id:attemptId,grader_id:userId,status,score,max_score:Number(b.max_score||100),comment:String(b.comment||""),updated_at:new Date().toISOString(),published_at:status==="published"?new Date().toISOString():null};
   if(file.storage_path)Object.assign(payload,{corrected_bucket_name:file.bucket_name||"assessment-corrections",corrected_storage_path:file.storage_path,corrected_file_name:file.file_name||file.name||"Correction",corrected_mime_type:file.mime_type||file.type||null,corrected_size_bytes:Number(file.size_bytes||file.size||0)});
   const {data:correction,error}=await sb.from("assessment_corrections").upsert(payload,{onConflict:"attempt_id,grader_id"}).select("*").single();if(error)throw error;
   if(status==="published"){
    const passing=Number(assessment.passing_score||70);const passed=score>=passing;const cooldown=Math.max(0,Number(assessment.retry_cooldown_hours||0));const remediationThreshold=Math.max(1,Number(assessment.remediation_after_attempts||3));const remediationRequired=!passed&&String(assessment.remediation_mode||"none")!=="none"&&Number(att.attempt_number||1)>=remediationThreshold;const retryAt=!passed&&cooldown>0?new Date(Date.now()+cooldown*3600000).toISOString():null;
    await sb.from("assessment_grading_history").insert({attempt_id:attemptId,grader_id:userId,previous_score:att.score,new_score:score,comment:String(b.comment||"")});
    await sb.from("assessment_answers").update({review_status:"reviewed",grader_feedback:String(b.comment||""),updated_at:new Date().toISOString()}).eq("attempt_id",attemptId).eq("review_status","pending");
    await sb.from("assessment_attempts").update({score,passed,status:passed?"passed":"failed",graded_at:new Date().toISOString(),graded_by:userId,feedback:String(b.comment||""),retry_available_at:passed?null:retryAt,remediation_required:remediationRequired,remediation_completed_at:null,result_status:"published",result_published_at:new Date().toISOString(),result_published_by:userId}).eq("id",attemptId);await syncCompetencyLedger(sb,{...att,id:attemptId},assessment,score,userId,"verified",Array.isArray(b.competency_results)?b.competency_results:[]);
    if(passed&&assessment.scope==="lesson"&&assessment.lesson_id){const {data:lesson}=await sb.from("course_lessons").select("duration_seconds").eq("id",assessment.lesson_id).maybeSingle();const {data:progress}=await sb.from("user_lesson_progress").select("time_spent_seconds").eq("user_id",att.user_id).eq("lesson_id",assessment.lesson_id).maybeSingle();const reached=Number(lesson?.duration_seconds||0)===0||Number(progress?.time_spent_seconds||0)>=Number(lesson?.duration_seconds||0);await sb.from("user_lesson_progress").upsert({user_id:att.user_id,course_id:att.course_id,lesson_id:assessment.lesson_id,quiz_passed:true,quiz_score:Math.round(score),is_completed:reached,completed_at:reached?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});}
    if(passed&&assessment.scope==="final")triggerCertificate(att.user_id,att.course_id,"final_manual_review_passed");
   }
   return json({success:true,correction});
  }
  if(action==="assessment_analytics"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);const {data:ass}=await sb.from("course_assessments").select("id,title,scope").eq("course_id",courseId);const ids=(ass||[]).map((x:any)=>x.id);if(!ids.length)return json({success:true,summary:{attempts:0,pass_rate:0,average_score:0},items:[]});const {data:at}=await sb.from("assessment_attempts").select("assessment_id,score,passed,status,time_spent_seconds").in("assessment_id",ids).not("score","is",null);const total=(at||[]).length,passes=(at||[]).filter((x:any)=>x.passed).length,avg=total?(at||[]).reduce((n:number,x:any)=>n+Number(x.score||0),0)/total:0;return json({success:true,summary:{attempts:total,pass_rate:total?Math.round(passes/total*100):0,average_score:Math.round(avg*100)/100},items:ass||[]});
  }


  if(action==="get_commercialization"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course}=await sb.from("courses").select("sale_mode,desired_price_amount,sale_currency,promotion_price_amount,structure_payment_mode,structure_fixed_amount,is_assisted,assisted_status,assisted_request_id,certification_requested,creator_context,structure_id,pricing_status,admin_selected_price_xof,pricing_revision_comment,price_xof,is_published").eq("id",courseId).single();
   const {data:settings}=await sb.from("site_settings").select("key,value").in("key",["commission_normal_sans_cpd","commission_normal_avec_cpd","commission_assistee_sans_cpd","commission_assistee_avec_cpd"]);
   const revenueRules:any={};for(const row of settings||[]){try{revenueRules[row.key]=typeof row.value==="string"?JSON.parse(row.value):row.value}catch{revenueRules[row.key]=row.value}}
   const [{data:certifications},organizationOptions,{data:assistedRequest},{data:liveLinks}]=await Promise.all([
    sb.from("course_certifications").select("*").eq("course_id",courseId).order("created_at"),
    certificationOrganizationOptions(sb,courseId),
    sb.from("assisted_course_requests").select("*").eq("course_id",courseId).in("status",["pending","in_progress","draft_ready","changes_requested","owner_validated","pricing_review","ready_to_publish"]).order("requested_at",{ascending:false}).limit(1).maybeSingle(),
    sb.from("course_live_content_links").select("id,course_id,event_id,media_id,title_override,position,required,is_active,live_events(id,title,delivery_type,status,starts_at,organizer_display_name),live_media(id,title,media_type,status,processing_status,sequence_no,event_id)").eq("course_id",courseId).eq("is_active",true).order("position").order("created_at")
   ]);
   const signedAssisted=assistedRequest?{...assistedRequest,documents:await signAssistedDocuments(sb,assistedRequest.documents,900)}:null;
   return json({success:true,course,revenue_rules:revenueRules,certifications:certifications||[],organization_options:organizationOptions,assisted_request:signedAssisted,live_links:liveLinks||[]});
  }
  if(action==="save_commercialization"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const mode=b.sale_mode||"paid";const amount=mode==="free"?0:Number(b.desired_price_amount||0);
   if(mode==="paid"&&amount<=0)return json({success:false,error:"PRICE_REQUIRED",message:"Indiquez un prix supérieur à zéro."},400);
   const updates:any={sale_mode:mode,desired_price_amount:amount,sale_currency:b.sale_currency||"XOF",promotion_price_amount:b.promotion_price_amount||null,structure_payment_mode:b.structure_payment_mode||"free",structure_fixed_amount:b.structure_fixed_amount||null,updated_at:new Date().toISOString()};
   const {data,error}=await sb.from("courses").update(updates).eq("id",courseId).select("sale_mode,desired_price_amount,sale_currency,promotion_price_amount,structure_payment_mode,structure_fixed_amount").single();if(error)throw error;await log(sb,courseId,userId,"commercialization_saved",updates);return json({success:true,course:data});
  }
  if(action==="list_live_content_options"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course}=await sb.from("courses").select("creator_context,structure_id").eq("id",courseId).maybeSingle();
   let eventQuery=sb.from("live_events").select("id,title,delivery_type,status,starts_at,owner_user_id,owner_structure_id,organizer_display_name").in("status",["approved","published","live","completed"]).order("updated_at",{ascending:false}).limit(250);
   if(!isAdmin){
    if(String(course?.creator_context||"")==="structure"&&course?.structure_id)eventQuery=eventQuery.eq("owner_structure_id",course.structure_id);
    else eventQuery=eventQuery.eq("owner_user_id",userId);
   }
   const {data:events,error:eventError}=await eventQuery;if(eventError)throw eventError;
   const eventIds=(events||[]).map((x:any)=>x.id);
   let media:any[]=[];
   if(eventIds.length){const {data,error}=await sb.from("live_media").select("id,event_id,title,media_type,status,processing_status,sequence_no").in("event_id",eventIds).in("media_type",["replay","recorded_video"]).neq("status","deleted").order("sequence_no",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});if(error)throw error;media=data||[]}
   return json({success:true,events:events||[],media});
  }
  if(action==="add_course_live_link"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const eventId=String(b.event_id||"")||null,mediaId=String(b.media_id||"")||null;
   if((eventId?1:0)+(mediaId?1:0)!==1)return json({success:false,error:"ONE_LIVE_TARGET_REQUIRED"},400);
   const {data:course}=await sb.from("courses").select("creator_context,structure_id").eq("id",courseId).maybeSingle();
   let targetEventId=eventId;
   if(mediaId){const {data:media}=await sb.from("live_media").select("id,event_id,media_type").eq("id",mediaId).maybeSingle();if(!media||!["replay","recorded_video"].includes(String(media.media_type)))return json({success:false,error:"MEDIA_NOT_LINKABLE"},400);targetEventId=String(media.event_id||"")||null}
   const {data:ev}=targetEventId?await sb.from("live_events").select("id,owner_user_id,owner_structure_id,status").eq("id",targetEventId).maybeSingle():{data:null};
   if(!ev)return json({success:false,error:"LIVE_EVENT_NOT_FOUND"},404);
   if(!isAdmin){const sameOwner=String(ev.owner_user_id||"")===userId;const sameStructure=course?.structure_id&&String(ev.owner_structure_id||"")===String(course.structure_id);if(!sameOwner&&!sameStructure)return json({success:false,error:"LIVE_CONTENT_NOT_OWNED"},403)}
   const row:any={course_id:courseId,event_id:eventId,media_id:mediaId,title_override:String(b.title_override||"").trim()||null,position:Math.max(0,Number(b.position||0)),required:b.required===true,is_active:true,created_by:userId,updated_at:new Date().toISOString()};
   let existingQuery=sb.from("course_live_content_links").select("id").eq("course_id",courseId);
   existingQuery=eventId?existingQuery.eq("event_id",eventId):existingQuery.eq("media_id",mediaId as string);
   const {data:existingLink,error:existingError}=await existingQuery.maybeSingle();if(existingError)throw existingError;
   let data:any,error:any;
   if(existingLink?.id){({data,error}=await sb.from("course_live_content_links").update(row).eq("id",existingLink.id).select("*").single());}
   else {({data,error}=await sb.from("course_live_content_links").insert(row).select("*").single());}
   if(error)throw error;
   await log(sb,courseId,userId,"course_live_content_linked",{link_id:data.id,event_id:eventId,media_id:mediaId});
   return json({success:true,link:data});
  }
  if(action==="remove_course_live_link"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const linkId=String(b.link_id||"");if(!linkId)return json({success:false,error:"LINK_ID_REQUIRED"},400);
   const {data:link}=await sb.from("course_live_content_links").select("*").eq("id",linkId).eq("course_id",courseId).maybeSingle();if(!link)return json({success:false,error:"LINK_NOT_FOUND"},404);
   const {error}=await sb.from("course_live_content_links").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",linkId);if(error)throw error;
   await log(sb,courseId,userId,"course_live_content_unlinked",{link_id:linkId,event_id:link.event_id,media_id:link.media_id});
   return json({success:true});
  }

  if(action==="request_assisted_entry"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const rs=await roles(sb,userId);
   if(rs.includes("super_admin"))return json({success:false,error:"ADMIN_ASSISTED_ENTRY_NOT_APPLICABLE",message:"L’Administration crée directement les formations au nom d’Omnia Global Academy."},403);
   const {data:ownedCourse}=await sb.from("courses").select("creator_context,structure_id").eq("id",courseId).maybeSingle();
   const requesterRole=String(ownedCourse?.creator_context||"")==="structure"?"structure":"professeur";
   const activeStatuses=["pending","in_progress","draft_ready","changes_requested","owner_validated","pricing_review","ready_to_publish"];
   const {data:existing}=await sb.from("assisted_course_requests").select("id,status").eq("course_id",courseId).in("status",activeStatuses).limit(1).maybeSingle();if(existing)return json({success:false,error:"ACTIVE_REQUEST_EXISTS",message:"Une demande est déjà en cours."},409);
   let assistedDocuments:any[]=[];try{assistedDocuments=(Array.isArray(b.documents)?b.documents:[]).map((document:any)=>normalizeAssistedDocument(document,courseId));}catch{return json({success:false,error:"INVALID_ASSISTED_DOCUMENT",message:"Un document joint ne correspond pas au stockage protégé de cette formation."},400)}
   const {data:reqRow,error}=await sb.from("assisted_course_requests").insert({course_id:courseId,requester_id:userId,requester_role:requesterRole,structure_id:ownedCourse?.structure_id||null,service_type:b.service_type||"without_certification",instructions:String(b.instructions||""),documents:assistedDocuments,status:"pending"}).select("*").single();if(error)throw error;
   await sb.from("courses").update({is_assisted:true,assisted_request_id:reqRow.id,assisted_status:"pending",updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"assisted_entry_requested",{request_id:reqRow.id,service_type:reqRow.service_type,requester_role:requesterRole});return json({success:true,request:reqRow});
  }
  if(action==="list_assisted_requests"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("assisted_course_requests").select("*,courses(title,creator_id),users!assisted_course_requests_requester_id_fkey(full_name,email)").order("requested_at",{ascending:false});if(error)throw error;const items=await Promise.all((data||[]).map(async(row:any)=>({...row,documents:await signAssistedDocuments(sb,row.documents,900)})));return json({success:true,items});
  }
  if(action==="admin_update_assisted_request"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);
   const status=String(b.status||"");if(!["pending","in_progress","draft_ready","completed","rejected","cancelled"].includes(status))return json({success:false,error:"INVALID_STATUS"},400);
   const {data:current}=await sb.from("assisted_course_requests").select("*,courses(is_published)").eq("id",b.id).maybeSingle();if(!current)return json({success:false,error:"NOT_FOUND"},404);
   if(status==="completed"&&current.courses?.is_published!==true)return json({success:false,error:"COURSE_NOT_PUBLISHED",message:"La demande ne peut être clôturée qu’après publication de la formation au nom de son propriétaire."},409);
   const patch:any={status,updated_at:new Date().toISOString(),admin_comment:b.admin_comment??current.admin_comment??null};
   if(status==="in_progress"){patch.assigned_to=userId;patch.started_at=current.started_at||new Date().toISOString()}
   if(status==="draft_ready"){patch.draft_ready_at=new Date().toISOString();patch.last_returned_at=new Date().toISOString()}
   if(status==="completed")patch.completed_at=new Date().toISOString();
   const {data,error}=await sb.from("assisted_course_requests").update(patch).eq("id",b.id).select("*").single();if(error)throw error;
   await sb.from("courses").update({assisted_status:status,updated_at:new Date().toISOString()}).eq("id",data.course_id);
   await log(sb,data.course_id,userId,"assisted_entry_admin_status",{request_id:data.id,status});
   return json({success:true,item:data});
  }
  if(action==="owner_review_assisted_request"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const decision=String(b.decision||"");if(!["changes_requested","validated"].includes(decision))return json({success:false,error:"INVALID_DECISION"},400);
   const {data:reqRow}=await sb.from("assisted_course_requests").select("*").eq("course_id",courseId).in("status",["draft_ready","changes_requested"]).order("requested_at",{ascending:false}).limit(1).maybeSingle();
   if(!reqRow)return json({success:false,error:"NO_REVIEWABLE_ASSISTED_REQUEST",message:"Aucun brouillon assisté n’attend votre validation."},409);
   const now=new Date().toISOString();
   const status=decision==="validated"?"owner_validated":"changes_requested";
   const patch:any={status,owner_comment:String(b.comment||""),updated_at:now};
   if(decision==="validated")patch.owner_validated_at=now;else{patch.revision_count=Number(reqRow.revision_count||0)+1;patch.last_returned_at=now}
   const {data,error}=await sb.from("assisted_course_requests").update(patch).eq("id",reqRow.id).select("*").single();if(error)throw error;
   await sb.from("courses").update({assisted_status:status,updated_at:now}).eq("id",courseId);
   await log(sb,courseId,userId,decision==="validated"?"assisted_draft_owner_validated":"assisted_draft_changes_requested",{request_id:reqRow.id,comment:String(b.comment||"")});
   return json({success:true,request:data});
  }
  if(action==="save_course_certification_request"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);const c=b.certification||{};
   const resolved=await resolveCertificationRegistry(sb,courseId,c);
   if(!resolved.organization_name||!resolved.certification_name)return json({success:false,error:"MISSING_CERTIFICATION_FIELDS"},400);
   const row:any={course_id:courseId,organization_id:resolved.organization_id||null,recognition_partner_id:resolved.recognition_partner_id||null,recognition_program_id:resolved.recognition_program_id||null,logo_permission_id:resolved.logo_permission_id||null,certification_type:resolved.certification_type,organization_name:resolved.organization_name,certification_name:resolved.certification_name,certification_code:c.code||null,credit_value:resolved.credit_value??null,credit_unit:resolved.credit_unit||null,badge_url:resolved.badge_url||null,logo_url:resolved.logo_url||null,signature_url:resolved.signature_url||null,stamp_url:resolved.stamp_url||null,verification_url:resolved.verification_url||null,evidence_url:c.evidence_url||null,valid_from:c.valid_from||null,expires_at:c.expires_at||null,partner_website_url:resolved.partner_website_url||null,partner_description:resolved.partner_description||null,display_on_course:c.display_on_course!==false,display_on_certificate:c.display_on_certificate!==false,immutable_asset_snapshot:{permission:resolved.permission_snapshot,course_logo_authorized:resolved.course_logo_authorized,certificate_logo_authorized:resolved.certificate_logo_authorized,requested_at:new Date().toISOString()},status:"pending",requested_by:userId};
   const {data,error}=await sb.from("course_certifications").insert(row).select("*").single();if(error)throw error;await sb.from("courses").update({certification_requested:true,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"certification_requested",{certification_id:data.id,type:data.certification_type,registry_source:resolved.permission_snapshot.source});return json({success:true,certification:data});
  }
  if(action==="admin_list_course_certifications"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("course_certifications").select("*,courses(title,creator_id)").order("created_at",{ascending:false});if(error)throw error;return json({success:true,items:data||[]});
  }
  if(action==="admin_update_course_certification"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);const status=String(b.status||"");if(!["pending","validated","rejected","expired","revoked"].includes(status))return json({success:false,error:"INVALID_STATUS"},400);
   const {data:current,error:currentError}=await sb.from("course_certifications").select("*").eq("id",b.id).maybeSingle();if(currentError)throw currentError;if(!current)return json({success:false,error:"NOT_FOUND"},404);
   const patch:any={status,admin_comment:b.admin_comment||null,display_on_course:b.display_on_course===undefined?current.display_on_course:!!b.display_on_course,display_on_certificate:b.display_on_certificate===undefined?current.display_on_certificate:!!b.display_on_certificate,updated_at:new Date().toISOString()};
   if(status==="validated"){
    const resolved=await resolveCertificationRegistry(sb,current.course_id,{...current,type:current.certification_type,organization_id:current.organization_id,recognition_partner_id:current.recognition_partner_id,recognition_program_id:current.recognition_program_id,certification_name:current.certification_name,credit_value:current.credit_value,credit_unit:current.credit_unit,verification_url:current.verification_url});
    patch.validated_by=userId;patch.validated_at=new Date().toISOString();patch.organization_name=resolved.organization_name;patch.certification_name=resolved.certification_name;patch.logo_url=resolved.course_logo_authorized?resolved.logo_url:null;patch.badge_url=resolved.certificate_logo_authorized?(resolved.badge_url||resolved.logo_url):null;patch.signature_url=resolved.certificate_logo_authorized?resolved.signature_url:null;patch.stamp_url=resolved.certificate_logo_authorized?resolved.stamp_url:null;patch.partner_website_url=resolved.partner_website_url||null;patch.partner_description=resolved.partner_description||null;patch.logo_permission_id=resolved.logo_permission_id||null;patch.immutable_asset_snapshot={organization_name:resolved.organization_name,certification_name:resolved.certification_name,logo_url:patch.logo_url,badge_url:patch.badge_url,signature_url:patch.signature_url,stamp_url:patch.stamp_url,verification_url:resolved.verification_url,partner_website_url:resolved.partner_website_url,permission:resolved.permission_snapshot,display_on_course:patch.display_on_course,display_on_certificate:patch.display_on_certificate,captured_at:new Date().toISOString(),validated_by:userId};
   }
   const {data,error}=await sb.from("course_certifications").update(patch).eq("id",b.id).select("*").single();if(error)throw error;await log(sb,current.course_id,userId,"course_certification_status_updated",{certification_id:current.id,status});return json({success:true,item:data});
  }
  if(action==="validate_checklist"){
   const errors:string[]=[],warnings:string[]=[];
   const {data:c,error:courseError}=await sb.from("courses").select("*").eq("id",courseId).single();if(courseError)throw courseError;
   const {data:m}=await sb.from("course_modules").select("id,title,objective,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
   const {data:l}=await sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
   const {data:bl}=await sb.from("lesson_blocks").select("lesson_id,block_type,content_json").eq("course_id",courseId);
   const {data:assessments}=await sb.from("course_assessments").select("id,scope,lesson_id,module_id,required,passing_score,retry_cooldown_hours,remediation_after_attempts,remediation_mode,assessment_questions(count)").eq("course_id",courseId);
   if(!c.title?.trim())errors.push("Le titre de la formation est obligatoire.");
   if(!c.short_description?.trim())errors.push("Ajoutez la description courte visible avant achat.");
   if(!c.long_description?.trim())errors.push("Ajoutez la présentation détaillée de la formation.");
   if(!c.cover_image_url?.trim())errors.push("Ajoutez une image de couverture.");
   if(!c.category)errors.push("Sélectionnez une catégorie.");
   if(!c.level)errors.push("Sélectionnez un niveau.");
   if(!c.target_audience?.trim())warnings.push("Précisez le public cible.");
   if(!(c.objectives||[]).filter((x:any)=>String(x||"").trim()).length)errors.push("Ajoutez au moins un objectif pédagogique.");
   const design=c.learning_design_settings||{};
   if(!String(design.learner_persona||"").trim())warnings.push("Décrivez le profil type de l’apprenant pour mieux calibrer le contenu.");
   if(!String(design.success_outcome||"").trim())warnings.push("Définissez le résultat professionnel observable attendu en fin de formation.");
   if(design.drip_enabled&&Number(design.drip_interval_days||0)<1)errors.push("Le déblocage progressif doit avoir un intervalle d’au moins un jour.");
   if(design.delivery_mode==="cohort"&&!design.cohort_start_at)errors.push("Indiquez la date de démarrage de la cohorte.");
   const accessibility=design.accessibility||{};
   if(!Object.values(accessibility).some(Boolean))warnings.push("Aucun contrôle d’accessibilité n’a été déclaré (sous-titres, transcription, clavier, contraste ou textes alternatifs).");
   for(const [label,value] of [["leçon",c.lesson_passing_score],["module",c.module_passing_score],["examen final",c.final_passing_score]] as any[]){if(Number(value)<1||Number(value)>100)errors.push(`Le seuil global ${label} doit être compris entre 1 et 100 %.`)}
   
   const intro=(m||[]).find((x:any)=>x.is_intro);const conclusion=(m||[]).find((x:any)=>x.is_conclusion);const finalExam=(m||[]).find((x:any)=>x.is_final_exam);
   const assessmentPolicy=c.assessment_policy&&typeof c.assessment_policy==="object"?c.assessment_policy:{};
   const requireLessonAssessments=assessmentPolicy.lesson_assessment_required===true;
   const requireModuleAssessments=assessmentPolicy.module_assessment_required===true;
   const requireFinalAssessment=assessmentPolicy.final_assessment_required===true||c.certification_requested===true||c.requested_cpd===true||c.cpd_accredited===true;
   if(intro){ const introLessons=(l||[]).filter((x:any)=>x.module_id===intro.id); const introHasBlocks=introLessons.some((lesson:any)=>(bl||[]).some((block:any)=>block.lesson_id===lesson.id)); if(!introHasBlocks)errors.push("Construisez l’introduction avec au moins un bloc."); }
   const normalModules=(m||[]).filter((x:any)=>!x.is_intro&&!x.is_conclusion&&!x.is_final_exam);
   if(!intro)errors.push("Ajoutez l’introduction de la formation.");
   if(!normalModules.length)errors.push("Ajoutez au moins un module après l’introduction.");
   if(!conclusion)errors.push("Ajoutez la conclusion de la formation.");
   if(requireFinalAssessment&&!finalExam)errors.push("Ajoutez l’examen final requis par la politique de cette formation.");
   for(const mod of normalModules){
    const moduleLessons=(l||[]).filter((x:any)=>x.module_id===mod.id&&!x.is_module_intro);
    if(!moduleLessons.length)errors.push(`Le module « ${mod.title} » doit contenir au moins une leçon.`);
    const moduleAssessment=(assessments||[]).find((a:any)=>a.scope==="module"&&a.module_id===mod.id&&a.required!==false);
    if(requireModuleAssessments&&!moduleAssessment)errors.push(`Le module « ${mod.title} » doit avoir l’évaluation configurée comme obligatoire.`);
    else if(moduleAssessment) {
      if(Number(moduleAssessment.passing_score)<1||Number(moduleAssessment.passing_score)>100)errors.push(`Le seuil du module « ${mod.title} » doit être compris entre 1 et 100 %.`);
      if(Number(moduleAssessment.assessment_questions?.[0]?.count||0)===0)errors.push(`L’évaluation du module « ${mod.title} » ne contient aucune question.`);
      if(Number(moduleAssessment.remediation_after_attempts||0)<1)errors.push(`Configurez le seuil de remédiation du module « ${mod.title} ».`);
    }
    for(const lesson of moduleLessons){
      const lessonBlocks=(bl||[]).filter((x:any)=>x.lesson_id===lesson.id);
      if(!lessonBlocks.length)errors.push(`La leçon « ${lesson.title} » ne contient aucun bloc.`);
      const lessonAssessment=(assessments||[]).find((a:any)=>a.scope==="lesson"&&a.lesson_id===lesson.id&&a.required!==false);
      if(requireLessonAssessments&&!lessonAssessment)errors.push(`La leçon « ${lesson.title} » doit avoir l’évaluation configurée comme obligatoire.`);
      else if(lessonAssessment) {
        if(Number(lessonAssessment.passing_score)<1||Number(lessonAssessment.passing_score)>100)errors.push(`Le seuil de la leçon « ${lesson.title} » doit être compris entre 1 et 100 %.`);
        if(Number(lessonAssessment.assessment_questions?.[0]?.count||0)===0)errors.push(`L’évaluation de la leçon « ${lesson.title} » ne contient aucune question.`);
        if(Number(lessonAssessment.remediation_after_attempts||0)<1)errors.push(`Configurez le seuil de remédiation de la leçon « ${lesson.title} ».`);
      }
    }
   }
   const finalAssessment=(assessments||[]).find((a:any)=>a.scope==="final"&&a.required!==false);
   if(requireFinalAssessment&&!finalAssessment)errors.push("L’examen final requis pour cette formation est absent.");
   else if(finalAssessment) {
    if(Number(finalAssessment.passing_score)<1||Number(finalAssessment.passing_score)>100)errors.push("Le seuil de l’examen final doit être compris entre 1 et 100 %.");
    if(Number(finalAssessment.assessment_questions?.[0]?.count||0)===0)errors.push("L’examen final ne contient aucune question.");
    if(Number(finalAssessment.remediation_after_attempts||0)<1)errors.push("Configurez le seuil de remédiation de l’examen final.");
   }
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)errors.push("Indiquez le prix de vente souhaité.");
   if(!c.sale_mode)errors.push("Choisissez si la formation est gratuite ou payante.");
   const calculatedDuration=await recalculateCourseDuration(sb,courseId);
   if(calculatedDuration<=0)errors.push("La durée pédagogique officielle n’a pas pu être calculée.");
   const report={valid:errors.length===0,errors,warnings,checked_at:new Date().toISOString(),calculated_duration_minutes:calculatedDuration};
   await sb.from("courses").update({calculated_duration_minutes:calculatedDuration,quality_status:report.valid?"ready":"incomplete",quality_report:report,quality_checked_at:report.checked_at,ready_to_submit:report.valid,updated_at:new Date().toISOString()}).eq("id",courseId);
   await log(sb,courseId,userId,"quality_check",{valid:report.valid,error_count:errors.length,warning_count:warnings.length});
   return json({success:true,...report});
  }
  if(action==="submit_course"){
   const {data:c,error}=await sb.from("courses").select("ready_to_submit,quality_report,sale_mode,desired_price_amount,current_version,creator_context,creator_id,pricing_status,admin_selected_price_xof,is_assisted,assisted_status").eq("id",courseId).single();if(error)throw error;
   if(!c.ready_to_submit)return json({success:false,errors:c.quality_report?.errors||["Exécutez le contrôle qualité et corrigez les éléments manquants."],warnings:c.quality_report?.warnings||[]},400);
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)return json({success:false,errors:["Indiquez le prix de vente souhaité dans Commercialisation."],warnings:[]},400);
   if(c.is_assisted&&!["owner_validated","pricing_review","ready_to_publish","completed"].includes(String(c.assisted_status||"")))return json({success:false,errors:["Validez d’abord le brouillon préparé par Omnia, ou demandez les corrections nécessaires."],warnings:[]},409);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const {data:lessons}=await sb.from("course_lessons").select("*").eq("course_id",courseId).order("position");
   const {data:blocks}=await sb.from("lesson_blocks").select("*").eq("course_id",courseId).order("position");
   const {data:assessments}=await sb.from("course_assessments").select("*").eq("course_id",courseId);
   const accelerated=isAdmin&&(c.creator_context==="super_admin"||c.creator_id===userId);
   if(c.sale_mode==="free"){
    await sb.from("courses").update({is_free:true,price_xof:0,pricing_status:"accepted",professor_price_accepted:true,professor_price_accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",courseId);
   }else if(accelerated&&c.pricing_status!=="accepted"){
    const selected=Math.max(0,Number(c.desired_price_amount||0));
    if(selected<=0)return json({success:false,errors:["Indiquez le prix décidé par Omnia."],warnings:[]},400);
    await sb.from("courses").update({score_calcule:null,prix_provisoire_xof:null,pricing_snapshot:{mode:"omnia_direct",calculated_at:new Date().toISOString()},pricing_status:"accepted",admin_selected_price_source:"omnia",admin_selected_price_xof:selected,pricing_admin_decided_at:new Date().toISOString(),pricing_admin_decided_by:userId,professor_price_accepted:true,professor_price_accepted_at:new Date().toISOString(),price_xof:selected,is_free:false,updated_at:new Date().toISOString()}).eq("id",courseId);
   }else if(c.sale_mode==="paid"&&c.pricing_status!=="accepted"&&String(c.creator_context||"")==="structure"){
    if(c.pricing_status==="en_attente_acceptation_prix_structure")return json({success:true,pricing_required:true,pricing_status:c.pricing_status,message:"Omnia a ajusté le prix. La Structure doit accepter le nouveau montant avant la soumission pédagogique."});
    await sb.from("courses").update({score_calcule:null,prix_provisoire_xof:null,pricing_snapshot:{mode:"structure_proposal_only",calculated_at:new Date().toISOString()},pricing_status:"en_attente_validation_prix_admin",professor_price_accepted:false,is_free:false,updated_at:new Date().toISOString()}).eq("id",courseId);
    await log(sb,courseId,userId,"structure_price_submitted",{desired_price_amount:Number(c.desired_price_amount||0)});
    return json({success:true,pricing_required:true,pricing_status:"en_attente_validation_prix_admin",message:"Le prix proposé par la Structure a été transmis à l’Administration Omnia. Aucun calcul automatique Professeur n’est appliqué."});
   }else if(c.sale_mode==="paid"&&c.pricing_status!=="accepted"){
    if(c.pricing_status==="en_attente_acceptation_prix_professeur")return json({success:true,pricing_required:true,pricing_status:c.pricing_status,message:"Le prix attend votre acceptation dans l’espace Tarification."});
    const pricing=await calculateCoursePricing(sb,courseId);
    await sb.from("courses").update({score_calcule:pricing.score,prix_provisoire_xof:pricing.price_xof,pricing_snapshot:pricing,pricing_status:"en_attente_validation_prix_admin",professor_price_accepted:false,is_free:false,updated_at:new Date().toISOString()}).eq("id",courseId);
    await log(sb,courseId,userId,"course_pricing_calculated",pricing);
    return json({success:true,pricing_required:true,pricing_status:"en_attente_validation_prix_admin",score_calcule:pricing.score,prix_provisoire_xof:pricing.price_xof,message:"Le prix automatique et votre proposition ont été transmis à l’Administration Omnia."});
   }
   const snapshot={course_id:courseId,modules:mods||[],lessons:lessons||[],blocks:blocks||[],assessments:assessments||[],captured_at:new Date().toISOString()};
   await sb.from("course_versions").upsert({course_id:courseId,version_label:c.current_version||"1.0",snapshot,status:"submitted",created_by:userId},{onConflict:"course_id,version_label"});

   let {data:courseReview}=await sb.from("quality_reviews").select("*").eq("course_id",courseId).in("status",["draft","submitted","in_review","changes_requested"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(courseReview){
    const {data,error:reviewUpdateError}=await sb.from("quality_reviews").update({status:"submitted",submitted_by:userId,review_type:accelerated?"fast_track":courseReview.review_type||"initial",accelerated,version_label:c.current_version||"1.0",completed_at:null,decision:null,decision_summary:null}).eq("id",courseReview.id).select("*").single();if(reviewUpdateError)throw reviewUpdateError;courseReview=data;
   }else{
    const {data,error:reviewInsertError}=await sb.from("quality_reviews").insert({entity_type:"course",course_id:courseId,review_type:accelerated?"fast_track":"initial",status:"submitted",submitted_by:userId,accelerated,version_label:c.current_version||"1.0"}).select("*").single();if(reviewInsertError)throw reviewInsertError;courseReview=data;
   }
   const {data:courseCriteria}=await sb.from("quality_criteria").select("id").eq("active",true).in("entity_type",["course","both"]);
   if(courseCriteria?.length)await sb.from("quality_review_items").upsert(courseCriteria.map((x:any)=>({review_id:courseReview.id,criterion_id:x.id})),{onConflict:"review_id,criterion_id",ignoreDuplicates:true});
   await sb.from("quality_review_history").insert({review_id:courseReview.id,course_id:courseId,actor_id:userId,event_type:"submitted",from_status:null,to_status:"submitted",note:accelerated?"Soumission Omnia en procédure accélérée":"Soumission au Centre Qualité",metadata:{version:c.current_version||"1.0",accelerated}});

   for(const assessment of assessments||[]){
    let {data:assessmentReview}=await sb.from("quality_reviews").select("*").eq("assessment_id",assessment.id).in("status",["draft","submitted","in_review","changes_requested"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(assessmentReview){
     const {data,error:assessmentReviewUpdateError}=await sb.from("quality_reviews").update({status:"submitted",submitted_by:userId,review_type:accelerated?"fast_track":assessmentReview.review_type||"initial",accelerated,version_label:c.current_version||"1.0",completed_at:null,decision:null,decision_summary:null}).eq("id",assessmentReview.id).select("*").single();if(assessmentReviewUpdateError)throw assessmentReviewUpdateError;assessmentReview=data;
    }else{
     const {data,error:assessmentReviewInsertError}=await sb.from("quality_reviews").insert({entity_type:"assessment",course_id:courseId,assessment_id:assessment.id,review_type:accelerated?"fast_track":"initial",status:"submitted",submitted_by:userId,accelerated,version_label:c.current_version||"1.0"}).select("*").single();if(assessmentReviewInsertError)throw assessmentReviewInsertError;assessmentReview=data;
    }
    const {data:assessmentCriteria}=await sb.from("quality_criteria").select("id").eq("active",true).in("entity_type",["assessment","both"]);
    if(assessmentCriteria?.length)await sb.from("quality_review_items").upsert(assessmentCriteria.map((x:any)=>({review_id:assessmentReview.id,criterion_id:x.id})),{onConflict:"review_id,criterion_id",ignoreDuplicates:true});
    await sb.from("course_assessments").update({quality_review_id:assessmentReview.id,quality_review_status:"submitted"}).eq("id",assessment.id);
   }
   await sb.from("courses").update({studio_status:"pending_validation",quality_review_id:courseReview.id,quality_review_status:"submitted",submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",courseId);
   await log(sb,courseId,userId,"course_submitted",{version:c.current_version||"1.0",quality_review_id:courseReview.id,accelerated});return json({success:true,version:c.current_version||"1.0",quality_review_id:courseReview.id,accelerated});
  }
  if(action==="get_change_logs"){const {data,error}=await sb.from("course_studio_logs").select("*,users(full_name)").eq("course_id",courseId).order("created_at",{ascending:false}).limit(100);if(error)throw error;return json({success:true,logs:data||[]})}
  if(action==="prepare_upload"){
   const bucket=String(b.bucket_name||"course-resources");
   if(bucket==="course-videos"&&cloudflareStreamConfigured()){
    const fileName=String(b.file_name||"").trim();const sizeBytes=Math.max(0,Number(b.size_bytes||0));
    if(!fileName||sizeBytes<=0)return json({success:false,error:"VIDEO_FILE_METADATA_REQUIRED"},400);
    const upload=await createDirectStreamUpload({fileName,sizeBytes,creator:String(userId),metadata:{course_id:String(courseId),module_id:String(b.module_id||""),lesson_id:String(b.lesson_id||""),block_id:String(b.block_id||"")}});
    return json({success:true,provider:"cloudflare_stream",stream_uid:upload.uid,protocol:upload.protocol,upload_url:upload.upload_url,headers:upload.headers,chunk_size_bytes:upload.chunk_size_bytes,requires_signed_urls:true});
   }
   const path=validCourseStoragePath(courseId,b.storage_path);if(!STUDIO_UPLOAD_BUCKETS.has(bucket)||!path)return json({success:false,error:"INVALID_STORAGE_TARGET"},400);const {data,error}=await sb.storage.from(bucket).createSignedUploadUrl(path,{upsert:true});if(error)throw error;return json({success:true,...data,provider:"supabase_storage",bucket,path});
  }
  if(action==="upload_block_file"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id,module_id,lesson_id,block_type,content_json,storage_path,bucket_name").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id,"can_upload_files")))return json({success:false,error:"FORBIDDEN"},403);
   if(String(b.provider||"")==="cloudflare_stream"){
    if(String(blk.block_type)!=="video")return json({success:false,error:"STREAM_ONLY_FOR_VIDEO_BLOCKS"},400);
    const streamUid=String(b.stream_uid||"").trim();if(!streamUid)return json({success:false,error:"STREAM_UID_REQUIRED"},400);
    const video=await getStreamVideo(streamUid);const meta=video?.meta||{};
    if(meta.course_id&&String(meta.course_id)!==String(blk.course_id))return json({success:false,error:"STREAM_COURSE_MISMATCH"},403);
    if(meta.block_id&&String(meta.block_id)!==String(b.block_id))return json({success:false,error:"STREAM_BLOCK_MISMATCH"},403);
    const persistedContent={...(blk.content_json||{}),url:null,provider:"cloudflare_stream",cloudflare_stream_uid:streamUid};
    const previousStreamUid=String(blk.content_json?.cloudflare_stream_uid||"").trim();const previousBucket=String((blk as any).bucket_name||"");const previousPath=String((blk as any).storage_path||"");
    const {data,error}=await sb.from("lesson_blocks").update({file_url:null,content_json:persistedContent,file_name:b.file_name,file_size:b.file_size,file_mime:b.file_mime,storage_path:null,bucket_name:null,updated_at:new Date().toISOString()}).eq("id",b.block_id).select("*").single();if(error)throw error;
    await sb.from("course_lessons").update({cloudflare_stream_uid:streamUid,video_url:null,updated_at:new Date().toISOString()}).eq("id",blk.lesson_id);
    if(previousStreamUid&&previousStreamUid!==streamUid)await deleteStreamVideo(previousStreamUid).catch(()=>{});if(previousPath&&PRIVATE_COURSE_BUCKET_SET.has(previousBucket))await sb.storage.from(previousBucket).remove([previousPath]).then(()=>{}).catch(()=>{});
    const decorated=await decorateStudioBlock(sb,data);return json({success:true,provider:"cloudflare_stream",stream_uid:streamUid,block:decorated,file_url:decorated.file_url});
   }
   const bucket=String(b.bucket_name||""),path=validCourseStoragePath(String(blk.course_id),b.storage_path);if(!STUDIO_UPLOAD_BUCKETS.has(bucket)||!path)return json({success:false,error:"INVALID_STORAGE_TARGET"},400);
   if(String(blk.block_type)==="scorm"){
    if(bucket!=="course-scorm"||!String(b.file_name||"").toLowerCase().endsWith(".zip"))return json({success:false,error:"SCORM_ZIP_REQUIRED",message:"Importez un package SCORM ZIP valide."},400);
    const scormBlock={...blk,id:b.block_id,module_id:b.module_id||null,lesson_id:b.lesson_id||null};
    const processed=await ingestScormPackage(sb,scormBlock,path);
    await sb.from("lesson_blocks").update({file_name:b.file_name,file_size:b.file_size,file_mime:b.file_mime}).eq("id",b.block_id);
    await log(sb,String(blk.course_id),userId,"scorm_package_ingested",{block_id:b.block_id,package_type:processed?.content_json?.package_type,launch_path:processed?.content_json?.launch_path});
    return json({success:true,provider:"scorm_private_proxy",block:processed,file_url:null,scorm_ready:true,package_type:processed?.content_json?.package_type});
   }
   const isPrivate=PRIVATE_COURSE_BUCKET_SET.has(bucket);const persistedUrl=isPrivate?path:`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${bucket}/${path}`;const persistedContent={...(blk.content_json||{}),url:persistedUrl,provider:"supabase_storage",cloudflare_stream_uid:null};const {data,error}=await sb.from("lesson_blocks").update({file_url:persistedUrl,content_json:persistedContent,file_name:b.file_name,file_size:b.file_size,file_mime:b.file_mime,storage_path:path,bucket_name:bucket,updated_at:new Date().toISOString()}).eq("id",b.block_id).select("*").single();if(error)throw error;await recalculateCourseDuration(sb,String(blk.course_id));const decorated=await decorateStudioBlock(sb,data);return json({success:true,provider:"supabase_storage",block:decorated,file_url:decorated.file_url});
  }
  if(action==="ai_generate_cover_images"){
   const prompt=String(b.prompt||"").trim();if(!prompt)return json({success:false,error:"PROMPT_REQUIRED"},400);
   const openaiKey=Deno.env.get("OPENAI_API_KEY");if(!openaiKey)return json({success:false,error:"OPENAI_API_KEY_MISSING",message:"Ajoutez OPENAI_API_KEY dans les secrets Supabase."},503);
   const count=Math.min(4,Math.max(1,Number(b.count)||3));const images:string[]=[];
   const safePrompt=`Image de couverture professionnelle pour une formation en ligne. ${prompt}. Format horizontal 16:9, composition claire, lisible en miniature, sans texte, sans logo, sans filigrane, sans personne sauf demande explicite. Style éducatif premium adapté à l'Afrique et au monde.`;
   for(let i=0;i<count;i++){
    const r=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Authorization":`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:getOpenAIImageModel(),prompt:`${safePrompt} Variante visuelle ${i+1}.`,size:"1536x1024",quality:"medium",n:1})});
    const out=await r.json();if(!r.ok)throw new Error(out?.error?.message||"IMAGE_GENERATION_FAILED");const b64=out?.data?.[0]?.b64_json;if(!b64)throw new Error("IMAGE_DATA_MISSING");
    const bytes=Uint8Array.from(atob(b64),(c)=>c.charCodeAt(0));const path=`${courseId}/ai-cover-${Date.now()}-${i+1}.png`;const {error:upErr}=await sb.storage.from("course-images").upload(path,bytes,{contentType:"image/png",upsert:true});if(upErr)throw upErr;
    images.push(`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/course-images/${path}`);
   }
   await sb.from("courses").update({cover_image_prompt:prompt,cover_image_candidates:images,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"cover_images_generated",{count:images.length});return json({success:true,images});
  }
  if(String(action).startsWith("ai_")){
   const input=String(b.text||b.content||b.topic||"").trim();if(!input)return json({success:false,error:"TEXT_REQUIRED"},400);
   const key=getAnthropicApiKey();if(!key)return json({success:true,result:"Service IA non configuré. Votre texte original a été conservé.",fallback:true});
   const prompts:Record<string,string>={ai_improve_text:"Améliore ce contenu pédagogique en français, sans inventer de faits.",ai_simplify_text:"Simplifie ce contenu pour un public débutant.",ai_correct_grammar:"Corrige uniquement la langue et la grammaire.",ai_summarize:"Résume clairement ce contenu.",ai_generate_qcm:"Génère un QCM avec 1 bonne réponse, 3 mauvaises réponses et une explication. Réponds en JSON.",ai_generate_true_false:"Génère une question vrai/faux avec explication. Réponds en JSON.",ai_generate_quiz:"Génère 5 questions variées avec corrigés. Réponds en JSON.",ai_create_summary:"Crée un résumé pédagogique structuré.",ai_create_remember:"Crée une liste concise de points à retenir.",ai_suggest_structure:"Propose une structure de modules et leçons.",ai_suggest_objectives:"Propose des objectifs pédagogiques mesurables.",ai_suggest_example:"Propose un exemple concret et réaliste."};
   const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:getAnthropicFastModel(),max_tokens:1400,messages:[{role:"user",content:`${prompts[action]||"Aide à améliorer ce contenu pédagogique."}\n\n${input}`} ]})});const out=await r.json();return json({success:r.ok,result:out?.content?.[0]?.text||"",error:r.ok?undefined:"AI_ERROR"},r.ok?200:502);
  }
  return json({success:false,error:"UNKNOWN_ACTION",action},400);
 }catch(e){console.error("studio-unified",e);return json({success:false,error:"SERVER_ERROR",message:(e as Error).message},500)}
});
