import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hasStructurePermission, validatedStructureAccess } from "../_shared/structure-access.ts";
import { PRIVATE_COURSE_BUCKET_SET, createSignedObjectUrl, normalizeAssistedDocument, parseStorageLocator, signAssistedDocuments } from "../_shared/protected-storage.ts";
import JSZip from "npm:jszip@3.10.1";
import * as XLSX from "npm:xlsx@0.18.5";
import { extractText as extractPdfDocumentText, getDocumentProxy } from "npm:unpdf@0.10.1";

import { getActiveOmniaSessionResult, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { runAiText, parseAiObject, normalizeAiPlainText, runAnthropicPdfText, runOpenAIImage, aiErrorPayload } from "../_shared/ai-runtime.ts";
import { cloudflareStreamConfigured, createDirectStreamUpload, deleteStreamVideo, getStreamVideo, signedStreamManifest } from "../_shared/cloudflare-stream.ts";
import { dispatchOmniaInAppNotification } from "../_shared/notifications.ts";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-omnia-session-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

const STUDIO_UPLOAD_BUCKETS=new Set<string>(["course-images",...PRIVATE_COURSE_BUCKET_SET]);
// B2: validate file metadata *before* issuing signed object-upload links.
// Keep unbound cover/assisted uploads unchanged: those use the same action without block_id.
const STUDIO_BLOCK_MEDIA_POLICY:Record<string,{bucket:string;extensions:string[];maxBytes:number|null}>={
 image:{bucket:"course-images",extensions:["jpg","jpeg","png","gif","webp"],maxBytes:20*1024*1024},
 video:{bucket:"course-videos",extensions:["mp4","mov","avi","mkv","webm"],maxBytes:null},
 audio:{bucket:"course-audios",extensions:["mp3","wav","ogg","m4a"],maxBytes:50*1024*1024},
 pdf:{bucket:"course-documents",extensions:["pdf"],maxBytes:25*1024*1024},
 word:{bucket:"course-documents",extensions:["doc","docx"],maxBytes:25*1024*1024},
 excel:{bucket:"course-excel",extensions:["xls","xlsx","csv"],maxBytes:25*1024*1024},
 scorm:{bucket:"course-scorm",extensions:["zip"],maxBytes:50*1024*1024},
 download:{bucket:"course-resources",extensions:["pdf","doc","docx","xls","xlsx","csv","ppt","pptx","txt","md","zip","png","jpg","jpeg","webp","gif","mp3","wav","ogg","m4a","mp4","webm"],maxBytes:50*1024*1024},
};
function studioMediaExt(name:unknown){return String(name||"").split(".").pop()?.toLowerCase().trim()||""}
function studioMediaMetadataValid(kind:string,bucket:string,fileName:unknown,size:unknown){
 const policy=STUDIO_BLOCK_MEDIA_POLICY[kind];if(!policy||policy.bucket!==bucket)return false;
 const bytes=Number(size);return !!String(fileName||"").trim()&&Number.isSafeInteger(bytes)&&bytes>0&&
  (policy.maxBytes===null||bytes<=policy.maxBytes)&&policy.extensions.includes(studioMediaExt(fileName));
}
function validCourseStoragePath(courseId:string,path:unknown){const clean=String(path||"").trim().replace(/^\/+/,"");return clean&&clean.startsWith(`${courseId}/`)?clean:""}
async function signNestedStudioRefs(sb:any,value:any,depth=0):Promise<any>{
 if(depth>5||value==null)return value;
 if(typeof value==="string"){const locator=parseStorageLocator(value);if(locator&&PRIVATE_COURSE_BUCKET_SET.has(locator.bucket)){const signed=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);return signed||null;}return value;}
 if(Array.isArray(value))return await Promise.all(value.map(item=>signNestedStudioRefs(sb,item,depth+1)));
 if(typeof value!=="object")return value;
 const out:any={};for(const [key,item] of Object.entries(value))out[key]=await signNestedStudioRefs(sb,item,depth+1);return out;
}
const PEDAGOGICAL_ACTIVITY_TYPES=new Set(["qcm","true_false","open_question","exercise","assignment_upload","case_study","flashcards","interactive_table","checklist","cloze","dictation","pronunciation","matching","sentence_order","oral_response","listening_comprehension","written_expression"]);
function relationTypeForBlock(blockType:string){if(blockType==="rubric")return "rubric_for";if(blockType==="correction")return "correction_for";return null;}
async function syncPedagogicalLinks(sb:any,sourceBlock:any,rawIds:any){
 const relationType=relationTypeForBlock(String(sourceBlock?.block_type||""));
 const ids=[...new Set((Array.isArray(rawIds)?rawIds:[]).map((x:any)=>String(x||"").trim()).filter(Boolean))];
 if(!relationType){if(ids.length)throw new Error("BLOCK_RELATION_NOT_SUPPORTED");return [];}
 if(relationType==="correction_for"&&ids.length>1)throw new Error("CORRECTION_SINGLE_TARGET_REQUIRED");
 if(ids.length){
  const {data:targets,error}=await sb.from("lesson_blocks").select("id,lesson_id,course_id,block_type,interaction_mode,title").in("id",ids);if(error)throw error;
  const map=new Map((targets||[]).map((x:any)=>[String(x.id),x]));
  for(const id of ids){const target:any=map.get(id);if(!target||String(target.lesson_id)!==String(sourceBlock.lesson_id)||String(target.course_id)!==String(sourceBlock.course_id))throw new Error("INVALID_BLOCK_RELATION_TARGET");if(!PEDAGOGICAL_ACTIVITY_TYPES.has(String(target.block_type)))throw new Error("RELATION_TARGET_NOT_ACTIVITY");if(relationType==="correction_for"&&String(target.interaction_mode)==="assessment")throw new Error("CORRECTION_TARGET_MUST_BE_TRAINING");}
 }
 const del=await sb.from("lesson_block_links").delete().eq("source_block_id",sourceBlock.id).eq("relation_type",relationType);if(del.error)throw del.error;
 if(ids.length){const rows=ids.map((targetId:string)=>({course_id:sourceBlock.course_id,lesson_id:sourceBlock.lesson_id,source_block_id:sourceBlock.id,target_block_id:targetId,relation_type:relationType}));const ins=await sb.from("lesson_block_links").insert(rows);if(ins.error)throw ins.error;}
 return ids;
}

async function incomingBlockLinkIds(sb:any,targetBlockId:string,relationType:string){
 const {data,error}=await sb.from("lesson_block_links").select("source_block_id").eq("target_block_id",targetBlockId).eq("relation_type",relationType);if(error)throw error;
 return (data||[]).map((x:any)=>String(x.source_block_id));
}
async function syncIncomingPedagogicalLinks(sb:any,targetBlock:any,relationType:string,sourceIds:any){
 const allowedSourceType=relationType==="rubric_for"?"rubric":"correction";
 const ids=[...new Set((Array.isArray(sourceIds)?sourceIds:[]).map((x:any)=>String(x)).filter(Boolean))];
 const {error:deleteError}=await sb.from("lesson_block_links").delete().eq("target_block_id",String(targetBlock.id)).eq("relation_type",relationType);if(deleteError)throw deleteError;
 if(!ids.length)return [];
 const {data:sources,error}=await sb.from("lesson_blocks").select("id,lesson_id,block_type").in("id",ids);if(error)throw error;
 const valid=(sources||[]).filter((row:any)=>String(row.lesson_id)===String(targetBlock.lesson_id)&&String(row.block_type)===allowedSourceType);
 if(valid.length!==ids.length)throw new Error("INVALID_PEDAGOGICAL_LINK_SOURCE");
 const payload=valid.map((row:any)=>({source_block_id:row.id,target_block_id:targetBlock.id,relation_type:relationType}));
 const {error:insertError}=await sb.from("lesson_block_links").insert(payload);if(insertError)throw insertError;
 return valid.map((row:any)=>String(row.id));
}
function assessmentBlockSettings(block:any){
 const settings=block?.settings_json&&typeof block.settings_json==="object"?block.settings_json:{};
 return {
  required: settings.assessment_required===true,
  passing_score: Math.min(100,Math.max(1,Number(settings.assessment_passing_score??80))),
 };
}
async function assessmentRequiredForBlock(sb:any,block:any,cfgRequired:boolean){
 const {data:course}=await sb.from("courses").select("assessment_policy,certification_requested,requested_cpd,cpd_accredited").eq("id",String(block.course_id)).maybeSingle();
 const policy=course?.assessment_policy&&typeof course.assessment_policy==="object"?course.assessment_policy:{};
 const scope=String(block.assessment_scope||"lesson");
 const policyRequired=scope==="lesson"?policy.lesson_assessment_required===true:scope==="module"?policy.module_assessment_required===true:policy.final_assessment_required===true||course?.certification_requested===true||course?.requested_cpd===true||course?.cpd_accredited===true;
 return cfgRequired||policyRequired;
}
function assessmentQuestionDataFromBlock(block:any){
 const content=block.content_json||{};const questionType=String(block.block_type);const automaticTypes=new Set(["qcm","true_false","cloze","matching","sentence_order","dictation","listening_comprehension"]);
 const responseMode=["exercise","case_study"].includes(questionType)?String(content.response_mode||(content.learner_upload_required===true?"file":"text")):null;
 const gradingMode=automaticTypes.has(questionType)?"automatic":(responseMode&&responseMode!=="text"?"human":String(content.grading_mode||"human"));
 let publicOptions:any=content.options||[];let correctAnswer:any=content.expected_answer??null;
 if(questionType==="qcm")correctAnswer=content.correctIndex;
 else if(questionType==="true_false")correctAnswer=content.answer;
 else if(questionType==="cloze"){correctAnswer=Array.isArray(content.answers)?content.answers:[];publicOptions={text:String(content.text||""),blank_count:Array.isArray(content.answers)?content.answers.length:Math.max(0,String(content.text||"").split("____").length-1)};}
 else if(questionType==="matching"){const pairs=Array.isArray(content.pairs)?content.pairs:[];correctAnswer=pairs.map((x:any)=>String(x.right||""));publicOptions={left:pairs.map((x:any)=>String(x.left||"")),choices:pairs.map((x:any)=>String(x.right||""))};}
 else if(questionType==="sentence_order"){const sentence=String(content.sentence||"");correctAnswer=[sentence,...(Array.isArray(content.accepted_orders)?content.accepted_orders:[])];publicOptions={tokens:Array.isArray(content.tokens)&&content.tokens.length?content.tokens:sentence.split(/\s+/).filter(Boolean)};}
 else if(questionType==="dictation")correctAnswer=String(content.transcript||"");
 else if(questionType==="listening_comprehension"){const questions=Array.isArray(content.questions)?content.questions:[];correctAnswer=questions.map((q:any)=>q.expected_answer??q.answer??q.correct_answer??"");publicOptions={questions:questions.map((q:any)=>({question:String(q.question||""),type:String(q.type||"text")}))};}
 else if(questionType==="case_study"){const questions=Array.isArray(content.questions)?content.questions:[];publicOptions={context:String(content.context||""),data:String(content.data||""),task:String(content.task||""),questions:questions.map((q:any)=>({question:String(typeof q==="string"?q:q?.question||q?.text||"")})).filter((q:any)=>q.question)};}
 const languagePrompt=questionType==="listening_comprehension"?(content.title||content.instructions||"Compréhension orale"):questionType==="dictation"?(content.instructions||"Transcrivez fidèlement l’audio."):questionType==="oral_response"?(content.prompt||"Réponse orale"):questionType==="pronunciation"?(content.instructions||"Prononcez les éléments demandés."):questionType==="written_expression"?(content.prompt||"Expression écrite"):questionType==="case_study"?(content.task||content.context||"Étude de cas"):null;
 return {question_type:questionType,prompt:assessmentPlainText(languagePrompt||String(content.question||content.statement||content.title||content.instructions||"Question à compléter")),points:Math.max(.1,Number(content.points??10)),grading_mode:gradingMode,response_mode:responseMode,response_layout:questionType==="case_study"?String(content.response_layout||"per_question"):null,options:sanitizeAssessmentValue(publicOptions),correct_answer:sanitizeAssessmentValue(correctAnswer),explanation:assessmentPlainText(content.explanation||""),localization_json:block.settings_json?.pedagogical_localization&&typeof block.settings_json.pedagogical_localization==="object"?block.settings_json.pedagogical_localization:{}};
}
async function syncExistingOfficialAssessmentFromBlock(sb:any,block:any){
 const sourceId=String(block.id||"");if(!sourceId)return;
 if(String(block.interaction_mode)!=="assessment"){
  await sb.from("assessment_questions").delete().eq("source_lesson_block_id",sourceId);
  return;
 }
 const scope=String(block.assessment_scope||"lesson");if(!["lesson","module","final"].includes(scope))return;
 const cfg=assessmentBlockSettings(block);const required=await assessmentRequiredForBlock(sb,block,cfg.required);const now=new Date().toISOString();
 let assessmentQuery=sb.from("course_assessments").select("*").eq("course_id",String(block.course_id)).eq("scope",scope);
 if(scope==="lesson")assessmentQuery=assessmentQuery.eq("lesson_id",String(block.lesson_id));
 else if(scope==="module")assessmentQuery=assessmentQuery.eq("module_id",String(block.module_id));
 else assessmentQuery=assessmentQuery.is("lesson_id",null).is("module_id",null);
 const existing=await assessmentQuery.maybeSingle();if(existing.error)throw existing.error;let assessment=existing.data;
 if(!assessment){
  const {data:course}=await sb.from("courses").select("title,assessment_policy").eq("id",String(block.course_id)).maybeSingle();const policy=course?.assessment_policy&&typeof course.assessment_policy==="object"?course.assessment_policy:{};const remediation=Math.max(1,Number(policy.default_remediation_after_attempts??3));const cooldown=Math.max(0,Number(policy.default_retry_cooldown_hours??24));
  const title=scope==="final"?`Examen final — ${course?.title||"Formation"}`:scope==="module"?"Évaluation du module":"Évaluation de la leçon";
  const inserted=await sb.from("course_assessments").insert({course_id:block.course_id,module_id:scope==="module"?block.module_id:null,lesson_id:scope==="lesson"?block.lesson_id:null,scope,title,passing_score:cfg.passing_score,max_attempts:remediation,remediation_after_attempts:remediation,retry_cooldown_hours:cooldown,remediation_mode:scope==="lesson"?"review_lesson":String(policy.default_remediation_mode||"review_module"),attempts_unlimited_for_purchased:true,required,correction_mode:"mixed",created_by:block.created_by||null,estimated_minutes:scope==="final"?45:scope==="module"?20:10}).select("*").single();if(inserted.error)throw inserted.error;assessment=inserted.data;
 }else{const updated=await sb.from("course_assessments").update({required:assessment.required===true,passing_score:cfg.passing_score,updated_at:now}).eq("id",assessment.id).select("*").single();if(updated.error)throw updated.error;assessment=updated.data;}
 const qdata=assessmentQuestionDataFromBlock(block);const rubric=await rubricCriteriaForTarget(sb,sourceId);const questionPayload={...qdata,rubric:rubric.length?rubric:(Array.isArray(block.content_json?.rubric)?block.content_json.rubric:[]),updated_at:now};
 const {data:question}=await sb.from("assessment_questions").select("id").eq("assessment_id",assessment.id).eq("source_lesson_block_id",sourceId).maybeSingle();
 if(question){const upd=await sb.from("assessment_questions").update(questionPayload).eq("id",question.id);if(upd.error)throw upd.error;}
 else{const {count}=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("assessment_id",assessment.id);const ins=await sb.from("assessment_questions").insert({...questionPayload,assessment_id:assessment.id,position:Number(count||0),source_lesson_block_id:sourceId});if(ins.error)throw ins.error;}
}
async function blockLinkIds(sb:any,blockId:string){const {data,error}=await sb.from("lesson_block_links").select("target_block_id").eq("source_block_id",blockId);if(error)throw error;return (data||[]).map((x:any)=>String(x.target_block_id));}
async function rubricCriteriaForTarget(sb:any,targetBlockId:string){
 const {data:links,error:linkError}=await sb.from("lesson_block_links").select("source_block_id").eq("relation_type","rubric_for").eq("target_block_id",targetBlockId);if(linkError)throw linkError;
 const ids=[...new Set((links||[]).map((x:any)=>String(x.source_block_id)))];if(!ids.length)return [];
 const {data:rubrics,error}=await sb.from("lesson_blocks").select("content_json").in("id",ids).eq("block_type","rubric");if(error)throw error;
 return (rubrics||[]).flatMap((row:any)=>Array.isArray(row.content_json?.criteria)?row.content_json.criteria:[]);
}
function rubricPointTotal(criteria:any){return (Array.isArray(criteria)?criteria:[]).reduce((sum:number,item:any)=>sum+Math.max(0,Number(item?.points||0)),0)}
function gradingModeLabel(mode:any){return mode==="automatic"?"Automatique":mode==="ai"?"IA":mode==="ai_human"?"IA + validation humaine":"Évaluateur humain";}
function safeJsonObject(text:any){try{return parseAiObject(text)}catch{return null}}
async function gradeAnswerWithAi(sb:any,params:{userId:string;courseId:string;assessmentId:string;question:any;answer:any}){
 const q=params.question;const max=Math.max(0,Number(q.points||0));const rubric=Array.isArray(q.rubric)?q.rubric:[];
 const answerText=typeof params.answer==="string"?params.answer:JSON.stringify(params.answer??null);
 if(!answerText||answerText==="null"||answerText.length>50000)return {ok:false,error:"AI_ANSWER_UNSUPPORTED"};
 const rubricText=rubric.length?rubric.map((c:any,i:number)=>`${i+1}. ${String(c?.label||c?.criterion||c?.title||"Critère")} — ${Math.max(0,Number(c?.points||0))} points${c?.description?` — ${String(c.description)}`:""}`).join("\n"):"Aucune grille détaillée. Évaluez strictement selon la consigne et le maximum de points.";
 const system=`Vous êtes le moteur de correction pédagogique d'Omnia Global Academy. Corrigez uniquement à partir de la consigne, de la réponse et de la grille fournies. N'ajoutez jamais de points. Le score doit être compris entre 0 et le maximum. Répondez uniquement en JSON valide: {"score":number,"feedback":"texte bref","criteria":[{"criterion":"texte","score":number,"max":number,"feedback":"texte"}]}.`;
 const prompt=`QUESTION:\n${String(q.prompt||"")}\n\nRÉPONSE APPRENANT:\n${answerText}\n\nBARÈME MAXIMUM: ${max}\n\nGRILLE:\n${rubricText}\n\nAttribuez les points. Le total des critères ne doit jamais dépasser ${max}.`;
 try{
  const result=await runAiText(sb,{context:{module:"studio",action:"assessment_ai_grading",userId:params.userId,courseId:params.courseId,metadata:{assessment_id:params.assessmentId,question_id:q.id}},system,prompt,tier:"quality",effort:"medium",maxTokens:3500,output:"structured",validate:value=>Number.isFinite(Number(value.score))});
  const parsed=safeJsonObject(result.text);if(!parsed||!Number.isFinite(Number(parsed.score)))return {ok:false,error:"AI_INVALID_GRADING_RESPONSE"};
  const score=Math.min(max,Math.max(0,Math.round(Number(parsed.score)*100)/100));
  return {ok:true,score,feedback:String(parsed.feedback||""),criteria:Array.isArray(parsed.criteria)?parsed.criteria:[],provider:result.provider,model:result.model,request_id:result.requestId};
 }catch(error){console.error("ASSESSMENT_AI_GRADING_FAILED",q.id,error);return {ok:false,error:(error as any)?.code||"AI_GRADING_FAILED"}}
}

async function decorateStudioBlock(sb:any,block:any){
 const content=await signNestedStudioRefs(sb,{...(block?.content_json||{})});
 const streamUid=String(content.cloudflare_stream_uid||"").trim();
 if(streamUid){
  try{const signed=await signedStreamManifest(streamUid,900);return {...block,file_url:signed.iframe_url,content_json:{...content,url:signed.iframe_url,provider:"cloudflare_stream"},_signed:true,_stream:true};}
  catch{return {...block,file_url:null,content_json:{...content,url:null,provider:"cloudflare_stream"},_signed:false,_stream:true};}
 }
 const bucket=String(block?.bucket_name||"");
 if(!PRIVATE_COURSE_BUCKET_SET.has(bucket))return {...block,content_json:content};
 const locator=parseStorageLocator(block.storage_path||block.file_url,bucket);
 if(!locator)return {...block,file_url:null,content_json:{...content,url:null}};
 const signed=await createSignedObjectUrl(sb,locator.bucket,locator.path,900);
 return {...block,file_url:signed,content_json:{...content,url:signed},_signed:!!signed};
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
async function owns(sb:any,userId:string,courseId:string,permission="can_edit_courses"){const {data}=await sb.from("courses").select("creator_id,creator_context,structure_id").eq("id",courseId).maybeSingle();if(!data)return false;const rs=await roles(sb,userId);if(rs.includes("super_admin"))return true;if(String(data.creator_context||"")==="structure"){if(!data.structure_id)return false;const access=await validatedStructureAccess(sb,userId,String(data.structure_id));return hasStructurePermission(access,permission)}return String(data.creator_id)===userId}
function coursePermissionForAction(action:string){if(action==="submit_course")return "can_submit_courses";if(["create_module","update_module","delete_module","create_lesson","update_lesson","delete_lesson","create_module_stage","create_block","update_block","delete_block","duplicate_block","remove_block_resource","reorder_blocks","ensure_special_sections","ensure_assessments","assessment_policy_update","assessment_policy_confirm_review","assessment_composition_get","assessment_section_create","assessment_section_update","assessment_section_delete","assessment_question_design_update"].includes(action))return "can_manage_lessons";if(["prepare_upload","upload_block_file","prepare_assessment_correction_upload"].includes(action))return "can_upload_files";return "can_edit_courses"}
async function log(sb:any,courseId:string,userId:string,action:string,details:any={}){await Promise.allSettled([sb.from("course_studio_logs").insert({course_id:courseId,user_id:userId,action,details}),sb.from("course_audit_log").insert({course_id:courseId,actor_id:userId,action,entity_type:"course",metadata:details})])}


const STUDIO_COPY:Record<string,Record<string,string>>={
 fr:{intro_module:'Introduction',welcome:'Introduction',conclusion:'Conclusion',conclusion_lesson:'Conclusion de la formation',final_exam:'Examen final'},
 en:{intro_module:'Introduction',welcome:'Introduction',conclusion:'Conclusion',conclusion_lesson:'Course conclusion',final_exam:'Final assessment'},
 es:{intro_module:'Introducción',welcome:'Introducción',conclusion:'Conclusión',conclusion_lesson:'Conclusión de la formación',final_exam:'Evaluación final'},
 pt:{intro_module:'Introdução',welcome:'Introdução',conclusion:'Conclusão',conclusion_lesson:'Conclusão da formação',final_exam:'Avaliação final'},
 de:{intro_module:'Einführung',welcome:'Einführung',conclusion:'Abschluss',conclusion_lesson:'Kursabschluss',final_exam:'Abschlussbewertung'},
 ar:{intro_module:'مقدمة',welcome:'مقدمة',conclusion:'الخاتمة',conclusion_lesson:'خاتمة الدورة',final_exam:'التقييم النهائي'},
 zh:{intro_module:'导言',welcome:'导言',conclusion:'总结',conclusion_lesson:'课程总结',final_exam:'最终评估'},
 ru:{intro_module:'Введение',welcome:'Введение',conclusion:'Заключение',conclusion_lesson:'Заключение курса',final_exam:'Итоговая оценка'},
 bm:{intro_module:'Introduction',welcome:'Introduction',conclusion:'Conclusion',conclusion_lesson:'Conclusion',final_exam:'Évaluation finale'}
};
function studioCopy(language:unknown,key:string){const lang=String(language||'fr').toLowerCase();return STUDIO_COPY[lang]?.[key]||STUDIO_COPY.en[key]||STUDIO_COPY.fr[key]||key}
const SUPPORTED_COURSE_LANGS=new Set(["fr","en","es","pt","ar","zh","ru","de","bm"]);
const CEFR_LEVELS=new Set(["A1","A2","B1","B2","C1","C2"]);
function normalizedCourseLanguage(value:unknown,fallback="fr"){const lang=String(value||"").trim().toLowerCase();return SUPPORTED_COURSE_LANGS.has(lang)?lang:fallback}
const AUTO_COPY:Record<string,Record<string,string>>={
 fr:{module:"Module",module_presentation:"Présentation du module",lesson:"Leçon"},
 en:{module:"Module",module_presentation:"Module overview",lesson:"Lesson"},
 es:{module:"Módulo",module_presentation:"Presentación del módulo",lesson:"Lección"},
 pt:{module:"Módulo",module_presentation:"Apresentação do módulo",lesson:"Lição"},
 de:{module:"Modul",module_presentation:"Modulübersicht",lesson:"Lektion"},
 ar:{module:"الوحدة",module_presentation:"نظرة عامة على الوحدة",lesson:"الدرس"},
 zh:{module:"模块",module_presentation:"模块概览",lesson:"课"},
 ru:{module:"Модуль",module_presentation:"Обзор модуля",lesson:"Урок"},
 bm:{module:"Module",module_presentation:"Module",lesson:"Leçon"}
};
function autoCopy(language:unknown,key:string){const lang=normalizedCourseLanguage(language);return AUTO_COPY[lang]?.[key]||AUTO_COPY.en[key]||key}
function detectImportLanguage(text:string){const t=String(text||'').slice(0,12000);if(/[\u0600-\u06ff]/.test(t))return'ar';if(/[\u4e00-\u9fff]/.test(t))return'zh';if(/[\u0400-\u04ff]/.test(t))return'ru';const low=` ${t.toLowerCase()} `;const scores:any={fr:[' le ',' la ',' les ',' des ',' une ',' pour ',' avec '],en:[' the ',' and ',' with ',' for ',' this ',' course '],es:[' el ',' la ',' los ',' una ',' para ',' con ',' curso '],pt:[' o ',' a ',' os ',' uma ',' para ',' com ',' curso '],de:[' der ',' die ',' das ',' und ',' mit ',' für ',' kurs ']};let best='fr',bestScore=-1;for(const [lang,words] of Object.entries(scores)){const score=(words as string[]).reduce((n,w)=>n+(low.split(w).length-1),0);if(score>bestScore){best=lang;bestScore=score}}return best}

function stripMarkup(value:unknown){return String(value||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<\/?[a-z][^>]*>/gi," ").replace(/\s+/g," ").trim()}
function wordCount(value:unknown){const text=stripMarkup(value);return text?text.split(/\s+/).filter(Boolean).length:0}
const COURSE_TEXT_WPM=250;
const COURSE_DURATION_ENGINE_VERSION="v2_3_active_time_250wpm_assessment_separation";
function clampDuration(value:number,min:number,max:number){return Math.min(max,Math.max(min,value))}
function durationSecondsFromContent(c:any){return Math.max(0,Number(c?.duration_seconds||c?.media_duration_seconds||c?.audio_duration_seconds||c?.video_duration_seconds||0))}
function blockActiveMinutes(block:any){
 const c=block?.content_json||{};const type=String(block?.block_type||"");
 const explicit=Math.max(0,Number(c.duration_min||c.duration_minutes||0));
 const explicitSeconds=durationSecondsFromContent(c);
 if(["video","audio","scorm"].includes(type)){
  if(explicit>0)return explicit;
  if(explicitSeconds>0)return explicitSeconds/60;
  return type==="scorm"?0:0.5;
 }
 if(["separator","rubric","correction"].includes(type))return 0;
 if(type==="image")return clampDuration(0.2+wordCount(`${c.caption||""} ${c.description||""}`)/COURSE_TEXT_WPM,0.2,1.5);
 if(type==="gallery")return clampDuration(0.25+(Array.isArray(c.images)?c.images.length:0)*0.12+wordCount(c.description||"")/COURSE_TEXT_WPM,0.25,3);
 if(type==="excel"||type==="table")return clampDuration(0.35+(Array.isArray(c.rows)?c.rows.length:0)*0.1,0.35,4);
 if(type==="pdf"||type==="word")return clampDuration(0.4+wordCount(`${c.extracted_text||""} ${c.text||""} ${c.description||""}`)/COURSE_TEXT_WPM,0.4,10);
 if(type==="download")return clampDuration(0.1+wordCount(c.description||"")/COURSE_TEXT_WPM,0.1,0.75);
 if(type==="vocabulary")return clampDuration((Array.isArray(c.items)?c.items.length:0)*0.25,0.5,5);
 if(type==="dialogue")return clampDuration((Array.isArray(c.lines)?c.lines.length:0)*0.2,0.5,5);
 if(type==="cloze")return clampDuration(wordCount(c.text||"")/COURSE_TEXT_WPM+(Array.isArray(c.answers)?c.answers.length:1)*0.25,1,6);
 if(type==="dictation")return clampDuration((explicitSeconds>0?explicitSeconds/60:wordCount(c.transcript||c.text||"")/90)+0.5,1.5,8);
 if(type==="pronunciation")return clampDuration((Array.isArray(c.items)?c.items.length:1)*0.5,1,6);
 if(type==="matching")return clampDuration((Array.isArray(c.pairs)?c.pairs.length:0)*0.25,1,5);
 if(type==="sentence_order")return clampDuration((Array.isArray(c.tokens)?c.tokens.length:0)*0.12,0.75,4);
 if(type==="oral_response")return clampDuration(wordCount(c.prompt||"")/COURSE_TEXT_WPM+Math.max(1,Number(c.response_minutes||c.target_minutes||2)),2,8);
 if(type==="listening_comprehension")return clampDuration((explicitSeconds>0?explicitSeconds/60:0.75)+(Array.isArray(c.questions)?c.questions.length:0)*0.75,2,10);
 if(type==="written_expression")return clampDuration(wordCount(c.prompt||c.instructions||"")/COURSE_TEXT_WPM+Math.max(1,Number(c.target_words||120)/35),3,15);
 if(type==="qcm"||type==="true_false")return 0.75;
 if(type==="open_question")return clampDuration(wordCount(c.question||c.prompt||c.instructions||"")/COURSE_TEXT_WPM+Math.max(1.5,Number(c.target_words||60)/35),2,6);
 if(type==="exercise")return clampDuration(3+wordCount(`${c.instructions||""} ${c.task||""} ${c.description||""}`)/COURSE_TEXT_WPM,3,8);
 if(type==="assignment_upload")return clampDuration(6+wordCount(`${c.instructions||""} ${c.task||""}`)/COURSE_TEXT_WPM,6,15);
 if(type==="case_study"){
  const readingWords=wordCount(`${c.context||""} ${c.data||""} ${c.description||""} ${c.task||""}`);
  const prompts=Array.isArray(c.questions)?c.questions.length:(Array.isArray(c.prompts)?c.prompts.length:1);
  return clampDuration(readingWords/COURSE_TEXT_WPM+Math.max(1,prompts)*1.5,4,12);
 }
 if(type==="flashcards")return clampDuration((Array.isArray(c.cards)?c.cards.length:0)*0.2,0.5,5);
 if(type==="accordion")return wordCount((c.items||[]).map((x:any)=>`${x?.title||""} ${x?.content||""}`).join(" "))/COURSE_TEXT_WPM;
 if(type==="interactive_table")return clampDuration((Array.isArray(c.rows)?c.rows.length:0)*0.15,0.4,4);
 if(type==="timeline")return clampDuration((Array.isArray(c.steps)?c.steps.length:0)*0.2,0.4,4);
 const textual=[c.html,c.text,c.content,c.definition,c.example,c.summary,c.instructions,c.task,c.description,c.transcription,c.code,c.latex,(c.points||[]).join?.(" "),(c.items||[]).map?.((x:any)=>typeof x==="string"?x:x?.text||"").join(" ")].filter(Boolean).join(" ");
 const words=wordCount(textual);
 return words>0?words/COURSE_TEXT_WPM:0;
}
function assessmentPlainText(value:any){
 let raw=String(value??"");if(!raw.trim())return "";
 raw=decodeXmlEntities(decodeXmlEntities(raw)).replace(/&nbsp;|&#160;|&#xA0;/gi," ");
 return raw.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<li\b[^>]*>/gi,"• ").replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi,"\n").replace(/<!--[\s\S]*?-->/g," ").replace(/<\/?[a-z][^>]*>/gi," ").replace(/\u00a0/g," ").replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").trim();
}
const ASSESSMENT_SECRET_KEYS=new Set(["correct_answer","correctanswer","correct_index","correctindex","expected_answer","expectedanswer","answer_key","answerkey","solution","solutions","explanation","rubric","grading_rubric","teacher_notes","instructor_notes","accepted_orders","transcript"]);
function publicAssessmentValue(value:any,depth=0):any{
 if(depth>8||value==null)return null;
 if(Array.isArray(value))return value.map(item=>publicAssessmentValue(item,depth+1));
 if(typeof value!=="object")return typeof value==="string"?assessmentPlainText(value):value;
 const out:any={};for(const [key,item] of Object.entries(value)){if(ASSESSMENT_SECRET_KEYS.has(key.toLowerCase()))continue;out[key]=publicAssessmentValue(item,depth+1);}return out;
}
function sanitizeAssessmentValue(value:any,depth=0):any{
 if(depth>6||value==null)return value;
 if(typeof value==="string")return assessmentPlainText(value);
 if(Array.isArray(value))return value.map(item=>sanitizeAssessmentValue(item,depth+1));
 if(typeof value!=="object")return value;
 const out:any={};for(const key of Object.keys(value))out[key]=sanitizeAssessmentValue(value[key],depth+1);return out;
}
function assessmentStableJson(value:any):string{
 if(value==null)return "null";
 if(Array.isArray(value))return `[${value.map(assessmentStableJson).join(",")}]`;
 if(typeof value==="object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${assessmentStableJson(value[key])}`).join(",")}}`;
 return JSON.stringify(value);
}
function assessmentQuestionSignature(question:any){
 return assessmentStableJson({
  type:String(question?.question_type||""),
  prompt:assessmentPlainText(question?.prompt||"").toLowerCase(),
  options:sanitizeAssessmentValue(question?.options||null),
  response_mode:String(question?.response_mode||""),
  response_layout:String(question?.response_layout||"")
 });
}
function canonicalAssessmentQuestions(rows:any[]){
 const sourceSignatures=new Set<string>();for(const row of rows||[])if(String(row?.source_lesson_block_id||""))sourceSignatures.add(assessmentQuestionSignature(row));
 const seenSourceIds=new Set<string>(),seenLegacySignatures=new Set<string>();const out:any[]=[];
 for(const row of rows||[]){
  const sourceId=String(row?.source_lesson_block_id||"");const signature=assessmentQuestionSignature(row);
  if(sourceId){if(seenSourceIds.has(sourceId))continue;seenSourceIds.add(sourceId);out.push(row);continue;}
  if(sourceSignatures.has(signature)||seenLegacySignatures.has(signature))continue;
  seenLegacySignatures.add(signature);out.push(row);
 }
 return out;
}
function stableQuestionOrder(rows:any[],assessmentId:string,userId:string,attemptNumber:number){
 function hash(value:string){let h=2166136261>>>0;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0}
 return [...rows].sort((a:any,b:any)=>hash(`${assessmentId}:${userId}:${attemptNumber}:${a.id}`)-hash(`${assessmentId}:${userId}:${attemptNumber}:${b.id}`));
}
function selectAssessmentQuestions(rows:any[],assessment:any,userId:string,attemptNumber:number){
 const canonical=canonicalAssessmentQuestions(rows||[]);
 const ordered=assessment?.randomize_questions===true?stableQuestionOrder(canonical,String(assessment.id),userId,attemptNumber):[...canonical].sort((a:any,b:any)=>Number(a.position||0)-Number(b.position||0));
 const limit=Math.max(0,Number(assessment?.random_question_count||0));
 return limit>0?ordered.slice(0,Math.min(limit,ordered.length)):ordered;
}

async function recalculateCourseDuration(sb:any,courseId:string){
 const [{data:blocks,error:blocksError},{data:assessments,error:assessmentsError},{data:lessons,error:lessonsError}]=await Promise.all([
  sb.from("lesson_blocks").select("id,lesson_id,block_type,content_json,interaction_mode").eq("course_id",courseId),
  sb.from("course_assessments").select("id,scope,module_id,lesson_id,estimated_minutes,required,is_active,assessment_questions(source_lesson_block_id)").eq("course_id",courseId),
  sb.from("course_lessons").select("id,module_id,stage_type,is_intro,is_module_intro,is_conclusion,is_final_exam,content_text").eq("course_id",courseId)
 ]);
 if(blocksError)throw blocksError;if(assessmentsError)throw assessmentsError;if(lessonsError)throw lessonsError;
 const activeAssessments=(assessments||[]).filter((a:any)=>a.is_active!==false&&a.required!==false);
 const requiredAssessmentBlockIds=new Set<string>(activeAssessments.flatMap((assessment:any)=>(Array.isArray(assessment.assessment_questions)?assessment.assessment_questions:[]).map((q:any)=>String(q?.source_lesson_block_id||"")).filter(Boolean)));
 const lessonMinutes=new Map<string,number>();let assessmentBlockMinutes=0;
 for(const lesson of lessons||[])lessonMinutes.set(String(lesson.id),0);
 for(const block of blocks||[]){
  const lessonId=String(block.lesson_id||"");if(!lessonId)continue;
  if(String(block.interaction_mode||"content")==="assessment"){
   if(requiredAssessmentBlockIds.has(String(block.id)))assessmentBlockMinutes+=blockActiveMinutes(block);
   continue;
  }
  lessonMinutes.set(lessonId,(lessonMinutes.get(lessonId)||0)+blockActiveMinutes(block));
 }
 for(const lesson of lessons||[]){
  const lessonId=String(lesson.id||"");if(!lessonId||Number(lessonMinutes.get(lessonId)||0)>0)continue;
  const words=wordCount(lesson.content_text||"");if(words>0)lessonMinutes.set(lessonId,words/COURSE_TEXT_WPM);
 }
 for(const [lessonId,minutes] of lessonMinutes.entries())if(minutes>0)lessonMinutes.set(lessonId,Math.max(0.5,minutes));
 let fallbackAssessmentMinutes=0;
 for(const assessment of activeAssessments){
  const sourceQuestions=Array.isArray(assessment.assessment_questions)?assessment.assessment_questions:[];
  const hasBuilderSource=sourceQuestions.some((q:any)=>String(q?.source_lesson_block_id||"").trim().length>0);
  if(!hasBuilderSource)fallbackAssessmentMinutes+=Math.max(0,Number(assessment.estimated_minutes||0));
 }
 await Promise.all((lessons||[]).map((lesson:any)=>{
  const minutes=Math.max(0,lessonMinutes.get(String(lesson.id))||0);
  const seconds=minutes>0?Math.max(30,Math.round(minutes*60)):0;
  return sb.from("course_lessons").update({cpd_calculated_time_seconds:seconds,updated_at:new Date().toISOString()}).eq("id",lesson.id);
 }));
 const contentMinutes=[...lessonMinutes.values()].reduce((sum:number,value:number)=>sum+Math.max(0,value),0);
 const minutes=Math.max(1,Math.round(contentMinutes+assessmentBlockMinutes+fallbackAssessmentMinutes));
 const {error:updateError}=await sb.from("courses").update({calculated_duration_minutes:minutes,total_duration_seconds:minutes*60,updated_at:new Date().toISOString()}).eq("id",courseId);
 if(updateError)throw updateError;
 return minutes;
}
async function ensurePublishedDurationEngineMigration(sb:any,userId:string){
 const setting=await sb.from("site_settings").select("value").eq("key","course_duration_engine_version").maybeSingle();
 if(setting.error)throw setting.error;
 const current=String(setting.data?.value?.version||setting.data?.value||"").replace(/^"|"$/g,"");
 if(current===COURSE_DURATION_ENGINE_VERSION)return {recalculated:0};
 const result=await sb.from("courses").select("id").or("is_published.eq.true,studio_status.eq.published");
 if(result.error)throw result.error;
 let recalculated=0;
 for(const row of result.data||[]){await recalculateCourseDuration(sb,String(row.id));recalculated++;}
 const marker={version:COURSE_DURATION_ENGINE_VERSION,recalculated_at:new Date().toISOString(),recalculated_courses:recalculated};
 const upsert=await sb.from("site_settings").upsert({key:"course_duration_engine_version",value:marker,updated_at:new Date().toISOString(),updated_by_admin_id:userId},{onConflict:"key"});
 if(upsert.error)throw upsert.error;
 return {recalculated};
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
 const old=block.content_json||{};const content={...old,url:null,provider:"scorm_private_proxy",scorm_ready:true,package_type:info.packageType,manifest_path:`${prefix}/${manifestPath}`,launch_path:launchRelative,scorm_package_prefix:prefix,duration_min:info.durationMin||0,duration_source:info.durationMin>0?"manifest":"automatic_unknown"};
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


const norm=(v:any)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g,"_");
function evalTextNorm(value:any){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function evalSimilarity(a:any,b:any){const x=evalTextNorm(a),y=evalTextNorm(b);if(!x&&!y)return 100;if(!x||!y)return 0;const prev=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=y.length;j++){const old=prev[j],cost=x[i-1]===y[j-1]?0:1;prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+cost);diagonal=old;}}const dist=prev[y.length];return Math.max(0,Math.round((1-dist/Math.max(x.length,y.length))*100))}

