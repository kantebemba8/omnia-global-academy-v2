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
async function log(sb:any,courseId:string,userId:string,action:string,details:any={}){await sb.from("course_studio_logs").insert({course_id:courseId,user_id:userId,action,details})}
const defaults:Record<string,any>={
 heading:{text:"Nouveau titre",level:1,alignment:"left"},subheading:{text:"Sous-titre",level:2,alignment:"left"},text:{html:"<p>Saisissez votre texte ici...</p>"},separator:{style:"line"},callout:{type:"info",content:"Information importante..."},remember:{title:"À retenir",points:["Point clé 1"]},objective:{text:"À la fin de cette leçon, vous serez capable de..."},example:{title:"Exemple",situation:"",explication:"",conclusion:""},summary:{intro:"Dans cette leçon, vous avez appris...",points:[]},image:{url:"",alt:"",caption:""},video:{url:"",eco_data:true},audio:{url:"",description:"",transcription:""},pdf:{url:"",title:"",description:"",downloadable:true},word:{url:"",title:"",description:""},excel:{url:"",title:"",sheet:"",preview_rows:[]},scorm:{url:"",title:"",package_type:"scorm_12",duration_min:0},download:{url:"",title:"",description:""},qcm:{question:"",options:["","","",""],correctIndex:0,explanation:""},true_false:{statement:"",answer:true,explanation:""},open_question:{question:"",guidance:"",expected_answer:""},exercise:{title:"",instructions:"",data:"",task:""},accordion:{items:[{id:crypto.randomUUID(),title:"Section 1",content:""}]},flashcards:{cards:[{id:crypto.randomUUID(),front:"Recto",back:"Verso"}]},interactive_table:{headers:["Colonne 1","Colonne 2"],rows:[["",""]],style:"table"},timeline:{steps:[{id:crypto.randomUUID(),title:"Étape 1",description:""}]},columns:{columns:[{id:crypto.randomUUID(),content:""},{id:crypto.randomUUID(),content:""}]},important:{type:"warning",content:""},case_study:{context:"",data:"",task:"",questions:[]},definition:{term:"",definition:"",example:""},correction:{content:"",key_points:[]},bullet_list:{items:["Élément 1","Élément 2"]},numbered_list:{items:["Étape 1","Étape 2"]},quote:{text:"Citation ou témoignage",author:""},code:{language:"text",code:""},checklist:{items:[{id:crypto.randomUUID(),text:"Action à réaliser",checked:false}]},link_button:{label:"Ouvrir le lien",url:"",open_new_tab:true},embed:{url:"",title:"Contenu intégré"},gallery:{images:[]},formula:{latex:""},chart:{chart_type:"bar",labels:["A","B"],values:[0,0]},assignment_upload:{title:"Travail à remettre",instructions:"",accepted_types:["pdf","docx"],max_size_mb:10},rubric:{criteria:[{name:"Critère 1",description:"",points:10}]}
};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userId=await sessionUser(sb,req); if(!userId)return json({success:false,error:"AUTH_REQUIRED"},401);
  const b=await req.json(); const action=b.action;
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
   const insert:any={
    title:b.title||"Nouvelle formation",creator_id:userId,template_used:b.template_used||"simple_textual",
    studio_mode:b.studio_mode||"simple",studio_status:"draft",short_description:b.short_description||"",
    long_description:b.long_description||"",category:b.category||null,level:b.level||null,language:b.language||"fr",
    prerequisites:b.prerequisites||"",objectives:b.objectives||[],target_audience:b.target_audience||"",
    learning_outcomes:b.learning_outcomes||[],cover_image_url:b.cover_image_url||null,
    cover_image_prompt:b.cover_image_prompt||"",course_intro_title:b.course_intro_title||"Bienvenue dans cette formation",
    course_intro_summary:b.course_intro_summary||""
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
  if(courseId && !(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
  if(action==="get_course"){
   const {data:course}=await sb.from("courses").select("*").eq("id",courseId).maybeSingle(); if(!course)return json({success:false,error:"NOT_FOUND"},404);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const ids=(mods||[]).map((m:any)=>m.id); const {data:lessons}=ids.length?await sb.from("course_lessons").select("*").in("module_id",ids).order("position"):{data:[]};
   const lsIds=(lessons||[]).map((l:any)=>l.id); let counts:any[]=[]; if(lsIds.length){const {data}=await sb.from("lesson_blocks").select("lesson_id").in("lesson_id",lsIds);counts=data||[]}
   const modules=(mods||[]).map((m:any)=>({...m,lessons:(lessons||[]).filter((l:any)=>l.module_id===m.id).map((l:any)=>({...l,has_blocks:counts.some(x=>x.lesson_id===l.id),block_count:counts.filter(x=>x.lesson_id===l.id).length}))}));
   return json({success:true,course,modules});
  }
  if(action==="create_module"){
   const {count}=await sb.from("course_modules").select("id",{count:"exact",head:true}).eq("course_id",courseId); const {data,error}=await sb.from("course_modules").insert({course_id:courseId,title:b.title||`Module ${(count||0)+1}`,objective:b.objective||"",position:count||0}).select("*").single();if(error)throw error;await log(sb,courseId,userId,"module_created",{module_id:data.id});return json({success:true,module:data});
  }
  if(action==="create_lesson"){
   const {count}=await sb.from("course_lessons").select("id",{count:"exact",head:true}).eq("module_id",b.module_id);const {data,error}=await sb.from("course_lessons").insert({course_id:courseId,module_id:b.module_id,title:b.title||`Leçon ${(count||0)+1}`,position:count||0}).select("*").single();if(error)throw error;await log(sb,courseId,userId,"lesson_created",{lesson_id:data.id});return json({success:true,lesson:{...data,has_blocks:false,block_count:0}});
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
   const updates:any={updated_at:new Date().toISOString()};for(const k of ["title","short_description","long_description","category","level","language","prerequisites","objectives","target_audience","learning_outcomes","cover_image_url","cover_image_prompt","course_intro_title","course_intro_summary","studio_mode","template_used","word_count"])if(b[k]!==undefined)updates[k]=b[k];if(b.word_count!==undefined)updates.estimated_read_min=Math.max(1,Math.ceil(Number(b.word_count)/200));if(action==="autosave")updates.last_autosave_at=new Date().toISOString();
   const {data,error}=await sb.from("courses").update(updates).eq("id",courseId).select("*").single();if(error)throw error;if(action!=="autosave")await log(sb,courseId,userId,"course_updated");return json({success:true,course:data});
  }
  if(action==="apply_template"){
   const {data:t}=await sb.from("course_studio_templates").select("*").eq("key",b.template_key).eq("is_active",true).maybeSingle();if(!t)return json({success:false,error:"TEMPLATE_NOT_FOUND"},404);
   if(b.replace_existing){await sb.from("course_modules").delete().eq("course_id",courseId).eq("is_intro",false)}
   for(const [mi,m] of (t.blueprint.modules||[]).entries()){
    const {data:mod}=await sb.from("course_modules").insert({course_id:courseId,title:m.title,objective:m.objective||"",position:mi}).select("*").single();
    for(const [li,l] of (m.lessons||[]).entries()){
     const {data:lesson}=await sb.from("course_lessons").insert({course_id:courseId,module_id:mod.id,title:l.title,position:li}).select("*").single();
     for(const [bi,type] of (l.blocks||[]).entries())await sb.from("lesson_blocks").insert({course_id:courseId,module_id:mod.id,lesson_id:lesson.id,block_type:type,position:bi,content_json:defaults[type]||{},settings_json:{},created_by:userId});
    }
   }
   await sb.from("courses").update({template_used:b.template_key,studio_mode:t.mode,updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"template_applied",{template:b.template_key});return json({success:true});
  }
  if(action==="validate_checklist"){
   const errors:string[]=[],warnings:string[]=[];const {data:c}=await sb.from("courses").select("*").eq("id",courseId).single();const {data:m}=await sb.from("course_modules").select("id,title,objective").eq("course_id",courseId);const {data:l}=await sb.from("course_lessons").select("id,title").eq("course_id",courseId);const {data:bl}=await sb.from("lesson_blocks").select("lesson_id,block_type,content_json").eq("course_id",courseId);
   if(!c.title?.trim())errors.push("Le titre de la formation est obligatoire.");if(!c.short_description?.trim())errors.push("Ajoutez la description courte visible avant achat.");if(!c.long_description?.trim())warnings.push("Ajoutez une présentation détaillée pour la fiche de vente.");if(!c.cover_image_url?.trim())errors.push("Ajoutez une image de couverture.");if(!c.target_audience?.trim())warnings.push("Précisez le public cible.");
   const normalModules=(m||[]).filter((x:any)=>!x.is_intro);const introModules=(m||[]).filter((x:any)=>x.is_intro);if(!introModules.length)errors.push("Ajoutez l’introduction de la formation.");if(!normalModules.length)errors.push("Ajoutez au moins un module après l’introduction.");if(!(l||[]).length)errors.push("Ajoutez au moins une leçon.");for(const lesson of l||[]){const lb=(bl||[]).filter((x:any)=>x.lesson_id===lesson.id);if(!lb.length)errors.push(`La leçon « ${lesson.title} » ne contient aucun bloc.`);if(!(lesson as any).is_intro&&!lb.some((x:any)=>["qcm","true_false","open_question","exercise","assignment_upload"].includes(x.block_type)))warnings.push(`Ajoutez une activité d’évaluation dans « ${lesson.title} ».`)}
   return json({success:true,valid:errors.length===0,errors,warnings});
  }
  if(action==="submit_course"){
   const {data:l}=await sb.from("course_lessons").select("id").eq("course_id",courseId);const {count}=await sb.from("lesson_blocks").select("id",{count:"exact",head:true}).eq("course_id",courseId);if(!(l||[]).length||!(count||0))return json({success:false,errors:["La formation doit contenir au moins une leçon et un bloc."],warnings:[]},400);await sb.from("courses").update({studio_status:"pending_validation",submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",courseId);await log(sb,courseId,userId,"course_submitted");return json({success:true});
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
