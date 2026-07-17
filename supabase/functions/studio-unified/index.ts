import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

async function sessionUser(sb:any, req:Request){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token) return null;
 const {data}=await sb.from("user_sessions").select("user_id").eq("session_token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(data?.user_id) return data.user_id;
 // Compatibilité avec les jetons Supabase Auth utilisés par certaines pages.
 const {data:authData}=await sb.auth.getUser(token);
 return authData?.user?.id||null;
}
async function roles(sb:any,userId:string){const {data}=await sb.from("user_roles").select("role").eq("user_id",userId);return (data||[]).map((r:any)=>r.role)}
async function owns(sb:any,userId:string,courseId:string){const {data}=await sb.from("courses").select("creator_id").eq("id",courseId).maybeSingle();if(!data)return false;const rs=await roles(sb,userId);return data.creator_id===userId||rs.includes("super_admin")}
async function log(sb:any,courseId:string,userId:string,action:string,details:any={}){await Promise.allSettled([sb.from("course_studio_logs").insert({course_id:courseId,user_id:userId,action,details}),sb.from("course_audit_log").insert({course_id:courseId,actor_id:userId,action,entity_type:"course",metadata:details})])}

async function triggerCertificate(userId:string,courseId:string,source:string){
 try{
  const url=`${Deno.env.get("SUPABASE_URL")}/functions/v1/certificate-generate`;
  await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,course_id:courseId,source})});
 }catch(_e){}
}
const defaults:Record<string,any>={
 heading:{text:"Nouveau titre",level:1,alignment:"left"},subheading:{text:"Sous-titre",level:2,alignment:"left"},text:{html:"<p>Saisissez votre texte ici...</p>"},separator:{style:"line"},callout:{type:"info",content:"Information importante..."},remember:{title:"À retenir",points:[""]},objective:{title:"Objectif pédagogique",html:"<p>À la fin de cette leçon, vous serez capable de...</p>"},example:{title:"Exemple",html:"<p>Décrivez ici un exemple concret...</p>"},summary:{title:"Résumé",html:"<p>Dans cette leçon, vous avez appris...</p>"},image:{url:"",alt:"",caption:""},video:{url:"",eco_data:true},audio:{url:"",description:"",transcription:""},pdf:{url:"",title:"",description:"",downloadable:true},word:{url:"",title:"",description:""},excel:{url:"",title:"",sheet:"",preview_rows:[]},scorm:{url:"",title:"",package_type:"scorm_12",duration_min:0},download:{url:"",title:"",description:""},qcm:{question:"",options:["","","",""],correctIndex:0,explanation:""},true_false:{statement:"",answer:true,explanation:""},open_question:{question:"",guidance:"",expected_answer:"",points:10,required:true},exercise:{title:"Exercice",instructions:"",task:"",resources:[],accepted_types:["pdf","doc","docx","xls","xlsx"],learner_upload_required:true,points:20},accordion:{items:[{id:crypto.randomUUID(),title:"Section 1",content:""}]},flashcards:{cards:[{id:crypto.randomUUID(),front:"Recto",back:"Verso"}]},interactive_table:{headers:["Colonne 1","Colonne 2"],rows:[["",""]],style:"table"},timeline:{steps:[{id:crypto.randomUUID(),title:"Étape 1",description:""}]},columns:{columns:[{id:crypto.randomUUID(),content:""},{id:crypto.randomUUID(),content:""}]},important:{title:"Important",html:"<p>Saisissez l’information importante...</p>"},case_study:{context:"",data:"",task:"",questions:[]},definition:{term:"",definition:"",example:""},correction:{title:"Correction",html:"<p>Saisissez ici la correction détaillée...</p>",key_points:[]},bullet_list:{items:[""]},numbered_list:{items:[""]},quote:{text:"Citation ou témoignage",author:""},code:{language:"text",code:""},checklist:{items:[{id:crypto.randomUUID(),text:"Action à réaliser",checked:false}]},link_button:{label:"Ouvrir le lien",url:"",open_new_tab:true},embed:{url:"",title:"Contenu intégré"},gallery:{images:[]},formula:{latex:""},chart:{chart_type:"bar",labels:["A","B"],values:[0,0]},assignment_upload:{title:"Travail à remettre",instructions:"",accepted_types:["pdf","docx"],max_size_mb:10},rubric:{criteria:[{name:"Critère 1",description:"",points:10}]}
};

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
   const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
   const viewerId=token?await sessionUser(sb,req):null; const viewerRoles=viewerId?await roles(sb,viewerId):[];
   const privileged=!!viewerId&&(viewerId===course.creator_id||viewerRoles.includes("super_admin"));
   if(!course.is_published&&!privileged)return json({success:false,error:"NOT_FOUND"},404);
   const {data:modules,error:moduleError}=await sb.from("course_modules").select("id,title,objective,position,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");if(moduleError)throw moduleError;
   const moduleIds=(modules||[]).map((m:any)=>m.id);
   const {data:lessons,error:lessonError}=moduleIds.length?await sb.from("course_lessons").select("id,module_id,title,position,is_intro,is_module_intro,is_conclusion,is_final_exam").in("module_id",moduleIds).order("position"):{data:[],error:null};if(lessonError)throw lessonError;
   const introLesson=(lessons||[]).find((l:any)=>l.is_intro);
   let blocks:any[]=[];
   if(course.free_preview_mode!=="none"&&introLesson){const {data,error}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,settings_json,file_url,file_name,file_size,file_mime").eq("lesson_id",introLesson.id).order("position");if(error)throw error;blocks=data||[]}
   const program=(modules||[]).filter((m:any)=>!m.is_intro).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id&&!l.is_module_intro).map((l:any)=>({id:l.id,title:l.title,position:l.position,locked:true}))}));
   return json({success:true,course,preview_enabled:course.free_preview_mode!=="none",introduction:introLesson?{...introLesson,blocks}:null,program,privileged});
  }

  const userId=await sessionUser(sb,req); if(!userId)return json({success:false,error:"AUTH_REQUIRED"},401);
  const userRoles=await roles(sb,userId); const isAdmin=userRoles.includes("super_admin");
  if(action==="get_my_courses"){
   let q=sb.from("courses").select("id,title,studio_status,category,level,cover_image_url,creator_id,created_at,updated_at,word_count,estimated_read_min,last_autosave_at,admin_comment,template_used,submitted_at").order("updated_at",{ascending:false});
   if(!isAdmin) q=q.eq("creator_id",userId);
   const {data,error}=await q;if(error)throw error;return json({success:true,courses:data||[]});
  }
  if(action==="get_pending_courses"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("courses").select("id,title,studio_status,category,level,cover_image_url,creator_id,submitted_at,updated_at,admin_comment,word_count").eq("studio_status","pending_validation").order("submitted_at",{ascending:true});if(error)throw error;return json({success:true,courses:data||[]});
  }
  if(action==="create_course"){
   if(b.client_draft_key){
    const {data:existing}=await sb.from("courses").select("*").eq("creator_id",userId).eq("client_draft_key",b.client_draft_key).maybeSingle();
    if(existing){
      const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",existing.id).order("position");
      const ids=(mods||[]).map((m:any)=>m.id); const {data:lessons}=ids.length?await sb.from("course_lessons").select("*").in("module_id",ids).order("position"):{data:[]};
      return json({success:true,course:existing,modules:(mods||[]).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id)})),reused:true});
    }
   }
   const insert:any={
    title:b.title||"Nouvelle formation",creator_id:userId,client_draft_key:b.client_draft_key||null,template_used:b.template_used||"simple_textual",
    studio_mode:b.studio_mode||"simple",studio_status:"draft",short_description:b.short_description||"",
    long_description:b.long_description||"",category:b.category||null,level:b.level||null,language:b.language||"fr",
    prerequisites:b.prerequisites||"",objectives:b.objectives||[],target_audience:b.target_audience||"",
    learning_outcomes:b.learning_outcomes||[],cover_image_url:b.cover_image_url||null,
    cover_image_prompt:b.cover_image_prompt||"",course_intro_title:b.course_intro_title||"Bienvenue dans cette formation",
    course_intro_summary:b.course_intro_summary||"",free_preview_mode:"introduction",
    quality_status:"incomplete",ready_to_submit:false,current_version:"1.0"
   };
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
  if(courseId && !["learner_get_assessment","learner_submit_assessment"].includes(action) && !(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
  if(action==="ensure_special_sections"){
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
    await sb.from("lesson_blocks").insert({course_id:courseId,module_id:m.id,lesson_id:l.id,block_type:"heading",position:0,content_json:{text:"Examen final",html:"Examen final",level:1},settings_json:{assessment_scope:"final",passing_score:70},created_by:userId}); result.push(m);
   }
   await log(sb,courseId,userId,"special_sections_ensured"); return json({success:true,created:result});
  }
  if(action==="delete_course"){
   const {data:c}=await sb.from("courses").select("studio_status").eq("id",courseId).maybeSingle(); if(!c)return json({success:false,error:"NOT_FOUND"},404); if(c.studio_status!=="draft"&&!isAdmin)return json({success:false,error:"ONLY_DRAFT_CAN_BE_DELETED"},409);
   const {error}=await sb.from("courses").delete().eq("id",courseId); if(error)throw error; return json({success:true});
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
  if(action==="get_blocks"){const {data,error}=await sb.from("lesson_blocks").select("*").eq("lesson_id",b.lesson_id).order("position");if(error)throw error;return json({success:true,blocks:data||[]})}
  if(action==="create_block"){
   const {count}=await sb.from("lesson_blocks").select("id",{count:"exact",head:true}).eq("lesson_id",b.lesson_id);const pos=Number.isInteger(b.position)?b.position:(count||0);
   const {data,error}=await sb.from("lesson_blocks").insert({course_id:courseId,module_id:b.module_id,lesson_id:b.lesson_id,block_type:b.block_type,position:pos,content_json:b.content_json||defaults[b.block_type]||{},settings_json:b.settings_json||{},created_by:userId,ai_generated:!!b.ai_generated,source_type:b.ai_generated?"ai":"manual"}).select("*").single();if(error)throw error;await log(sb,courseId,userId,"block_created",{block_id:data.id,type:data.block_type});return json({success:true,block:data});
  }
  if(action==="update_block"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id)))return json({success:false,error:"FORBIDDEN"},403);
   const allowed:any={updated_at:new Date().toISOString()};for(const k of ["title","content_json","settings_json","file_url","file_name","file_size","file_mime","source_type","ai_generated"])if(b[k]!==undefined)allowed[k]=b[k];const {data,error}=await sb.from("lesson_blocks").update(allowed).eq("id",b.block_id).select("*").single();if(error)throw error;return json({success:true,block:data});
  }
  if(action==="delete_block"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id)))return json({success:false,error:"FORBIDDEN"},403);await sb.from("lesson_blocks").delete().eq("id",b.block_id);await log(sb,blk.course_id,userId,"block_deleted",{block_id:b.block_id});return json({success:true});
  }
  if(action==="reorder_blocks"){
   const ids=b.ordered_ids||[];for(let i=0;i<ids.length;i++)await sb.from("lesson_blocks").update({position:i,updated_at:new Date().toISOString()}).eq("id",ids[i]).eq("lesson_id",b.lesson_id);return json({success:true});
  }
  if(action==="update_course"||action==="autosave"){
   const updates:any={updated_at:new Date().toISOString()};for(const k of ["title","short_description","long_description","category","level","language","prerequisites","objectives","target_audience","learning_outcomes","cover_image_url","cover_image_prompt","course_intro_title","course_intro_summary","studio_mode","template_used","word_count","sale_mode","desired_price_amount","sale_currency","promotion_price_amount","structure_payment_mode","structure_fixed_amount","certification_requested","is_assisted","assisted_status","assisted_request_id"])if(b[k]!==undefined)updates[k]=b[k]; updates.free_preview_mode="introduction";if(b.word_count!==undefined)updates.estimated_read_min=Math.max(1,Math.ceil(Number(b.word_count)/200));if(action==="autosave")updates.last_autosave_at=new Date().toISOString();
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
   const {data:course}=await sb.from("courses").select("id,title,creator_id,lesson_passing_score,module_passing_score,final_passing_score").eq("id",courseId).single();
   const {data:mods}=await sb.from("course_modules").select("id,title,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
   const {data:lessons}=await sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
   const {data:blocks}=await sb.from("lesson_blocks").select("id,lesson_id,block_type,position,content_json,file_url,file_name").eq("course_id",courseId).order("position");
   const evalTypes=["qcm","true_false","open_question","exercise","assignment_upload"];
   const ensureOne=async(scope:string,title:string,moduleId?:string,lessonId?:string,passing=80)=>{
    let q=sb.from("course_assessments").select("*").eq("course_id",courseId).eq("scope",scope);
    if(lessonId)q=q.eq("lesson_id",lessonId); else if(moduleId)q=q.eq("module_id",moduleId); else q=q.is("module_id",null).is("lesson_id",null);
    let {data:a}=await q.maybeSingle();
    if(!a){const ins:any={course_id:courseId,module_id:moduleId||null,lesson_id:lessonId||null,scope,title,passing_score:passing,max_attempts:3,required:true,correction_mode:"mixed",created_by:userId,estimated_minutes:scope==="final"?45:scope==="module"?20:10};const r=await sb.from("course_assessments").insert(ins).select("*").single();a=r.data;}
    const {count}=await sb.from("assessment_questions").select("id",{count:"exact",head:true}).eq("assessment_id",a.id);
    if(!count){
      const sourceLessonIds=lessonId?[lessonId]:moduleId?(lessons||[]).filter((l:any)=>l.module_id===moduleId&&!l.is_module_intro).map((l:any)=>l.id):(lessons||[]).filter((l:any)=>l.is_final_exam).map((l:any)=>l.id);
      const src=(blocks||[]).filter((x:any)=>sourceLessonIds.includes(x.lesson_id)&&evalTypes.includes(x.block_type));
      for(const [i,bk] of src.entries()){
       const c=bk.content_json||{}; let qt=bk.block_type==="assignment_upload"?"exercise":bk.block_type; const payload:any={assessment_id:a.id,question_type:qt,position:i,prompt:c.question||c.statement||c.title||c.instructions||"Question à compléter",points:Number(c.points||10),grading_mode:["qcm","true_false"].includes(qt)?"automatic":(c.grading_mode||"human"),options:c.options||[],correct_answer:qt==="qcm"?c.correctIndex:qt==="true_false"?c.answer:c.expected_answer||null,explanation:c.explanation||"",resource_files:c.resources||((bk.file_url)?[{name:bk.file_name||"Ressource",url:bk.file_url}]:[]),accepted_submission_types:c.accepted_types||["pdf","doc","docx","xls","xlsx","zip","png","jpg"],rubric:c.rubric||[]};
       await sb.from("assessment_questions").insert(payload);
      }
    }
    return a;
   };
   for(const l of lessons||[]){if(!l.is_intro&&!l.is_module_intro&&!l.is_conclusion&&!l.is_final_exam)await ensureOne("lesson",`Évaluation — ${l.title}`,l.module_id,l.id,course.lesson_passing_score||80)}
   for(const m of mods||[]){if(!m.is_intro&&!m.is_conclusion&&!m.is_final_exam)await ensureOne("module",`Évaluation du module — ${m.title}`,m.id,undefined,course.module_passing_score||80)}
   await ensureOne("final",`Examen final — ${course.title}`,undefined,undefined,course.final_passing_score||70);
   const {data:all}=await sb.from("course_assessments").select("*,assessment_questions(count)").eq("course_id",courseId).order("scope");
   return json({success:true,assessments:all||[]});
  }
  if(action==="learner_get_assessment"){
   let q=sb.from("course_assessments").select("*").eq("course_id",courseId).eq("scope",b.scope||"lesson").eq("is_active",true);
   if(b.lesson_id)q=q.eq("lesson_id",b.lesson_id);else if(b.module_id)q=q.eq("module_id",b.module_id);else q=q.is("lesson_id",null).is("module_id",null);
   const {data:a}=await q.maybeSingle();if(!a)return json({success:true,assessment:null});
   const {data:qs}=await sb.from("assessment_questions").select("id,question_type,position,prompt,options,explanation,points,resource_files,accepted_submission_types").eq("assessment_id",a.id).order("position");
   const {data:last}=await sb.from("assessment_attempts").select("score,passed,status,attempt_number").eq("assessment_id",a.id).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   return json({success:true,assessment:{...a,questions:qs||[],latest_attempt:last||null}});
  }
  if(action==="learner_submit_assessment"){
   const assessmentId=b.assessment_id;const {data:a}=await sb.from("course_assessments").select("*").eq("id",assessmentId).single();
   const {data:qs}=await sb.from("assessment_questions").select("*").eq("assessment_id",assessmentId).order("position");
   const {count}=await sb.from("assessment_attempts").select("id",{count:"exact",head:true}).eq("assessment_id",assessmentId).eq("user_id",userId);const attemptNo=(count||0)+1;
   if(attemptNo>Number(a.max_attempts||3))return json({success:false,error:"MAX_ATTEMPTS_REACHED"},400);
   const answers=Array.isArray(b.answers)?b.answers:[];let earned=0,total=0,pending=false;
   const {data:attempt,error:attErr}=await sb.from("assessment_attempts").insert({assessment_id:assessmentId,course_id:a.course_id,user_id:userId,attempt_number:attemptNo,status:"submitted",submitted_at:new Date().toISOString()}).select("*").single();if(attErr)throw attErr;
   for(const qn of qs||[]){total+=Number(qn.points||0);const ans=answers.find((x:any)=>x.question_id===qn.id)?.answer;let autoScore:null|number=null;let review="not_required";
    if(qn.question_type==="qcm")autoScore=Number(ans)===Number(qn.correct_answer)?Number(qn.points):0;
    else if(qn.question_type==="true_false")autoScore=Boolean(ans)===Boolean(qn.correct_answer)?Number(qn.points):0;
    else {pending=true;review="pending";}
    if(autoScore!==null)earned+=autoScore;
    await sb.from("assessment_answers").insert({attempt_id:attempt.id,question_id:qn.id,answer_json:ans===undefined?null:ans,submission_files:ans?.files||[],auto_score:autoScore,final_score:autoScore,review_status:review});
   }
   const score=total?Math.round((earned/total)*10000)/100:0;const passed=!pending&&score>=Number(a.passing_score);
   await sb.from("assessment_attempts").update({score,passed,status:pending?"pending_review":passed?"passed":"failed"}).eq("id",attempt.id);
   if(passed&&a.scope==="final")triggerCertificate(userId,a.course_id,"final_exam_passed");
   return json({success:true,attempt_id:attempt.id,score,passed,pending_review:pending,passing_score:a.passing_score});
  }
  if(action==="grader_list_attempts"){
   const {data,error}=await sb.from("assessment_attempts").select("*,course_assessments(title,scope,lesson_id,module_id),users(full_name,email)").eq("course_id",courseId).in("status",["pending_review","submitted"]).order("submitted_at",{ascending:true});if(error)throw error;return json({success:true,attempts:data||[]});
  }
  if(action==="grader_grade_attempt"){
   const {data:att}=await sb.from("assessment_attempts").select("*,course_assessments(passing_score)").eq("id",b.attempt_id).single();
   for(const item of b.grades||[]){const {data:old}=await sb.from("assessment_answers").select("final_score").eq("id",item.answer_id).single();await sb.from("assessment_answers").update({final_score:item.score,grader_feedback:item.feedback||"",review_status:"reviewed",updated_at:new Date().toISOString()}).eq("id",item.answer_id);await sb.from("assessment_grading_history").insert({attempt_id:b.attempt_id,answer_id:item.answer_id,grader_id:userId,previous_score:old?.final_score,new_score:item.score,comment:item.feedback||""});}
   const {data:answers}=await sb.from("assessment_answers").select("final_score,assessment_questions(points)").eq("attempt_id",b.attempt_id);let got=0,max=0;for(const x of answers||[]){got+=Number(x.final_score||0);max+=Number((x as any).assessment_questions?.points||0)}const score=max?Math.round(got/max*10000)/100:0;const passed=score>=Number((att as any).course_assessments?.passing_score||80);await sb.from("assessment_attempts").update({score,passed,status:passed?"passed":"failed",graded_at:new Date().toISOString(),graded_by:userId,feedback:b.feedback||""}).eq("id",b.attempt_id);if(passed){const {data:scopeRow}=await sb.from("course_assessments").select("scope,course_id").eq("id",att.assessment_id).maybeSingle();if(scopeRow?.scope==="final")triggerCertificate(att.user_id,scopeRow.course_id,"final_manual_review_passed");}return json({success:true,score,passed});
  }
  if(action==="assessment_analytics"){
   const {data:ass}=await sb.from("course_assessments").select("id,title,scope").eq("course_id",courseId);const ids=(ass||[]).map((x:any)=>x.id);if(!ids.length)return json({success:true,summary:{attempts:0,pass_rate:0,average_score:0},items:[]});const {data:at}=await sb.from("assessment_attempts").select("assessment_id,score,passed,status,time_spent_seconds").in("assessment_id",ids).not("score","is",null);const total=(at||[]).length,passes=(at||[]).filter((x:any)=>x.passed).length,avg=total?(at||[]).reduce((n:number,x:any)=>n+Number(x.score||0),0)/total:0;return json({success:true,summary:{attempts:total,pass_rate:total?Math.round(passes/total*100):0,average_score:Math.round(avg*100)/100},items:ass||[]});
  }


  if(action==="get_commercialization"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:course}=await sb.from("courses").select("sale_mode,desired_price_amount,sale_currency,promotion_price_amount,structure_payment_mode,structure_fixed_amount,is_assisted,assisted_status,assisted_request_id,certification_requested").eq("id",courseId).single();
   const {data:settings}=await sb.from("site_settings").select("key,value").in("key",["commission_normal_sans_cpd","commission_normal_avec_cpd","commission_assistee_sans_cpd","commission_assistee_avec_cpd"]);
   const revenueRules:any={};for(const row of settings||[]){try{revenueRules[row.key]=typeof row.value==="string"?JSON.parse(row.value):row.value}catch{revenueRules[row.key]=row.value}}
   const {data:certifications}=await sb.from("course_certifications").select("*").eq("course_id",courseId).order("created_at");
   return json({success:true,course,revenue_rules:revenueRules,certifications:certifications||[]});
  }
  if(action==="save_commercialization"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const mode=b.sale_mode||"paid";const amount=mode==="free"?0:Number(b.desired_price_amount||0);
   if(mode==="paid"&&amount<=0)return json({success:false,error:"PRICE_REQUIRED",message:"Indiquez un prix supérieur à zéro."},400);
   const updates:any={sale_mode:mode,desired_price_amount:amount,sale_currency:b.sale_currency||"XOF",promotion_price_amount:b.promotion_price_amount||null,structure_payment_mode:b.structure_payment_mode||"free",structure_fixed_amount:b.structure_fixed_amount||null,updated_at:new Date().toISOString()};
   const {data,error}=await sb.from("courses").update(updates).eq("id",courseId).select("sale_mode,desired_price_amount,sale_currency,promotion_price_amount,structure_payment_mode,structure_fixed_amount").single();if(error)throw error;await log(sb,courseId,userId,"commercialization_saved",updates);return json({success:true,course:data});
  }
  if(action==="request_assisted_entry"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
   const rs=await roles(sb,userId);const requesterRole=rs.includes("responsable_structure")||rs.includes("structure_admin")?"structure":"professeur";
   const {data:existing}=await sb.from("assisted_course_requests").select("id,status").eq("course_id",courseId).in("status",["pending","in_progress"]).maybeSingle();if(existing)return json({success:false,error:"ACTIVE_REQUEST_EXISTS",message:"Une demande est déjà en cours."},409);
   const {data:reqRow,error}=await sb.from("assisted_course_requests").insert({course_id:courseId,requester_id:userId,requester_role:requesterRole,service_type:b.service_type||"without_certification",instructions:String(b.instructions||""),documents:Array.isArray(b.documents)?b.documents:[],status:"pending"}).select("*").single();if(error)throw error;
   await sb.from("courses").update({is_assisted:true,assisted_request_id:reqRow.id,assisted_status:"pending",updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"assisted_entry_requested",{request_id:reqRow.id,service_type:reqRow.service_type});return json({success:true,request:reqRow});
  }
  if(action==="list_assisted_requests"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("assisted_course_requests").select("*,courses(title,creator_id),users!assisted_course_requests_requester_id_fkey(full_name,email)").order("requested_at",{ascending:false});if(error)throw error;return json({success:true,items:data||[]});
  }
  if(action==="admin_update_assisted_request"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);
   const status=String(b.status||"");if(!["pending","in_progress","completed","rejected","cancelled"].includes(status))return json({success:false,error:"INVALID_STATUS"},400);
   const patch:any={status,updated_at:new Date().toISOString(),admin_comment:b.admin_comment||null};if(status==="in_progress"){patch.assigned_to=userId;patch.started_at=new Date().toISOString()}if(status==="completed")patch.completed_at=new Date().toISOString();
   const {data,error}=await sb.from("assisted_course_requests").update(patch).eq("id",b.id).select("*").single();if(error)throw error;await sb.from("courses").update({assisted_status:status}).eq("id",data.course_id);return json({success:true,item:data});
  }
  if(action==="save_course_certification_request"){
   if(!courseId||!(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);const c=b.certification||{};
   if(!String(c.organization_name||"").trim()||!String(c.certification_name||"").trim())return json({success:false,error:"MISSING_CERTIFICATION_FIELDS"},400);
   const row:any={course_id:courseId,certification_type:c.type||"other",organization_name:c.organization_name,certification_name:c.certification_name,certification_code:c.code||null,credit_value:c.credit_value?Number(c.credit_value):null,credit_unit:c.credit_unit||null,badge_url:c.badge_url||null,logo_url:c.logo_url||null,signature_url:c.signature_url||null,stamp_url:c.stamp_url||null,verification_url:c.verification_url||null,evidence_url:c.evidence_url||null,valid_from:c.valid_from||null,expires_at:c.expires_at||null,status:"pending",requested_by:userId};
   const {data,error}=await sb.from("course_certifications").insert(row).select("*").single();if(error)throw error;await sb.from("courses").update({certification_requested:true,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"certification_requested",{certification_id:data.id,type:data.certification_type});return json({success:true,certification:data});
  }
  if(action==="admin_list_course_certifications"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);
   const {data,error}=await sb.from("course_certifications").select("*,courses(title,creator_id)").order("created_at",{ascending:false});if(error)throw error;return json({success:true,items:data||[]});
  }
  if(action==="admin_update_course_certification"){
   const rs=await roles(sb,userId);if(!rs.includes("super_admin"))return json({success:false,error:"FORBIDDEN"},403);const status=String(b.status||"");if(!["pending","validated","rejected","expired","revoked"].includes(status))return json({success:false,error:"INVALID_STATUS"},400);
   const patch:any={status,admin_comment:b.admin_comment||null,updated_at:new Date().toISOString()};if(status==="validated"){patch.validated_by=userId;patch.validated_at=new Date().toISOString()}
   const {data,error}=await sb.from("course_certifications").update(patch).eq("id",b.id).select("*").single();if(error)throw error;return json({success:true,item:data});
  }
  if(action==="validate_checklist"){
   const errors:string[]=[],warnings:string[]=[];
   const {data:c,error:courseError}=await sb.from("courses").select("*").eq("id",courseId).single();if(courseError)throw courseError;
   const {data:m}=await sb.from("course_modules").select("id,title,objective,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
   const {data:l}=await sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
   const {data:bl}=await sb.from("lesson_blocks").select("lesson_id,block_type,content_json").eq("course_id",courseId);
   const {data:assessments}=await sb.from("course_assessments").select("id,scope_type,lesson_id,module_id,is_required,passing_score").eq("course_id",courseId);
   if(!c.title?.trim())errors.push("Le titre de la formation est obligatoire.");
   if(!c.short_description?.trim())errors.push("Ajoutez la description courte visible avant achat.");
   if(!c.long_description?.trim())errors.push("Ajoutez la présentation détaillée de la formation.");
   if(!c.cover_image_url?.trim())errors.push("Ajoutez une image de couverture.");
   if(!c.category)errors.push("Sélectionnez une catégorie.");
   if(!c.level)errors.push("Sélectionnez un niveau.");
   if(!c.target_audience?.trim())warnings.push("Précisez le public cible.");
   if(!(c.objectives||[]).filter((x:any)=>String(x||"").trim()).length)errors.push("Ajoutez au moins un objectif pédagogique.");
   
   const intro=(m||[]).find((x:any)=>x.is_intro);const conclusion=(m||[]).find((x:any)=>x.is_conclusion);const finalExam=(m||[]).find((x:any)=>x.is_final_exam);
   if(intro){ const introLessons=(l||[]).filter((x:any)=>x.module_id===intro.id); const introHasBlocks=introLessons.some((lesson:any)=>(bl||[]).some((block:any)=>block.lesson_id===lesson.id)); if(!introHasBlocks)errors.push("Construisez l’introduction avec au moins un bloc."); }
   const normalModules=(m||[]).filter((x:any)=>!x.is_intro&&!x.is_conclusion&&!x.is_final_exam);
   if(!intro)errors.push("Ajoutez l’introduction de la formation.");
   if(!normalModules.length)errors.push("Ajoutez au moins un module après l’introduction.");
   if(!conclusion)errors.push("Ajoutez la conclusion de la formation.");
   if(!finalExam)errors.push("Ajoutez l’examen final.");
   for(const mod of normalModules){
    const moduleLessons=(l||[]).filter((x:any)=>x.module_id===mod.id&&!x.is_module_intro);
    if(!moduleLessons.length)errors.push(`Le module « ${mod.title} » doit contenir au moins une leçon.`);
    const moduleAssessment=(assessments||[]).find((a:any)=>a.scope_type==="module"&&a.module_id===mod.id&&a.is_required!==false);
    if(!moduleAssessment)errors.push(`Le module « ${mod.title} » doit avoir une évaluation obligatoire.`);
    else if(Number(moduleAssessment.passing_score)!==80)warnings.push(`Le seuil du module « ${mod.title} » doit être de 80 %.`);
    for(const lesson of moduleLessons){
      const lessonBlocks=(bl||[]).filter((x:any)=>x.lesson_id===lesson.id);
      if(!lessonBlocks.length)errors.push(`La leçon « ${lesson.title} » ne contient aucun bloc.`);
      const lessonAssessment=(assessments||[]).find((a:any)=>a.scope_type==="lesson"&&a.lesson_id===lesson.id&&a.is_required!==false);
      if(!lessonAssessment)errors.push(`La leçon « ${lesson.title} » doit avoir une évaluation obligatoire.`);
      else if(Number(lessonAssessment.passing_score)!==80)warnings.push(`Le seuil de la leçon « ${lesson.title} » doit être de 80 %.`);
    }
   }
   const finalAssessment=(assessments||[]).find((a:any)=>a.scope_type==="final"&&a.is_required!==false);
   if(!finalAssessment)errors.push("L’examen final obligatoire est absent.");
   else if(Number(finalAssessment.passing_score)!==70)warnings.push("Le seuil de l’examen final doit être de 70 %.");
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)errors.push("Indiquez le prix de vente souhaité.");
   if(!c.sale_mode)errors.push("Choisissez si la formation est gratuite ou payante.");
   if(Number(c.calculated_duration_minutes||c.estimated_read_min||0)<=0)warnings.push("La durée pédagogique n’a pas encore été calculée.");
   const report={valid:errors.length===0,errors,warnings,checked_at:new Date().toISOString()};
   await sb.from("courses").update({quality_status:report.valid?"ready":"incomplete",quality_report:report,quality_checked_at:report.checked_at,ready_to_submit:report.valid,updated_at:new Date().toISOString()}).eq("id",courseId);
   await log(sb,courseId,userId,"quality_check",{valid:report.valid,error_count:errors.length,warning_count:warnings.length});
   return json({success:true,...report});
  }
  if(action==="submit_course"){
   const {data:c,error}=await sb.from("courses").select("ready_to_submit,quality_report,sale_mode,desired_price_amount,current_version").eq("id",courseId).single();if(error)throw error;
   if(!c.ready_to_submit)return json({success:false,errors:c.quality_report?.errors||["Exécutez le contrôle qualité et corrigez les éléments manquants."],warnings:c.quality_report?.warnings||[]},400);
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)return json({success:false,errors:["Indiquez le prix de vente souhaité dans Commercialisation."],warnings:[]},400);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const {data:lessons}=await sb.from("course_lessons").select("*").eq("course_id",courseId).order("position");
   const {data:blocks}=await sb.from("lesson_blocks").select("*").eq("course_id",courseId).order("position");
   const {data:assessments}=await sb.from("course_assessments").select("*").eq("course_id",courseId);
   const snapshot={course_id:courseId,modules:mods||[],lessons:lessons||[],blocks:blocks||[],assessments:assessments||[],captured_at:new Date().toISOString()};
   await sb.from("course_versions").upsert({course_id:courseId,version_label:c.current_version||"1.0",snapshot,status:"submitted",created_by:userId},{onConflict:"course_id,version_label"});
   await sb.from("courses").update({studio_status:"pending_validation",submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",courseId);
   await log(sb,courseId,userId,"course_submitted",{version:c.current_version||"1.0"});return json({success:true,version:c.current_version||"1.0"});
  }
  if(action==="get_change_logs"){const {data,error}=await sb.from("course_studio_logs").select("*,users(full_name)").eq("course_id",courseId).order("created_at",{ascending:false}).limit(100);if(error)throw error;return json({success:true,logs:data||[]})}
  if(action==="prepare_upload"){
   const bucket=b.bucket_name||"course-resources";const path=b.storage_path;const {data,error}=await sb.storage.from(bucket).createSignedUploadUrl(path,{upsert:true});if(error)throw error;return json({success:true,...data,bucket,path});
  }
  if(action==="upload_block_file"){
   const {data:blk}=await sb.from("lesson_blocks").select("course_id").eq("id",b.block_id).maybeSingle();if(!blk||!(await owns(sb,userId,blk.course_id)))return json({success:false,error:"FORBIDDEN"},403);const publicUrl=`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${b.bucket_name}/${b.storage_path}`;const {data,error}=await sb.from("lesson_blocks").update({file_url:publicUrl,file_name:b.file_name,file_size:b.file_size,file_mime:b.file_mime,storage_path:b.storage_path,bucket_name:b.bucket_name,updated_at:new Date().toISOString()}).eq("id",b.block_id).select("*").single();if(error)throw error;return json({success:true,block:data,public_url:publicUrl});
  }
  if(action==="ai_generate_cover_images"){
   const prompt=String(b.prompt||"").trim();if(!prompt)return json({success:false,error:"PROMPT_REQUIRED"},400);
   const openaiKey=Deno.env.get("OPENAI_API_KEY");if(!openaiKey)return json({success:false,error:"OPENAI_API_KEY_MISSING",message:"Ajoutez OPENAI_API_KEY dans les secrets Supabase."},503);
   const count=Math.min(4,Math.max(1,Number(b.count)||3));const images:string[]=[];
   const safePrompt=`Image de couverture professionnelle pour une formation en ligne. ${prompt}. Format horizontal 16:9, composition claire, lisible en miniature, sans texte, sans logo, sans filigrane, sans personne sauf demande explicite. Style éducatif premium adapté à l'Afrique et au monde.`;
   for(let i=0;i<count;i++){
    const r=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Authorization":`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_IMAGE_MODEL")||"gpt-image-1",prompt:`${safePrompt} Variante visuelle ${i+1}.`,size:"1536x1024",quality:"medium",n:1})});
    const out=await r.json();if(!r.ok)throw new Error(out?.error?.message||"IMAGE_GENERATION_FAILED");const b64=out?.data?.[0]?.b64_json;if(!b64)throw new Error("IMAGE_DATA_MISSING");
    const bytes=Uint8Array.from(atob(b64),(c)=>c.charCodeAt(0));const path=`${courseId}/ai-cover-${Date.now()}-${i+1}.png`;const {error:upErr}=await sb.storage.from("course-images").upload(path,bytes,{contentType:"image/png",upsert:true});if(upErr)throw upErr;
    images.push(`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/course-images/${path}`);
   }
   await sb.from("courses").update({cover_image_prompt:prompt,cover_image_candidates:images,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"cover_images_generated",{count:images.length});return json({success:true,images});
  }
  if(String(action).startsWith("ai_")){
   const input=String(b.text||b.content||b.topic||"").trim();if(!input)return json({success:false,error:"TEXT_REQUIRED"},400);
   const key=Deno.env.get("ANTHROPIC_API_KEY");if(!key)return json({success:true,result:"Service IA non configuré. Votre texte original a été conservé.",fallback:true});
   const prompts:Record<string,string>={ai_improve_text:"Améliore ce contenu pédagogique en français, sans inventer de faits.",ai_simplify_text:"Simplifie ce contenu pour un public débutant.",ai_correct_grammar:"Corrige uniquement la langue et la grammaire.",ai_summarize:"Résume clairement ce contenu.",ai_generate_qcm:"Génère un QCM avec 1 bonne réponse, 3 mauvaises réponses et une explication. Réponds en JSON.",ai_generate_true_false:"Génère une question vrai/faux avec explication. Réponds en JSON.",ai_generate_quiz:"Génère 5 questions variées avec corrigés. Réponds en JSON.",ai_create_summary:"Crée un résumé pédagogique structuré.",ai_create_remember:"Crée une liste concise de points à retenir.",ai_suggest_structure:"Propose une structure de modules et leçons.",ai_suggest_objectives:"Propose des objectifs pédagogiques mesurables.",ai_suggest_example:"Propose un exemple concret et réaliste."};
   const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-3-5-haiku-latest",max_tokens:1400,messages:[{role:"user",content:`${prompts[action]||"Aide à améliorer ce contenu pédagogique."}\n\n${input}`} ]})});const out=await r.json();return json({success:r.ok,result:out?.content?.[0]?.text||"",error:r.ok?undefined:"AI_ERROR"},r.ok?200:502);
  }
  return json({success:false,error:"UNKNOWN_ACTION",action},400);
 }catch(e){console.error("studio-unified",e);return json({success:false,error:"SERVER_ERROR",message:(e as Error).message},500)}
});