async function settingJson(sb:any,key:string,fallback:any){const {data}=await sb.from("site_settings").select("value").eq("key",key).maybeSingle();if(!data?.value)return fallback;try{return typeof data.value==="string"?{...fallback,...JSON.parse(data.value)}:{...fallback,...data.value}}catch{return fallback}}
function roundPrice(value:number,step:number){const safe=Math.max(1,Math.round(step||1));return Math.round(Math.max(0,value)/safe)*safe}
async function calculateCoursePricing(sb:any,courseId:string){
 const {data:course,error:courseError}=await sb.from("courses").select("id,creator_context,total_duration_seconds,calculated_duration_minutes,cpd_hours,desired_price_amount,sale_mode,certification_requested,requested_cpd,cpd_accredited,course_type,category").eq("id",courseId).single();if(courseError)throw courseError;
 const durationMinutes=Math.max(0,Math.round(Number(course?.total_duration_seconds||0)/60)||Math.round(Number(course?.calculated_duration_minutes||0)));
 const [{data:bands},{data:factors},{data:settings}]=await Promise.all([sb.from("professor_pricing_duration_bands").select("*").eq("is_active",true).order("min_minutes"),sb.from("professor_pricing_factors").select("*").eq("is_active",true).order("display_order"),sb.from("professor_pricing_settings").select("*").eq("singleton_key","default").maybeSingle()]);
 const band=(bands||[]).find((x:any)=>durationMinutes>=Number(x.min_minutes||0)&&(x.max_minutes==null||durationMinutes<Number(x.max_minutes)))||(bands||[]).slice(-1)[0]||null;
 if(!band)return {engine:"v3",configured:false,duration_minutes:durationMinutes,duration_band:null,applied_factors:[],price_xof:null,range_min_xof:null,range_max_xof:null,desired_price_xof:Number(course?.desired_price_amount||0)||null,rounding_step_xof:Number(settings?.rounding_step_xof||1),calculated_at:new Date().toISOString()};
 let value=Number(band.base_price_xof||0);const applied:any[]=[];
 const {data:assessmentRows}=await sb.from("course_assessments").select("scope,correction_mode,delivery_mode,jury_required,required").eq("course_id",courseId).eq("is_active",true);
 const liveCount=(await sb.from("course_live_content_links").select("id",{count:"exact",head:true}).eq("course_id",courseId)).count||0;
 const signals:Record<string,boolean>={human_correction:(assessmentRows||[]).some((a:any)=>a.correction_mode==="human"),jury:(assessmentRows||[]).some((a:any)=>a.jury_required===true),live:liveCount>0,external_certification:Boolean(course?.certification_requested),cpd:Boolean(course?.requested_cpd||course?.cpd_accredited)};
 const courseFieldAllowed=new Set(["category","course_type","sale_mode","certification_requested","requested_cpd","cpd_accredited"]);
 for(const factor of factors||[]){
  const key=String(factor.factor_key||"");const cfg=factor.config||{};const trigger=String(factor.trigger_type||"signal");let applies=false;
  if(trigger==="always")applies=true;
  else if(trigger==="course_field"&&courseFieldAllowed.has(String(cfg.field||""))){const actual=(course as any)?.[String(cfg.field)];const expected=cfg.value;applies=typeof actual==="boolean"?actual===Boolean(expected):String(actual??"").toLowerCase()===String(expected??"").toLowerCase();}
  else applies=signals[trigger]===true||signals[key]===true||cfg.always===true;
  if(!applies)continue;const before=value;if(factor.factor_type==="fixed_amount")value+=Number(factor.fixed_amount_xof||0);else if(factor.factor_type==="percentage")value*=1+Number(factor.multiplier||0)/100;else value*=Number(factor.multiplier||1);applied.push({key,name:factor.name_fr,type:factor.factor_type,trigger,before,after:value});
 }
 const step=Number(settings?.rounding_step_xof||1);const recommended=roundPrice(value,step);const lower=Math.max(0,roundPrice(recommended*(1-Number(settings?.lower_range_percent||0)/100),step));const upper=Math.max(lower,roundPrice(recommended*(1+Number(settings?.upper_range_percent||0)/100),step));
 return {engine:"v3",duration_minutes:durationMinutes,duration_band:band?{id:band.id,label:band.label,min_minutes:band.min_minutes,max_minutes:band.max_minutes,base_price_xof:Number(band.base_price_xof||0)}:null,applied_factors:applied,price_xof:recommended,range_min_xof:lower,range_max_xof:upper,desired_price_xof:Number(course?.desired_price_amount||0)||null,rounding_step_xof:step,calculated_at:new Date().toISOString()};
}

const defaults:Record<string,any>={
 heading:{text:"",level:1,alignment:"left"},subheading:{text:"",level:2,alignment:"left"},text:{html:""},separator:{style:"line"},callout:{type:"info",title:"",content:""},remember:{title:"",points:[]},objective:{text:""},example:{content:"",situation:"",explication:"",conclusion:""},summary:{content:"",intro:"",points:[]},image:{url:"",alt:"",caption:""},video:{url:"",eco_data:true},audio:{url:"",description:"",transcription:""},pdf:{url:"",title:"",description:"",downloadable:true},word:{url:"",title:"",description:""},excel:{url:"",title:"",sheet:"",preview_rows:[]},scorm:{url:"",title:"",package_type:"scorm_2004",duration_min:0,duration_source:"automatic",scorm_ready:false},
 vocabulary:{title:"",items:[]},dialogue:{title:"",lines:[]},cloze:{title:"",text:"",answers:[],instructions:""},dictation:{title:"",audio_url:"",transcript:"",instructions:""},pronunciation:{title:"",items:[],instructions:""},matching:{title:"",pairs:[],instructions:""},sentence_order:{title:"",sentence:"",tokens:[],accepted_orders:[],instructions:""},oral_response:{title:"",prompt:"",reference_audio_url:"",guidance:""},listening_comprehension:{title:"",audio_url:"",transcript:"",questions:[]},written_expression:{title:"",prompt:"",guidance:"",target_words:null},
 download:{url:"",title:"",description:""},qcm:{question:"",options:["",""],correctIndex:0,explanation:""},true_false:{statement:"",answer:true,explanation:""},open_question:{question:"",guidance:"",expected_answer:"",points:10},exercise:{title:"",instructions:"",task:"",resources:[],response_mode:"text",accepted_types:["pdf","doc","docx","xls","xlsx"],max_size_mb:10,learner_upload_required:false,points:10},accordion:{items:[]},flashcards:{cards:[]},interactive_table:{headers:[],rows:[],style:"table",mode:"explore"},timeline:{steps:[]},columns:{columns:[{id:crypto.randomUUID(),content:""},{id:crypto.randomUUID(),content:""}]},important:{content:""},case_study:{context:"",data:"",task:"",questions:[],response_mode:"text",response_layout:"per_question",accepted_types:["pdf","doc","docx","xls","xlsx","png","jpg"],max_size_mb:10},definition:{term:"",definition:"",example:""},correction:{content:"",key_points:[],reveal_mode:"after_attempt"},bullet_list:{items:[]},numbered_list:{items:[]},quote:{text:"",author:""},code:{language:"text",code:"",caption:""},checklist:{items:[]},link_button:{label:"",url:"",open_new_tab:true},embed:{url:"",title:""},gallery:{images:[]},formula:{latex:"",explanation:""},chart:{chart_type:"bar",title:"",labels:[],values:[],unit:""},assignment_upload:{title:"",instructions:"",accepted_types:["pdf","docx"],max_size_mb:10,points:10},rubric:{criteria:[]}
};
function defaultBlockForLanguage(type:string,_language:unknown){return structuredClone(defaults[type]||{})}


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
type CourseImportModule={title:string;objective?:string;presentation?:string;synthesis?:string;lessons:CourseImportLesson[]};
type CourseImportBlueprint={title:string;short_description:string;long_description?:string;prerequisites?:string;introduction?:string;objectives:string[];target_audience:string;learning_outcomes:string[];modules:CourseImportModule[]};

const COURSE_IMPORT_BUCKET="course-imports";
const COURSE_IMPORT_MAX_BYTES=25*1024*1024;
const COURSE_IMPORT_MAX_TEXT=180000;
const COURSE_IMPORT_ALLOWED=new Set(["pdf","docx","pptx","xlsx","zip","txt","md","csv"]);
const COURSE_IMPORT_DANGEROUS=new Set(["exe","dll","msi","bat","cmd","com","scr","ps1","psm1","vbs","js","mjs","cjs","jar","apk","ipa","sh","php","py","rb"]);

function importExtension(name:string){const clean=String(name||"").split(/[?#]/)[0];const part=clean.split(".").pop();return part&&part!==clean?part.toLowerCase():""}
function safeImportName(name:string){const ext=importExtension(name);const base=String(name||"document").replace(/\.[^.]+$/,"" ).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"document";return ext?`${base}.${ext}`:base}
function courseImportUploadMime(extension:string){const map:Record<string,string>={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",zip:"application/zip",txt:"text/plain",md:"text/markdown",csv:"text/csv",pptx:"application/octet-stream"};return map[extension]||"application/octet-stream"}
function cleanImportedText(value:string){return String(value||"").replace(/\u0000/g,"").replace(/\r\n?/g,"\n").replace(/[\t ]+\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").replace(/[ \t]{2,}/g," ").trim()}
function decodeXmlEntities(value:string){return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)))}
function stripOfficeXml(xml:string){return cleanImportedText(decodeXmlEntities(xml.replace(/<w:tab\/?\s*>/gi,"\t").replace(/<w:br\/?\s*>/gi,"\n").replace(/<\/w:p>/gi,"\n").replace(/<\/w:tr>/gi,"\n").replace(/<\/w:tc>/gi,"\t").replace(/<[^>]+>/g," ")))}
function escapeHtml(value:string){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function textToHtml(value:string){const paragraphs=cleanImportedText(value).split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).slice(0,80);return paragraphs.map(p=>`<p>${escapeHtml(p).replace(/\n/g,"<br>")}</p>`).join("")}
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
async function extractPptxText(bytes:Uint8Array){
 const archive=await JSZip.loadAsync(bytes,{checkCRC32:true});const parts:string[]=[];
 const slideNames=Object.keys(archive.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort((a,b)=>Number(a.match(/slide(\d+)/i)?.[1]||0)-Number(b.match(/slide(\d+)/i)?.[1]||0)).slice(0,250);
 for(const name of slideNames){const file=archive.file(name);if(!file)continue;const xml=await file.async("string");const text=stripOfficeXml(xml);if(text)parts.push(`DIAPOSITIVE ${parts.length+1}\n${text}`);const n=name.match(/slide(\d+)\.xml/i)?.[1];if(n){const note=archive.file(`ppt/notesSlides/notesSlide${n}.xml`);if(note){const noteText=stripOfficeXml(await note.async("string"));if(noteText)parts.push(`NOTES\n${noteText}`);}}}
 return cleanImportedText(parts.join("\n\n"));
}
type PptxRichSlide={index:number;title:string;text:string;notes:string;image_paths:string[];tables:Array<{headers:string[];rows:string[][]}>};
type PptxRichData={slides:PptxRichSlide[];image_count:number;table_count:number};
function pptxTextRuns(xml:string){return [...String(xml||"").matchAll(/<a:t>([\s\S]*?)<\/a:t>/gi)].map(match=>cleanImportedText(decodeXmlEntities(match[1]||""))).filter(Boolean)}
function pptxTables(xml:string){const tables:Array<{headers:string[];rows:string[][]}>=[];for(const match of String(xml||"").matchAll(/<a:tbl[\s\S]*?<\/a:tbl>/gi)){const rowValues:string[][]=[];for(const row of match[0].matchAll(/<a:tr[\s\S]*?<\/a:tr>/gi)){const cells=[...row[0].matchAll(/<a:tc[\s\S]*?<\/a:tc>/gi)].map(cell=>pptxTextRuns(cell[0]).join(" ").trim());if(cells.some(Boolean))rowValues.push(cells)}if(rowValues.length){const width=Math.max(...rowValues.map(row=>row.length));const first=rowValues[0]||[];const headers=first.map((value,index)=>value||`Colonne ${index+1}`);const rows=rowValues.slice(1).map(row=>Array.from({length:width},(_,index)=>row[index]||""));tables.push({headers,rows})}}return tables}
async function extractPptxRichData(bytes:Uint8Array):Promise<PptxRichData>{
 const archive=await JSZip.loadAsync(bytes,{checkCRC32:true});const slides:PptxRichSlide[]=[];
 const slideNames=Object.keys(archive.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort((a,b)=>Number(a.match(/slide(\d+)/i)?.[1]||0)-Number(b.match(/slide(\d+)/i)?.[1]||0)).slice(0,250);
 for(const name of slideNames){const n=Number(name.match(/slide(\d+)\.xml/i)?.[1]||slides.length+1);const file=archive.file(name);if(!file)continue;const xml=await file.async("string");const runs=pptxTextRuns(xml);const title=(runs[0]||`Diapositive ${n}`).slice(0,500);const text=cleanImportedText(runs.join("\n"));let notes="";const note=archive.file(`ppt/notesSlides/notesSlide${n}.xml`);if(note)notes=cleanImportedText(pptxTextRuns(await note.async("string")).join("\n"));
  const relFile=archive.file(`ppt/slides/_rels/slide${n}.xml.rels`);const relMap=new Map<string,string>();if(relFile){const relXml=await relFile.async("string");for(const rel of relXml.matchAll(/<Relationship\b[^>]*>/gi)){const tag=rel[0];const id=tag.match(/\bId="([^"]+)"/i)?.[1]||"";const rawTarget=tag.match(/\bTarget="([^"]+)"/i)?.[1]||"";const target=String(rawTarget).replace(/^\.\.\//,"");if(id&&target.startsWith("media/"))relMap.set(id,`ppt/${target}`)}}
  const imagePaths=[...xml.matchAll(/<a:blip[^>]+r:embed="([^"]+)"/gi)].map(match=>relMap.get(String(match[1]))||"").filter(path=>path&&archive.file(path));slides.push({index:n,title,text,notes,image_paths:[...new Set(imagePaths)],tables:pptxTables(xml)});
 }
 return {slides,image_count:slides.reduce((sum,slide)=>sum+slide.image_paths.length,0),table_count:slides.reduce((sum,slide)=>sum+slide.tables.length,0)};
}
function pptxFaithfulBlueprint(rich:PptxRichData,suggestedTitle:string,language:string):CourseImportBlueprint{
 const moduleWord=autoCopy(language,"module");const modules:CourseImportModule[]=[];const slides=rich.slides.slice(0,80);for(let index=0;index<slides.length;index+=5){const slice=slides.slice(index,index+5);modules.push({title:`${moduleWord} ${Math.floor(index/5)+1}`,objective:"",lessons:slice.map(slide=>({title:slide.title||`Diapositive ${slide.index}`,objective:"",content:cleanImportedText([slide.text,slide.notes].filter(Boolean).join("\n\n"))||slide.title,summary:"",questions:[]}))})}const all=slides.map(slide=>slide.text).join(" ");return {title:suggestedTitle||"Présentation",short_description:firstSentence(all,500),objectives:[],target_audience:"",learning_outcomes:[],modules};
}
function mediaMime(name:string){const ext=importExtension(name);if(["jpg","jpeg"].includes(ext))return "image/jpeg";if(ext==="png")return "image/png";if(ext==="webp")return "image/webp";if(ext==="gif")return "image/gif";if(ext==="svg")return "image/svg+xml";return "application/octet-stream"}
async function appendPptxRichBlocks(sb:any,userId:string,job:any,courseId:string,lessonIds:string[]){
 if(importExtension(String(job.original_name||""))!=="pptx"||!lessonIds.length)return {images:0,tables:0};const download=await sb.storage.from(String(job.bucket_name)).download(String(job.storage_path));if(download.error||!download.data)throw download.error||new Error("PPTX_DOWNLOAD_FAILED");const bytes=new Uint8Array(await download.data.arrayBuffer());const archive=await JSZip.loadAsync(bytes,{checkCRC32:true});const rich=await extractPptxRichData(bytes);const {data:lessonRows,error:lessonError}=await sb.from("course_lessons").select("id,module_id").in("id",lessonIds);if(lessonError)throw lessonError;const lessonMap=new Map((lessonRows||[]).map((row:any)=>[String(row.id),row]));const posMap=new Map<string,number>();for(const id of lessonIds){const {data:last}=await sb.from("lesson_blocks").select("position").eq("lesson_id",id).order("position",{ascending:false}).limit(1).maybeSingle();posMap.set(id,Number(last?.position??-1)+1)}let images=0,tables=0;
 for(let i=0;i<rich.slides.length;i++){const slide=rich.slides[i];const lessonId=lessonIds[Math.min(lessonIds.length-1,Math.floor(i*lessonIds.length/Math.max(1,rich.slides.length)))];const lesson=lessonMap.get(String(lessonId));if(!lesson)continue;let position=posMap.get(lessonId)||0;
  for(const table of slide.tables){const {error}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:lesson.module_id,lesson_id:lessonId,block_type:"interactive_table",position:position++,content_json:{headers:table.headers,rows:table.rows,mode:"explore",title:slide.title},settings_json:{},interaction_mode:"content",is_required:false,source_type:"file_import",source_provenance:{source_name:job.original_name,import_job_id:job.id,slide:slide.index,asset_type:"table"},ai_generated:false,created_by:userId});if(error)throw error;tables++}
  for(const imagePath of slide.image_paths){const file=archive.file(imagePath);if(!file)continue;const imageBytes=await file.async("uint8array");if(!imageBytes.length||imageBytes.length>12*1024*1024)continue;const fileName=imagePath.split("/").pop()||`slide-${slide.index}.png`;const storagePath=`${courseId}/imports/${job.id}/slide-${slide.index}-${crypto.randomUUID()}-${safeImportName(fileName)}`;const contentType=mediaMime(fileName);if(!contentType.startsWith("image/"))continue;const upload=await sb.storage.from("course-images").upload(storagePath,imageBytes,{contentType,upsert:false});if(upload.error)throw upload.error;const {error}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:lesson.module_id,lesson_id:lessonId,block_type:"image",position:position++,content_json:{alt:slide.title||`Illustration de la diapositive ${slide.index}`,caption:""},settings_json:{},bucket_name:"course-images",storage_path:storagePath,file_name:fileName,file_size:imageBytes.length,file_mime:contentType,interaction_mode:"content",is_required:false,preview_allowed:false,source_type:"file_import",source_provenance:{source_name:job.original_name,import_job_id:job.id,slide:slide.index,asset_type:"image",pptx_path:imagePath},ai_generated:false,created_by:userId});if(error)throw error;images++}
  posMap.set(lessonId,position);
 }
 await recalculateCourseDuration(sb,courseId);return {images,tables};
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
function extractXlsxPreview(bytes:Uint8Array){
 const workbook=XLSX.read(bytes,{type:"array",cellDates:false});const sheetName=workbook.SheetNames[0]||"";if(!sheetName)return {sheet:"",headers:[],preview_rows:[]};
 const sheet=workbook.Sheets[sheetName];if(!sheet)return {sheet:sheetName,headers:[],preview_rows:[]};
 const matrix=(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:"",blankrows:false}) as unknown[][]).slice(0,31).map(row=>row.slice(0,20).map(cell=>String(cell??"").slice(0,500)));
 if(!matrix.length)return {sheet:sheetName,headers:[],preview_rows:[]};
 const width=Math.max(1,...matrix.map(row=>row.length));const first=matrix[0]||[];const headers=Array.from({length:width},(_,index)=>String(first[index]||`Colonne ${index+1}`));
 const preview_rows=matrix.slice(1).map(row=>Array.from({length:width},(_,index)=>String(row[index]||"")));
 return {sheet:sheetName,headers,preview_rows};
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
 if(extension==="pptx")return await extractPptxText(bytes);
 if(extension==="xlsx")return extractXlsxText(bytes);
 if(extension==="zip")return await extractZipText(bytes,depth);
 return cleanImportedText(new TextDecoder("utf-8",{fatal:false}).decode(bytes));
}

function heuristicImportBlueprint(text:string,suggestedTitle:string,language:string):CourseImportBlueprint{
 const clean=cleanImportedText(text);const rawLines=clean.split("\n").map(x=>x.trim()).filter(Boolean);
 const modules:CourseImportModule[]=[];const lessonWord=autoCopy(language,"lesson");const moduleWord=autoCopy(language,"module");let currentModule:CourseImportModule={title:`${moduleWord} 1`,objective:"",lessons:[]};
 let lessonTitle=`${lessonWord} 1`;let buffer:string[]=[];
 const flushLesson=()=>{const content=cleanImportedText(buffer.join("\n"));if(!content)return;currentModule.lessons.push({title:lessonTitle,objective:firstSentence(content,180),content,summary:firstSentence(content,320)});buffer=[];lessonTitle=`${lessonWord} ${currentModule.lessons.length+1}`};
 const flushModule=()=>{flushLesson();if(currentModule.lessons.length)modules.push(currentModule);currentModule={title:`${moduleWord} ${modules.length+1}`,objective:"",lessons:[]};lessonTitle=`${lessonWord} 1`};
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
  const lessons=chunks.filter(Boolean).slice(0,18).map((chunk,index)=>({title:`${lessonWord} ${index+1}`,objective:firstSentence(chunk,180),content:cleanImportedText(chunk),summary:firstSentence(chunk,320)}));
  for(let index=0;index<lessons.length;index+=3)modules.push({title:`${moduleWord} ${Math.floor(index/3)+1}`,objective:"",lessons:lessons.slice(index,index+3)});
 }
 const bounded=modules.slice(0,8).map((module,index)=>({...module,title:module.title||`${moduleWord} ${index+1}`,lessons:module.lessons.slice(0,10)}));
 const title=suggestedTitle.trim()||titleFromFilename(suggestedTitle)||"Course";
 return {title,short_description:firstSentence(clean,500),long_description:clean.slice(0,2400),prerequisites:"",introduction:"",objectives:[],target_audience:"",learning_outcomes:[],modules:bounded};
}

function normalizeImportBlueprint(value:any,fallback:CourseImportBlueprint,language:string):CourseImportBlueprint{
 const source=value&&typeof value==="object"?value:{};const lessonWord=autoCopy(language,"lesson");const moduleWord=autoCopy(language,"module");
 const modules=(Array.isArray(source.modules)?source.modules:[]).slice(0,12).map((module:any,moduleIndex:number)=>({
  title:String(module?.title||`${moduleWord} ${moduleIndex+1}`).trim().slice(0,500),objective:String(module?.objective||"").trim().slice(0,2000),presentation:cleanImportedText(String(module?.presentation||"")).slice(0,2500),synthesis:cleanImportedText(String(module?.synthesis||module?.summary||"")).slice(0,2500),
  lessons:(Array.isArray(module?.lessons)?module.lessons:[]).slice(0,15).map((lesson:any,lessonIndex:number)=>({title:String(lesson?.title||`${lessonWord} ${lessonIndex+1}`).trim().slice(0,500),objective:String(lesson?.objective||"").trim().slice(0,1200),content:cleanImportedText(String(lesson?.content||lesson?.text||"")).slice(0,12000),summary:cleanImportedText(String(lesson?.summary||"")).slice(0,1800),questions:(Array.isArray(lesson?.questions)?lesson.questions:[]).slice(0,3).map((question:any)=>({question:String(question?.question||"").trim().slice(0,1200),options:stringList(question?.options,4).map(x=>x.slice(0,500)),correctIndex:Math.min(3,Math.max(0,Number(question?.correctIndex)||0)),explanation:String(question?.explanation||"").trim().slice(0,1800)})).filter((question:any)=>question.question&&question.options.length===4)})).filter((lesson:any)=>lesson.content||lesson.objective||lesson.summary)
 })).filter((module:any)=>module.lessons.length||module.presentation||module.synthesis);
 const normalizedModules=modules.length?modules:(fallback.modules||[]);
 return {title:String(source.title||fallback.title).trim().slice(0,500)||fallback.title,short_description:String(source.short_description||source.description||fallback.short_description||"").trim().slice(0,700),long_description:cleanImportedText(String(source.long_description||fallback.long_description||"")).slice(0,5000),prerequisites:cleanImportedText(String(source.prerequisites||fallback.prerequisites||"")).slice(0,2500),introduction:cleanImportedText(String(source.introduction||fallback.introduction||"")).slice(0,3500),objectives:stringList(source.objectives,16).length?stringList(source.objectives,16):fallback.objectives,target_audience:String(source.target_audience||fallback.target_audience||"").trim().slice(0,2500),learning_outcomes:stringList(source.learning_outcomes,16).length?stringList(source.learning_outcomes,16):fallback.learning_outcomes,modules:normalizedModules};
}
async function aiImportBlueprint(sb:any,userId:string,text:string,fallback:CourseImportBlueprint,language:string){
 const excerpt=cleanImportedText(text).slice(0,100000);const prompt=`Langue du contenu : ${language}. Conserve cette langue. Transforme la source en brouillon de formation éditable et fidèle. N'invente aucun fait absent. Réponds uniquement en JSON valide selon ce schéma : {"title":"","short_description":"","long_description":"","prerequisites":"","introduction":"","objectives":[""],"target_audience":"","learning_outcomes":[""],"modules":[{"title":"","objective":"","presentation":"","lessons":[{"title":"","objective":"","content":"texte brut","summary":"","questions":[{"question":"","options":["","","",""],"correctIndex":0,"explanation":""}]}],"synthesis":""}]}. Jusqu'à 12 modules, 15 leçons/module, 3 QCM/leçon. introduction, presentation et synthesis ne doivent reformuler que la source. Ne génère jamais la Conclusion de formation ni l'Examen final. TITRE SUGGÉRÉ : ${fallback.title}

CONTENU :
${excerpt}`;
 try{const result=await runAiText(sb,{context:{module:"studio",action:"import_blueprint",userId,metadata:{language,source_chars:excerpt.length}},tier:"fast",prompt,maxTokens:10000,effort:"low",output:"structured"});const parsed=parseAiObject(result.text);return {blueprint:normalizeImportBlueprint(parsed,fallback,language),ai_used:true,ai_error:null};}catch(error){const ai=aiErrorPayload(error);return {blueprint:fallback,ai_used:false,ai_error:ai.error}}
}
function importMode(value:any){const mode=String(value||"structured");return ["faithful","structured","enriched"].includes(mode)?mode:"structured"}
function importBlockFromLesson(lesson:any,mode:string){const blocks:any[]=[];if(lesson.objective)blocks.push({block_type:"objective",content_json:{text:lesson.objective}});if(lesson.content)blocks.push({block_type:"text",content_json:{html:textToHtml(lesson.content)}});if(mode==="enriched"&&lesson.summary)blocks.push({block_type:"summary",content_json:{content:lesson.summary,intro:lesson.summary,points:[]}});if(mode==="enriched")for(const q of lesson.questions||[])blocks.push({block_type:"qcm",content_json:q,interaction_mode:"training",is_required:false,training_passing_score:80});return blocks}
async function aiImportBlueprintFromPdf(sb:any,userId:string,pdfBytes:Uint8Array,fallback:CourseImportBlueprint,language:string,mode:string){
 const faithful=mode==="faithful";const prompt=`Analyse ce PDF comme source pédagogique multimodale${faithful?" en transcription fidèle":" en structuration fidèle"}. Préserve titres, tableaux, graphiques et informations visibles. N'invente aucun fait. Langue: ${language}. Retourne uniquement un JSON strict conforme à : {"title":"","short_description":"","long_description":"","prerequisites":"","introduction":"","objectives":[""],"target_audience":"","learning_outcomes":[""],"modules":[{"title":"","objective":"","presentation":"","lessons":[{"title":"","objective":"","content":"","summary":"","questions":[{"question":"","options":["","","",""],"correctIndex":0,"explanation":""}]}],"synthesis":""}]}. ${faithful?"N'ajoute aucun enrichissement et laisse vides les champs absents du document.":"Organise et reformule sans ajouter de connaissances externes."} Ne génère jamais la Conclusion de formation ni l'Examen final.`;
 try{const result=await runAnthropicPdfText(sb,{context:{module:"studio",action:"import_pdf_multimodal_blueprint",userId,metadata:{language,mode}},tier:"quality",pdfBytes,prompt,maxTokens:10000,effort:"low",output:"structured"});const parsed=parseAiObject(result.text);return {blueprint:normalizeImportBlueprint(parsed,fallback,language),ai_used:true,ai_error:null,pdf_multimodal:true};}catch(error){console.warn("IMPORT_PDF_MULTIMODAL_FALLBACK",(error as Error)?.message||error);return {blueprint:fallback,ai_used:false,ai_error:(error as Error)?.message||String(error),pdf_multimodal:false};}
}

async function analyzeImportSource(sb:any,userId:string,params:any){
 const bucket=String(params.bucket_name||"");const path=String(params.storage_path||"");const originalName=String(params.original_name||"").trim();if(bucket!==COURSE_IMPORT_BUCKET||!path.startsWith(`imports/${userId}/`))throw new Error("INVALID_IMPORT_PATH");const extension=importExtension(originalName);if(!COURSE_IMPORT_ALLOWED.has(extension))throw new Error("UNSUPPORTED_IMPORT_FORMAT");
 const download=await sb.storage.from(bucket).download(path);if(download.error||!download.data)throw download.error||new Error("IMPORT_DOWNLOAD_FAILED");const bytes=new Uint8Array(await download.data.arrayBuffer());if(bytes.byteLength>COURSE_IMPORT_MAX_BYTES)throw new Error("IMPORT_FILE_TOO_LARGE");
 const richPptx=extension==="pptx"?await extractPptxRichData(bytes):null;let extracted="";try{extracted=await extractCourseImportText(bytes,originalName)}catch(error){if(extension!=="pdf")throw error;console.warn("IMPORT_PDF_TEXT_EXTRACTION_FAILED",(error as Error)?.message||error)}
 if(!extracted.trim()&&richPptx)extracted=cleanImportedText(richPptx.slides.map(slide=>[slide.title,slide.text,slide.notes,...slide.tables.flatMap(table=>[table.headers.join(" | "),...table.rows.map(row=>row.join(" | "))])].filter(Boolean).join("\n")).join("\n\n"));
 const scannedPdf=extension==="pdf"&&!extracted.trim();const visualPptx=Boolean(richPptx&&richPptx.image_count>0);if(!extracted.trim()&&!scannedPdf&&!visualPptx)throw new Error("IMPORT_EMPTY");if(extracted.length>COURSE_IMPORT_MAX_TEXT)extracted=extracted.slice(0,COURSE_IMPORT_MAX_TEXT);
 const language=normalizedCourseLanguage(String(params.language||"").trim()||(extracted?detectImportLanguage(extracted):"fr"));const mode=importMode(params.mode);const title=String(params.title||"").trim()||titleFromFilename(originalName);
 const fallback:CourseImportBlueprint=scannedPdf?{title,short_description:"",long_description:"",prerequisites:"",introduction:"",objectives:[],target_audience:"",learning_outcomes:[],modules:[]}:(richPptx?pptxFaithfulBlueprint(richPptx,title,language):heuristicImportBlueprint(extracted,title,language));
 let generated:any={blueprint:fallback,ai_used:false,ai_error:null,pdf_multimodal:false};const allowAi=params.allow_ai!==false;
 if(extension==="pdf"&&(allowAi||scannedPdf)){generated=await aiImportBlueprintFromPdf(sb,userId,bytes,fallback,language,mode);if(scannedPdf&&!generated.ai_used)throw new Error("Le PDF semble être scanné et l'analyse visuelle n'a pas pu aboutir. Réessayez lorsque le moteur IA est disponible.");}else if(mode!=="faithful"&&allowAi){generated=await aiImportBlueprint(sb,userId,extracted,fallback,language)}
 const blueprint=normalizeImportBlueprint(generated.blueprint,fallback,language);if(!(blueprint.modules||[]).length)throw new Error("Aucune structure exploitable n'a pu être construite à partir de ce document.");
 return {bytes,extracted,language,mode,blueprint,ai_used:generated.ai_used,ai_error:generated.ai_error||null,pdf_multimodal:Boolean(generated.pdf_multimodal),scanned_pdf:scannedPdf,sha256:await sha256Hex(bytes),pptx_summary:richPptx?{slides:richPptx.slides.length,images:richPptx.image_count,tables:richPptx.table_count}:null};
}
async function createBlocksInLesson(sb:any,userId:string,courseId:string,moduleId:string,lessonId:string,lessons:any[],mode:string,source:any){const positionRes=await sb.from("lesson_blocks").select("position").eq("lesson_id",lessonId).order("position",{ascending:false}).limit(1).maybeSingle();let position=Number(positionRes.data?.position??-1)+1;for(const lesson of lessons){for(const block of importBlockFromLesson(lesson,mode)){const {error}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:moduleId,lesson_id:lessonId,block_type:block.block_type,position:position++,content_json:block.content_json,settings_json:{},interaction_mode:block.interaction_mode||"content",is_required:block.is_required??false,training_passing_score:block.training_passing_score??80,training_is_graded:true,source_type:"file_import",source_provenance:{source_name:source.name,import_job_id:source.job_id||null,mode},ai_generated:source.ai_used===true,created_by:userId});if(error)throw error;}}await recalculateCourseDuration(sb,courseId);}
async function createImportedModuleStage(sb:any,userId:string,courseId:string,moduleId:string,stageType:"module_presentation"|"module_summary",content:string,source:any){const clean=cleanImportedText(content);if(!clean)return null;const {data:existing,error:existingError}=await sb.from("course_lessons").select("id").eq("module_id",moduleId).eq("stage_type",stageType).maybeSingle();if(existingError)throw existingError;let lessonId=String(existing?.id||"");if(!lessonId){const title=stageType==="module_presentation"?"Présentation du module":"Synthèse du module";const position=stageType==="module_presentation"?-1:9999;const {data:created,error}=await sb.from("course_lessons").insert({course_id:courseId,module_id:moduleId,title,position,is_intro:false,is_module_intro:stageType==="module_presentation",is_required:false,stage_type:stageType}).select("id").single();if(error)throw error;lessonId=String(created.id)}const {data:last}=await sb.from("lesson_blocks").select("position").eq("lesson_id",lessonId).order("position",{ascending:false}).limit(1).maybeSingle();const {error:blockError}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:moduleId,lesson_id:lessonId,block_type:"text",position:Number(last?.position??-1)+1,content_json:{html:textToHtml(clean)},settings_json:{},interaction_mode:"content",is_required:false,source_type:"file_import",source_provenance:{source_name:source.name,import_job_id:source.job_id||null,stage_type:stageType},ai_generated:source.ai_used===true,created_by:userId});if(blockError)throw blockError;return lessonId;}
async function applyImportJob(sb:any,userId:string,job:any,params:any){
 const blueprint=job.blueprint||{};const mode=importMode(job.mode);const source={name:job.original_name,job_id:job.id,ai_used:job.analysis_metadata?.ai_used===true};
 if(job.target_type==="course"){const created=await createImportedCourse(sb,userId,String(params.creator_context||"professor"),blueprint,{bucket:job.bucket_name,path:job.storage_path,name:job.original_name,mime:job.mime_type,size:job.size_bytes,sha256:job.sha256,job_id:job.id},Boolean(job.analysis_metadata?.ai_used),job.detected_language,mode);const lessonIds=(created.modules||[]).filter((m:any)=>!m.is_intro).flatMap((m:any)=>(m.lessons||[]).filter((l:any)=>String(l.stage_type||"lesson")==="lesson").map((l:any)=>String(l.id)));const pptx_assets=await appendPptxRichBlocks(sb,userId,job,String(created.course.id),lessonIds);return {course:created.course,pptx_assets};}
 const courseId=String(job.course_id||params.course_id||"");if(!courseId||!(await owns(sb,userId,courseId)))throw new Error("FORBIDDEN");
 if(job.target_type==="module"){const moduleId=String(job.target_id||params.module_id||"");const {data:module}=await sb.from("course_modules").select("id").eq("id",moduleId).eq("course_id",courseId).maybeSingle();if(!module)throw new Error("MODULE_NOT_FOUND");const sourceModules=Array.isArray(blueprint.modules)?blueprint.modules:[];if(mode!=="faithful"){await createImportedModuleStage(sb,userId,courseId,moduleId,"module_presentation",cleanImportedText(sourceModules.map((m:any)=>m.presentation||"").filter(Boolean).join("\\n\\n")),source);await createImportedModuleStage(sb,userId,courseId,moduleId,"module_summary",cleanImportedText(sourceModules.map((m:any)=>m.synthesis||"").filter(Boolean).join("\\n\\n")),source)}const lessons=sourceModules.flatMap((m:any)=>m.lessons||[]);const {data:lastReal}=await sb.from("course_lessons").select("position").eq("module_id",moduleId).eq("stage_type","lesson").order("position",{ascending:false}).limit(1).maybeSingle();let pos=Number(lastReal?.position??-1)+1;const createdLessonIds:string[]=[];for(const lesson of lessons){const {data:row,error}=await sb.from("course_lessons").insert({course_id:courseId,module_id:moduleId,title:lesson.title||`Leçon ${pos+1}`,position:pos++,is_intro:false,is_module_intro:false,is_required:true,stage_type:"lesson",content_text:lesson.content||"",lesson_summary:lesson.summary||""}).select("id").single();if(error)throw error;await createBlocksInLesson(sb,userId,courseId,moduleId,row.id,[lesson],mode,source);createdLessonIds.push(String(row.id))}const pptx_assets=await appendPptxRichBlocks(sb,userId,job,courseId,createdLessonIds);await recalculateCourseDuration(sb,courseId);return {course_id:courseId,module_id:moduleId,created_lessons:lessons.length,pptx_assets};}
 if(job.target_type==="lesson"){const lessonId=String(job.target_id||params.lesson_id||"");const {data:lesson}=await sb.from("course_lessons").select("id,module_id").eq("id",lessonId).eq("course_id",courseId).maybeSingle();if(!lesson)throw new Error("LESSON_NOT_FOUND");const lessons=(blueprint.modules||[]).flatMap((m:any)=>m.lessons||[]);await createBlocksInLesson(sb,userId,courseId,lesson.module_id,lessonId,lessons,mode,source);const pptx_assets=await appendPptxRichBlocks(sb,userId,job,courseId,[lessonId]);return {course_id:courseId,lesson_id:lessonId,created_blocks:true,pptx_assets};}
 if(job.target_type==="block"){const blockId=String(job.target_id||params.block_id||"");const {data:block}=await sb.from("lesson_blocks").select("id,course_id,module_id,lesson_id,block_type").eq("id",blockId).eq("course_id",courseId).maybeSingle();if(!block)throw new Error("BLOCK_NOT_FOUND");const lesson=(blueprint.modules||[]).flatMap((m:any)=>m.lessons||[])[0]||{};const sourceText=String(lesson.content||"").trim();const sourceTitle=String(lesson.title||"").trim();const sourceSummary=String(lesson.summary||"").trim();const sourceObjective=String(lesson.objective||"").trim();let content:any={};if(block.block_type==="text")content={html:textToHtml(sourceText)};else if(block.block_type==="heading")content={text:sourceTitle||firstSentence(sourceText,140),level:2};else if(block.block_type==="subtitle")content={text:sourceTitle||firstSentence(sourceText,180)};else if(block.block_type==="objective")content={text:sourceObjective||firstSentence(sourceText,220)};else if(block.block_type==="summary")content={content:sourceSummary||firstSentence(sourceText,500),intro:sourceSummary||firstSentence(sourceText,500),points:[]};else if(block.block_type==="example")content={content:sourceText,situation:"",explication:"",conclusion:""};else if(block.block_type==="definition")content={term:sourceTitle,definition:sourceText};else if(["important","remember","key_takeaway"].includes(block.block_type))content={content:sourceText,text:sourceText,variant:block.block_type==="important"?"important":"key_takeaway"};else if(block.block_type==="quote")content={quote:sourceText,text:sourceText,author:""};else if(["bullet_list","numbered_list","list"].includes(block.block_type))content={items:sourceText.split(/\\n+/).map((item:string)=>item.replace(/^[-*•]\\s*/,"").trim()).filter(Boolean),ordered:block.block_type==="numbered_list"};else if(block.block_type==="code")content={code:sourceText,language:"text",caption:sourceTitle};else if(["interactive_table","table"].includes(block.block_type))content={headers:[sourceTitle||"Contenu"],rows:sourceText.split(/\\n+/).filter(Boolean).map((line:string)=>[line]),mode:"explore"};else if(block.block_type==="callout")content={type:"info",title:sourceTitle,content:sourceText};else throw new Error(`BLOCK_IMPORT_NOT_SUPPORTED:${block.block_type}`);const {error}=await sb.from("lesson_blocks").update({content_json:content,source_type:"file_import",source_provenance:{source_name:job.original_name,import_job_id:job.id,mode},ai_generated:Boolean(job.analysis_metadata?.ai_used),updated_at:new Date().toISOString()}).eq("id",blockId);if(error)throw error;await recalculateCourseDuration(sb,courseId);return {course_id:courseId,block_id:blockId};}
 throw new Error("INVALID_IMPORT_TARGET");
}

async function sha256Hex(bytes:Uint8Array){const input=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;const digest=await crypto.subtle.digest("SHA-256",input);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("")}

async function createImportedCourse(sb:any,userId:string,creatorContext:string,blueprint:CourseImportBlueprint,source:any,aiUsed:boolean,requestedLanguage="",mode="structured"){
 let structureId:string|null=null;if(creatorContext==="structure"){const access=await validatedStructureAccess(sb,userId);if(!access)throw new Error("STRUCTURE_NOT_VALIDATED");if(!hasStructurePermission(access,"can_create_courses"))throw new Error("STRUCTURE_COURSE_PERMISSION_REQUIRED");structureId=access.organizationId}
 const thresholdDefaults=await settingJson(sb,"assessment_threshold_defaults",{lesson_passing_score:80,module_passing_score:80,final_passing_score:70,competency_mastery_score:80,default_retry_cooldown_hours:24,default_remediation_after_attempts:3});const wordCount=(blueprint.modules||[]).flatMap(module=>module.lessons||[]).reduce((sum,lesson)=>sum+cleanImportedText(lesson.content||"").split(/\\s+/).filter(Boolean).length,0);const learningDesign={delivery_mode:"self_paced",drip_enabled:false,drip_interval_days:7,cohort_start_at:null,completion_policy:"all_required",require_sequential_progress:true,require_video_completion:false,import_source:{bucket:source.bucket,path:source.path,name:source.name,mime:source.mime,size:source.size,sha256:source.sha256,imported_at:new Date().toISOString(),ai_assisted:aiUsed,mode}};const importLanguage=normalizedCourseLanguage(requestedLanguage);
 const importedCourseId=crypto.randomUUID();const insert:any={id:importedCourseId,version_family_id:importedCourseId,title:blueprint.title||titleFromFilename(String(source.name||""))||"Course",creator_id:userId,instructor_id:userId,creator_context:creatorContext,structure_id:structureId,template_used:"file_import",studio_mode:"simple",studio_status:"draft",is_published:false,short_description:blueprint.short_description||"",long_description:blueprint.long_description||"",language:importLanguage,instruction_language:importLanguage,course_type:"standard",prerequisites:blueprint.prerequisites||"",objectives:blueprint.objectives||[],target_audience:blueprint.target_audience||"",learning_outcomes:blueprint.learning_outcomes||[],course_intro_title:blueprint.introduction?"Introduction":"",course_intro_summary:firstSentence(blueprint.introduction||"",500),free_preview_mode:"introduction",lesson_passing_score:Math.min(100,Math.max(1,Number(thresholdDefaults.lesson_passing_score??80))),module_passing_score:Math.min(100,Math.max(1,Number(thresholdDefaults.module_passing_score??80))),final_passing_score:Math.min(100,Math.max(1,Number(thresholdDefaults.final_passing_score??70))),assessment_policy:{default_retry_cooldown_hours:Number(thresholdDefaults.default_retry_cooldown_hours??24),default_remediation_after_attempts:Number(thresholdDefaults.default_remediation_after_attempts??3),competency_mastery_score:Number(thresholdDefaults.competency_mastery_score??80)},learning_design_settings:learningDesign,quality_status:"incomplete",ready_to_submit:false,current_version:"1.0",word_count:wordCount,estimated_read_min:Math.max(1,Math.ceil(wordCount/250))};if(creatorContext==="super_admin")insert.creator_type="plateforme";
 const {data:course,error:courseError}=await sb.from("courses").insert(insert).select("*").single();if(courseError)throw courseError;const moduleRows:any[]=[];const {data:introModule,error:introModuleError}=await sb.from("course_modules").insert({course_id:course.id,title:studioCopy(importLanguage,"intro_module"),objective:"",position:-1,is_intro:true,section_type:"introduction"}).select("*").single();if(introModuleError)throw introModuleError;const {data:introLesson,error:introLessonError}=await sb.from("course_lessons").insert({course_id:course.id,module_id:introModule.id,title:studioCopy(importLanguage,"welcome"),position:0,is_intro:true,stage_type:"introduction"}).select("*").single();if(introLessonError)throw introLessonError;let introBlockCount=0;if(cleanImportedText(blueprint.introduction||"")){const {error}=await sb.from("lesson_blocks").insert({course_id:course.id,module_id:introModule.id,lesson_id:introLesson.id,block_type:"text",position:0,content_json:{html:textToHtml(blueprint.introduction||"")},settings_json:{},interaction_mode:"content",is_required:false,source_type:"file_import",source_provenance:{source_name:source.name,mode,part:"introduction"},ai_generated:aiUsed,created_by:userId});if(error)throw error;introBlockCount=1}moduleRows.push({...introModule,lessons:[{...introLesson,stage_type:"introduction",has_blocks:introBlockCount>0,block_count:introBlockCount}]});
 for(const [moduleIndex,module] of (blueprint.modules||[]).entries()){const {data:moduleRow,error:moduleError}=await sb.from("course_modules").insert({course_id:course.id,title:module.title||`Module ${moduleIndex+1}`,objective:module.objective||"",position:moduleIndex,is_intro:false,section_type:"module"}).select("*").single();if(moduleError)throw moduleError;const lessonRows:any[]=[];if(mode!=="faithful"&&cleanImportedText(module.presentation||"")){const stageId=await createImportedModuleStage(sb,userId,course.id,moduleRow.id,"module_presentation",module.presentation||"",{name:source.name,job_id:source.job_id,ai_used:aiUsed});if(stageId)lessonRows.push({id:stageId,module_id:moduleRow.id,stage_type:"module_presentation",title:"Présentation du module",has_blocks:true,block_count:1})}for(const [lessonIndex,lesson] of (module.lessons||[]).entries()){const {data:lessonRow,error:lessonError}=await sb.from("course_lessons").insert({course_id:course.id,module_id:moduleRow.id,title:lesson.title||`${autoCopy(importLanguage,"lesson")} ${lessonIndex+1}`,position:lessonIndex,is_intro:false,is_module_intro:false,stage_type:"lesson",content_text:lesson.content||"",lesson_summary:lesson.summary||""}).select("*").single();if(lessonError)throw lessonError;const blocks=importBlockFromLesson(lesson,mode);let position=0;for(const block of blocks){const {error}=await sb.from("lesson_blocks").insert({course_id:course.id,module_id:moduleRow.id,lesson_id:lessonRow.id,block_type:block.block_type,position:position++,content_json:block.content_json,settings_json:{draft_from_import:true},interaction_mode:block.interaction_mode||"content",is_required:block.is_required??false,training_passing_score:block.training_passing_score??80,training_is_graded:true,source_type:"file_import",source_provenance:{source_name:source.name,mode},ai_generated:aiUsed,created_by:userId});if(error)throw error}lessonRows.push({...lessonRow,stage_type:"lesson",has_blocks:blocks.length>0,block_count:blocks.length})}if(mode!=="faithful"&&cleanImportedText(module.synthesis||"")){const stageId=await createImportedModuleStage(sb,userId,course.id,moduleRow.id,"module_summary",module.synthesis||"",{name:source.name,job_id:source.job_id,ai_used:aiUsed});if(stageId)lessonRows.push({id:stageId,module_id:moduleRow.id,stage_type:"module_summary",title:"Synthèse du module",has_blocks:true,block_count:1})}moduleRows.push({...moduleRow,lessons:lessonRows})}
 await recalculateCourseDuration(sb,course.id);await log(sb,course.id,userId,"course_import_completed",{source_name:source.name,source_mime:source.mime,source_size:source.size,source_sha256:source.sha256,ai_used:aiUsed,mode,module_count:blueprint.modules.length,lesson_count:blueprint.modules.reduce((sum,module)=>sum+(module.lessons||[]).length,0),draft_only:true});return {course,modules:moduleRows,summary:{modules:blueprint.modules.length,lessons:blueprint.modules.reduce((sum,module)=>sum+(module.lessons||[]).length,0),questions:blueprint.modules.reduce((sum,module)=>sum+(module.lessons||[]).reduce((lessonSum,lesson)=>lessonSum+(lesson.questions?.length||0),0),0),ai_used:aiUsed,draft_only:true}};
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const b=await req.json(); const action=b.action;

  // Action publique : aperçu gratuit de l’introduction avant achat.
  if(action==="public_course_preview"){
   const courseId=String(b.course_id||""); if(!courseId)return json({success:false,error:"COURSE_ID_REQUIRED"},400);
   const {data:course,error:courseError}=await sb.from("courses").select("id,title,short_description,long_description,cover_image_url,category,level,language,target_audience,objectives,learning_outcomes,course_intro_title,course_intro_summary,sale_mode,price_xof,desired_price_amount,sale_currency,free_preview_mode,preview_first_lesson_enabled,is_catalog_active,studio_status,is_published,creator_id,current_version").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const token=(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
   const viewerId=token?await sessionUser(sb,req):null; const viewerRoles=viewerId?await roles(sb,viewerId):[];
   const privileged=!!viewerId&&(viewerId===course.creator_id||viewerRoles.includes("super_admin"));
   if((!course.is_published||course.is_catalog_active===false)&&!privileged)return json({success:false,error:"NOT_FOUND"},404);
   const {data:modules,error:moduleError}=await sb.from("course_modules").select("id,title,objective,position,is_intro,is_conclusion,is_final_exam,section_type").eq("course_id",courseId).order("position");if(moduleError)throw moduleError;
   const moduleIds=(modules||[]).map((m:any)=>m.id);
   const {data:lessons,error:lessonError}=moduleIds.length?await sb.from("course_lessons").select("id,module_id,title,position,is_intro,is_module_intro,is_conclusion,is_final_exam,is_free_preview,cpd_calculated_time_seconds,stage_type").in("module_id",moduleIds).order("position"):{data:[],error:null};if(lessonError)throw lessonError;
   const sectionType=(m:any)=>String(m.section_type||(m.is_intro?"introduction":m.is_conclusion?"conclusion":m.is_final_exam?"final_exam":"module"));
   const stageType=(l:any)=>String(l.stage_type||(l.is_intro?"introduction":l.is_module_intro?"module_presentation":l.is_conclusion?"conclusion":l.is_final_exam?"final_exam":"lesson"));
   const introLesson=(lessons||[]).find((l:any)=>stageType(l)==="introduction")||null;
   const firstModule=(modules||[]).filter((m:any)=>sectionType(m)==="module").sort((a:any,b:any)=>Number(a.position||0)-Number(b.position||0))[0]||null;
   const firstPresentation=firstModule?(lessons||[]).filter((l:any)=>l.module_id===firstModule.id&&stageType(l)==="module_presentation")[0]||null:null;
   const realLessons=(lessons||[]).filter((l:any)=>stageType(l)==="lesson").sort((a:any,b:any)=>Number(a.position||0)-Number(b.position||0));
   const selectedPreviewLesson=realLessons.find((l:any)=>l.is_free_preview===true)||null;
   const firstLesson=selectedPreviewLesson||(firstModule?realLessons.find((l:any)=>l.module_id===firstModule.id)||null:null);
   const safePreviewTypes=new Set(["heading","subheading","text","separator","callout","remember","objective","example","summary","important","definition","bullet_list","numbered_list","quote","code","accordion","flashcards","interactive_table","checklist","link_button","timeline","columns","formula","chart","image","gallery","video","audio","pdf","word","excel","download","embed","vocabulary","dialogue","matching","cloze","sentence_order"]);
   async function previewBlocks(lesson:any){if(!lesson)return[];const {data,error}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,settings_json,file_url,file_name,file_size,file_mime,storage_path,bucket_name,interaction_mode,preview_allowed").eq("lesson_id",lesson.id).order("position");if(error)throw error;const filtered=(data||[]).filter((row:any)=>String(row.interaction_mode||"content")==="content"&&safePreviewTypes.has(String(row.block_type)));return await Promise.all(filtered.map((row:any)=>decorateStudioBlock(sb,row)));}
   const effectivePreviewMode=["none","introduction","introduction_first_lesson"].includes(String(course.free_preview_mode))?course.free_preview_mode:"introduction";
   const blocks=effectivePreviewMode!=="none"?await previewBlocks(introLesson):[];
   const presentationBlocks=effectivePreviewMode==="introduction_first_lesson"&&course.preview_first_lesson_enabled!==false?await previewBlocks(firstPresentation):[];
   const firstLessonBlocks=effectivePreviewMode==="introduction_first_lesson"&&course.preview_first_lesson_enabled!==false?await previewBlocks(firstLesson):[];
   const program=(modules||[]).sort((a:any,b:any)=>{const rank=(m:any)=>sectionType(m)==="introduction"?-100000:sectionType(m)==="conclusion"?100000:sectionType(m)==="final_exam"?200000:Number(m.position||0);return rank(a)-rank(b)}).map((m:any)=>{
    const st=sectionType(m);const moduleLessons=(lessons||[]).filter((l:any)=>l.module_id===m.id).sort((a:any,b:any)=>{const rank=(l:any)=>stageType(l)==="module_presentation"?-10000:stageType(l)==="module_summary"?10000:Number(l.position||0);return rank(a)-rank(b)});
    return {...m,section_type:st,lessons:moduleLessons.map((l:any)=>{const lt=stageType(l);const previewOn=effectivePreviewMode!=="none";const extended=effectivePreviewMode==="introduction_first_lesson"&&course.preview_first_lesson_enabled!==false;const allowed=previewOn&&(lt==="introduction"||(extended&&firstPresentation&&l.id===firstPresentation.id)||(extended&&firstLesson&&l.id===firstLesson.id));return {id:l.id,title:l.title,position:l.position,stage_type:lt,duration_seconds:Number(l.cpd_calculated_time_seconds||0),locked:!allowed,is_free_preview:l.is_free_preview===true};})};
   });
   return json({success:true,course,preview_enabled:effectivePreviewMode!=="none",introduction:introLesson?{...introLesson,stage_type:"introduction",blocks}:null,module_presentation:firstPresentation?{...firstPresentation,stage_type:"module_presentation",blocks:presentationBlocks}:null,first_lesson:firstLesson?{...firstLesson,stage_type:"lesson",blocks:firstLessonBlocks}:null,program,privileged,preview_rules:{progress_recorded:false,training_recorded:false,assessment_access:false}});
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
   if(isAdmin)await ensurePublishedDurationEngineMigration(sb,userId);
   const context=String(b.creator_context||"").trim();
   let q=sb.from("courses").select("id,title,studio_status,category,level,cover_image_url,creator_id,creator_context,structure_id,created_at,updated_at,word_count,estimated_read_min,calculated_duration_minutes,total_duration_seconds,last_autosave_at,admin_comment,template_used,submitted_at,is_published,is_catalog_active,is_current_catalog_version,version_family_id,version_number,course_code,price_xof,pricing_status,pricing_recommended_xof,pricing_range_min_xof,pricing_range_max_xof").order("updated_at",{ascending:false});
   if(!isAdmin) q=q.eq("creator_id",userId);
   if(context) q=q.eq("creator_context",context);
   const {data,error}=await q;if(error)throw error;const courses=data||[];const courseIds=courses.map((row:any)=>String(row.id));
   if(!courseIds.length)return json({success:true,courses:[]});
   const [{data:moduleRows,error:moduleError},{data:lessonRows,error:lessonError}]=await Promise.all([
    sb.from("course_modules").select("id,course_id,section_type,is_intro,is_conclusion,is_final_exam").in("course_id",courseIds),
    sb.from("course_lessons").select("id,course_id,stage_type,is_intro,is_module_intro,is_conclusion,is_final_exam").in("course_id",courseIds)
   ]);if(moduleError)throw moduleError;if(lessonError)throw lessonError;
   const moduleCount:Record<string,number>={},lessonCount:Record<string,number>={};for(const row of moduleRows||[]){const r:any=row;const st=r.section_type||(r.is_intro?"introduction":r.is_conclusion?"conclusion":r.is_final_exam?"final_exam":"module");if(st==="module")moduleCount[String(r.course_id)]=(moduleCount[String(r.course_id)]||0)+1;}for(const row of lessonRows||[]){const r:any=row;const st=r.stage_type||(r.is_intro?"introduction":r.is_module_intro?"module_presentation":r.is_conclusion?"conclusion":r.is_final_exam?"final_exam":"lesson");if(st==="lesson")lessonCount[String(r.course_id)]=(lessonCount[String(r.course_id)]||0)+1;}
   return json({success:true,courses:courses.map((row:any)=>({...row,module_count:moduleCount[String(row.id)]||0,lesson_count:lessonCount[String(row.id)]||0}))});
  }
  if(action==="course_stats"){
   const courseId=String(b.course_id||"");if(!courseId)return json({success:false,error:"COURSE_ID_REQUIRED"},400);if(!(await owns(sb,userId,courseId,"can_edit_courses")))return json({success:false,error:"FORBIDDEN"},403);
   const [{data:enrollments,error:enrollError},{data:lessons,error:lessonError}]=await Promise.all([sb.from("user_enrollments").select("user_id,enrolled_at,completed_at").eq("course_id",courseId).order("enrolled_at",{ascending:false}),sb.from("course_lessons").select("id,stage_type,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId)]);if(enrollError)throw enrollError;if(lessonError)throw lessonError;
   const learnerIds=(enrollments||[]).map((x:any)=>String(x.user_id));const realLessons=(lessons||[]).filter((x:any)=>String(x.stage_type||(x.is_intro?"introduction":x.is_module_intro?"module_presentation":x.is_conclusion?"conclusion":x.is_final_exam?"final_exam":"lesson"))==="lesson");const lessonIds=realLessons.map((x:any)=>String(x.id));
   const [{data:users,error:userError},{data:progress,error:progressError}]=await Promise.all([learnerIds.length?sb.from("users").select("id,full_name,email").in("id",learnerIds):Promise.resolve({data:[],error:null}),learnerIds.length&&lessonIds.length?sb.from("user_lesson_progress").select("user_id,lesson_id,is_completed,time_spent_seconds,updated_at,completed_at").eq("course_id",courseId).in("user_id",learnerIds).in("lesson_id",lessonIds):Promise.resolve({data:[],error:null})]);if(userError)throw userError;if(progressError)throw progressError;
   const userMap=new Map((users||[]).map((u:any)=>[String(u.id),u]));const progressByUser=new Map<string,any[]>();for(const row of progress||[]){const key=String((row as any).user_id);if(!progressByUser.has(key))progressByUser.set(key,[]);progressByUser.get(key)!.push(row)}const totalLessons=realLessons.length;
   const learners=(enrollments||[]).map((e:any)=>{const uid=String(e.user_id),rows=progressByUser.get(uid)||[],completedLessons=new Set(rows.filter((r:any)=>r.is_completed===true).map((r:any)=>String(r.lesson_id))).size,progressPercent=totalLessons?Math.round(completedLessons/totalLessons*100):(e.completed_at?100:0),lastActivity=rows.map((r:any)=>String(r.updated_at||r.completed_at||"")).filter(Boolean).sort().pop()||null,u=userMap.get(uid)||{};return {user_id:uid,full_name:u.full_name||"Apprenant",email:u.email||"",enrolled_at:e.enrolled_at,completed_at:e.completed_at,completed_lessons:completedLessons,total_lessons:totalLessons,progress_percent:progressPercent,last_activity_at:lastActivity,status:e.completed_at||progressPercent>=100?"completed":progressPercent>0?"active":"not_started"}});
   const completed=learners.filter((x:any)=>x.status==="completed").length,active=learners.filter((x:any)=>x.status==="active").length,average=learners.length?Math.round(learners.reduce((sum:number,x:any)=>sum+Number(x.progress_percent||0),0)/learners.length):0;return json({success:true,summary:{enrolled:learners.length,active,completed,average_progress:average,total_lessons:totalLessons},learners});
  }
  if(action==="toggle_catalog_active"){
   const id=String(b.course_id||"");if(!id)return json({success:false,error:"COURSE_ID_REQUIRED"},400);
   const {data:course,error:readError}=await sb.from("courses").select("id,creator_id,creator_context,structure_id,studio_status,is_published,is_catalog_active").eq("id",id).maybeSingle();if(readError)throw readError;if(!course)return json({success:false,error:"NOT_FOUND"},404);
   if(!(await owns(sb,userId,id,"can_edit_courses")))return json({success:false,error:"FORBIDDEN"},403);
   if(!["validated","published"].includes(String(course.studio_status||""))&&!course.is_published)return json({success:false,error:"COURSE_NOT_APPROVED",message:"Seule une formation agréée peut être activée dans le catalogue."},409);
   const active=b.active===true;const now=new Date().toISOString();
   const cataloguePatch:any={is_catalog_active:active,catalog_deactivated_at:active?null:now,updated_at:now};if(active)cataloguePatch.catalog_activated_at=now;
   const {data,error}=await sb.from("courses").update(cataloguePatch).eq("id",id).select("id,is_catalog_active,catalog_activated_at,catalog_deactivated_at").single();if(error)throw error;
   await log(sb,id,userId,active?"course_catalog_activated":"course_catalog_deactivated",{});return json({success:true,course:data});
  }
  if(action==="create_major_version"||action==="duplicate_course"){
   const independentDuplicate=action==="duplicate_course"||b.independent_duplicate===true;
   const sourceId=String(b.course_id||"");if(!sourceId)return json({success:false,error:"COURSE_ID_REQUIRED"},400);
   if(!(await owns(sb,userId,sourceId,"can_edit_courses")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:source,error:sourceError}=await sb.from("courses").select("*").eq("id",sourceId).maybeSingle();if(sourceError)throw sourceError;if(!source)return json({success:false,error:"COURSE_NOT_FOUND"},404);
   const familyId=String(source.version_family_id||source.id);const {data:versions,error:versionError}=await sb.from("courses").select("version_number,course_code").eq("version_family_id",familyId).order("version_number",{ascending:false}).limit(20);if(versionError)throw versionError;
   const nextVersion=Math.max(1,...(versions||[]).map((x:any)=>Number(x.version_number||1)))+1;
   const baseCode=String(source.course_code||"COURSE").replace(/-V\d+$/i,"").slice(0,26)||"COURSE";let nextCode=independentDuplicate?`${baseCode.slice(0,20)}-COPY-${crypto.randomUUID().slice(0,4).toUpperCase()}`.slice(0,32):`${baseCode}-V${nextVersion}`.slice(0,32);let suffix=1;
   if(!independentDuplicate)while((versions||[]).some((x:any)=>String(x.course_code||"").toUpperCase()===nextCode.toUpperCase())){nextCode=`${baseCode.slice(0,24)}-V${nextVersion}-${suffix++}`.slice(0,32)}
   const courseCopy={...source};for(const key of ["id","created_at","updated_at","submitted_at","validated_at","validated_by","published_at","admin_comment","last_autosave_at","catalog_activated_at","catalog_deactivated_at","superseded_at"])delete (courseCopy as any)[key];
   const duplicatedCourseId=crypto.randomUUID();Object.assign(courseCopy,{id:duplicatedCourseId,title:independentDuplicate?`${String(source.title||"Formation")} — copie`:source.title,course_code:nextCode,version_family_id:independentDuplicate?duplicatedCourseId:familyId,previous_version_course_id:independentDuplicate?null:source.id,version_number:independentDuplicate?1:nextVersion,current_version:independentDuplicate?"1.0":`${nextVersion}.0`,is_current_catalog_version:false,is_catalog_active:false,is_published:false,status:"brouillon",studio_status:"draft",builder_version:"v3",client_draft_key:null,quality_status:"incomplete",quality_report:null,ready_to_submit:false,submitted_at:null,validated_at:null,validated_by:null,published_at:null,moderated_at:null,moderated_by:null,rejection_reason:null,admin_comment:null,score_calcule:null,prix_provisoire_xof:null,pricing_recommended_xof:null,pricing_range_min_xof:null,pricing_range_max_xof:null,pricing_snapshot:{mode:String(source.creator_context||"")==="super_admin"?"omnia_direct":"v3_recalculate_required",cloned_from_course_id:source.id,independent_duplicate:independentDuplicate},pricing_status:String(source.creator_context||"")==="super_admin"?"accepted":"draft",admin_selected_price_source:String(source.creator_context||"")==="super_admin"?"omnia":null,admin_selected_price_xof:String(source.creator_context||"")==="super_admin"?source.price_xof:null,pricing_admin_decided_at:String(source.creator_context||"")==="super_admin"?new Date().toISOString():null,pricing_admin_decided_by:String(source.creator_context||"")==="super_admin"?userId:null,professor_price_accepted:String(source.creator_context||"")==="super_admin",professor_price_accepted_at:String(source.creator_context||"")==="super_admin"?new Date().toISOString():null,price_xof:String(source.creator_context||"")==="super_admin"?source.price_xof:null,is_assisted:independentDuplicate?false:source.is_assisted,assisted_request_id:independentDuplicate?null:source.assisted_request_id,assisted_status:independentDuplicate?null:source.assisted_status,certification_requested:independentDuplicate?false:source.certification_requested,catalog_activated_at:null,catalog_deactivated_at:null,updated_at:new Date().toISOString()});
   const insertResult=await sb.from("courses").insert(courseCopy).select("*").single();if(insertResult.error)throw insertResult.error;let newCourse=insertResult.data;if(independentDuplicate){const detached=await sb.from("courses").update({version_family_id:newCourse.id,is_current_catalog_version:true,updated_at:new Date().toISOString()}).eq("id",newCourse.id).select("*").single();if(detached.error)throw detached.error;newCourse=detached.data;}
   const moduleMap=new Map<string,string>(),lessonMap=new Map<string,string>(),blockMap=new Map<string,string>(),assessmentMap=new Map<string,string>();
   const {data:modules,error:modulesError}=await sb.from("course_modules").select("*").eq("course_id",source.id).order("position");if(modulesError)throw modulesError;
   for(const oldModule of modules||[]){const row={...oldModule,course_id:newCourse.id};delete row.id;delete row.created_at;delete row.updated_at;const {data:created,error}=await sb.from("course_modules").insert(row).select("*").single();if(error)throw error;moduleMap.set(String(oldModule.id),String(created.id));}
   const {data:lessons,error:lessonsError}=await sb.from("course_lessons").select("*").eq("course_id",source.id).order("position");if(lessonsError)throw lessonsError;
   for(const oldLesson of lessons||[]){const row={...oldLesson,course_id:newCourse.id,module_id:moduleMap.get(String(oldLesson.module_id))||null};delete row.id;delete row.created_at;delete row.updated_at;const {data:created,error}=await sb.from("course_lessons").insert(row).select("*").single();if(error)throw error;lessonMap.set(String(oldLesson.id),String(created.id));}
   const {data:blocks,error:blocksError}=await sb.from("lesson_blocks").select("*").eq("course_id",source.id).order("position");if(blocksError)throw blocksError;
   for(const oldBlock of blocks||[]){const row={...oldBlock,course_id:newCourse.id,module_id:moduleMap.get(String(oldBlock.module_id))||null,lesson_id:lessonMap.get(String(oldBlock.lesson_id))||null,created_by:userId,source_provenance:{...(oldBlock.source_provenance||{}),cloned_from_block_id:oldBlock.id,cloned_from_course_id:source.id}};delete row.id;delete row.created_at;delete row.updated_at;const {data:created,error}=await sb.from("lesson_blocks").insert(row).select("id").single();if(error)throw error;blockMap.set(String(oldBlock.id),String(created.id));}
   const oldBlockIds=[...blockMap.keys()];if(oldBlockIds.length){const {data:blockLinks,error:blockLinksError}=await sb.from("lesson_block_links").select("*").in("source_block_id",oldBlockIds);if(blockLinksError)throw blockLinksError;for(const oldLink of blockLinks||[]){const sourceBlockId=blockMap.get(String(oldLink.source_block_id)),targetBlockId=blockMap.get(String(oldLink.target_block_id));if(!sourceBlockId||!targetBlockId)continue;const row={course_id:newCourse.id,lesson_id:lessonMap.get(String(oldLink.lesson_id))||null,source_block_id:sourceBlockId,target_block_id:targetBlockId,relation_type:oldLink.relation_type};const {error}=await sb.from("lesson_block_links").insert(row);if(error)throw error;}}
   const {data:assessments,error:assError}=await sb.from("course_assessments").select("*").eq("course_id",source.id);if(assError)throw assError;
   for(const oldAssessment of assessments||[]){const row={...oldAssessment,course_id:newCourse.id,module_id:oldAssessment.module_id?moduleMap.get(String(oldAssessment.module_id))||null:null,lesson_id:oldAssessment.lesson_id?lessonMap.get(String(oldAssessment.lesson_id))||null:null,created_by:userId};delete row.id;delete row.created_at;delete row.updated_at;const {data:created,error}=await sb.from("course_assessments").insert(row).select("*").single();if(error)throw error;assessmentMap.set(String(oldAssessment.id),String(created.id));}
   const oldAssessmentIds=[...assessmentMap.keys()];if(oldAssessmentIds.length){const {data:questions,error:qError}=await sb.from("assessment_questions").select("*").in("assessment_id",oldAssessmentIds).order("position");if(qError)throw qError;for(const oldQuestion of questions||[]){const row={...oldQuestion,assessment_id:assessmentMap.get(String(oldQuestion.assessment_id)),source_lesson_block_id:oldQuestion.source_lesson_block_id?blockMap.get(String(oldQuestion.source_lesson_block_id))||null:null};delete row.id;delete row.created_at;delete row.updated_at;const {error}=await sb.from("assessment_questions").insert(row);if(error)throw error;}
    const {data:mappings,error:mappingError}=await sb.from("assessment_competency_mappings").select("*").in("assessment_id",oldAssessmentIds);if(mappingError)throw mappingError;for(const oldMapping of mappings||[]){const row={...oldMapping,assessment_id:assessmentMap.get(String(oldMapping.assessment_id))};delete row.id;delete row.created_at;delete row.updated_at;const {error}=await sb.from("assessment_competency_mappings").insert(row);if(error)throw error;}
   }
   if(!independentDuplicate){const {data:liveLinks}=await sb.from("course_live_content_links").select("*").eq("course_id",source.id).eq("is_active",true);for(const oldLink of liveLinks||[]){const row={...oldLink,course_id:newCourse.id,created_by:userId,updated_at:new Date().toISOString()};delete row.id;delete row.created_at;const {error}=await sb.from("course_live_content_links").insert(row);if(error)throw error;}const {data:certifications,error:certificationError}=await sb.from("course_certifications").select("*").eq("course_id",source.id).in("status",["pending","validated"]);if(certificationError)throw certificationError;for(const oldCertification of certifications||[]){const row={...oldCertification,course_id:newCourse.id,status:"pending",requested_by:userId,validated_by:null,validated_at:null,admin_comment:null,updated_at:new Date().toISOString(),immutable_asset_snapshot:{...(oldCertification.immutable_asset_snapshot||{}),cloned_from_certification_id:oldCertification.id,requires_revalidation:true}};delete row.id;delete row.created_at;const {error}=await sb.from("course_certifications").insert(row);if(error)throw error;}}
   await recalculateCourseDuration(sb,newCourse.id);await log(sb,newCourse.id,userId,independentDuplicate?"course_duplicated":"course_major_version_created",{source_course_id:source.id,version_family_id:independentDuplicate?newCourse.id:familyId,version_number:independentDuplicate?1:nextVersion});return json({success:true,course:newCourse,duplicated:independentDuplicate});
  }
  if(action==="assessment_composition_get"){
   const assessmentId=String(b.assessment_id||"");if(!assessmentId)return json({success:false,error:"ASSESSMENT_ID_REQUIRED"},400);
   const {data:assessment,error:assessmentError}=await sb.from("course_assessments").select("id,course_id,title,scope,passing_score,required").eq("id",assessmentId).maybeSingle();if(assessmentError)throw assessmentError;if(!assessment)return json({success:false,error:"ASSESSMENT_NOT_FOUND"},404);
   if(!(await owns(sb,userId,String(assessment.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const [{data:sections,error:sectionError},{data:questions,error:questionError}]=await Promise.all([
    sb.from("assessment_sections").select("*").eq("assessment_id",assessmentId).order("position").order("created_at"),
    sb.from("assessment_questions").select("id,assessment_id,section_id,position,prompt,question_type,points,grading_mode,response_mode,response_layout,max_submission_size_mb,accepted_submission_types,rubric,source_lesson_block_id").eq("assessment_id",assessmentId).order("position")
   ]);if(sectionError)throw sectionError;if(questionError)throw questionError;
   const sectionRows=(sections||[]).map((section:any)=>{const qs=(questions||[]).filter((q:any)=>String(q.section_id||"")===String(section.id));const actual_points=qs.reduce((sum:number,q:any)=>sum+Math.max(0,Number(q.points||0)),0);return {...section,actual_points,question_count:qs.length,balanced:section.target_points==null||Math.abs(actual_points-Number(section.target_points))<0.001};});
   const total_points=(questions||[]).reduce((sum:number,q:any)=>sum+Math.max(0,Number(q.points||0)),0);
   return json({success:true,assessment,sections:sectionRows,questions:questions||[],total_points,unassigned_count:(questions||[]).filter((q:any)=>!q.section_id).length});
  }
  if(action==="assessment_section_create"){
   const assessmentId=String(b.assessment_id||"");const title=String(b.title||"").trim();if(!assessmentId||!title)return json({success:false,error:"ASSESSMENT_AND_TITLE_REQUIRED"},400);
   const {data:assessment}=await sb.from("course_assessments").select("course_id").eq("id",assessmentId).maybeSingle();if(!assessment||!(await owns(sb,userId,String(assessment.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:last}=await sb.from("assessment_sections").select("position").eq("assessment_id",assessmentId).order("position",{ascending:false}).limit(1).maybeSingle();
   const target=b.target_points===null||b.target_points===undefined||b.target_points===""?null:Math.max(0.1,Number(b.target_points));
   const {data,error}=await sb.from("assessment_sections").insert({assessment_id:assessmentId,title,description:String(b.description||""),target_points:target,position:Number(last?.position??-1)+1,created_by:userId}).select("*").single();if(error)throw error;return json({success:true,section:data});
  }
  if(action==="assessment_section_update"){
   const sectionId=String(b.section_id||"");if(!sectionId)return json({success:false,error:"SECTION_ID_REQUIRED"},400);
   const {data:section}=await sb.from("assessment_sections").select("id,assessment_id,course_assessments!assessment_sections_assessment_id_fkey(course_id)").eq("id",sectionId).maybeSingle();const course=(section as any)?.course_assessments?.course_id;if(!section||!course||!(await owns(sb,userId,String(course),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const patch:any={updated_at:new Date().toISOString()};if(b.title!==undefined){const title=String(b.title||"").trim();if(!title)return json({success:false,error:"SECTION_TITLE_REQUIRED"},400);patch.title=title;}if(b.description!==undefined)patch.description=String(b.description||"");if(b.target_points!==undefined)patch.target_points=b.target_points===null||b.target_points===""?null:Math.max(0.1,Number(b.target_points));if(b.position!==undefined)patch.position=Math.max(0,Number(b.position)||0);
   if(b.response_mode!==undefined){const responseMode=b.response_mode?String(b.response_mode):null;if(responseMode&&!["text","file","text_file"].includes(responseMode))return json({success:false,error:"INVALID_RESPONSE_MODE"},400);if(responseMode&&!["exercise","case_study"].includes(String((question as any).question_type||"")))return json({success:false,error:"RESPONSE_MODE_NOT_SUPPORTED_FOR_QUESTION_TYPE"},400);const effectiveGrading=String((b.grading_mode??(question as any).grading_mode)||"human");if(responseMode&&responseMode!=="text"&&["ai","ai_human"].includes(effectiveGrading))return json({success:false,error:"AI_FILE_GRADING_NOT_AVAILABLE",message:"La correction IA des pièces jointes n’est pas activée. Utilisez Évaluateur humain ou une remise texte."},409);patch.response_mode=responseMode;}
   if(b.response_layout!==undefined){const layout=b.response_layout?String(b.response_layout):null;if(layout&&!["single","per_question"].includes(layout))return json({success:false,error:"INVALID_RESPONSE_LAYOUT"},400);patch.response_layout=layout;}
   if(b.max_submission_size_mb!==undefined)patch.max_submission_size_mb=b.max_submission_size_mb==null?null:Math.max(1,Math.min(50,Number(b.max_submission_size_mb)||10));
   if(b.grading_mode!==undefined){const mode=String(b.grading_mode);if(!["automatic","ai","human","ai_human"].includes(mode))return json({success:false,error:"INVALID_GRADING_MODE"},400);if(mode==="automatic"&&!["qcm","true_false","cloze","matching","sentence_order","dictation","listening_comprehension"].includes(String((question as any).question_type||"")))return json({success:false,error:"AUTOMATIC_MODE_NOT_SUPPORTED_FOR_QUESTION_TYPE"},400);const effectiveResponse=String((b.response_mode??(question as any).response_mode)||"");if(["ai","ai_human"].includes(mode)&&effectiveResponse&&effectiveResponse!=="text")return json({success:false,error:"AI_FILE_GRADING_NOT_AVAILABLE",message:"La correction IA des pièces jointes n’est pas activée. Utilisez Évaluateur humain ou une remise texte."},409);patch.grading_mode=mode;}
   const {data,error}=await sb.from("assessment_sections").update(patch).eq("id",sectionId).select("*").single();if(error)throw error;return json({success:true,section:data});
  }
  if(action==="assessment_section_delete"){
   const sectionId=String(b.section_id||"");const {data:section}=await sb.from("assessment_sections").select("id,assessment_id,course_assessments!assessment_sections_assessment_id_fkey(course_id)").eq("id",sectionId).maybeSingle();const course=(section as any)?.course_assessments?.course_id;if(!section||!course||!(await owns(sb,userId,String(course),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {count}=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("section_id",sectionId);if(Number(count||0)>0)return json({success:false,error:"SECTION_NOT_EMPTY",message:"Déplacez d’abord les questions de cette partie avant de la supprimer."},409);
   const {error}=await sb.from("assessment_sections").delete().eq("id",sectionId);if(error)throw error;return json({success:true});
  }
  if(action==="assessment_question_design_update"){
   const questionId=String(b.question_id||"");if(!questionId)return json({success:false,error:"QUESTION_ID_REQUIRED"},400);
   const {data:question,error:qError}=await sb.from("assessment_questions").select("id,assessment_id,question_type,grading_mode,response_mode,course_assessments!assessment_questions_assessment_id_fkey(course_id)").eq("id",questionId).maybeSingle();if(qError)throw qError;const course=(question as any)?.course_assessments?.course_id;if(!question||!course||!(await owns(sb,userId,String(course),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const patch:any={updated_at:new Date().toISOString()};if(b.points!==undefined){const points=Number(b.points);if(!Number.isFinite(points)||points<=0||points>10000)return json({success:false,error:"INVALID_QUESTION_POINTS"},400);patch.points=Math.round(points*100)/100;}
   if(b.section_id!==undefined){if(b.section_id){const {data:section}=await sb.from("assessment_sections").select("id").eq("id",String(b.section_id)).eq("assessment_id",question.assessment_id).maybeSingle();if(!section)return json({success:false,error:"SECTION_OUTSIDE_ASSESSMENT"},400);patch.section_id=section.id;}else patch.section_id=null;}
   if(b.position!==undefined)patch.position=Math.max(0,Number(b.position)||0);
   const {data,error}=await sb.from("assessment_questions").update(patch).eq("id",questionId).select("id,section_id,position,points").single();if(error)throw error;return json({success:true,question:data});
  }
  if(action==="question_bank_list"){
   let q=sb.from("question_bank").select("*").eq("is_active",true).order("updated_at",{ascending:false}).limit(500);if(!isAdmin)q=q.eq("owner_id",userId);if(b.category)q=q.eq("category",String(b.category));if(b.question_type)q=q.eq("question_type",String(b.question_type));const {data,error}=await q;if(error)throw error;return json({success:true,questions:data||[]});
  }
  if(action==="question_bank_save"){
   const item=b.question||{};const title=String(item.title||item.content_json?.prompt||"").trim();if(!title)return json({success:false,error:"QUESTION_TITLE_REQUIRED"},400);const payload:any={owner_id:userId,title,question_type:String(item.question_type||"qcm"),content_json:item.content_json||{},category:String(item.category||"").trim()||null,level:String(item.level||"").trim()||null,tags:Array.isArray(item.tags)?item.tags.map((x:any)=>String(x).trim()).filter(Boolean):[],is_active:item.is_active!==false,updated_at:new Date().toISOString()};const result=item.id?await sb.from("question_bank").update(payload).eq("id",String(item.id)).eq("owner_id",userId).select("*").single():await sb.from("question_bank").insert(payload).select("*").single();if(result.error)throw result.error;return json({success:true,question:result.data});
  }
  if(action==="assessment_add_training_blocks"){
   const assessmentId=String(b.assessment_id||"");if(!assessmentId)return json({success:false,error:"ASSESSMENT_ID_REQUIRED"},400);
   const {data:assessment,error:assessmentError}=await sb.from("course_assessments").select("id,course_id,scope,module_id,lesson_id").eq("id",assessmentId).maybeSingle();if(assessmentError)throw assessmentError;if(!assessment)return json({success:false,error:"ASSESSMENT_NOT_FOUND"},404);
   if(!(await owns(sb,userId,String(assessment.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   let lessonIds:string[]=[];
   if(assessment.scope==="lesson"&&assessment.lesson_id)lessonIds=[String(assessment.lesson_id)];
   else if(assessment.scope==="module"&&assessment.module_id){const {data:rows,error}=await sb.from("course_lessons").select("id,is_module_intro").eq("module_id",assessment.module_id).order("position");if(error)throw error;lessonIds=(rows||[]).filter((x:any)=>!x.is_module_intro).map((x:any)=>String(x.id));}
   else {const {data:rows,error}=await sb.from("course_lessons").select("id,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",assessment.course_id).order("position");if(error)throw error;lessonIds=(rows||[]).filter((x:any)=>!x.is_intro&&!x.is_module_intro&&!x.is_conclusion&&!x.is_final_exam).map((x:any)=>String(x.id));}
   if(!lessonIds.length)return json({success:true,added:0,message:"Aucune leçon source pour cette évaluation."});
   const eligible=["qcm","true_false","open_question","exercise","assignment_upload","case_study","cloze","dictation","matching","sentence_order","oral_response","listening_comprehension","written_expression"];
   const {data:blocks,error:blockError}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,file_url,file_name,storage_path,bucket_name").in("lesson_id",lessonIds).eq("interaction_mode","training").in("block_type",eligible).order("position");if(blockError)throw blockError;
   const trainingBlockIds=(blocks||[]).map((x:any)=>String(x.id));const rubricByTarget=new Map<string,any[]>();if(trainingBlockIds.length){const {data:rubricLinks,error:rubricLinkError}=await sb.from("lesson_block_links").select("source_block_id,target_block_id").eq("relation_type","rubric_for").in("target_block_id",trainingBlockIds);if(rubricLinkError)throw rubricLinkError;const rubricIds=[...new Set((rubricLinks||[]).map((x:any)=>String(x.source_block_id)))];let rubricMap=new Map<string,any>();if(rubricIds.length){const {data:rubrics,error:rubricError}=await sb.from("lesson_blocks").select("id,content_json").in("id",rubricIds).eq("block_type","rubric");if(rubricError)throw rubricError;rubricMap=new Map((rubrics||[]).map((x:any)=>[String(x.id),x.content_json||{}]));}for(const link of rubricLinks||[]){const target=String(link.target_block_id),rubric=rubricMap.get(String(link.source_block_id));if(rubric)rubricByTarget.set(target,[...(rubricByTarget.get(target)||[]),...(Array.isArray(rubric.criteria)?rubric.criteria:[])]);}}
   let added=0;for(const block of blocks||[]){const c=block.content_json||{};const existing=await sb.from("assessment_questions").select("id").eq("assessment_id",assessmentId).eq("source_lesson_block_id",block.id).maybeSingle();if(existing.error)throw existing.error;if(existing.data)continue;
    const qt=["assignment_upload","oral_response","exercise"].includes(block.block_type)?"exercise":["written_expression","dictation","listening_comprehension","cloze","matching","sentence_order"].includes(block.block_type)?"open_question":block.block_type;
    const prompt=block.block_type==="listening_comprehension"?(c.questions||[]).map((q:any,i:number)=>`${i+1}. ${q?.question||""}`).filter(Boolean).join("\n"):String(c.question||c.statement||c.prompt||c.instructions||c.title||block.title||"Question").trim();
    const responseMode=["exercise","case_study"].includes(String(block.block_type))?String(c.response_mode||(c.learner_upload_required===true?"file":"text")):null;const responseLayout=String(block.block_type)==="case_study"?String(c.response_layout||"per_question"):null;const row:any={assessment_id:assessmentId,question_type:qt,position:added+1000,prompt,points:Math.max(.1,Number(c.points??10)),grading_mode:["qcm","true_false"].includes(qt)?"automatic":(responseMode&&responseMode!=="text"?"human":String(c.grading_mode||"human")),options:String(block.block_type)==="case_study"?{context:String(c.context||""),data:String(c.data||""),task:String(c.task||""),questions:(Array.isArray(c.questions)?c.questions:[]).map((q:any)=>({question:String(typeof q==="string"?q:q?.question||q?.text||"")})).filter((q:any)=>q.question)}:(Array.isArray(c.options)?c.options:[]),correct_answer:qt==="qcm"?(c.correctIndex??c.correct_answer??null):qt==="true_false"?(c.answer??c.correct_answer??null):(c.expected_answer??c.reference_answer??null),explanation:String(c.explanation||c.correction||""),rubric:(rubricByTarget.get(String(block.id))|| (Array.isArray(c.rubric)?c.rubric:[])),response_mode:responseMode,response_layout:responseLayout,max_submission_size_mb:responseMode&&responseMode!=="text"?Math.max(1,Math.min(50,Number(c.max_size_mb||10))):null,accepted_submission_types:responseMode&&responseMode!=="text"?(Array.isArray(c.accepted_types)?c.accepted_types:["pdf","doc","docx","xls","xlsx","png","jpg"]):[],source_lesson_block_id:block.id};
    const {error}=await sb.from("assessment_questions").insert(row);if(error)throw error;added++;
   }
   return json({success:true,added,message:added?`${added} activité(s) d’entraînement ajoutée(s) à l’évaluation.`:"Aucune nouvelle activité compatible à ajouter."});
  }
  if(action==="question_bank_add_to_assessment"){
   const assessmentId=String(b.assessment_id||""),bankIds=Array.isArray(b.question_bank_ids)?b.question_bank_ids.map(String):[];if(!assessmentId||!bankIds.length)return json({success:false,error:"QUESTION_SELECTION_REQUIRED"},400);const {data:assessment}=await sb.from("course_assessments").select("id,course_id").eq("id",assessmentId).maybeSingle();if(!assessment||!(await owns(sb,userId,String(assessment.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);const {data:bank,error:bankError}=await sb.from("question_bank").select("*").in("id",bankIds).eq("is_active",true);if(bankError)throw bankError;const {count}=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("assessment_id",assessmentId);let position=Number(count||0);for(const item of bank||[]){if(!isAdmin&&String(item.owner_id)!==userId)continue;const c=item.content_json||{};const row={assessment_id:assessmentId,question_type:String(item.question_type||"qcm"),position:position++,prompt:String(c.prompt||item.title||"Question"),options:Array.isArray(c.options)?c.options:[],correct_answer:c.correct_answer??c.correctIndex??c.answer??null,explanation:String(c.explanation||""),points:Math.max(0.1,Number(c.points||1)),grading_mode:String(c.grading_mode||(["qcm","true_false"].includes(String(item.question_type))?"automatic":"human")),resource_files:Array.isArray(c.resource_files)?c.resource_files:[],accepted_submission_types:Array.isArray(c.accepted_submission_types)?c.accepted_submission_types:["pdf","doc","docx","xls","xlsx","zip","png","jpg"],rubric:c.rubric||[],source_question_bank_id:item.id};const {error}=await sb.from("assessment_questions").insert(row);if(error)throw error;await sb.from("question_bank").update({usage_count:Number(item.usage_count||0)+1,updated_at:new Date().toISOString()}).eq("id",item.id);}
   return json({success:true,added:(bank||[]).length});
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
   const requestedCourseCode=String(b.course_code||"").trim().toUpperCase();
   if(requestedCourseCode&&!/^[A-Z0-9][A-Z0-9._-]{1,31}$/.test(requestedCourseCode))return json({success:false,error:"INVALID_COURSE_CODE",message:"Le code formation doit contenir 2 à 32 caractères : lettres, chiffres, tiret, point ou underscore."},400);
   if(requestedCourseCode){const {data:duplicate}=await sb.from("courses").select("id").eq("course_code",requestedCourseCode).limit(1).maybeSingle();if(duplicate)return json({success:false,error:"COURSE_CODE_ALREADY_EXISTS",message:"Ce code de formation est déjà utilisé."},409);}
   let structureId:string|null=null;
   if(creatorContext==="structure"){const access=await validatedStructureAccess(sb,userId);if(!access)return json({success:false,error:"STRUCTURE_NOT_VALIDATED"},403);if(!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);structureId=access.organizationId;}
   const thresholdDefaults=await settingJson(sb,"assessment_threshold_defaults",{lesson_passing_score:80,module_passing_score:80,final_passing_score:70,competency_mastery_score:80,default_retry_cooldown_hours:24,default_remediation_after_attempts:3});
   const initialCourseId=crypto.randomUUID();
   const insert:any={
    id:initialCourseId,version_family_id:initialCourseId,
    course_code:requestedCourseCode||null,title:b.title||"Nouvelle formation",creator_id:userId,instructor_id:userId,creator_context:creatorContext,structure_id:structureId,client_draft_key:b.client_draft_key||null,template_used:b.template_used||"simple_textual",
    studio_mode:b.studio_mode||"simple",studio_status:"draft",short_description:b.short_description||"",
    long_description:b.long_description||"",category:b.category||null,level:b.level||null,language:normalizedCourseLanguage(b.language),course_type:b.course_type==="language_learning"?"language_learning":"standard",instruction_language:normalizedCourseLanguage(b.instruction_language||b.language),target_language:b.course_type==="language_learning"?(normalizedCourseLanguage(b.target_language,"")||null):null,cefr_start_level:b.course_type==="language_learning"?(b.cefr_start_level||null):null,cefr_target_level:b.course_type==="language_learning"?(b.cefr_target_level||null):null,language_framework:b.course_type==="language_learning"?(b.language_framework||"CEFR"):null,
    prerequisites:b.prerequisites||"",objectives:b.objectives||[],target_audience:b.target_audience||"",
    learning_outcomes:b.learning_outcomes||[],cover_image_url:b.cover_image_url||null,
    cover_image_prompt:b.cover_image_prompt||"",course_intro_title:b.course_intro_title||"",
    course_intro_summary:b.course_intro_summary||"",free_preview_mode:["none","introduction","introduction_first_lesson"].includes(String(b.free_preview_mode))?b.free_preview_mode:"introduction",
    lesson_passing_score:Math.min(100,Math.max(1,Number(b.lesson_passing_score??thresholdDefaults.lesson_passing_score??80))),module_passing_score:Math.min(100,Math.max(1,Number(b.module_passing_score??thresholdDefaults.module_passing_score??80))),final_passing_score:Math.min(100,Math.max(1,Number(b.final_passing_score??thresholdDefaults.final_passing_score??70))),
    assessment_policy:{default_retry_cooldown_hours:Number(thresholdDefaults.default_retry_cooldown_hours??24),default_remediation_after_attempts:Number(thresholdDefaults.default_remediation_after_attempts??3),competency_mastery_score:Number(thresholdDefaults.competency_mastery_score??80)},
    learning_design_settings:b.learning_design_settings||{delivery_mode:"self_paced",drip_enabled:false,drip_interval_days:7,cohort_start_at:null,completion_policy:"all_required",require_sequential_progress:true,require_video_completion:false},
    quality_status:"incomplete",ready_to_submit:false,current_version:"1.0"
   };
   if(creatorContext==="super_admin")insert.creator_type="plateforme";
   const {data,error}=await sb.from("courses").insert(insert).select("*").single(); if(error)throw error;
   let modules:any[]=[];
   if(b.create_introduction!==false){
    const lang=normalizedCourseLanguage(b.language);
    const {data:introModule,error:moduleError}=await sb.from("course_modules").insert({course_id:data.id,title:studioCopy(lang,"intro_module"),objective:"",position:-1,is_intro:true,is_required:true,section_type:"introduction"}).select("*").single();if(moduleError)throw moduleError;
    const {data:introLesson,error:lessonError}=await sb.from("course_lessons").insert({course_id:data.id,module_id:introModule.id,title:studioCopy(lang,"intro_module"),position:0,is_intro:true,is_required:true,content_text:""}).select("*").single();if(lessonError)throw lessonError;
    // V3 : l’Introduction est une section de structure vide. Le créateur la construit
    // avec les mêmes blocs que les leçons ; aucun faux texte d’exemple n’est persisté.
    modules=[{...introModule,lessons:[{...introLesson,has_blocks:false,block_count:0}]}];
   }
   await log(sb,data.id,userId,"course_created",{template:data.template_used}); return json({success:true,course:data,modules});
  }

  // Unified AI blueprint: review is mandatory, no database write before confirmation.
  if(action==="ai_course_blueprint_preview"){
   const creatorContext=String(b.creator_context||"")==="structure"?"structure":((String(b.creator_context||"")==="admin"||String(b.creator_context||"")==="super_admin")&&isAdmin?"super_admin":"professeur");
   if(creatorContext==="structure"&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access||!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403)}
   const topic=String(b.topic||"").trim().slice(0,500);if(topic.length<4)return json({success:false,error:"TOPIC_REQUIRED"},400);
   const language=normalizedCourseLanguage(b.language||"fr");const audience=String(b.audience||"").slice(0,500);const level=String(b.level||"debutant").slice(0,80);
   const duration=Math.min(120,Math.max(1,Number(b.duration_hours)||8));const count=Math.min(12,Math.max(1,Math.round(Number(b.module_count)||4)));
   const objectives=String(b.objectives||"").slice(0,2400);const orientation=String(b.orientation||"equilibree").slice(0,70);
   const detailed=b.generate_content===true;
   const fallback:CourseImportBlueprint={title:topic,short_description:"",long_description:"",prerequisites:"",introduction:"",objectives:[],target_audience:audience,learning_outcomes:[],modules:[]};
   const prompt=`Tu es concepteur pédagogique pour Omnia Global Academy. Propose un BLUEPRINT de formation contrôlable par un professeur. Langue ${language}; thème ${topic}; public ${audience}; niveau ${level}; durée cible ${duration} heures; ${count} modules; objectifs ${objectives}; orientation ${orientation}. ${detailed?"Rédige pour chaque leçon un contenu pédagogique substantiel et structuré, sans inventer de références ni sources, et signale les éléments nécessitant vérification.":"Propose le plan, objectifs, présentations, synthèses et leçons; pour chaque leçon fournis un bref contenu préliminaire éditable."} La durée officielle sera calculée par le moteur OGA, ne promets pas ${duration} heures. N'invente pas d'attestation, certification, Conclusion ou Examen final sans demande. Réponds uniquement en JSON strict {"title":"","short_description":"","long_description":"","prerequisites":"","introduction":"","objectives":[""],"target_audience":"","learning_outcomes":[""],"modules":[{"title":"","objective":"","presentation":"","lessons":[{"title":"","objective":"","content":"","summary":"","questions":[]}],"synthesis":""}]}.`;
   try{
    const result=await runAiText(sb,{context:{module:"studio",action:"ai_course_blueprint_preview",userId,metadata:{duration_target_hours:duration,module_count:count}},prompt,tier:"quality",maxTokens:12000,effort:"low",output:"structured"});
    const parsed=parseAiObject(result.text);const blueprint=normalizeImportBlueprint(parsed,fallback,language);
    if(!blueprint.modules.length)return json({success:false,error:"AI_BLUEPRINT_EMPTY",message:"Aucun programme utilisable n'a été généré."},502);
    return json({success:true,blueprint,language,creator_context:creatorContext,generated_content:detailed,provider:result.provider,model:result.model,message:"Vérifiez et modifiez le programme avant de confirmer la création."});
   }catch(error){const safe=aiErrorPayload(error);return json({success:false,...safe,message:"La génération IA est indisponible. Aucun brouillon n'a été créé."},safe.status||502)}
  }
  if(action==="ai_course_blueprint_apply"){
   const requested=String(b.creator_context||"");const creatorContext=requested==="structure"?"structure":((requested==="admin"||requested==="super_admin")&&isAdmin?"super_admin":"professeur");
   if(creatorContext==="structure"&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access||!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403)}
   const raw=b.blueprint;
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||!Array.isArray(raw.modules)||raw.modules.length<1||raw.modules.length>12)return json({success:false,error:"INVALID_BLUEPRINT"},400);
   const language=normalizedCourseLanguage(b.language||"fr");const fallback:CourseImportBlueprint={title:String(raw.title||"Formation").slice(0,500),short_description:"",long_description:"",prerequisites:"",introduction:"",objectives:[],target_audience:"",learning_outcomes:[],modules:[]};
   const blueprint=normalizeImportBlueprint(raw,fallback,language);if(!blueprint.modules.length)return json({success:false,error:"INVALID_BLUEPRINT"},400);
   const result=await createImportedCourse(sb,userId,creatorContext,blueprint,{bucket:"",path:"",name:"Création assistée IA",mime:"application/json",size:0,sha256:"",job_id:null},true,language,"structured");
   return json({success:true,...result,draft_only:true});
  }
  if(action==="analyze_multi_course_import"){
   const sources=Array.isArray(b.sources)?b.sources:[];
   if(sources.length<2||sources.length>4)return json({success:false,error:"SOURCE_COUNT_INVALID",message:"Sélectionnez entre 2 et 4 documents."},400);
   const requestedContext=String(b.creator_context||"");const creatorContext=requestedContext==="structure"?"structure":((requestedContext==="admin"||requestedContext==="super_admin")&&isAdmin?"super_admin":"professeur");
   if(creatorContext==="structure"&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access||!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403)}
   const entries=[] as any[];let total=0;
   for(const source of sources){const item=await analyzeImportSource(sb,userId,{...source,mode:"faithful",allow_ai:false});total+=item.bytes.byteLength;if(total>70*1024*1024)return json({success:false,error:"IMPORT_TOTAL_SIZE_EXCEEDED"},400);entries.push({source,item})}
   const language=normalizedCourseLanguage(b.language||entries[0].item.language);const priority=String(b.instructions||"Chaque document contribue au cours, sans doublons.").slice(0,1200);
   const fallback:CourseImportBlueprint={...entries[0].item.blueprint,modules:entries.flatMap(e=>e.item.blueprint.modules).slice(0,12)};
   const consolidated=entries.map((e,i)=>`DOCUMENT ${i+1}: ${String(e.source.original_name||"Document")}\n${e.item.extracted}`).join("\n\n----\n\n").slice(0,160000);
   const ai=await aiImportBlueprint(sb,userId,`Consignes de fusion et priorité: ${priority}\n\n${consolidated}`,fallback,language);
   const source=entries[0].source;
   const jobSource={bucket:String(source.bucket_name),path:String(source.storage_path),name:entries.map(e=>String(e.source.original_name)).join(" + ").slice(0,500),mime:"application/x-omnia-multi-import",size:total,sha256:entries[0].item.sha256};
   const {data:job,error:jobError}=await sb.from("course_import_jobs").insert({user_id:userId,course_id:null,target_type:"course",target_id:null,mode:"structured",bucket_name:jobSource.bucket,storage_path:jobSource.path,original_name:jobSource.name,mime_type:jobSource.mime,size_bytes:jobSource.size,sha256:jobSource.sha256,detected_language:language,status:"ready",blueprint:ai.blueprint,analysis_metadata:{ai_used:ai.ai_used,ai_error:ai.ai_error,creator_context:creatorContext,sources:entries.map(e=>({name:e.source.original_name,path:e.source.storage_path,sha256:e.item.sha256})),instructions:priority}}).select("*").single();if(jobError)throw jobError;
   return json({success:true,job_id:job.id,blueprint:ai.blueprint,detected:{modules:ai.blueprint.modules.length,lessons:ai.blueprint.modules.reduce((n:number,m:any)=>n+m.lessons.length,0),sources:sources.length,ai_used:ai.ai_used},mode:"structured",message:"Fusion préparée. Vérifiez la structure avant de créer le brouillon."});
  }
  if(action==="prepare_course_import_upload"){
   const requestedContext=String(b.creator_context||"");
   const creatorContext=requestedContext==="structure"?"structure":((requestedContext==="admin"||requestedContext==="super_admin")&&isAdmin?"super_admin":"professeur");
   if(creatorContext==="structure"&&!isAdmin){const access=await validatedStructureAccess(sb,userId);if(!access)return json({success:false,error:"STRUCTURE_NOT_VALIDATED"},403);if(!hasStructurePermission(access,"can_create_courses"))return json({success:false,error:"STRUCTURE_COURSE_PERMISSION_REQUIRED"},403);}
   const originalName=String(b.original_name||"").trim();const extension=importExtension(originalName);const fileSize=Number(b.file_size||0);
   if(!originalName||!COURSE_IMPORT_ALLOWED.has(extension))return json({success:false,error:"UNSUPPORTED_IMPORT_FORMAT",message:"Utilisez PDF, DOCX, PPTX, XLSX, ZIP, TXT, MD ou CSV."},400);
   if(fileSize<=0||fileSize>COURSE_IMPORT_MAX_BYTES)return json({success:false,error:"IMPORT_SIZE_INVALID",message:"Le fichier doit être compris entre 1 octet et 25 Mo."},400);
   const safeName=safeImportName(originalName);const path=`imports/${userId}/${crypto.randomUUID()}/${safeName}`;const uploadMime=courseImportUploadMime(extension);
   const {data,error}=await sb.storage.from(COURSE_IMPORT_BUCKET).createSignedUploadUrl(path,{upsert:false});if(error)throw error;
   return json({success:true,signedUrl:data.signedUrl,token:data.token,path,bucket:COURSE_IMPORT_BUCKET,upload_mime:uploadMime,creator_context:creatorContext,max_bytes:COURSE_IMPORT_MAX_BYTES,allowed_extensions:Array.from(COURSE_IMPORT_ALLOWED)});
  }
  if(action==="analyze_course_import"){
   const requestedContext=String(b.creator_context||"");const creatorContext=requestedContext==="structure"?"structure":((requestedContext==="admin"||requestedContext==="super_admin")&&isAdmin?"super_admin":"professeur");
   const targetType=["course","module","lesson","block"].includes(String(b.target_type))?String(b.target_type):"course";const targetId=String(b.target_id||"")||null;const targetCourseId=String(b.course_id||"")||null;
   if(targetType!=="course"&&(!targetCourseId||!(await owns(sb,userId,targetCourseId))))return json({success:false,error:"FORBIDDEN"},403);
   const analyzed=await analyzeImportSource(sb,userId,b);const source={bucket:String(b.bucket_name),path:String(b.storage_path),name:String(b.original_name),mime:String(b.file_mime||"application/octet-stream"),size:analyzed.bytes.length,sha256:analyzed.sha256};
   const {data:job,error:jobError}=await sb.from("course_import_jobs").insert({user_id:userId,course_id:targetCourseId,target_type:targetType,target_id:targetId,mode:analyzed.mode,bucket_name:source.bucket,storage_path:source.path,original_name:source.name,mime_type:source.mime,size_bytes:source.size,sha256:source.sha256,detected_language:analyzed.language,status:"ready",blueprint:analyzed.blueprint,analysis_metadata:{ai_used:analyzed.ai_used,ai_error:analyzed.ai_error,creator_context:creatorContext,source_chars:analyzed.extracted.length,pdf_multimodal:analyzed.pdf_multimodal,scanned_pdf:analyzed.scanned_pdf,pptx:analyzed.pptx_summary}}).select("*").single();if(jobError)throw jobError;
   const detected={modules:(analyzed.blueprint.modules||[]).length,lessons:(analyzed.blueprint.modules||[]).reduce((n:number,m:any)=>n+(m.lessons||[]).length,0),suggested_questions:(analyzed.blueprint.modules||[]).flatMap((m:any)=>m.lessons||[]).reduce((n:number,l:any)=>n+(l.questions||[]).length,0),language:analyzed.language,ai_used:analyzed.ai_used,pdf_multimodal:analyzed.pdf_multimodal,scanned_pdf:analyzed.scanned_pdf,images:Number(analyzed.pptx_summary?.images||0),tables:Number(analyzed.pptx_summary?.tables||0),slides:Number(analyzed.pptx_summary?.slides||0)};
   return json({success:true,job_id:job.id,blueprint:analyzed.blueprint,detected,mode:analyzed.mode,target_type:targetType,message:"Analyse terminée. Vérifiez la structure avant de l’appliquer."});
  }
  if(action==="apply_course_import"){
   const jobId=String(b.job_id||"");const {data:job,error:jobError}=await sb.from("course_import_jobs").select("*").eq("id",jobId).eq("user_id",userId).maybeSingle();if(jobError)throw jobError;if(!job)return json({success:false,error:"IMPORT_JOB_NOT_FOUND"},404);if(job.status==="applied")return json({success:false,error:"IMPORT_ALREADY_APPLIED"},409);
   if(b.blueprint&&typeof b.blueprint==="object"){await sb.from("course_import_jobs").update({blueprint:b.blueprint}).eq("id",jobId);job.blueprint=b.blueprint;}
   const creatorContext=String(job.analysis_metadata?.creator_context||b.creator_context||"professeur");const result=await applyImportJob(sb,userId,job,{...b,creator_context:creatorContext});await sb.from("course_import_jobs").update({status:"applied",applied_at:new Date().toISOString()}).eq("id",jobId);return json({success:true,...result});
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
  // V4/A: a published pedagogical version is immutable, including for super-admin.
  // Minor public metadata edits remain possible through update_course/autosave.
  const immutableActions=new Set(["create_module","update_module","delete_module","create_lesson","update_lesson","delete_lesson","create_module_stage","create_block","update_block","delete_block","duplicate_block","remove_block_resource","reorder_blocks","ensure_special_sections","ensure_assessments","assessment_policy_update","assessment_policy_confirm_review","assessment_section_create","assessment_section_update","assessment_section_delete","assessment_question_design_update","assessment_add_training_blocks","question_bank_add_to_assessment","ai_course_blueprint_apply","resource_rag_update","upload_block_file","apply_template","apply_course_import","reorder_lessons","reorder_modules"]);
  if(courseId&&immutableActions.has(action)){
   const {data:state,error:stateError}=await sb.from("courses").select("is_published,studio_status").eq("id",courseId).maybeSingle();
   if(stateError)throw stateError;
   if(state?.is_published===true)return json({success:false,error:"PUBLISHED_VERSION_IMMUTABLE",message:"Créez une nouvelle version brouillon pour modifier le contenu pédagogique publié."},409);
  }
  if(action==="ensure_special_sections"){
   const {data:courseSettings}=await sb.from("courses").select("final_passing_score,language").eq("id",courseId).maybeSingle();const sectionLang=courseSettings?.language||"fr";const finalPassing=Math.min(100,Math.max(1,Number(courseSettings?.final_passing_score||70)));
   const {data:existing}=await sb.from("course_modules").select("*").eq("course_id",courseId).or("is_conclusion.eq.true,is_final_exam.eq.true");
   const result:any[]=[];
   if(!(existing||[]).some((m:any)=>m.is_conclusion)){
    // V3 : la Conclusion existe comme section de structure mais son contenu n’est jamais généré automatiquement.
    // Le créateur la construit manuellement avec les mêmes blocs que l’Introduction.
    const {data:m,error}=await sb.from("course_modules").insert({course_id:courseId,title:studioCopy(sectionLang,"conclusion"),objective:"",position:9000,is_intro:false,is_conclusion:true,is_final_exam:false,section_type:"conclusion"}).select("*").single();if(error)throw error;
    await sb.from("course_lessons").insert({course_id:courseId,module_id:m.id,title:studioCopy(sectionLang,"conclusion_lesson"),position:0,is_conclusion:true,is_final_exam:false,stage_type:"conclusion",content_text:""});
    result.push(m);
   }
   if(!(existing||[]).some((m:any)=>m.is_final_exam)){
    const {data:m,error}=await sb.from("course_modules").insert({course_id:courseId,title:studioCopy(sectionLang,"final_exam"),objective:"",position:10000,is_intro:false,is_conclusion:false,is_final_exam:true,section_type:"final_exam"}).select("*").single();if(error)throw error;
    await sb.from("course_lessons").insert({course_id:courseId,module_id:m.id,title:studioCopy(sectionLang,"final_exam"),position:0,is_conclusion:false,is_final_exam:true,stage_type:"final_exam",content_text:""});
    result.push(m);
   }
   await log(sb,courseId,userId,"special_sections_ensured"); return json({success:true,created:result});
  }
  if(action==="get_course"){
   if(isAdmin)await ensurePublishedDurationEngineMigration(sb,userId);
   await recalculateCourseDuration(sb,courseId);
   const {data:course}=await sb.from("courses").select("*").eq("id",courseId).maybeSingle(); if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const ids=(mods||[]).map((m:any)=>m.id); const {data:lessons}=ids.length?await sb.from("course_lessons").select("*").in("module_id",ids).order("position"):{data:[]};
   const lsIds=(lessons||[]).map((l:any)=>l.id); let counts:any[]=[]; if(lsIds.length){const {data}=await sb.from("lesson_blocks").select("lesson_id").in("lesson_id",lsIds);counts=data||[]}
   const modules=(mods||[]).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id).map((l:any)=>({...l,has_blocks:counts.some(x=>x.lesson_id===l.id),block_count:counts.filter(x=>x.lesson_id===l.id).length}))}));
   return json({success:true,course,modules});
  }
  if(action==="create_module"){
   const [{data:normalMods},{data:courseMeta}]=await Promise.all([sb.from("course_modules").select("id").eq("course_id",courseId).eq("section_type","module"),sb.from("courses").select("language").eq("id",courseId).maybeSingle()]);
   const normalCount=(normalMods||[]).length;const lang=normalizedCourseLanguage(courseMeta?.language);
   const {data,error}=await sb.from("course_modules").insert({course_id:courseId,title:b.title||`Module ${normalCount+1}`,objective:b.objective||"",position:normalCount,is_intro:false,section_type:"module"}).select("*").single();if(error)throw error;
   await log(sb,courseId,userId,"module_created",{module_id:data.id,automatic_lessons:false});return json({success:true,module:data,intro_lesson:null});
  }
  if(action==="update_module"){
   const moduleId=String(b.module_id||"");const title=String(b.title||"").trim();if(!moduleId||!title)return json({success:false,error:"MODULE_ID_AND_TITLE_REQUIRED"},400);
   const {data:mod}=await sb.from("course_modules").select("id,course_id").eq("id",moduleId).maybeSingle();if(!mod||!(await owns(sb,userId,String(mod.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("course_modules").update({title,updated_at:new Date().toISOString()}).eq("id",moduleId).select("*").single();if(error)throw error;await log(sb,String(mod.course_id),userId,"module_updated",{module_id:moduleId,title});return json({success:true,module:data});
  }
  if(action==="create_lesson"){
   const [{data:normalLessons},{data:courseMeta}]=await Promise.all([sb.from("course_lessons").select("id").eq("module_id",b.module_id).eq("stage_type","lesson"),sb.from("courses").select("language").eq("id",courseId).maybeSingle()]);const count=(normalLessons||[]).length;const lang=normalizedCourseLanguage(courseMeta?.language);
   const {data,error}=await sb.from("course_lessons").insert({course_id:courseId,module_id:b.module_id,title:b.title||`${autoCopy(lang,"lesson")} ${count+1}`,position:count,is_intro:false,is_module_intro:false,stage_type:"lesson"}).select("*").single();if(error)throw error;await log(sb,courseId,userId,"lesson_created",{lesson_id:data.id});return json({success:true,lesson:{...data,has_blocks:false,block_count:0}});
  }
  if(action==="update_lesson"){
   const lessonId=String(b.lesson_id||"");if(!lessonId)return json({success:false,error:"LESSON_ID_REQUIRED"},400);
   const {data:lesson}=await sb.from("course_lessons").select("id,course_id,module_id,stage_type,title").eq("id",lessonId).maybeSingle();if(!lesson||!(await owns(sb,userId,String(lesson.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const updates:any={updated_at:new Date().toISOString()};
   if(b.title!==undefined){const title=String(b.title||"").trim();if(!title)return json({success:false,error:"LESSON_TITLE_REQUIRED"},400);updates.title=title;}
   if(b.is_free_preview!==undefined){
    if(String(lesson.stage_type||"lesson")!=="lesson")return json({success:false,error:"FREE_PREVIEW_ONLY_FOR_LESSONS"},409);
    const enabled=b.is_free_preview===true;updates.is_free_preview=enabled;
    if(enabled)await sb.from("course_lessons").update({is_free_preview:false,updated_at:new Date().toISOString()}).eq("course_id",lesson.course_id).eq("stage_type","lesson").neq("id",lessonId);
   }
   if(Object.keys(updates).length===1)return json({success:false,error:"NO_LESSON_CHANGES"},400);
   const {data,error}=await sb.from("course_lessons").update(updates).eq("id",lessonId).select("*").single();if(error)throw error;await log(sb,String(lesson.course_id),userId,"lesson_updated",{lesson_id:lessonId,title:updates.title??lesson.title,is_free_preview:updates.is_free_preview});return json({success:true,lesson:data});
  }
  if(action==="create_module_stage"){
   const moduleId=String(b.module_id||"");const stage=String(b.stage_type||"");
   if(!["module_presentation","module_summary"].includes(stage))return json({success:false,error:"INVALID_MODULE_STAGE"},400);
   const {data:mod}=await sb.from("course_modules").select("id,course_id").eq("id",moduleId).eq("section_type","module").maybeSingle();
   if(!mod||!(await owns(sb,userId,String(mod.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:existing}=await sb.from("course_lessons").select("*").eq("module_id",moduleId).eq("stage_type",stage).maybeSingle();
   if(existing)return json({success:true,lesson:{...existing,has_blocks:false,block_count:0},existing:true});
   const title=String(b.title|| (stage==="module_presentation"?"Présentation du module":"Synthèse du module")).trim();
   const position=stage==="module_presentation"?-1:9999;
   const {data,error}=await sb.from("course_lessons").insert({course_id:mod.course_id,module_id:moduleId,title,position,is_intro:false,is_module_intro:stage==="module_presentation",is_required:false,stage_type:stage}).select("*").single();if(error)throw error;
   await log(sb,String(mod.course_id),userId,"module_stage_created",{module_id:moduleId,lesson_id:data.id,stage_type:stage});
   return json({success:true,lesson:{...data,has_blocks:false,block_count:0}});
  }
  if(action==="delete_lesson"){
   const lessonId=String(b.lesson_id||"");const {data:lesson}=await sb.from("course_lessons").select("id,course_id,module_id,stage_type").eq("id",lessonId).maybeSingle();
   if(!lesson||!(await owns(sb,userId,String(lesson.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:deleteCourse}=await sb.from("courses").select("is_published,studio_status").eq("id",lesson.course_id).maybeSingle();if(deleteCourse?.is_published===true)return json({success:false,error:"PUBLISHED_VERSION_IMMUTABLE",message:"Créez une nouvelle version brouillon avant de supprimer une leçon d’une formation publiée."},409);
   if(["introduction","conclusion","final_exam"].includes(String(lesson.stage_type||"")))return json({success:false,error:"STRUCTURAL_STAGE_CANNOT_BE_DELETED"},409);
   const {data:blocks}=await sb.from("lesson_blocks").select("id,content_json,storage_path,bucket_name").eq("lesson_id",lessonId);
   for(const blk of blocks||[]){const uid=String(blk.content_json?.cloudflare_stream_uid||"").trim();if(uid)await deleteStreamVideo(uid).catch(()=>{});if(blk.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||"")))await sb.storage.from(String(blk.bucket_name)).remove([String(blk.storage_path)]).catch(()=>{});}
   const {error}=await sb.from("course_lessons").delete().eq("id",lessonId);if(error)throw error;
   const {data:remaining}=await sb.from("course_lessons").select("id,stage_type,position").eq("module_id",lesson.module_id).order("position");
   let pos=0;for(const row of (remaining||[]).filter((x:any)=>String(x.stage_type||"lesson")==="lesson"))await sb.from("course_lessons").update({position:pos++,updated_at:new Date().toISOString()}).eq("id",row.id);
   await recalculateCourseDuration(sb,String(lesson.course_id));await log(sb,String(lesson.course_id),userId,"lesson_deleted",{lesson_id:lessonId});return json({success:true});
  }
  if(action==="delete_module"){
   const moduleId=String(b.module_id||"");const {data:mod}=await sb.from("course_modules").select("id,course_id,section_type").eq("id",moduleId).maybeSingle();
   if(!mod||!(await owns(sb,userId,String(mod.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:deleteCourse}=await sb.from("courses").select("is_published,studio_status").eq("id",mod.course_id).maybeSingle();if(deleteCourse?.is_published===true)return json({success:false,error:"PUBLISHED_VERSION_IMMUTABLE",message:"Créez une nouvelle version brouillon avant de supprimer un module d’une formation publiée."},409);
   if(String(mod.section_type||"module")!=="module")return json({success:false,error:"STRUCTURAL_SECTION_CANNOT_BE_DELETED"},409);
   const {data:blocks}=await sb.from("lesson_blocks").select("content_json,storage_path,bucket_name").eq("module_id",moduleId);
   for(const blk of blocks||[]){const uid=String(blk.content_json?.cloudflare_stream_uid||"").trim();if(uid)await deleteStreamVideo(uid).catch(()=>{});if(blk.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||"")))await sb.storage.from(String(blk.bucket_name)).remove([String(blk.storage_path)]).catch(()=>{});}
   const {error}=await sb.from("course_modules").delete().eq("id",moduleId);if(error)throw error;
   const {data:remaining}=await sb.from("course_modules").select("id,position").eq("course_id",mod.course_id).eq("section_type","module").order("position");
   for(const [i,row] of (remaining||[]).entries())await sb.from("course_modules").update({position:i,updated_at:new Date().toISOString()}).eq("id",row.id);
   await recalculateCourseDuration(sb,String(mod.course_id));await log(sb,String(mod.course_id),userId,"module_deleted",{module_id:moduleId});return json({success:true});
  }
  if(action==="get_blocks"){const {data,error}=await sb.from("lesson_blocks").select("*").eq("lesson_id",b.lesson_id).order("position");if(error)throw error;const ids=(data||[]).map((x:any)=>String(x.id));const sourceIds=(data||[]).filter((x:any)=>relationTypeForBlock(String(x.block_type))).map((x:any)=>String(x.id));const linkMap=new Map<string,string[]>();const rubricIncoming=new Map<string,string[]>();const correctionIncoming=new Map<string,string[]>();if(ids.length){const {data:links,error:linkError}=await sb.from("lesson_block_links").select("source_block_id,target_block_id,relation_type").or(`source_block_id.in.(${ids.join(",")}),target_block_id.in.(${ids.join(",")})`);if(linkError)throw linkError;for(const link of links||[]){const source=String(link.source_block_id),target=String(link.target_block_id),relation=String(link.relation_type);if(sourceIds.includes(source))linkMap.set(source,[...(linkMap.get(source)||[]),target]);if(relation==="rubric_for")rubricIncoming.set(target,[...(rubricIncoming.get(target)||[]),source]);if(relation==="correction_for")correctionIncoming.set(target,[...(correctionIncoming.get(target)||[]),source]);}}const blocks=await Promise.all((data||[]).map(async(row:any)=>({...await decorateStudioBlock(sb,row),linked_block_ids:linkMap.get(String(row.id))||[],rubric_block_ids:rubricIncoming.get(String(row.id))||[],correction_block_ids:correctionIncoming.get(String(row.id))||[]})));return json({success:true,blocks})}
  if(action==="create_block"){
   const [{count},{data:courseMeta}]=await Promise.all([sb.from("lesson_blocks").select("id",{count:"exact",head:true}).eq("lesson_id",b.lesson_id),sb.from("courses").select("language").eq("id",courseId).maybeSingle()]);const pos=Number.isInteger(b.position)?b.position:(count||0);
   const trainingTypes=new Set(["qcm","true_false","open_question","exercise","assignment_upload","case_study","flashcards","interactive_table","checklist","cloze","dictation","pronunciation","matching","sentence_order","oral_response","listening_comprehension","written_expression"]);
   const defaultMode=trainingTypes.has(String(b.block_type))?"training":"content";
   const {data,error}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:b.module_id,lesson_id:b.lesson_id,block_type:b.block_type,position:pos,content_json:b.content_json||defaultBlockForLanguage(b.block_type,courseMeta?.language),settings_json:b.settings_json||{},interaction_mode:["content","training","assessment"].includes(String(b.interaction_mode))?b.interaction_mode:defaultMode,assessment_scope:b.assessment_scope&&["lesson","module","final"].includes(String(b.assessment_scope))?b.assessment_scope:null,is_required:b.is_required===true,training_passing_score:Math.min(100,Math.max(0,Number(b.training_passing_score??80))),training_is_graded:b.training_is_graded!==false,created_by:userId,ai_generated:!!b.ai_generated,source_type:b.ai_generated?"ai":"manual"}).select("*").single();if(error)throw error;if(String(data.interaction_mode)==="assessment")await syncExistingOfficialAssessmentFromBlock(sb,data);await recalculateCourseDuration(sb,courseId);await log(sb,courseId,userId,"block_created",{block_id:data.id,type:data.block_type});return json({success:true,block:data});
  }
  if(action==="update_block"){
   const {data:blk}=await sb.from("lesson_blocks").select("id,course_id,module_id,lesson_id,storage_path,bucket_name,content_json,settings_json,block_type,interaction_mode,assessment_scope").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id,"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const allowed:any={updated_at:new Date().toISOString()};for(const k of ["title","content_json","settings_json","file_url","file_name","file_size","file_mime","source_type","ai_generated","interaction_mode","assessment_scope","is_required","training_passing_score","training_is_graded","rag_enabled","preview_allowed"])if(b[k]!==undefined)allowed[k]=b[k]; if(allowed.interaction_mode!==undefined&&!['content','training','assessment'].includes(String(allowed.interaction_mode)))return json({success:false,error:"INVALID_INTERACTION_MODE"},400);if(allowed.assessment_scope!==undefined&&allowed.assessment_scope!==null&&!['lesson','module','final'].includes(String(allowed.assessment_scope)))return json({success:false,error:"INVALID_ASSESSMENT_SCOPE"},400);if(allowed.training_passing_score!==undefined)allowed.training_passing_score=Math.min(100,Math.max(0,Number(allowed.training_passing_score)));
   const incomingContent=allowed.content_json&&typeof allowed.content_json==="object"?allowed.content_json:null;const streamUid=String(incomingContent?.cloudflare_stream_uid||blk.content_json?.cloudflare_stream_uid||"").trim();
   if(streamUid){allowed.file_url=null;allowed.content_json={...(blk.content_json||{}),...(incomingContent||{}),url:null,provider:"cloudflare_stream",cloudflare_stream_uid:streamUid};}
   else if(PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||""))&&blk.storage_path){allowed.file_url=String(blk.storage_path);if(incomingContent)allowed.content_json={...incomingContent,url:String(blk.storage_path)};}
   const {data,error}=await sb.from("lesson_blocks").update(allowed).eq("id",b.block_id).select("*").single();if(error)throw error;let linkedBlockIds=await blockLinkIds(sb,String(data.id));if(b.linked_block_ids!==undefined)linkedBlockIds=await syncPedagogicalLinks(sb,data,b.linked_block_ids);let rubricBlockIds=await incomingBlockLinkIds(sb,String(data.id),"rubric_for");let correctionBlockIds=await incomingBlockLinkIds(sb,String(data.id),"correction_for");if(b.rubric_block_ids!==undefined)rubricBlockIds=await syncIncomingPedagogicalLinks(sb,data,"rubric_for",b.rubric_block_ids);if(b.correction_block_ids!==undefined)correctionBlockIds=await syncIncomingPedagogicalLinks(sb,data,"correction_for",b.correction_block_ids);await syncExistingOfficialAssessmentFromBlock(sb,data);await recalculateCourseDuration(sb,String(blk.course_id));return json({success:true,block:{...await decorateStudioBlock(sb,data),linked_block_ids:linkedBlockIds,rubric_block_ids:rubricBlockIds,correction_block_ids:correctionBlockIds}});
  }
  if(action==="delete_block"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id,lesson_id,content_json,storage_path,bucket_name").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id,"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);const streamUid=String(blk.content_json?.cloudflare_stream_uid||"").trim();await sb.from("lesson_blocks").delete().eq("id",b.block_id);if(streamUid){await deleteStreamVideo(streamUid).catch(()=>{});const {data:remainingVideos}=await sb.from("lesson_blocks").select("content_json,position").eq("lesson_id",blk.lesson_id).eq("block_type","video").order("position",{ascending:false});const nextUid=String((remainingVideos||[]).map((row:any)=>row?.content_json?.cloudflare_stream_uid).find((value:any)=>String(value||"").trim())||"").trim()||null;await sb.from("course_lessons").update({cloudflare_stream_uid:nextUid,updated_at:new Date().toISOString()}).eq("id",blk.lesson_id);}if(blk.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||"")))await sb.storage.from(String(blk.bucket_name)).remove([String(blk.storage_path)]).then(()=>{}).catch(()=>{});await recalculateCourseDuration(sb,String(blk.course_id));await log(sb,blk.course_id,userId,"block_deleted",{block_id:b.block_id,stream_deleted:!!streamUid});return json({success:true});
  }
  if(action==="duplicate_block"){
   const blockId=String(b.block_id||"");const {data:blk}=await sb.from("lesson_blocks").select("*").eq("id",blockId).maybeSingle();if(!blk||!(await owns(sb,userId,String(blk.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:after}=await sb.from("lesson_blocks").select("id,position").eq("lesson_id",blk.lesson_id).gt("position",Number(blk.position||0)).order("position",{ascending:false});
   for(const row of after||[])await sb.from("lesson_blocks").update({position:Number(row.position||0)+1,updated_at:new Date().toISOString()}).eq("id",row.id);
   const content={...(blk.content_json||{})};let storagePath:string|null=null,bucketName:string|null=null,fileUrl:any=null,fileName:any=null,fileSize:any=null,fileMime:any=null;
   const streamUid=String(content.cloudflare_stream_uid||"").trim();
   if(streamUid){delete content.cloudflare_stream_uid;delete content.url;delete content.provider;fileUrl=null;}
   else if(blk.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||""))){
    const sourcePath=String(blk.storage_path);const slash=sourcePath.lastIndexOf("/");const prefix=slash>=0?sourcePath.slice(0,slash+1):`${blk.course_id}/`;const base=slash>=0?sourcePath.slice(slash+1):sourcePath;const targetPath=`${prefix}${crypto.randomUUID()}-copy-${base}`;const copyResult=await sb.storage.from(String(blk.bucket_name)).copy(sourcePath,targetPath);if(copyResult.error)throw copyResult.error;storagePath=targetPath;bucketName=String(blk.bucket_name);fileUrl=targetPath;fileName=blk.file_name;fileSize=blk.file_size;fileMime=blk.file_mime;content.url=targetPath;
   }else{fileUrl=blk.file_url;fileName=blk.file_name;fileSize=blk.file_size;fileMime=blk.file_mime;}
   const payload:any={course_id:blk.course_id,module_id:blk.module_id,lesson_id:blk.lesson_id,block_type:blk.block_type,position:Number(blk.position||0)+1,title:blk.title,content_json:content,settings_json:blk.settings_json||{},file_url:fileUrl,file_name:fileName,file_size:fileSize,file_mime:fileMime,storage_path:storagePath,bucket_name:bucketName,source_type:"duplicate",source_provenance:{source_block_id:blockId},ai_generated:false,interaction_mode:blk.interaction_mode,assessment_scope:blk.assessment_scope,is_required:blk.is_required,training_passing_score:blk.training_passing_score,training_is_graded:blk.training_is_graded!==false,rag_enabled:blk.rag_enabled,preview_allowed:blk.preview_allowed,created_by:userId};
   const {data,error}=await sb.from("lesson_blocks").insert(payload).select("*").single();if(error)throw error;const originalLinks=await blockLinkIds(sb,blockId);if(originalLinks.length&&relationTypeForBlock(String(blk.block_type)))await syncPedagogicalLinks(sb,data,originalLinks);await recalculateCourseDuration(sb,String(blk.course_id));await log(sb,String(blk.course_id),userId,"block_duplicated",{source_block_id:blockId,block_id:data.id,resource_copied:!!storagePath,stream_cleared:!!streamUid});return json({success:true,block:{...await decorateStudioBlock(sb,data),linked_block_ids:originalLinks},stream_requires_reupload:!!streamUid});
  }
  if(action==="remove_block_resource"){
   const blockId=String(b.block_id||"");const {data:blk}=await sb.from("lesson_blocks").select("id,course_id,lesson_id,block_type,content_json,storage_path,bucket_name").eq("id",blockId).maybeSingle();if(!blk||!(await owns(sb,userId,String(blk.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const content={...(blk.content_json||{})};const streamUid=String(content.cloudflare_stream_uid||"").trim();
   if(streamUid)await deleteStreamVideo(streamUid).catch(()=>{});
   if(blk.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||"")))await sb.storage.from(String(blk.bucket_name)).remove([String(blk.storage_path)]).catch(()=>{});
   for(const key of ["url","provider","cloudflare_stream_uid","scorm_ready","scorm_package_prefix","launch_path","runtime_session_token","runtime_state","sheet","headers","preview_rows"])delete content[key];
   const {data,error}=await sb.from("lesson_blocks").update({file_url:null,file_name:null,file_size:null,file_mime:null,storage_path:null,bucket_name:null,content_json:content,rag_enabled:false,updated_at:new Date().toISOString()}).eq("id",blockId).select("*").single();if(error)throw error;
   if(String(blk.block_type)==="video"){const {data:remainingVideos}=await sb.from("lesson_blocks").select("content_json,position").eq("lesson_id",blk.lesson_id).eq("block_type","video").order("position",{ascending:false});const nextUid=String((remainingVideos||[]).map((row:any)=>row?.id===blockId?null:row?.content_json?.cloudflare_stream_uid).find((value:any)=>String(value||"").trim())||"").trim()||null;await sb.from("course_lessons").update({cloudflare_stream_uid:nextUid,updated_at:new Date().toISOString()}).eq("id",blk.lesson_id);}
   await recalculateCourseDuration(sb,String(blk.course_id));await log(sb,String(blk.course_id),userId,"block_resource_removed",{block_id:blockId,stream_deleted:!!streamUid});return json({success:true,block:await decorateStudioBlock(sb,data)});
  }
  if(action==="reorder_blocks"){
   const ids=b.ordered_ids||[];for(let i=0;i<ids.length;i++)await sb.from("lesson_blocks").update({position:i,updated_at:new Date().toISOString()}).eq("id",ids[i]).eq("lesson_id",b.lesson_id);return json({success:true});
  }
  if(action==="update_course"||action==="autosave"){
   if(b.course_code!==undefined){const code=String(b.course_code||"").trim().toUpperCase();if(code&&!/^[A-Z0-9][A-Z0-9._-]{1,31}$/.test(code))return json({success:false,error:"INVALID_COURSE_CODE",message:"Le code formation doit contenir 2 à 32 caractères : lettres, chiffres, tiret, point ou underscore."},400);if(code){const {data:duplicate}=await sb.from("courses").select("id").eq("course_code",code).neq("id",courseId).limit(1).maybeSingle();if(duplicate)return json({success:false,error:"COURSE_CODE_ALREADY_EXISTS",message:"Ce code de formation est déjà utilisé."},409);}b.course_code=code||null;}
   if(b.language!==undefined&&!SUPPORTED_COURSE_LANGS.has(String(b.language).toLowerCase()))return json({success:false,error:"INVALID_COURSE_LANGUAGE"},400);
   if(b.instruction_language!==undefined&&String(b.instruction_language||"")&&!SUPPORTED_COURSE_LANGS.has(String(b.instruction_language).toLowerCase()))return json({success:false,error:"INVALID_INSTRUCTION_LANGUAGE"},400);
   if(b.target_language!==undefined&&String(b.target_language||"")&&!SUPPORTED_COURSE_LANGS.has(String(b.target_language).toLowerCase()))return json({success:false,error:"INVALID_TARGET_LANGUAGE"},400);
   if(b.cefr_start_level!==undefined&&String(b.cefr_start_level||"")&&!CEFR_LEVELS.has(String(b.cefr_start_level)))return json({success:false,error:"INVALID_CEFR_START_LEVEL"},400);
   if(b.cefr_target_level!==undefined&&String(b.cefr_target_level||"")&&!CEFR_LEVELS.has(String(b.cefr_target_level)))return json({success:false,error:"INVALID_CEFR_TARGET_LEVEL"},400);
   const {data:publishState,error:publishError}=await sb.from("courses").select("is_published,studio_status").eq("id",courseId).maybeSingle();if(publishError)throw publishError;
   if(publishState?.is_published===true){
    const minor=new Set(["title","short_description","long_description","cover_image_url","cover_image_prompt"]);
    const pedagogical=new Set(["course_code","category","level","language","course_type","instruction_language","target_language","cefr_start_level","cefr_target_level","language_framework","prerequisites","objectives","target_audience","learning_outcomes","course_intro_title","course_intro_summary","studio_mode","template_used","word_count","sale_mode","desired_price_amount","sale_currency","promotion_price_amount","structure_payment_mode","structure_fixed_amount","certification_requested","certificate_mode","is_assisted","assisted_status","assisted_request_id","learning_design_settings","lesson_passing_score","module_passing_score","final_passing_score","free_preview_mode"]);
    if(Object.keys(b).some(k=>pedagogical.has(k)&&b[k]!==undefined))return json({success:false,error:"PUBLISHED_VERSION_IMMUTABLE",message:"Les paramètres pédagogiques d'une formation publiée nécessitent une nouvelle version."},409);
    if(Object.keys(b).some(k=>!minor.has(k)&&!["action","course_id"].includes(k)))return json({success:false,error:"PUBLISHED_VERSION_IMMUTABLE"},409);
   }
   const updates:any={updated_at:new Date().toISOString()};for(const k of ["course_code","title","short_description","long_description","category","level","language","course_type","instruction_language","target_language","cefr_start_level","cefr_target_level","language_framework","prerequisites","objectives","target_audience","learning_outcomes","cover_image_url","cover_image_prompt","course_intro_title","course_intro_summary","studio_mode","template_used","word_count","sale_mode","desired_price_amount","sale_currency","promotion_price_amount","structure_payment_mode","structure_fixed_amount","certification_requested","certificate_mode","is_assisted","assisted_status","assisted_request_id","learning_design_settings","lesson_passing_score","module_passing_score","final_passing_score"])if(b[k]!==undefined)updates[k]=b[k]; if(updates.course_type==="standard"){updates.target_language=null;updates.cefr_start_level=null;updates.cefr_target_level=null;updates.language_framework=null}else if(updates.course_type==="language_learning"){updates.language_framework="CEFR";} if(updates.certificate_mode!==undefined&&!['omnia','external','none'].includes(String(updates.certificate_mode)))return json({success:false,error:"INVALID_CERTIFICATE_MODE"},400); if(b.free_preview_mode!==undefined){if(!["none","introduction","introduction_first_lesson"].includes(String(b.free_preview_mode)))return json({success:false,error:"INVALID_PREVIEW_MODE"},400);updates.free_preview_mode=b.free_preview_mode;}if(b.word_count!==undefined)updates.estimated_read_min=Math.max(1,Math.ceil(Number(b.word_count)/250));if(action==="autosave")updates.last_autosave_at=new Date().toISOString();
   const {data,error}=await sb.from("courses").update(updates).eq("id",courseId).select("*").single();if(error)throw error;if(action!=="autosave")await log(sb,courseId,userId,"course_updated");return json({success:true,course:data});
  }
  if(action==="apply_template"){
   const {data:t}=await sb.from("course_studio_templates").select("*").eq("key",b.template_key).eq("is_active",true).maybeSingle();if(!t)return json({success:false,error:"TEMPLATE_NOT_FOUND"},404);
   if(b.replace_existing){await sb.from("course_modules").delete().eq("course_id",courseId).eq("is_intro",false)}
   const {data:courseMeta}=await sb.from("courses").select("language").eq("id",courseId).maybeSingle();const templateLang=normalizedCourseLanguage(courseMeta?.language);
   for(const [mi,m] of (t.blueprint.modules||[]).entries()){
    const localizedModuleTitle=templateLang==="fr"?m.title:(/^Module\s+\d+$/i.test(String(m.title||""))?`Module ${mi+1}`:m.title);const localizedObjective=templateLang==="fr"?(m.objective||""):"";
    const {data:mod}=await sb.from("course_modules").insert({course_id:courseId,title:localizedModuleTitle,objective:localizedObjective,position:mi,is_intro:false,section_type:"module"}).select("*").single();
    for(const [li,l] of (m.lessons||[]).entries()){
     const localizedLessonTitle=templateLang==="fr"?l.title:`${autoCopy(templateLang,"lesson")} ${li+1}`;
     const {data:lesson}=await sb.from("course_lessons").insert({course_id:courseId,module_id:mod.id,title:localizedLessonTitle,position:li,is_intro:false,is_module_intro:false,stage_type:"lesson"}).select("*").single();
     for(const [bi,type] of (l.blocks||[]).entries())await sb.from("lesson_blocks").insert({course_id:courseId,module_id:mod.id,lesson_id:lesson.id,block_type:type,position:bi,content_json:defaultBlockForLanguage(type,templateLang),settings_json:{},created_by:userId});
    }
   }
   await sb.from("courses").update({template_used:b.template_key,studio_mode:t.mode,...(b.template_key==="language_learning"?{course_type:"language_learning",language_framework:"CEFR"}:{}),updated_at:new Date().toISOString()}).eq("id",courseId);await recalculateCourseDuration(sb,courseId);await log(sb,courseId,userId,"template_applied",{template:b.template_key});return json({success:true});
  }

  if(action==="ensure_assessments"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course,error:courseError}=await sb.from("courses").select("id,title,creator_id,studio_status,lesson_passing_score,module_passing_score,final_passing_score,assessment_policy,certification_requested,requested_cpd,cpd_accredited").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;
   if(!course)return json({success:false,error:"NOT_FOUND"},404);
   if(!isAdmin&&["pending_validation","validated","published"].includes(String(course.studio_status||"")))return json({success:false,error:"COURSE_LOCKED",message:"Cette formation doit être renvoyée en modification avant de changer ses évaluations."},409);

   const [{data:mods,error:modsError},{data:lessons,error:lessonsError},{data:blocks,error:blocksError}]=await Promise.all([
    sb.from("course_modules").select("id,title,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position"),
    sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam,is_required,stage_type").eq("course_id",courseId).order("position"),
    sb.from("lesson_blocks").select("id,course_id,module_id,lesson_id,block_type,position,content_json,settings_json,file_url,file_name,storage_path,bucket_name,interaction_mode,assessment_scope").eq("course_id",courseId).order("position"),
   ]);
   if(modsError)throw modsError;
   if(lessonsError)throw lessonsError;
   if(blocksError)throw blocksError;

   const policy=course.assessment_policy&&typeof course.assessment_policy==="object"?course.assessment_policy:{};
   const policyConfigured=Boolean(policy.builder_configured_at);
   const defaultCooldown=Math.max(0,Number(policy.default_retry_cooldown_hours??24));
   const defaultRemediation=Math.max(1,Number(policy.default_remediation_after_attempts??3));
   const defaultMode=String(policy.default_remediation_mode||"review_module");
   const lessonRequired=policy.lesson_assessment_required===true;
   const moduleRequired=policy.module_assessment_required===true;
   const finalRequired=policy.final_assessment_required===true||course.certification_requested===true||course.requested_cpd===true||course.cpd_accredited===true;
   const evalTypes=["qcm","true_false","open_question","exercise","assignment_upload","case_study","cloze","dictation","pronunciation","matching","sentence_order","oral_response","listening_comprehension","written_expression"];

   // Le niveau d'une évaluation est déterminé par son emplacement structurel :
   // une Synthèse porte l'évaluation du module et la section Examen final porte l'épreuve finale.
   // Les évaluations historiques placées dans une leçon ordinaire conservent leur scope existant
   // afin de ne pas déplacer automatiquement un ancien contenu pédagogique.
   const lessonById=new Map((lessons||[]).map((lesson:any)=>[String(lesson.id),lesson]));
   const staleAssessmentIds=new Set<string>();
   for(const block of blocks||[]){
    if(String(block.interaction_mode)!=="assessment")continue;
    const lesson:any=lessonById.get(String(block.lesson_id));
    const stage=String(lesson?.stage_type||(lesson?.is_intro?"introduction":lesson?.is_module_intro?"module_presentation":lesson?.is_conclusion?"conclusion":lesson?.is_final_exam?"final_exam":"lesson"));
    const currentScope=["lesson","module","final"].includes(String(block.assessment_scope||""))?String(block.assessment_scope):"lesson";
    const expectedScope=stage==="final_exam"?"final":stage==="module_summary"?"module":currentScope;
    if(expectedScope===currentScope)continue;
    const {data:oldQuestions,error:oldQuestionError}=await sb.from("assessment_questions").select("assessment_id").eq("source_lesson_block_id",String(block.id));if(oldQuestionError)throw oldQuestionError;
    for(const row of oldQuestions||[])if(row.assessment_id)staleAssessmentIds.add(String(row.assessment_id));
    const deleteOld=await sb.from("assessment_questions").delete().eq("source_lesson_block_id",String(block.id));if(deleteOld.error)throw deleteOld.error;
    const updateScope=await sb.from("lesson_blocks").update({assessment_scope:expectedScope,updated_at:new Date().toISOString()}).eq("id",String(block.id));if(updateScope.error)throw updateScope.error;
    block.assessment_scope=expectedScope;
    await syncExistingOfficialAssessmentFromBlock(sb,block);
   }
   for(const assessmentId of staleAssessmentIds){const {count,error:countError}=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("assessment_id",assessmentId);if(countError)throw countError;if(Number(count||0)===0){const deactivate=await sb.from("course_assessments").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",assessmentId);if(deactivate.error)throw deactivate.error;}}

   const ensureOne=async(scope:string,title:string,moduleId?:string,lessonId?:string,passing=80,required=false)=>{
    const targetLessonIds=lessonId?[lessonId]:moduleId?(lessons||[]).filter((lesson:any)=>String(lesson.module_id)===String(moduleId)).map((lesson:any)=>String(lesson.id)):scope==="final"?(lessons||[]).filter((lesson:any)=>String(lesson.stage_type||(lesson.is_final_exam?"final_exam":"lesson"))==="final_exam").map((lesson:any)=>String(lesson.id)):(lessons||[]).filter((lesson:any)=>String(lesson.stage_type||"lesson")==="lesson").map((lesson:any)=>String(lesson.id));
    const configuredBlocks=(blocks||[]).filter((block:any)=>targetLessonIds.includes(String(block.lesson_id))&&block.interaction_mode==="assessment"&&String(block.assessment_scope||"lesson")===scope);
    if(configuredBlocks.length){const cfg=assessmentBlockSettings(configuredBlocks[0]);required=required||cfg.required;passing=cfg.passing_score;}

    let q=sb.from("course_assessments").select("*").eq("course_id",courseId).eq("scope",scope);
    if(lessonId)q=q.eq("lesson_id",lessonId);else if(moduleId)q=q.eq("module_id",moduleId);else q=q.is("module_id",null).is("lesson_id",null);
    const existing=await q.maybeSingle();
    if(existing.error)throw existing.error;
    let assessment=existing.data;
    if(!assessment&&!required&&!configuredBlocks.length)return null;
    if(!assessment){
     const insertPayload:any={course_id:courseId,module_id:moduleId||null,lesson_id:lessonId||null,scope,title,passing_score:passing,max_attempts:defaultRemediation,remediation_after_attempts:defaultRemediation,retry_cooldown_hours:defaultCooldown,remediation_mode:scope==="lesson"?"review_lesson":defaultMode,attempts_unlimited_for_purchased:true,required,correction_mode:"mixed",created_by:userId,estimated_minutes:scope==="final"?45:scope==="module"?20:10};
     const inserted=await sb.from("course_assessments").insert(insertPayload).select("*").single();
     if(inserted.error)throw inserted.error;
     assessment=inserted.data;
    } else {
     const ensurePatch:any=policyConfigured
      ? {updated_at:new Date().toISOString()}
      : {required,passing_score:passing,updated_at:new Date().toISOString()};
     const updatedAssessment=await sb.from("course_assessments").update(ensurePatch).eq("id",assessment.id).select("*").single();
     if(updatedAssessment.error)throw updatedAssessment.error;
     assessment=updatedAssessment.data;
    }

    const questionCount=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("assessment_id",assessment.id);
    if(questionCount.error)throw questionCount.error;
    if(!questionCount.count){
     const sourceLessonIds=lessonId?[lessonId]:moduleId?(lessons||[]).filter((lesson:any)=>String(lesson.module_id)===String(moduleId)).map((lesson:any)=>lesson.id):scope==="final"?(lessons||[]).filter((lesson:any)=>String(lesson.stage_type||(lesson.is_final_exam?"final_exam":"lesson"))==="final_exam").map((lesson:any)=>lesson.id):(lessons||[]).filter((lesson:any)=>String(lesson.stage_type||"lesson")==="lesson").map((lesson:any)=>lesson.id);
     const sourceBlocks=(blocks||[]).filter((block:any)=>sourceLessonIds.includes(block.lesson_id)&&evalTypes.includes(block.block_type)&&block.interaction_mode==="assessment"&&String(block.assessment_scope||"lesson")===scope);
     for(const [position,block] of sourceBlocks.entries()){
      const content=block.content_json||{};
      const questionType=String(block.block_type);
      const languagePrompt=questionType==="listening_comprehension"?(content.title||content.instructions||"Compréhension orale"):questionType==="dictation"?(content.instructions||"Transcrivez fidèlement l’audio."):questionType==="oral_response"?(content.prompt||"Réponse orale"):questionType==="pronunciation"?(content.instructions||"Prononcez les éléments demandés."):questionType==="written_expression"?(content.prompt||"Expression écrite"):questionType==="case_study"?(content.task||content.context||"Étude de cas"):null;
      const uploadTypes=new Set(["assignment_upload","exercise","oral_response","pronunciation"]);const languageAccepted=["oral_response","pronunciation"].includes(questionType)?["mp3","wav","m4a","ogg","webm"]:null;
      const blockResource=block.storage_path&&PRIVATE_COURSE_BUCKET_SET.has(String(block.bucket_name||""))?{name:block.file_name||"Ressource",bucket_name:block.bucket_name,storage_path:block.storage_path,url:null}:(block.file_url?{name:block.file_name||"Ressource",url:block.file_url}:null);
      const mediaResource=content.audio_url?{name:"Audio de l’activité",url:content.audio_url}:content.reference_audio_url?{name:"Audio de référence",url:content.reference_audio_url}:null;
      let publicOptions:any=content.options||[];let correctAnswer:any=content.expected_answer??null;
      if(questionType==="qcm")correctAnswer=content.correctIndex;
      else if(questionType==="true_false")correctAnswer=content.answer;
      else if(questionType==="cloze"){correctAnswer=Array.isArray(content.answers)?content.answers:[];publicOptions={text:String(content.text||""),blank_count:Array.isArray(content.answers)?content.answers.length:Math.max(0,String(content.text||"").split("____").length-1)};}
      else if(questionType==="matching"){const pairs=Array.isArray(content.pairs)?content.pairs:[];correctAnswer=pairs.map((x:any)=>String(x.right||""));publicOptions={left:pairs.map((x:any)=>String(x.left||"")),choices:pairs.map((x:any)=>String(x.right||""))};}
      else if(questionType==="sentence_order"){const sentence=String(content.sentence||"");correctAnswer=[sentence,...(Array.isArray(content.accepted_orders)?content.accepted_orders:[])];publicOptions={tokens:Array.isArray(content.tokens)&&content.tokens.length?content.tokens:sentence.split(/\s+/).filter(Boolean)};}
      else if(questionType==="dictation")correctAnswer=String(content.transcript||"");
      else if(questionType==="listening_comprehension"){const questions=Array.isArray(content.questions)?content.questions:[];correctAnswer=questions.map((q:any)=>q.expected_answer??q.answer??q.correct_answer??"");publicOptions={questions:questions.map((q:any)=>({question:String(q.question||""),type:String(q.type||"text")}))};}
      const automaticTypes=new Set(["qcm","true_false","cloze","matching","sentence_order","dictation","listening_comprehension"]);
      const linkedRubric=await rubricCriteriaForTarget(sb,String(block.id));const responseMode=["exercise","case_study"].includes(questionType)?String(content.response_mode||(content.learner_upload_required===true?"file":"text")):null;const responseLayout=questionType==="case_study"?String(content.response_layout||"per_question"):null;if(questionType==="case_study"){const questions=Array.isArray(content.questions)?content.questions:[];publicOptions={context:String(content.context||""),data:String(content.data||""),task:String(content.task||""),questions:questions.map((q:any)=>({question:String(typeof q==="string"?q:q?.question||q?.text||"")})).filter((q:any)=>q.question)};}const selectedGrading=automaticTypes.has(questionType)?"automatic":(responseMode&&responseMode!=="text"?"human":String(content.grading_mode||"human"));const questionPayload:any={assessment_id:assessment.id,question_type:questionType,position,prompt:languagePrompt||String(content.question||content.statement||content.title||content.instructions||"Question à compléter").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(),points:Math.max(0.1,Number(content.points??10)),grading_mode:selectedGrading,response_mode:responseMode,response_layout:responseLayout,max_submission_size_mb:responseMode&&responseMode!=="text"?Math.max(1,Math.min(50,Number(content.max_size_mb||10))):null,options:publicOptions,correct_answer:correctAnswer,explanation:content.explanation||"",resource_files:[...(Array.isArray(content.resources)?content.resources:[]),...(blockResource?[blockResource]:[]),...(mediaResource?[mediaResource]:[])],accepted_submission_types:languageAccepted||(responseMode&&responseMode!=="text"?(Array.isArray(content.accepted_types)?content.accepted_types:["pdf","doc","docx","xls","xlsx","zip","png","jpg"]):(uploadTypes.has(questionType)?["pdf","doc","docx","xls","xlsx","zip","png","jpg"]:[])),rubric:linkedRubric.length?linkedRubric:(content.rubric||[]),localization_json:block.settings_json?.pedagogical_localization&&typeof block.settings_json.pedagogical_localization==="object"?block.settings_json.pedagogical_localization:{},source_lesson_block_id:block.id};
      const {error:questionError}=await sb.from("assessment_questions").insert(questionPayload);
      if(questionError)throw questionError;
     }
    }
    return assessment;
   };

   for(const lesson of lessons||[]){if(String(lesson.stage_type||"lesson")==="lesson")await ensureOne("lesson",`Évaluation — ${lesson.title}`,lesson.module_id,lesson.id,course.lesson_passing_score||80,lessonRequired)}
   for(const module of mods||[]){if(!module.is_intro&&!module.is_conclusion&&!module.is_final_exam)await ensureOne("module",`Évaluation du module — ${module.title}`,module.id,undefined,course.module_passing_score||80,moduleRequired)}
   await ensureOne("final",`Examen final — ${course.title}`,undefined,undefined,course.final_passing_score||70,finalRequired);

   const {data:all,error:allError}=await sb.from("course_assessments").select("*,assessment_questions(count)").eq("course_id",courseId).order("scope");
   if(allError)throw allError;await recalculateCourseDuration(sb,courseId);
   return json({success:true,assessments:all||[],policy});
  }
  if(action==="assessment_policy_get"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course,error:courseError}=await sb.from("courses").select("assessment_policy").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;
   if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const {data:assessments,error:assessmentError}=await sb.from("course_assessments").select("id,title,scope,module_id,lesson_id,passing_score,max_attempts,time_limit_minutes,required,retry_cooldown_hours,remediation_after_attempts,remediation_mode,attempts_unlimited_for_purchased,attempts_per_period,attempt_period,retry_instructions,assessment_type,delivery_mode,security_level,session_required,identity_verification_required,proctoring_settings,result_release_mode,competency_labels,competency_framework_id,jury_required,jury_min_members,jury_decision_mode,appeal_enabled,appeal_deadline_days,allowed_materials,candidate_instructions,integrity_rules,randomize_questions,random_question_count").eq("course_id",courseId).order("scope");
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
   const nowIso=new Date().toISOString();
   const policy={...(b.policy&&typeof b.policy==="object"?b.policy:{}),purchased_access:"until_passed",certificate_requires_success:true,builder_configured_at:nowIso,builder_final_reviewed_at:null};

   const atomicUpdates:any[]=[];
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
    const patch:any={passing_score:Math.min(100,Math.max(1,Number(item.passing_score||70))),max_attempts:Math.max(1,Number(item.max_attempts||item.remediation_after_attempts||3)),remediation_after_attempts:Math.max(1,Number(item.remediation_after_attempts||3)),retry_cooldown_hours:Math.max(0,Number(item.retry_cooldown_hours||0)),remediation_mode:allowedModes.includes(item.remediation_mode)?item.remediation_mode:"review_module",attempts_unlimited_for_purchased:true,time_limit_minutes:timeLimit>0?Math.max(1,timeLimit):null,required:item.required!==false,attempts_per_period:item.attempts_per_period?Math.max(1,Number(item.attempts_per_period)):null,attempt_period:allowedPeriods.includes(item.attempt_period)?item.attempt_period:null,retry_instructions:String(item.retry_instructions||""),assessment_type:allowedTypes.includes(item.assessment_type)?item.assessment_type:(item.scope==="final"?"exam":"quiz"),delivery_mode:allowedDelivery.includes(item.delivery_mode)?item.delivery_mode:"asynchronous",security_level:Math.min(4,Math.max(1,Number(item.security_level||1))),session_required:item.session_required===true,identity_verification_required:item.identity_verification_required===true,proctoring_settings:item.proctoring_settings&&typeof item.proctoring_settings==="object"?Object.fromEntries(Object.entries(item.proctoring_settings).filter(([key])=>key!=="human_proctor_required"&&key!=="recording_required")):{},result_release_mode:juryRequired?"manual":(allowedRelease.includes(item.result_release_mode)?item.result_release_mode:"after_review"),competency_labels:labels.length?labels:(Array.isArray(item.competency_labels)?item.competency_labels.map((label:any)=>String(label).trim()).filter(Boolean).slice(0,30):[]),competency_framework_id:frameworkId,jury_required:juryRequired,jury_min_members:Math.min(15,Math.max(1,Number(item.jury_min_members||2))),jury_decision_mode:juryMode,appeal_enabled:item.appeal_enabled!==false,appeal_deadline_days:Math.min(90,Math.max(0,Number(item.appeal_deadline_days??7))),allowed_materials:String(item.allowed_materials||""),candidate_instructions:String(item.candidate_instructions||""),integrity_rules:String(item.integrity_rules||""),randomize_questions:item.randomize_questions===true,random_question_count:item.randomize_questions===true?Math.max(1,Number(item.random_question_count||1)):null,updated_at:nowIso};
    const mappingRows=selected.map((mapping:any)=>({assessment_id:item.id,competency_id:String(mapping.competency_id),target_level_id:mapping.target_level_id||null,weight:Math.min(100,Math.max(0.01,Number(mapping.weight||1))),passing_score:mapping.passing_score===null||mapping.passing_score===undefined?null:Math.min(100,Math.max(0,Number(mapping.passing_score))),required:mapping.required!==false,created_by:userId}));
    atomicUpdates.push({id:item.id,patch,mappings:mappingRows});
   }

   const first=(scope:string,fallback:number)=>Math.min(100,Math.max(1,Number(rows.find((item:any)=>item.scope===scope)?.passing_score||fallback)));
   const {error:atomicPolicyError}=await sb.rpc("oga_studio_v4_apply_assessment_policy",{p_course_id:courseId,p_updates:atomicUpdates,p_course_patch:{assessment_policy:policy,lesson_passing_score:first("lesson",80),module_passing_score:first("module",80),final_passing_score:first("final",70),assessment_rules_locked:false,updated_at:nowIso}});
   if(atomicPolicyError)throw atomicPolicyError;
   await recalculateCourseDuration(sb,courseId);await log(sb,courseId,userId,"assessment_policy_updated",{count:rows.length});
   return json({success:true,updated_assessments:rows.length,policy});
  }
  if(action==="assessment_policy_confirm_review"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:row,error}=await sb.from("courses").select("assessment_policy").eq("id",courseId).maybeSingle();if(error)throw error;if(!row)return json({success:false,error:"NOT_FOUND"},404);
   const policy=row.assessment_policy&&typeof row.assessment_policy==="object"?row.assessment_policy:{};
   if(!policy.builder_configured_at)return json({success:false,error:"ASSESSMENT_POLICY_NOT_CONFIGURED",message:"Configurez d’abord les règles d’évaluation."},409);
   const next={...policy,builder_final_reviewed_at:new Date().toISOString()};
   const {error:updateError}=await sb.from("courses").update({assessment_policy:next,updated_at:new Date().toISOString()}).eq("id",courseId);if(updateError)throw updateError;
   await log(sb,courseId,userId,"assessment_policy_final_reviewed",{});return json({success:true,policy:next});
  }
  if(action==="prepare_assessment_submission_upload"){
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation administrative Omnia ne crée aucune copie."},403);
   const assessmentId=String(b.assessment_id||"");const questionId=String(b.question_id||"");const fileName=String(b.file_name||"fichier").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-160);const size=Math.max(0,Number(b.size_bytes||0));
   if(!assessmentId||!questionId||size>52428800)return json({success:false,error:size>52428800?"FILE_TOO_LARGE":"ASSESSMENT_QUESTION_REQUIRED"},400);
   const {data:a}=await sb.from("course_assessments").select("id,course_id").eq("id",assessmentId).maybeSingle();if(!a)return json({success:false,error:"ASSESSMENT_NOT_FOUND"},404);
   const {data:question}=await sb.from("assessment_questions").select("id,question_type,response_mode,max_submission_size_mb,accepted_submission_types").eq("id",questionId).eq("assessment_id",assessmentId).maybeSingle();if(!question)return json({success:false,error:"SUBMISSION_NOT_ALLOWED"},400);const qType=String(question.question_type);const historicalUpload=["exercise","assignment_upload","oral_response","pronunciation"].includes(qType);const effectiveResponse=String(question.response_mode||(qType==="case_study"?"text":historicalUpload?"file":"text"));if(!["file","text_file"].includes(effectiveResponse)&&!["assignment_upload","oral_response","pronunciation"].includes(qType))return json({success:false,error:"SUBMISSION_NOT_ALLOWED"},400);
   const accepted=(Array.isArray(question.accepted_submission_types)?question.accepted_submission_types:[]).map((x:any)=>String(x).toLowerCase().replace(/^\./,""));const ext=fileName.includes(".")?fileName.split(".").pop()!.toLowerCase():"";if(accepted.length&&ext&&!accepted.includes(ext)&&!(ext==="jpeg"&&accepted.includes("jpg"))&&!(ext==="jpg"&&accepted.includes("jpeg")))return json({success:false,error:"FILE_TYPE_NOT_ALLOWED",file_name:fileName},400);
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll)return json({success:false,error:"NOT_ENROLLED"},403);
   const path=`${userId}/${a.course_id}/${assessmentId}/${crypto.randomUUID()}-${fileName}`;const {data,error}=await sb.storage.from("assessment-submissions").createSignedUploadUrl(path,{upsert:false});if(error)throw error;return json({success:true,...data,bucket:"assessment-submissions",path});
  }
  if(action==="learner_get_assessment"){
   let q=sb.from("course_assessments").select("*").eq("is_active",true);
   if(b.assessment_id)q=q.eq("id",String(b.assessment_id));else{q=q.eq("course_id",courseId).eq("scope",b.scope||"lesson");if(b.lesson_id)q=q.eq("lesson_id",b.lesson_id);else if(b.module_id)q=q.eq("module_id",b.module_id);else q=q.is("lesson_id",null).is("module_id",null);}
   const {data:a,error:assessmentLookupError}=await q.maybeSingle();if(assessmentLookupError)return json({success:false,error:"ASSESSMENT_LOOKUP_FAILED",message:"L’évaluation du module n’a pas pu être chargée.",details:assessmentLookupError.message},500);if(!a)return json({success:true,assessment:null});
   const assessmentPreview=b.preview===true&&await owns(sb,userId,String(a.course_id),"can_edit_courses");
   if(b.preview===true&&!assessmentPreview&&!isAdmin)return json({success:false,error:"PREVIEW_FORBIDDEN"},403);
   if(!isAdmin&&!assessmentPreview){const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll)return json({success:false,error:"NOT_ENROLLED"},403);}
   let session:any=null;
   if(a.session_required&&!assessmentPreview&&!isAdmin){const sessionId=String(b.session_id||"");if(!sessionId)return json({success:false,error:"SESSION_REQUIRED",message:"Cette évaluation doit être ouverte depuis une session programmée."},409);const {data:sess}=await sb.from("assessment_sessions").select("*").eq("id",sessionId).eq("assessment_id",a.id).maybeSingle();if(!sess)return json({success:false,error:"SESSION_NOT_FOUND"},404);const {data:accommodation}=isAdmin?{data:null}:await sb.from("assessment_accommodations").select("extra_time_minutes").eq("session_id",sessionId).eq("user_id",userId).eq("status","approved").maybeSingle();const effectiveEnd=new Date(new Date(sess.ends_at).getTime()+Math.max(0,Number(accommodation?.extra_time_minutes||0))*60000).toISOString();session={id:sess.id,starts_at:sess.starts_at,ends_at:sess.ends_at,status:sess.status,effective_ends_at:effectiveEnd};const now=Date.now(),start=new Date(sess.starts_at).getTime(),end=new Date(effectiveEnd).getTime();if(!isAdmin&&(now<start-15*60000||now>end||!["scheduled","open","in_progress"].includes(String(sess.status))))return json({success:false,error:"SESSION_NOT_OPEN"},409);const {data:candidate}=isAdmin?{data:null}:await sb.from("assessment_session_candidates").select("status,started_at").eq("session_id",sessionId).eq("user_id",userId).maybeSingle();if(!isAdmin&&!candidate?.started_at)return json({success:false,error:"SESSION_NOT_STARTED",message:"Confirmez d’abord votre identité et démarrez la session."},409);}
   const {data:last}=isAdmin||assessmentPreview?{data:null}:await sb.from("assessment_attempts").select("id,score,passed,status,attempt_number,retry_available_at,remediation_required,remediation_completed_at,feedback,submitted_at,result_status").eq("assessment_id",a.id).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   const [{data:allQuestions,error:questionsError},{data:assessmentSections,error:sectionsError}]=await Promise.all([sb.from("assessment_questions").select("id,section_id,question_type,position,prompt,options,points,grading_mode,response_mode,response_layout,max_submission_size_mb,localization_json,resource_files,accepted_submission_types,source_lesson_block_id").eq("assessment_id",a.id).order("position"),sb.from("assessment_sections").select("id,title,description,position,target_points").eq("assessment_id",a.id).order("position")]);if(questionsError)throw questionsError;if(sectionsError)throw sectionsError;
   const sourceBlockIds=[...new Set((allQuestions||[]).map((question:any)=>String(question.source_lesson_block_id||"")).filter(Boolean))];let sourceBlockMap=new Map<string,any>();if(sourceBlockIds.length){const {data:sourceBlocks,error:sourceBlocksError}=await sb.from("lesson_blocks").select("id,block_type,content_json").in("id",sourceBlockIds);if(sourceBlocksError)throw sourceBlocksError;sourceBlockMap=new Map((sourceBlocks||[]).map((block:any)=>[String(block.id),block]));}
   const canonicalQuestions=canonicalAssessmentQuestions(allQuestions||[]);const nextAttemptNumber=Number(last?.attempt_number||0)+1;const selectedQuestions=selectAssessmentQuestions(canonicalQuestions,a,String(userId),nextAttemptNumber);
   const signedQuestions=await Promise.all(selectedQuestions.map(async(question:any)=>{question={...question,prompt:assessmentPlainText(question.prompt),options:publicAssessmentValue(question.options||{})};delete question.explanation;const resources=await Promise.all((Array.isArray(question.resource_files)?question.resource_files:[]).map(async(resource:any)=>{let bucket=String(resource?.bucket_name||""),path=String(resource?.storage_path||"");if((!bucket||!path)&&resource?.url){const locator=parseStorageLocator(resource.url);if(locator){bucket=locator.bucket;path=locator.path}}if(PRIVATE_COURSE_BUCKET_SET.has(bucket)&&path){const signed=await createSignedObjectUrl(sb,bucket,path,900);return {...resource,bucket_name:bucket,storage_path:path,url:signed}}return resource;}));let options=question.options||{};let presentation:any={};if(question.source_lesson_block_id){const source=sourceBlockMap.get(String(question.source_lesson_block_id));const content=source?.content_json||{};const type=String(question.question_type||source?.block_type||"");const promptValue=type==="true_false"?content.statement:type==="case_study"?(content.task||question.prompt):type==="written_expression"||type==="oral_response"?content.prompt:(content.question||content.instructions||content.title||question.prompt);presentation={prompt_html:assessmentPlainText(promptValue||question.prompt||"")};if(type==="case_study"){const sourceQuestions=Array.isArray(content.questions)?content.questions:[];options={...options,context:assessmentPlainText(content.context||options?.context||""),data:assessmentPlainText(content.data||options?.data||""),task:assessmentPlainText(content.task||options?.task||""),questions:sourceQuestions.length?sourceQuestions.map((item:any)=>({question:assessmentPlainText(typeof item==="string"?item:item?.question||item?.text||"")})).filter((item:any)=>item.question):(Array.isArray(options?.questions)?publicAssessmentValue(options.questions):[])};presentation={...presentation,context_html:assessmentPlainText(content.context||options?.context||""),data_html:assessmentPlainText(content.data||options?.data||""),task_html:assessmentPlainText(content.task||options?.task||""),question_html:sourceQuestions.map((item:any)=>assessmentPlainText(typeof item==="string"?item:item?.question||item?.text||""))};}}return {...question,options:publicAssessmentValue(options),presentation,resource_files:resources};}));
   let correction:any=null;if(last?.id&&(assessmentPreview||isAdmin||last.result_status==="published")){const {data:c}=await sb.from("assessment_corrections").select("score,max_score,comment,corrected_bucket_name,corrected_storage_path,corrected_file_name,published_at").eq("attempt_id",last.id).eq("status","published").order("published_at",{ascending:false}).limit(1).maybeSingle();if(c){let signed_url=null;if(c.corrected_bucket_name&&c.corrected_storage_path){const {data:signed}=await sb.storage.from(c.corrected_bucket_name).createSignedUrl(c.corrected_storage_path,3600);signed_url=signed?.signedUrl||null}correction={...c,signed_url}}}
   if(last&&last.result_status!=="published"&&!assessmentPreview&&!isAdmin){last.score=null;last.passed=false;last.feedback=null;correction=null;}
   const now=Date.now();const retryAt=last?.retry_available_at?new Date(last.retry_available_at).getTime():0;const pending=last&&["pending_review","submitted","in_progress"].includes(last.status);const remediationBlocked=!!last?.remediation_required&&!last?.remediation_completed_at;
   const sanitizedSections=(assessmentSections||[]).map((section:any)=>({...section,title:assessmentPlainText(section.title),description:assessmentPlainText(section.description)}));
   return json({success:true,preview:assessmentPreview||isAdmin,assessment:{id:a.id,course_id:a.course_id,scope:a.scope,module_id:a.module_id,lesson_id:a.lesson_id,title:assessmentPlainText(a.title),instructions:assessmentPlainText(a.instructions),passing_score:a.passing_score,time_limit_minutes:a.time_limit_minutes,required:a.required,session_required:a.session_required,assessment_type:a.assessment_type,delivery_mode:a.delivery_mode,result_release_mode:a.result_release_mode,remediation_mode:a.remediation_mode,retry_instructions:a.retry_instructions,session,sections:sanitizedSections,total_points:selectedQuestions.reduce((sum:number,q:any)=>sum+Math.max(0,Number(q.points||0)),0),questions:signedQuestions,latest_attempt:last||null,correction,can_retry:assessmentPreview||isAdmin?true:!pending&&!remediationBlocked&&(!retryAt||retryAt<=now),retry_blocked_until:assessmentPreview||isAdmin?null:(retryAt>now?last.retry_available_at:null),remediation_blocked:assessmentPreview||isAdmin?false:remediationBlocked}});
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
   const [{data:attemptUser},{data:attemptProfile}]=await Promise.all([sb.from("users").select("country_code").eq("id",userId).maybeSingle(),sb.from("user_profiles").select("preferred_pedagogical_currency").eq("user_id",userId).maybeSingle()]);const attemptCountry=String(attemptUser?.country_code||"").toUpperCase();let attemptSuggested:string|null=null;if(attemptCountry){const {data:attemptLoc}=await sb.from("country_localization_settings").select("default_currency_code").eq("country_code",attemptCountry).eq("is_active",true).maybeSingle();attemptSuggested=attemptLoc?.default_currency_code?String(attemptLoc.default_currency_code).toUpperCase():null;}const attemptCurrency=attemptProfile?.preferred_pedagogical_currency?String(attemptProfile.preferred_pedagogical_currency).toUpperCase():attemptSuggested;
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation administrative Omnia ne crée aucune tentative."},403);
   const assessmentId=String(b.assessment_id||"");const {data:a,error:ae}=await sb.from("course_assessments").select("*").eq("id",assessmentId).eq("is_active",true).single();if(ae)throw ae;
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll&&!isAdmin)return json({success:false,error:"NOT_ENROLLED"},403);
   const {data:last}=await sb.from("assessment_attempts").select("id,status,retry_available_at,remediation_required,remediation_completed_at,attempt_number").eq("assessment_id",assessmentId).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   if(last&&["pending_review","submitted","in_progress"].includes(last.status))return json({success:false,error:"ATTEMPT_PENDING_REVIEW",message:"Une copie est déjà en attente de correction."},409);
   if(last?.retry_available_at&&new Date(last.retry_available_at)>new Date())return json({success:false,error:"RETRY_COOLDOWN",retry_available_at:last.retry_available_at,message:"La nouvelle tentative sera disponible après le délai prévu."},429);
   if(last?.remediation_required&&!last?.remediation_completed_at)return json({success:false,error:"REMEDIATION_REQUIRED",message:"Revoyez d’abord le contenu demandé avant de recommencer."},409);
   const {data:allQuestions}=await sb.from("assessment_questions").select("*").eq("assessment_id",assessmentId).order("position");const attemptNo=Number(last?.attempt_number||0)+1;const qs=selectAssessmentQuestions(allQuestions||[],a,String(userId),attemptNo);
   const answers=Array.isArray(b.answers)?b.answers:[];let earned=0,total=0,pending=false;
   for(const qn of qs||[]){const ans=answers.find((x:any)=>x.question_id===qn.id)?.answer;const files=Array.isArray(ans?.files)?ans.files:[];const qType=String(qn.question_type);const historicalUpload=["exercise","assignment_upload","oral_response","pronunciation"].includes(qType);const responseMode=String(qn.response_mode||(qType==="case_study"?"text":historicalUpload?"file":"text"));if(["exercise","case_study"].includes(qType)){const hasFiles=files.length>0;const hasText=String(ans?.text??(typeof ans==="string"?ans:"")).trim().length>0;const responseValues=Array.isArray(ans?.responses)?ans.responses:[];const questions=Array.isArray(qn.options?.questions)?qn.options.questions:[];const perQuestionOk=questions.length>0&&questions.every((_:any,i:number)=>String(responseValues[i]||"").trim().length>0);const textOk=String(qn.response_layout||"single")==="per_question"&&questions.length?perQuestionOk:hasText;if((responseMode==="text"&&!textOk)||(responseMode==="file"&&!hasFiles)||(responseMode==="text_file"&&(!textOk||!hasFiles)))return json({success:false,error:"ASSESSMENT_SUBMISSION_INCOMPLETE",question_id:qn.id},400);}const expectedPrefix=`${userId}/${a.course_id}/${assessmentId}/`;const accepted=(Array.isArray(qn.accepted_submission_types)?qn.accepted_submission_types:[]).map((x:any)=>String(x).toLowerCase().replace(/^\./,""));for(const f of files){const path=String(f?.storage_path||"");const name=String(f?.file_name||f?.name||"");const ext=name.includes(".")?name.split(".").pop()!.toLowerCase():"";if((f?.bucket_name||"assessment-submissions")!=="assessment-submissions"||!path.startsWith(expectedPrefix))return json({success:false,error:"INVALID_SUBMISSION_FILE"},400);if(Number(f?.size_bytes||f?.size||0)>52428800)return json({success:false,error:"FILE_TOO_LARGE"},400);if(accepted.length&&ext&&!accepted.includes(ext)&&!(ext==="jpeg"&&accepted.includes("jpg"))&&!(ext==="jpg"&&accepted.includes("jpeg")))return json({success:false,error:"FILE_TYPE_NOT_ALLOWED",file_name:name},400);}}
   let session:any=null;if(a.session_required){const sessionId=String(b.session_id||"");const {data:sess}=await sb.from("assessment_sessions").select("*").eq("id",sessionId).eq("assessment_id",assessmentId).maybeSingle();if(!sess)return json({success:false,error:"SESSION_REQUIRED"},409);const {data:accommodation}=await sb.from("assessment_accommodations").select("extra_time_minutes").eq("session_id",sessionId).eq("user_id",userId).eq("status","approved").maybeSingle();const effectiveEnd=new Date(new Date(sess.ends_at).getTime()+Math.max(0,Number(accommodation?.extra_time_minutes||0))*60000);const now=Date.now();if(now<new Date(sess.starts_at).getTime()-15*60000||now>effectiveEnd.getTime()||!["scheduled","open","in_progress"].includes(String(sess.status)))return json({success:false,error:"SESSION_CLOSED"},409);session={...sess,effective_ends_at:effectiveEnd.toISOString()};const {data:candidate}=await sb.from("assessment_session_candidates").select("started_at").eq("session_id",sessionId).eq("user_id",userId).maybeSingle();if(!candidate?.started_at)return json({success:false,error:"SESSION_NOT_STARTED"},409);}
   const stagedAnswers:any[]=[];
   const attemptPayload:any={assessment_id:assessmentId,course_id:a.course_id,user_id:userId,attempt_number:attemptNo,status:"submitted",submitted_at:new Date().toISOString(),session_id:session?.id||null,result_status:"pending_review",identity_verified_at:session?.identity_verification_required?new Date().toISOString():null,security_snapshot:{security_level:session?.security_level||a.security_level||1,proctoring_settings:session?.proctoring_settings||a.proctoring_settings||{}},localization_snapshot:{country_code:attemptCountry||null,currency_code:attemptCurrency||null,source:attemptProfile?.preferred_pedagogical_currency?"user_preference":attemptSuggested?"country_default":"reference",frozen_at:new Date().toISOString()}};
   for(const qn of qs||[]){total+=Number(qn.points||0);const ans=answers.find((x:any)=>x.question_id===qn.id)?.answer;let autoScore:null|number=null;let review="not_required";
    if(qn.question_type==="qcm")autoScore=Number(ans)===Number(qn.correct_answer)?Number(qn.points):0;
    else if(qn.question_type==="true_false"){const expected=typeof qn.correct_answer==="boolean"?qn.correct_answer:String(qn.correct_answer).toLowerCase()==="true";const received=typeof ans==="boolean"?ans:String(ans).toLowerCase()==="true";autoScore=received===expected?Number(qn.points):0;}
    else if(qn.question_type==="cloze"||qn.question_type==="matching"){const expected=Array.isArray(qn.correct_answer)?qn.correct_answer:[];const received=Array.isArray(ans)?ans:[];const correct=expected.filter((x:any,i:number)=>evalTextNorm(x)===evalTextNorm(received[i])).length;autoScore=expected.length?Number(qn.points)*(correct/expected.length):0;}
    else if(qn.question_type==="sentence_order"){const accepted=Array.isArray(qn.correct_answer)?qn.correct_answer:[qn.correct_answer];const received=Array.isArray(ans)?ans.join(" "):String(ans||"");autoScore=accepted.some((x:any)=>evalTextNorm(x)===evalTextNorm(received))?Number(qn.points):0;}
    else if(qn.question_type==="dictation"){autoScore=Number(qn.points)*(evalSimilarity(qn.correct_answer,ans)/100);}
    else if(qn.question_type==="listening_comprehension"){const expected=Array.isArray(qn.correct_answer)?qn.correct_answer:[];const received=Array.isArray(ans)?ans:[];const gradable=expected.map((x:any,i:number)=>({x,i})).filter((x:any)=>String(x.x??"").trim());const scorePct=gradable.length?gradable.reduce((sum:number,item:any)=>sum+evalSimilarity(item.x,received[item.i]||""),0)/gradable.length:0;autoScore=Number(qn.points)*(scorePct/100);}
    else {
     const mode=String(qn.grading_mode||"human");
     if(mode==="ai"||mode==="ai_human"){
      const aiResult=await gradeAnswerWithAi(sb,{userId,courseId:a.course_id,assessmentId,question:qn,answer:ans});
      if(aiResult.ok){
       autoScore=Number(aiResult.score);review=mode==="ai"?"not_required":"pending";
       if(mode==="ai_human")pending=true;
       (qn as any).__ai_result=aiResult;
      }else{
       // Fail-safe: une indisponibilité IA ne doit jamais fabriquer une note.
       pending=true;review="pending";(qn as any).__ai_result=aiResult;
      }
     }else {pending=true;review="pending";}
    }
    if(autoScore!==null&&String(qn.grading_mode)!=="ai_human")earned+=autoScore;
    const files=Array.isArray(ans?.files)?ans.files:[];const aiResult=(qn as any).__ai_result;
    const answerPayload:any={question_id:qn.id,answer_json:ans===undefined?null:ans,submission_files:files,auto_score:String(qn.grading_mode)==="automatic"?autoScore:null,final_score:String(qn.grading_mode)==="ai"?autoScore:(String(qn.grading_mode)==="automatic"?autoScore:null),review_status:review,ai_score:aiResult?.ok?Number(aiResult.score):null,ai_feedback:aiResult?.ok?String(aiResult.feedback||""):null,ai_grading_json:aiResult?.ok?{criteria:aiResult.criteria||[],request_id:aiResult.request_id||null}:{error:aiResult?.error||null},ai_provider:aiResult?.ok?aiResult.provider:null,ai_model:aiResult?.ok?aiResult.model:null,ai_graded_at:aiResult?.ok?new Date().toISOString():null,human_validated_ai:false};
    const validatedFiles=files.filter((f:any)=>f?.storage_path).map((f:any)=>({bucket_name:"assessment-submissions",storage_path:f.storage_path,file_name:f.file_name||f.name||"fichier",mime_type:f.mime_type||f.type||null,size_bytes:Number(f.size_bytes||f.size||0)}));
    stagedAnswers.push({question_id:qn.id,answer:answerPayload,files:validatedFiles});
   }
   const score=total?Math.round((earned/total)*10000)/100:0;const passed=!pending&&score>=Number(a.passing_score);const failedCount=attemptNo;const remediationRequired=!pending&&!passed&&String(a.remediation_mode||"none")!=="none"&&failedCount>=Number(a.remediation_after_attempts||a.max_attempts||3);const retryAvailableAt=!pending&&!passed&&Number(a.retry_cooldown_hours||0)>0?new Date(Date.now()+Number(a.retry_cooldown_hours)*3600000).toISOString():null;
   const releaseNow=!pending&&!a.jury_required&&String(a.result_release_mode||"after_review")==="immediate";
   const {data:commit,error:commitError}=await sb.rpc("oga_studio_v4_submit_assessment",{p_assessment_id:assessmentId,p_user_id:userId,p_attempt:attemptPayload,p_answers:stagedAnswers,p_result:{score,passed,status:pending?"pending_review":passed?"passed":"failed",retry_available_at:retryAvailableAt,remediation_required:remediationRequired,result_status:releaseNow?"published":"pending_review"}});
   if(commitError){if(String(commitError.message||"").includes("OGA_ATTEMPT_CONFLICT"))return json({success:false,error:"ATTEMPT_CONFLICT",message:"Une tentative existe déjà ou les conditions de reprise ont changé."},409);throw commitError;}
   const attempt={id:commit?.attempt_id,user_id:userId,assessment_id:assessmentId};
   if(releaseNow){try{await syncCompetencyLedger(sb,attempt,a,score,null,"verified",[])}catch(e){console.error("assessment competency ledger deferred",e)}}
   if(passed&&a.scope==="lesson"&&a.lesson_id){const {data:lesson}=await sb.from("course_lessons").select("cpd_calculated_time_seconds").eq("id",a.lesson_id).maybeSingle();const {data:prog}=await sb.from("user_lesson_progress").select("time_spent_seconds").eq("user_id",userId).eq("lesson_id",a.lesson_id).maybeSingle();const reached=Number(lesson?.cpd_calculated_time_seconds||0)===0||Number(prog?.time_spent_seconds||0)>=Number(lesson?.cpd_calculated_time_seconds||0);await sb.from("user_lesson_progress").upsert({user_id:userId,course_id:a.course_id,lesson_id:a.lesson_id,quiz_passed:true,quiz_score:Math.round(score),is_completed:reached,completed_at:reached?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});}
   if(passed&&a.scope==="final")triggerCertificate(userId,a.course_id,"final_exam_passed");
   return json({success:true,attempt_id:attempt.id,score:releaseNow?score:null,passed:releaseNow?passed:null,pending_review:!releaseNow,passing_score:a.passing_score,retry_available_at:retryAvailableAt,remediation_required:remediationRequired});
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
   const {data:answers}=await sb.from("assessment_answers").select("*,assessment_questions(id,prompt,question_type,points,rubric,correct_answer,grading_mode)").eq("attempt_id",attemptId).order("created_at");
   const {data:files}=await sb.from("assessment_submission_files").select("*").eq("attempt_id",attemptId).order("uploaded_at");const signedFiles=[];for(const f of files||[]){const {data:signed}=await sb.storage.from(f.bucket_name).createSignedUrl(f.storage_path,3600);signedFiles.push({...f,signed_url:signed?.signedUrl||null});}
   const {data:correction}=await sb.from("assessment_corrections").select("*").eq("attempt_id",attemptId).eq("grader_id",userId).maybeSingle();let correctionSigned=null;if(correction?.corrected_bucket_name&&correction?.corrected_storage_path){const {data:signed}=await sb.storage.from(correction.corrected_bucket_name).createSignedUrl(correction.corrected_storage_path,3600);correctionSigned=signed?.signedUrl||null;}
   return json({success:true,attempt:att,answers:answers||[],files:signedFiles,correction:correction?{...correction,signed_url:correctionSigned}:null});
  }
  if(action==="grader_ai_suggest_answer"){
   const answerId=String(b.answer_id||"");if(!answerId)return json({success:false,error:"ANSWER_ID_REQUIRED"},400);
   const {data:answer,error:answerError}=await sb.from("assessment_answers").select("id,attempt_id,answer_json,auto_score,final_score,assessment_attempts(course_id,user_id),assessment_questions(id,prompt,question_type,points,correct_answer,explanation,rubric,grading_mode)").eq("id",answerId).maybeSingle();
   if(answerError)throw answerError;if(!answer)return json({success:false,error:"ANSWER_NOT_FOUND"},404);
   const att=(answer as any).assessment_attempts||{};if(!(await owns(sb,userId,String(att.course_id||""))))return json({success:false,error:"FORBIDDEN"},403);
   const q=(answer as any).assessment_questions||{};const maxPoints=Math.max(0,Number(q.points||0));
   if(["qcm","true_false"].includes(String(q.question_type||"")))return json({success:false,error:"AUTOMATIC_QUESTION",message:"Cette question est déjà corrigée automatiquement."},409);
   const prompt=`Tu assistes un correcteur Omnia Global Academy. Tu proposes une correction, mais tu ne prends jamais la décision finale.

Question : ${String(q.prompt||"")}
Type : ${String(q.question_type||"")}
Réponse de l'apprenant : ${JSON.stringify(answer.answer_json??null)}
Repères de correction : ${JSON.stringify(q.correct_answer??null)}
Explication éventuelle : ${String(q.explanation||"")}
Grille/rubrique : ${JSON.stringify(q.rubric||[])}
Points maximum : ${maxPoints}

Retourne uniquement un JSON valide : {"suggested_points": nombre entre 0 et ${maxPoints}, "feedback": "commentaire bref et constructif", "reasoning_summary": "justification concise destinée au correcteur"}. N'invente aucun critère absent de la consigne ou de la grille.`;
   try{const ai=await runAiText(sb,{context:{module:"studio",action:"grader_ai_suggest_answer",userId,courseId:String(att.course_id||""),metadata:{answer_id:answerId,question_type:q.question_type}},tier:"quality",prompt,maxTokens:1800,effort:"low",output:"structured",validate:value=>Number.isFinite(Number(value.suggested_points))});let parsed:any=null;try{parsed=parseAiObject(ai.text)}catch{return json({success:false,error:"AI_SUGGESTION_INVALID",message:"La suggestion IA n'a pas pu être structurée. Aucune note n'a été enregistrée."},502)}const suggested=Math.min(maxPoints,Math.max(0,Number(parsed?.suggested_points||0)));return json({success:true,suggestion:{suggested_points:suggested,feedback:String(parsed?.feedback||""),reasoning_summary:String(parsed?.reasoning_summary||"")},provider:ai.provider,model:ai.model,advisory_only:true});}catch(error){const payload=aiErrorPayload(error);return json({success:false,...payload,message:"La correction assistée par IA est momentanément indisponible. Aucune note n'a été modifiée."},payload.status||502)}
  }
  if(action==="prepare_assessment_correction_upload"){
   const attemptId=String(b.attempt_id||"");const {data:att}=await sb.from("assessment_attempts").select("course_id").eq("id",attemptId).maybeSingle();if(!att||!(await owns(sb,userId,att.course_id,"can_upload_files")))return json({success:false,error:"FORBIDDEN"},403);const fileName=String(b.file_name||"correction").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-160);if(Number(b.size_bytes||0)>52428800)return json({success:false,error:"FILE_TOO_LARGE"},400);const path=`${att.course_id}/${attemptId}/${userId}/${crypto.randomUUID()}-${fileName}`;const {data,error}=await sb.storage.from("assessment-corrections").createSignedUploadUrl(path,{upsert:false});if(error)throw error;return json({success:true,...data,bucket:"assessment-corrections",path});
  }
  if(action==="grader_save_correction"){
   const attemptId=String(b.attempt_id||"");
   const {data:att,error:attemptError}=await sb.from("assessment_attempts").select("*,course_assessments(id,passing_score,scope,course_id,lesson_id,retry_cooldown_hours,remediation_after_attempts,remediation_mode,result_release_mode,competency_labels,jury_required,appeal_enabled,appeal_deadline_days)").eq("id",attemptId).single();
   if(attemptError)throw attemptError;if(!(await owns(sb,userId,att.course_id)))return json({success:false,error:"FORBIDDEN"},403);
   const assessment=(att as any).course_assessments||{};if(b.publish===true&&assessment.jury_required===true)return json({success:false,error:"JURY_DECISION_REQUIRED",message:"Cette évaluation exige une décision du jury. Enregistrez la correction en brouillon puis transmettez la copie au jury."},409);const status=b.publish===true?"published":"draft";let score=Math.min(100,Math.max(0,Number(b.score||0)));const file=b.corrected_file||{};
   const submittedScores=Array.isArray(b.answer_scores)?b.answer_scores:[];if(submittedScores.length){const {data:answerRows,error:answerRowsError}=await sb.from("assessment_answers").select("id,auto_score,final_score,ai_score,ai_feedback,ai_grading_json,review_status,assessment_questions(points,grading_mode)").eq("attempt_id",attemptId);if(answerRowsError)throw answerRowsError;let earned=0,total=0;for(const row of answerRows||[]){const maxPoints=Math.max(0,Number((row as any).assessment_questions?.points||0));total+=maxPoints;const supplied=submittedScores.find((x:any)=>String(x.answer_id)===String(row.id));const mode=String((row as any).assessment_questions?.grading_mode||"human");let finalScore=row.review_status==="not_required"?Number(row.auto_score||row.final_score||0):Number(supplied?.score);if(!Number.isFinite(finalScore)&&mode==="ai_human"&&Number.isFinite(Number((row as any).ai_score)))finalScore=Number((row as any).ai_score);if(!Number.isFinite(finalScore)||finalScore<0||finalScore>maxPoints)return json({success:false,error:"INVALID_ANSWER_SCORE",answer_id:row.id,max_points:maxPoints},400);earned+=finalScore;await sb.from("assessment_answers").update({final_score:finalScore,review_status:"reviewed",human_validated_ai:mode==="ai_human",grader_feedback:String(supplied?.feedback||b.comment||""),updated_at:new Date().toISOString()}).eq("id",row.id);}score=total?Math.round(earned/total*10000)/100:0;}
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
    if(passed&&assessment.scope==="lesson"&&assessment.lesson_id){const {data:lesson}=await sb.from("course_lessons").select("cpd_calculated_time_seconds").eq("id",assessment.lesson_id).maybeSingle();const {data:progress}=await sb.from("user_lesson_progress").select("time_spent_seconds").eq("user_id",att.user_id).eq("lesson_id",assessment.lesson_id).maybeSingle();const reached=Number(lesson?.cpd_calculated_time_seconds||0)===0||Number(progress?.time_spent_seconds||0)>=Number(lesson?.cpd_calculated_time_seconds||0);await sb.from("user_lesson_progress").upsert({user_id:att.user_id,course_id:att.course_id,lesson_id:assessment.lesson_id,quiz_passed:true,quiz_score:Math.round(score),is_completed:reached,completed_at:reached?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,lesson_id"});}
    let notificationAction=`/cours/${att.course_id}/apprendre`;if(assessment.scope==="module"&&assessment.module_id){const {data:summaryLesson}=await sb.from("course_lessons").select("id").eq("module_id",assessment.module_id).eq("stage_type","module_summary").order("position",{ascending:false}).limit(1).maybeSingle();if(summaryLesson?.id)notificationAction=`/cours/${att.course_id}/apprendre/${summaryLesson.id}`;}else if(assessment.scope==="lesson"&&assessment.lesson_id)notificationAction=`/cours/${att.course_id}/apprendre/${assessment.lesson_id}`;else if(assessment.scope==="final")notificationAction=`/cours/${att.course_id}/validation-finale`;await dispatchOmniaInAppNotification({userId:String(att.user_id),title:"Résultat de votre évaluation",message:passed?`Votre évaluation a été corrigée et validée avec ${score} %.`:`Votre évaluation a été corrigée. Votre résultat est de ${score} %.`,actionUrl:notificationAction,notificationType:"assessment_result_published",priority:"normal",payload:{course_id:att.course_id,assessment_id:assessment.id,attempt_id:attemptId,passed,score}});
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
  if(action==="quality_spelling_review"){
   if(!courseId||!(await owns(sb,userId,courseId,"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   const {data:c}=await sb.from("courses").select("title,short_description,long_description,target_audience,objectives,language").eq("id",courseId).maybeSingle();
   const {data:rows}=await sb.from("lesson_blocks").select("id,lesson_id,block_type,title,content_json").eq("course_id",courseId).order("position");
   const {data:writingLessons}=await sb.from("course_lessons").select("id,module_id").eq("course_id",courseId);
   const writingLessonMap=new Map((writingLessons||[]).map((x:any)=>[String(x.id),String(x.module_id||"")]));
   const sources:any[]=[];
   const push=(source:string,text:unknown,block_id:string|null=null,lesson_id:string|null=null)=>{const value=cleanImportedText(String(text||"").replace(/<[^>]+>/g," "));if(value)sources.push({source,block_id,lesson_id,module_id:lesson_id?writingLessonMap.get(String(lesson_id))||null:null,text:value.slice(0,1400)})};
   push("Titre de la formation",c?.title);push("Description courte",c?.short_description);push("Description détaillée",c?.long_description);push("Public cible",c?.target_audience);(c?.objectives||[]).forEach((x:any,i:number)=>push(`Objectif ${i+1}`,x));
   for(const row of (rows||[]).slice(0,140)){
    const cj=row.content_json&&typeof row.content_json==="object"?row.content_json:{};
    const parts:any[]=[row.title,cj.text,cj.html,cj.content,cj.definition,cj.term,cj.quote,cj.caption,cj.prompt,cj.question,cj.instructions,cj.intro,cj.summary,cj.situation,cj.explication,cj.conclusion];
    if(Array.isArray(cj.items))parts.push(...cj.items.map((x:any)=>typeof x==="string"?x:JSON.stringify(x)));
    if(Array.isArray(cj.points))parts.push(...cj.points.map((x:any)=>typeof x==="string"?x:JSON.stringify(x)));
    const value=cleanImportedText(parts.filter(Boolean).join("\n").replace(/<[^>]+>/g," "));
    if(value)push(`${row.block_type}`,value,String(row.id),row.lesson_id?String(row.lesson_id):null);
   }
   if(!sources.length)return json({success:true,suggestions:[],message:"Aucun texte à analyser."});
   const payload=JSON.stringify(sources).slice(0,28000);
   const language=String(c?.language||"fr").toLowerCase();
   const prompt=`Tu es un correcteur éditorial professionnel pour une plateforme de formation. Analyse uniquement les fautes manifestes d'orthographe, grammaire, accords et formulation maladroite dans la langue principale ${language}. Ne corrige pas les noms propres, acronymes, termes métier ou variantes africaines plausibles sans certitude. Ne réécris pas le fond pédagogique. Retourne STRICTEMENT un JSON {"suggestions":[{"source":"...","block_id":"uuid ou null","original":"segment court","replacement":"correction courte","reason":"raison brève"}]}. Maximum 30 suggestions, aucune explication hors JSON.\n\nCONTENUS:\n${payload}`;
   try{
    const ai=await runAiText(sb,{context:{module:"studio",action:"quality_spelling_review",userId,courseId},tier:"fast",prompt,maxTokens:2600,effort:"low",output:"structured",validate:value=>Array.isArray(value.suggestions)});
    let parsed:any={suggestions:[]};try{parsed=parseAiObject(ai.text)}catch{return json({success:false,error:"WRITING_REVIEW_INVALID",message:"L’analyse rédactionnelle n’a pas pu être structurée."},502)}
    const suggestions=Array.isArray(parsed?.suggestions)?parsed.suggestions.slice(0,30).map((x:any)=>({source:String(x.source||""),block_id:x.block_id?String(x.block_id):null,lesson_id:x.lesson_id?String(x.lesson_id):null,module_id:x.module_id?String(x.module_id):null,original:String(x.original||"").slice(0,500),replacement:String(x.replacement||"").slice(0,500),reason:String(x.reason||"").slice(0,500)})).filter((x:any)=>x.original&&x.replacement):[];
    return json({success:true,suggestions,provider:ai.provider,model:ai.model,blocking:false});
   }catch(error){const payload=aiErrorPayload(error);return json({success:false,...payload,message:"L’analyse orthographique globale est momentanément indisponible. Le correcteur local du navigateur reste actif."},payload.status||502)}
  }
  if(action==="validate_checklist"){
   const phase=String(b.phase||"quality")==="publication"?"publication":"quality";const publicationPhase=phase==="publication";
   const errors:string[]=[],warnings:string[]=[],explicitIssues:any[]=[];
   const {data:c,error:courseError}=await sb.from("courses").select("*").eq("id",courseId).single();if(courseError)throw courseError;
   const {data:m}=await sb.from("course_modules").select("id,title,objective,is_intro,is_conclusion,is_final_exam,is_required").eq("course_id",courseId).order("position");
   const {data:l}=await sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam,stage_type").eq("course_id",courseId).order("position");
   const {data:bl}=await sb.from("lesson_blocks").select("id,module_id,lesson_id,title,position,block_type,content_json,settings_json,file_url,file_name,interaction_mode,assessment_scope,is_required,training_passing_score,training_is_graded,rag_enabled,preview_allowed,course_id,created_by").eq("course_id",courseId);
    // Audit qualité en lecture seule : aucune création ni synchronisation d’épreuve.
   const {data:assessments}=await sb.from("course_assessments").select("id,scope,lesson_id,module_id,required,passing_score,retry_cooldown_hours,remediation_after_attempts,remediation_mode,assessment_questions(count)").eq("course_id",courseId);
   const assessmentIdsForComposition=(assessments||[]).map((a:any)=>String(a.id));let compositionQuestions:any[]=[];let compositionSections:any[]=[];
   if(assessmentIdsForComposition.length){const [qRes,sRes]=await Promise.all([sb.from("assessment_questions").select("id,assessment_id,section_id,points,rubric,source_lesson_block_id").in("assessment_id",assessmentIdsForComposition),sb.from("assessment_sections").select("id,assessment_id,title,target_points").in("assessment_id",assessmentIdsForComposition)]);compositionQuestions=qRes.data||[];compositionSections=sRes.data||[];}
   const blockIdsForLinks=(bl||[]).filter((x:any)=>["rubric","correction"].includes(String(x.block_type))).map((x:any)=>String(x.id));const {data:blockLinks}=blockIdsForLinks.length?await sb.from("lesson_block_links").select("source_block_id,target_block_id,relation_type").in("source_block_id",blockIdsForLinks):{data:[] as any[]};const linkedSourceIds=new Set((blockLinks||[]).map((x:any)=>String(x.source_block_id)));
   if(!String(c.course_code||"").trim())errors.push("Ajoutez le code unique de la formation.");
   if(!c.title?.trim())errors.push("Le titre de la formation est obligatoire.");
   if(!c.short_description?.trim())errors.push("Ajoutez la description courte visible avant achat.");
   if(!c.long_description?.trim())errors.push("Ajoutez la présentation détaillée de la formation.");
   if(!c.cover_image_url?.trim())errors.push("Ajoutez une image de couverture.");
   if(!c.category)errors.push("Sélectionnez une catégorie.");
   if(!c.level)errors.push("Sélectionnez un niveau.");
   if(!SUPPORTED_COURSE_LANGS.has(String(c.language||"").toLowerCase()))errors.push("Sélectionnez une langue principale de contenu valide.");
   if(c.course_type==="language_learning"){const start=String(c.cefr_start_level||"");const target=String(c.cefr_target_level||"");if(!SUPPORTED_COURSE_LANGS.has(String(c.instruction_language||"").toLowerCase()))errors.push("Sélectionnez la langue d’enseignement de la formation linguistique.");if(!SUPPORTED_COURSE_LANGS.has(String(c.target_language||"").toLowerCase()))errors.push("Sélectionnez la langue étudiée.");if(!CEFR_LEVELS.has(start))errors.push("Sélectionnez le niveau CECRL / CEFR de départ.");if(!CEFR_LEVELS.has(target))errors.push("Sélectionnez le niveau CECRL / CEFR visé.");const order=["A1","A2","B1","B2","C1","C2"];if(CEFR_LEVELS.has(start)&&CEFR_LEVELS.has(target)&&order.indexOf(target)<order.indexOf(start))errors.push("Le niveau CECRL / CEFR visé ne peut pas être inférieur au niveau de départ.");}
   if(!c.target_audience?.trim())errors.push("Précisez le public cible.");
   if(!(c.objectives||[]).filter((x:any)=>String(x||"").trim()).length)errors.push("Ajoutez au moins un objectif pédagogique.");
   const design=c.learning_design_settings||{};
   if(publicationPhase&&design.drip_enabled&&Number(design.drip_interval_days||0)<1)errors.push("Le déblocage progressif doit avoir un intervalle d’au moins un jour.");
   if(publicationPhase&&design.delivery_mode==="cohort"&&!design.cohort_start_at)errors.push("Indiquez la date de démarrage de la cohorte.");
   if(publicationPhase)for(const [label,value] of [["leçon",c.lesson_passing_score],["module",c.module_passing_score],["examen final",c.final_passing_score]] as any[]){if(Number(value)<1||Number(value)>100)errors.push(`Le seuil global ${label} doit être compris entre 1 et 100 %.`)}
   
   const intro=(m||[]).find((x:any)=>x.is_intro);const conclusion=(m||[]).find((x:any)=>x.is_conclusion);const finalExam=(m||[]).find((x:any)=>x.is_final_exam);
   const assessmentPolicy=c.assessment_policy&&typeof c.assessment_policy==="object"?c.assessment_policy:{};
   if(publicationPhase&&!assessmentPolicy.builder_configured_at){const message="Enregistrez les règles de progression et d’évaluation dans Finalisation.";errors.push(message);explicitIssues.push({severity:"error",message,target:"finalization"});}
   const requireLessonAssessments=publicationPhase&&assessmentPolicy.lesson_assessment_required===true;
   const requireModuleAssessments=publicationPhase&&assessmentPolicy.module_assessment_required===true;
   const requireFinalAssessment=publicationPhase&&(assessmentPolicy.final_assessment_required===true||c.certification_requested===true||c.requested_cpd===true||c.cpd_accredited===true);
   if(publicationPhase&&String(c.certificate_mode||'omnia')==='external'){const {count:externalCertCount}=await sb.from("course_certifications").select("id",{count:"exact",head:true}).eq("course_id",courseId).in("status",["pending","validated"]);if(Number(externalCertCount||0)<1)errors.push("Ajoutez la certification externe ou choisissez un autre mode de certification.");}
   if(intro){ const introLessons=(l||[]).filter((x:any)=>x.module_id===intro.id); const introHasBlocks=introLessons.some((lesson:any)=>(bl||[]).some((block:any)=>block.lesson_id===lesson.id)); if(!introHasBlocks)errors.push("Construisez l’introduction avec au moins un bloc."); }
   if(conclusion){const conclusionLessons=(l||[]).filter((x:any)=>x.module_id===conclusion.id);const conclusionHasBlocks=conclusionLessons.some((lesson:any)=>(bl||[]).some((block:any)=>block.lesson_id===lesson.id));if(!conclusionHasBlocks)errors.push("Construisez la conclusion avec au moins un bloc. La conclusion n’est jamais générée automatiquement.");}
   const normalModules=(m||[]).filter((x:any)=>!x.is_intro&&!x.is_conclusion&&!x.is_final_exam);
   if(!intro)errors.push("Ajoutez l’introduction de la formation.");
   if(!normalModules.length)errors.push("Ajoutez au moins un module après l’introduction.");
   if(!conclusion)errors.push("Ajoutez la conclusion de la formation.");
   const finalAssessmentRequiredByRow=(assessments||[]).some((a:any)=>a.scope==="final"&&a.required===true);
   if((requireFinalAssessment||finalAssessmentRequiredByRow)&&!finalExam)errors.push(publicationPhase?"Ajoutez l’examen final requis par la politique de cette formation.":"Une évaluation finale obligatoire existe mais la section Examen final est absente.");
   for(const mod of normalModules){
    const moduleLessons=(l||[]).filter((x:any)=>String(x.module_id)===String(mod.id)&&String(x.stage_type||"lesson")==="lesson");
    if(!moduleLessons.length)errors.push(`Le module « ${mod.title} » doit contenir au moins une leçon.`);
    const moduleAssessment=(assessments||[]).find((a:any)=>a.scope==="module"&&String(a.module_id)===String(mod.id));
    const moduleItemCount=Number(moduleAssessment?.assessment_questions?.[0]?.count||0);
    const moduleRequiredEffective=requireModuleAssessments||moduleAssessment?.required===true;
    if(moduleRequiredEffective&&!moduleAssessment)errors.push(`Le module « ${mod.title} » doit avoir une évaluation obligatoire.`);
    else if(moduleAssessment&&(moduleRequiredEffective||moduleItemCount>0)) {
      if(Number(moduleAssessment.passing_score)<1||Number(moduleAssessment.passing_score)>100)errors.push(`Le seuil du module « ${mod.title} » doit être compris entre 1 et 100 %.`);
      if(moduleRequiredEffective&&moduleItemCount===0)errors.push(`L’évaluation obligatoire du module « ${mod.title} » ne contient aucune activité évaluée.`);
      if(publicationPhase&&moduleRequiredEffective&&Number(moduleAssessment.remediation_after_attempts||0)<1)errors.push(`Configurez la règle de reprise de l’évaluation du module « ${mod.title} ».`);
    }
    for(const lesson of moduleLessons){
      const lessonBlocks=(bl||[]).filter((x:any)=>String(x.lesson_id)===String(lesson.id));
      if(!lessonBlocks.length)errors.push(`La leçon « ${lesson.title} » ne contient aucun bloc.`);
      const lessonAssessment=(assessments||[]).find((a:any)=>a.scope==="lesson"&&String(a.lesson_id)===String(lesson.id));
      const lessonItemCount=Number(lessonAssessment?.assessment_questions?.[0]?.count||0);
      const lessonRequiredEffective=requireLessonAssessments||lessonAssessment?.required===true;
      if(lessonRequiredEffective&&!lessonAssessment)errors.push(`La leçon « ${lesson.title} » doit avoir une évaluation obligatoire.`);
      else if(lessonAssessment&&(lessonRequiredEffective||lessonItemCount>0)) {
        if(Number(lessonAssessment.passing_score)<1||Number(lessonAssessment.passing_score)>100)errors.push(`Le seuil de la leçon « ${lesson.title} » doit être compris entre 1 et 100 %.`);
        if(lessonRequiredEffective&&lessonItemCount===0)errors.push(`L’évaluation obligatoire de la leçon « ${lesson.title} » ne contient aucune activité évaluée.`);
        if(publicationPhase&&lessonRequiredEffective&&Number(lessonAssessment.remediation_after_attempts||0)<1)errors.push(`Configurez la règle de reprise de l’évaluation de la leçon « ${lesson.title} ».`);
      }
    }
   }
   const finalAssessment=(assessments||[]).find((a:any)=>a.scope==="final");
   const finalItemCount=Number(finalAssessment?.assessment_questions?.[0]?.count||0);
   const finalRequiredEffective=requireFinalAssessment||finalAssessment?.required===true;
   if(finalRequiredEffective&&!finalAssessment)errors.push("L’examen final requis pour cette formation est absent.");
   else if(finalAssessment&&(finalRequiredEffective||finalItemCount>0)) {
    if(Number(finalAssessment.passing_score)<1||Number(finalAssessment.passing_score)>100)errors.push("Le seuil de l’examen final doit être compris entre 1 et 100 %.");
    if(finalRequiredEffective&&finalItemCount===0)errors.push("L’examen final obligatoire ne contient aucune activité évaluée.");
    const finalQuestions=compositionQuestions.filter((q:any)=>String(q.assessment_id)===String(finalAssessment.id));const finalSections=compositionSections.filter((x:any)=>String(x.assessment_id)===String(finalAssessment.id));
    const finalTotal=finalQuestions.reduce((sum:number,q:any)=>sum+Math.max(0,Number(q.points||0)),0);if(finalTotal<=0)errors.push("L’examen final doit avoir un total de points supérieur à 0.");
    if(finalSections.length&&finalQuestions.some((q:any)=>!q.section_id))errors.push("Toutes les questions de l’examen final doivent être rattachées à une partie.");
    for(const section of finalSections){const actual=finalQuestions.filter((q:any)=>String(q.section_id||"")===String(section.id)).reduce((sum:number,q:any)=>sum+Math.max(0,Number(q.points||0)),0);if(section.target_points!=null&&Math.abs(actual-Number(section.target_points))>0.001)errors.push(`La partie « ${section.title} » totalise ${actual} points alors que ${Number(section.target_points)} points sont attendus.`);}
    for(const q of finalQuestions){
     const rubricTotal=rubricPointTotal(q.rubric);
     if(rubricTotal>0&&Math.abs(rubricTotal-Number(q.points||0))>0.001){
      const activityBlock=(bl||[]).find((block:any)=>String(block.id)===String(q.source_lesson_block_id||""));
      const rubricLink=(blockLinks||[]).find((link:any)=>String(link.relation_type)==="rubric_for"&&String(link.target_block_id)===String(q.source_lesson_block_id||""));
      const targetBlock=(bl||[]).find((block:any)=>String(block.id)===String(rubricLink?.source_block_id||""))||activityBlock;
      const activityLabel=String(activityBlock?.title||activityBlock?.content_json?.title||activityBlock?.content_json?.question||"activité").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
      const message=`La grille liée à « ${activityLabel||"activité"} » totalise ${rubricTotal} points pour une activité notée sur ${Number(q.points||0)} points. La grille ne sera pas double-comptée, mais son barème devrait correspondre à l’activité.`;
      warnings.push(message);
      explicitIssues.push({severity:"warning",message,target:targetBlock?"block":"finalization",block_id:targetBlock?.id||null,lesson_id:targetBlock?.lesson_id||activityBlock?.lesson_id||null,module_id:targetBlock?.module_id||activityBlock?.module_id||null});
     }
    }
    if(publicationPhase&&finalRequiredEffective&&Number(finalAssessment.remediation_after_attempts||0)<1)errors.push("Configurez la règle de reprise de l’examen final.");
   }
   const meaningful=(value:any):boolean=>{if(value==null)return false;if(typeof value==="string")return value.replace(/<[^>]+>/g," ").trim().length>0;if(typeof value==="number"||typeof value==="boolean")return true;if(Array.isArray(value))return value.some(meaningful);if(typeof value==="object")return Object.entries(value).some(([key,v])=>!["style","alignment","type","open_new_tab","eco_data","package_type","duration_source","chart_type","mode"].includes(key)&&meaningful(v));return false};
   for(const block of bl||[]){const cjson=block.content_json||{};if(!meaningful(cjson)&&block.block_type!=="separator")warnings.push(`Un bloc ${block.block_type} est vide et sera à compléter ou supprimer.`);if(block.interaction_mode==="training"&&block.training_is_graded!==false&&block.is_required===true&&(Number(block.training_passing_score)<1||Number(block.training_passing_score)>100))errors.push("Un entraînement obligatoire noté possède un seuil invalide.");if(block.interaction_mode==="assessment"){const cfg=assessmentBlockSettings(block);if(!["lesson","module","final"].includes(String(block.assessment_scope||"")))errors.push("Un bloc d’évaluation officielle n’est rattaché à aucun niveau.");if(Number(block.content_json?.points||0)<=0)errors.push("Un bloc d’évaluation officielle doit avoir un nombre de points supérieur à 0.");if(cfg.passing_score<1||cfg.passing_score>100)errors.push("Un bloc d’évaluation officielle possède un seuil invalide.");const responseMode=String(block.content_json?.response_mode||"text");const gradingMode=String(block.content_json?.grading_mode||"human");if(responseMode!=="text"&&["ai","ai_human"].includes(gradingMode))errors.push("Une évaluation avec pièce jointe ne peut pas être corrigée par IA tant que l’extraction de fichier n’est pas activée.");}if(["video","audio","pdf","word","excel","download"].includes(String(block.block_type))&&!String(block.file_url||cjson.url||"").trim())errors.push(`Une ressource ${block.block_type} n’est pas correctement attachée.`);if(block.block_type==="scorm"&&cjson.scorm_ready!==true)errors.push("Un package SCORM n’est pas prêt ou son manifeste n’a pas été validé.");if(block.block_type==="formula"&&!String(cjson.latex||"").trim())warnings.push("Une formule est vide.");if(block.block_type==="chart"&&(!Array.isArray(cjson.labels)||!cjson.labels.length))warnings.push("Un graphique ne contient pas de données.");if(block.block_type==="rubric"&&!linkedSourceIds.has(String(block.id)))errors.push("Une grille d’évaluation n’est associée à aucune activité.");if(block.block_type==="correction"&&!linkedSourceIds.has(String(block.id)))errors.push("Un bloc Correction n’est associé à aucun exercice ou entraînement.");}
   const assessmentBlocks=(bl||[]).filter((block:any)=>block.interaction_mode==="assessment");const assessmentConfigGroups=new Map<string,any[]>();for(const block of assessmentBlocks){const lesson=(l||[]).find((x:any)=>String(x.id)===String(block.lesson_id));const scope=String(block.assessment_scope||"lesson");const target=scope==="lesson"?String(block.lesson_id):scope==="module"?String(lesson?.module_id||""):"course";const key=`${scope}:${target}`;assessmentConfigGroups.set(key,[...(assessmentConfigGroups.get(key)||[]),block]);}for(const [key,items] of assessmentConfigGroups.entries()){const signatures=new Set(items.map((block:any)=>{const cfg=assessmentBlockSettings(block);const scope=String(block.assessment_scope||"lesson");const effectiveRequired=cfg.required||(scope==="lesson"?requireLessonAssessments:scope==="module"?requireModuleAssessments:requireFinalAssessment);return `${effectiveRequired}:${cfg.passing_score}`}));if(signatures.size>1)errors.push(`Des blocs rattachés à la même évaluation (${key}) utilisent des seuils ou règles obligatoires réellement incompatibles. Harmonisez-les dans les paramètres des blocs.`);}
   if(publicationPhase&&c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)errors.push("Indiquez le prix de vente souhaité.");
   if(publicationPhase&&!c.sale_mode)errors.push("Choisissez si la formation est gratuite ou payante.");
   const calculatedDuration=await recalculateCourseDuration(sb,courseId);
   if(calculatedDuration<=0)errors.push("La durée pédagogique officielle n’a pas pu être calculée.");
   const inferIssueTarget=(message:string)=>{
    const lower=message.toLowerCase();
    if(lower.includes("code")||lower.includes("titre de la formation")||lower.includes("description")||lower.includes("image de couverture")||lower.includes("catégorie")||lower.includes("niveau")||lower.includes("langue")||lower.includes("public cible")||lower.includes("objectif pédagogique"))return {target:"information"};
    const lesson=(l||[]).find((x:any)=>message.includes(`« ${x.title} »`));if(lesson)return {target:"lesson",lesson_id:lesson.id,module_id:lesson.module_id};
    const mod=(m||[]).find((x:any)=>message.includes(`« ${x.title} »`));if(mod)return {target:"module",module_id:mod.id};
    if(lower.includes("introduction"))return {target:"introduction",module_id:intro?.id||null};
    if(lower.includes("conclusion"))return {target:"conclusion",module_id:conclusion?.id||null};
    if(publicationPhase&&(lower.includes("évaluation")||lower.includes("seuil")||lower.includes("remédiation")||lower.includes("certification")||lower.includes("prix")||lower.includes("gratuite")||lower.includes("payante")||lower.includes("cohorte")||lower.includes("déblocage progressif")))return {target:"finalization"};
    return {target:"content"};
   };
   const explicitMessages=new Set(explicitIssues.map((x:any)=>x.message));
   const issues=[...errors.map(message=>({severity:"error",message,...inferIssueTarget(message)})),...warnings.filter(message=>!explicitMessages.has(message)).map(message=>({severity:"warning",message,...inferIssueTarget(message)})),...explicitIssues];
   const report={valid:errors.length===0,errors,warnings,issues,phase,checked_at:new Date().toISOString(),calculated_duration_minutes:calculatedDuration};
   if(publicationPhase){
    await sb.from("courses").update({calculated_duration_minutes:calculatedDuration,ready_to_submit:report.valid,updated_at:new Date().toISOString()}).eq("id",courseId);
    await log(sb,courseId,userId,"publication_check",{valid:report.valid,error_count:errors.length,warning_count:warnings.length});
   }else{
    await sb.from("courses").update({calculated_duration_minutes:calculatedDuration,quality_status:report.valid?"ready":"incomplete",quality_report:report,quality_checked_at:report.checked_at,ready_to_submit:false,updated_at:new Date().toISOString()}).eq("id",courseId);
    await log(sb,courseId,userId,"quality_check",{valid:report.valid,error_count:errors.length,warning_count:warnings.length});
   }
   return json({success:true,...report});
  }
  if(action==="submit_course"){
   const {data:c,error}=await sb.from("courses").select("ready_to_submit,quality_report,sale_mode,desired_price_amount,current_version,creator_context,creator_id,pricing_status,admin_selected_price_xof,is_assisted,assisted_status,version_family_id,version_number").eq("id",courseId).single();if(error)throw error;
   if(!c.ready_to_submit)return json({success:false,errors:["Exécutez la vérification de Finalisation avant la publication."],warnings:[]},400);
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)return json({success:false,errors:["Indiquez le prix de vente souhaité dans Commercialisation."],warnings:[]},400);
   if(c.is_assisted&&!["owner_validated","pricing_review","ready_to_publish","completed"].includes(String(c.assisted_status||"")))return json({success:false,errors:["Validez d’abord le brouillon préparé par Omnia, ou demandez les corrections nécessaires."],warnings:[]},409);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const {data:lessons}=await sb.from("course_lessons").select("*").eq("course_id",courseId).order("position");
   const {data:blocks}=await sb.from("lesson_blocks").select("*").eq("course_id",courseId).order("position");
   const {data:assessments}=await sb.from("course_assessments").select("*").eq("course_id",courseId);
   const directOmniaPublish=isAdmin&&String(c.creator_context||"")==="super_admin";
   const accelerated=isAdmin&&!directOmniaPublish&&c.creator_id===userId;
   if(c.sale_mode==="free"){
    await sb.from("courses").update({is_free:true,price_xof:0,pricing_status:"accepted",professor_price_accepted:true,professor_price_accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",courseId);
   }else if((directOmniaPublish||accelerated)&&c.pricing_status!=="accepted"){
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
    if(pricing.configured===false)return json({success:false,error:"PROFESSOR_PRICING_V3_NOT_CONFIGURED",errors:["La tarification automatique Professeur V3 n’est pas encore configurée par le Super-admin. Configurez au moins une tranche de durée avant la soumission."],warnings:[]},409);
    await sb.from("courses").update({score_calcule:null,prix_provisoire_xof:null,pricing_recommended_xof:pricing.price_xof,pricing_range_min_xof:pricing.range_min_xof,pricing_range_max_xof:pricing.range_max_xof,pricing_engine_version:"v3",pricing_snapshot:pricing,pricing_status:"en_attente_validation_prix_admin",professor_price_accepted:false,is_free:false,updated_at:new Date().toISOString()}).eq("id",courseId);
    await log(sb,courseId,userId,"course_pricing_calculated",pricing);
    return json({success:true,pricing_required:true,pricing_status:"en_attente_validation_prix_admin",pricing_recommended_xof:pricing.price_xof,pricing_range_min_xof:pricing.range_min_xof,pricing_range_max_xof:pricing.range_max_xof,message:"La recommandation tarifaire V3 et votre prix souhaité ont été transmis à l’Administration Omnia."});
   }
   const snapshot={course_id:courseId,modules:mods||[],lessons:lessons||[],blocks:blocks||[],assessments:assessments||[],captured_at:new Date().toISOString()};
   const now=new Date().toISOString();
   await sb.from("course_versions").upsert({course_id:courseId,version_label:c.current_version||"1.0",snapshot,status:directOmniaPublish?"published":"submitted",created_by:userId},{onConflict:"course_id,version_label"});

   if(directOmniaPublish){
    if(c.version_family_id){const deactivate=await sb.from("courses").update({is_current_catalog_version:false,is_catalog_active:false,catalog_deactivated_at:now,superseded_at:now,updated_at:now}).eq("version_family_id",c.version_family_id).neq("id",courseId).eq("is_current_catalog_version",true);if(deactivate.error)throw deactivate.error;}
    if((assessments||[]).length){const assessmentApprove=await sb.from("course_assessments").update({quality_review_status:"approved",quality_approved_at:now,quality_approved_by:userId,updated_at:now}).eq("course_id",courseId);if(assessmentApprove.error)throw assessmentApprove.error;}
    const publishPatch:any={status:"publiee",studio_status:"published",is_published:true,is_catalog_active:true,is_current_catalog_version:true,catalog_activated_at:now,catalog_deactivated_at:null,validated_at:now,validated_by:userId,published_at:now,moderated_at:now,moderated_by:userId,quality_review_status:"approved",quality_last_reviewed_at:now,submitted_at:now,updated_at:now};
    const directPublish=await sb.from("courses").update(publishPatch).eq("id",courseId).select("id,studio_status,is_published,is_catalog_active").single();if(directPublish.error)throw directPublish.error;
    await log(sb,courseId,userId,"course_published_by_super_admin",{version:c.current_version||"1.0",technical_quality:true,direct_publish:true});
    return json({success:true,version:c.current_version||"1.0",published:true,direct_publish:true,studio_status:"published"});
   }

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
   if(b.block_id){
    const {data:target,error:targetError}=await sb.from("lesson_blocks").select("course_id,module_id,lesson_id,block_type").eq("id",String(b.block_id)).maybeSingle();
    if(targetError)throw targetError;
    if(!target||String(target.course_id)!==String(courseId)||
       String(target.module_id||"")!==String(b.module_id||"")||String(target.lesson_id||"")!==String(b.lesson_id||""))
      return json({success:false,error:"INVALID_BLOCK_UPLOAD_TARGET"},403);
    if(!studioMediaMetadataValid(String(target.block_type),bucket,b.file_name,b.size_bytes))
      return json({success:false,error:"INVALID_MEDIA_UPLOAD",message:"Type, taille ou destination du fichier non autorisé pour ce bloc."},400);
   }
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
   if(String(b.course_id||"")!==String(blk.course_id)||String(b.module_id||"")!==String(blk.module_id||"")||String(b.lesson_id||"")!==String(blk.lesson_id||""))return json({success:false,error:"UPLOAD_BLOCK_CONTEXT_MISMATCH"},403);
   const expectedBucket=STUDIO_BLOCK_MEDIA_POLICY[String(blk.block_type)]?.bucket||"";
   if(!studioMediaMetadataValid(String(blk.block_type),expectedBucket,b.file_name,b.file_size))return json({success:false,error:"INVALID_MEDIA_METADATA"},400);
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
   const bucket=String(b.bucket_name||""),path=validCourseStoragePath(String(blk.course_id),b.storage_path);
   if(!STUDIO_UPLOAD_BUCKETS.has(bucket)||bucket!==expectedBucket||!path||String(b.provider||"")!=="supabase_storage")return json({success:false,error:"INVALID_STORAGE_TARGET"},400);
   if(studioMediaExt(path)!==studioMediaExt(b.file_name))return json({success:false,error:"STORAGE_FILE_EXTENSION_MISMATCH"},400);
   if(String(blk.block_type)==="scorm"){
    if(bucket!=="course-scorm"||!String(b.file_name||"").toLowerCase().endsWith(".zip"))return json({success:false,error:"SCORM_ZIP_REQUIRED",message:"Importez un package SCORM ZIP valide."},400);
    const scormBlock={...blk,id:b.block_id,module_id:b.module_id||null,lesson_id:b.lesson_id||null};
    const processed=await ingestScormPackage(sb,scormBlock,path);
    await sb.from("lesson_blocks").update({file_name:b.file_name,file_size:b.file_size,file_mime:b.file_mime}).eq("id",b.block_id);
    await log(sb,String(blk.course_id),userId,"scorm_package_ingested",{block_id:b.block_id,package_type:processed?.content_json?.package_type,launch_path:processed?.content_json?.launch_path});
    return json({success:true,provider:"scorm_private_proxy",block:processed,file_url:null,scorm_ready:true,package_type:processed?.content_json?.package_type});
   }
   const isPrivate=PRIVATE_COURSE_BUCKET_SET.has(bucket);const persistedUrl=isPrivate?path:`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${bucket}/${path}`;let persistedContent={...(blk.content_json||{}),url:persistedUrl,provider:"supabase_storage",cloudflare_stream_uid:null};
   if(String(blk.block_type)==="excel"){
    try{const download=await sb.storage.from(bucket).download(path);if(download.error||!download.data)throw download.error||new Error("EXCEL_DOWNLOAD_FAILED");const bytes=new Uint8Array(await download.data.arrayBuffer());const preview=extractXlsxPreview(bytes);persistedContent={...persistedContent,...preview,title:String((blk.content_json||{}).title||"")};}
    catch(excelError){console.warn("excel preview extraction",excelError);persistedContent={...persistedContent,headers:[],preview_rows:[],sheet:""};}
   }
   const {data,error}=await sb.from("lesson_blocks").update({file_url:persistedUrl,content_json:persistedContent,file_name:b.file_name,file_size:b.file_size,file_mime:b.file_mime,storage_path:path,bucket_name:bucket,updated_at:new Date().toISOString()}).eq("id",b.block_id).select("*").single();if(error)throw error;await recalculateCourseDuration(sb,String(blk.course_id));if(blk.storage_path&&String(blk.storage_path)!==path&&PRIVATE_COURSE_BUCKET_SET.has(String(blk.bucket_name||""))){
    await sb.storage.from(String(blk.bucket_name)).remove([String(blk.storage_path)]).then(()=>{}).catch(()=>{});
   }
   const decorated=await decorateStudioBlock(sb,data);return json({success:true,provider:"supabase_storage",block:decorated,file_url:decorated.file_url});
  }
  if(action==="resource_rag_update"){
   const blockId=String(b.block_id||"");const enabled=b.enabled===true;
   const {data:blk,error:blockError}=await sb.from("lesson_blocks").select("id,course_id,block_type,content_json,storage_path,bucket_name,file_name,file_mime").eq("id",blockId).maybeSingle();if(blockError)throw blockError;
   if(!blk||!(await owns(sb,userId,String(blk.course_id),"can_manage_lessons")))return json({success:false,error:"FORBIDDEN"},403);
   if(!["pdf","word","excel","download"].includes(String(blk.block_type)))return json({success:false,error:"RAG_RESOURCE_UNSUPPORTED",message:"Ce type de ressource n’est pas indexable comme document."},400);
   const content={...(blk.content_json||{})};
   if(!enabled){delete content.rag_extracted_text;const {data,error}=await sb.from("lesson_blocks").update({rag_enabled:false,content_json:content,updated_at:new Date().toISOString()}).eq("id",blockId).select("*").single();if(error)throw error;return json({success:true,block:await decorateStudioBlock(sb,data)});}
   const bucket=String(blk.bucket_name||"");const storagePath=String(blk.storage_path||"");if(!bucket||!storagePath||!PRIVATE_COURSE_BUCKET_SET.has(bucket))return json({success:false,error:"PRIVATE_RESOURCE_REQUIRED",message:"Téléversez d’abord le document dans le stockage privé Omnia."},400);
   const extension=importExtension(String(blk.file_name||storagePath));if(!COURSE_IMPORT_ALLOWED.has(extension)||["zip"].includes(extension))return json({success:false,error:"RAG_DOCUMENT_FORMAT_UNSUPPORTED",message:"Ce format ne peut pas être extrait pour l’Assistant pédagogique."},400);
   const download=await sb.storage.from(bucket).download(storagePath);if(download.error||!download.data)throw download.error||new Error("RESOURCE_DOWNLOAD_FAILED");const bytes=new Uint8Array(await download.data.arrayBuffer());if(bytes.byteLength>COURSE_IMPORT_MAX_BYTES)return json({success:false,error:"RESOURCE_TOO_LARGE",message:"Le document dépasse la limite d’analyse sécurisée."},413);
   const extracted=cleanImportedText(await extractCourseImportText(bytes,String(blk.file_name||storagePath))).slice(0,COURSE_IMPORT_MAX_TEXT);if(!extracted)return json({success:false,error:"RESOURCE_TEXT_EMPTY",message:"Aucun texte exploitable n’a été détecté dans ce document."},400);
   content.rag_extracted_text=extracted;content.rag_index_source="private_document_extraction";content.rag_indexed_at=new Date().toISOString();
   const {data,error}=await sb.from("lesson_blocks").update({rag_enabled:true,content_json:content,updated_at:new Date().toISOString()}).eq("id",blockId).select("*").single();if(error)throw error;await log(sb,String(blk.course_id),userId,"resource_rag_enabled",{block_id:blockId,file_name:blk.file_name,characters:extracted.length});return json({success:true,block:await decorateStudioBlock(sb,data),characters:extracted.length});
  }
  if(action==="ai_generate_cover_images"){
   const prompt=String(b.prompt||"").trim();if(!prompt)return json({success:false,error:"PROMPT_REQUIRED"},400);
   const {data:coverCourse}=await sb.from("courses").select("cover_ai_generation_count").eq("id",courseId).maybeSingle();const generationCount=Number(coverCourse?.cover_ai_generation_count||0);if(generationCount>=2)return json({success:false,error:"COVER_AI_GENERATION_LIMIT",message:"La limite de 2 générations pour ce visuel est atteinte."},429);
   const count=2;const images:string[]=[];
   const safePrompt=`Image de couverture professionnelle pour une formation en ligne. ${prompt}. Format horizontal 16:9, composition claire, lisible en miniature, sans texte, sans logo, sans filigrane, sans personne sauf demande explicite. Style éducatif premium adapté à l'Afrique et au monde. Produis ${count} variantes réellement différentes.`;
   const generated=await runOpenAIImage(sb,{context:{module:"image",action:"course_cover",userId,courseId},prompt:safePrompt,size:"1536x1024",quality:"medium",count});
   const generatedImages=Array.isArray(generated.images)&&generated.images.length?generated.images:[generated.b64];
   for(let i=0;i<generatedImages.length;i++){
    const bytes=Uint8Array.from(atob(generatedImages[i]),(c)=>c.charCodeAt(0));const path=`${courseId}/ai-cover-${Date.now()}-${i+1}.png`;const {error:upErr}=await sb.storage.from("course-images").upload(path,bytes,{contentType:"image/png",upsert:true});if(upErr)throw upErr;
    images.push(`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/course-images/${path}`);
   }
   await sb.from("courses").update({cover_image_prompt:prompt,cover_image_candidates:images,cover_ai_generation_count:generationCount+1,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"cover_images_generated",{count:images.length,generation:generationCount+1});return json({success:true,images,generation_count:generationCount+1,generation_limit:2});
  }
  if(String(action).startsWith("ai_")){
   const aliases:Record<string,string>={ai_generate_summary_block:"ai_create_summary",ai_generate_remember:"ai_create_remember"};
   const normalizedAction=aliases[String(action)]||String(action);
   const prompts:Record<string,string>={ai_improve_text:"Améliore ce contenu pédagogique sans inventer de faits.",ai_simplify_text:"Simplifie ce contenu pour un public débutant.",ai_correct_grammar:"Corrige uniquement la langue et la grammaire.",ai_summarize:"Résume clairement ce contenu.",ai_generate_qcm:"Génère un QCM avec 1 bonne réponse, 3 mauvaises réponses et une explication. Réponds en JSON valide.",ai_generate_true_false:"Génère une question vrai/faux avec explication. Réponds en JSON valide.",ai_generate_quiz:"Génère 5 questions variées avec corrigés. Réponds en JSON valide.",ai_create_summary:"Crée un résumé pédagogique structuré.",ai_create_remember:"Crée une liste concise de points à retenir.",ai_suggest_structure:"Propose une structure de modules et leçons.",ai_suggest_objectives:"Propose des objectifs pédagogiques mesurables.",ai_suggest_example:"Propose un exemple concret et réaliste."};
   if(!prompts[normalizedAction])return json({success:false,error:"UNKNOWN_AI_ACTION",action},400);
   const input=String(b.text||b.content||b.topic||"").trim();if(!input)return json({success:false,error:"TEXT_REQUIRED"},400);
   let aiCourse:any=null;let courseLanguage=String(b.language||b.instruction_language||"").trim();
   if(b.course_id){const result=await sb.from("courses").select("language,instruction_language,target_language,course_type,cefr_start_level,cefr_target_level").eq("id",String(b.course_id)).maybeSingle();aiCourse=result.data;if(!courseLanguage)courseLanguage=String(aiCourse?.instruction_language||aiCourse?.language||"").trim();}
   const languageRule=courseLanguage?`Langue d'enseignement : ${courseLanguage}. ${aiCourse?.course_type==="language_learning"&&aiCourse?.target_language?`Langue cible : ${aiCourse.target_language}. Niveau : ${aiCourse.cefr_start_level||"?"} → ${aiCourse.cefr_target_level||"?"}.`:""} Réponds dans la langue d'enseignement sauf si l'exercice exige explicitement la langue cible.`:"Conserve strictement la langue du texte source. Ne traduis pas le contenu sauf demande explicite du créateur.";
   const ai=await runAiText(sb,{context:{module:"studio",action:normalizedAction,userId,courseId:String(b.course_id||courseId||"")||null,lessonId:String(b.lesson_id||"")||null,blockId:String(b.block_id||"")||null},tier:"fast",prompt:`${languageRule}\n${prompts[normalizedAction]}\n\nTitre de la leçon : ${String(b.lesson_title||"")}\n\n${input}`,maxTokens:["ai_generate_quiz","ai_suggest_structure"].includes(normalizedAction)?3600:2400,effort:"low",output:["ai_generate_qcm","ai_generate_true_false","ai_generate_quiz"].includes(normalizedAction)?"structured":"rich_text"});
   const structured=["ai_generate_qcm","ai_generate_true_false","ai_generate_quiz"].includes(normalizedAction);
   let resultText=ai.text;
   if(structured){try{resultText=JSON.stringify(parseAiObject(ai.text))}catch{return json({success:false,error:"AI_INVALID_STRUCTURED_RESPONSE",message:"La génération n’a pas produit des données exploitables. Aucun contenu n’a été modifié."},502)}}
   else if(!["ai_create_summary","ai_create_remember","ai_suggest_structure"].includes(normalizedAction))resultText=normalizeAiPlainText(ai.text);
   return json({success:true,result:resultText,provider:ai.provider,model:ai.model,action:normalizedAction});
  }
  return json({success:false,error:"UNKNOWN_ACTION",action},400);
 }catch(e){console.error("studio-unified",e);const ai=aiErrorPayload(e);if(ai.error!=="AI_RUNTIME_ERROR")return json({success:false,error:ai.error,provider:ai.provider,message:ai.message},ai.status);return json({success:false,error:"SERVER_ERROR",message:(e as Error).message},500)}
});
