import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-omnia-session-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

async function sessionUser(sb:any, req:Request, bodyToken=""){
 const token=(bodyToken||req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
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
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const url=`${Deno.env.get("SUPABASE_URL")}/functions/v1/certificate-generate`;
  const response=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,course_id:courseId,source,internal_request:true})});
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
 const durationHours=Math.max(Number(course?.cpd_hours||0),Number(course?.total_duration_seconds||0)/3600,Number(course?.calculated_duration_minutes||course?.estimated_read_min||0)/60);
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
 heading:{text:"Nouveau titre",level:1,alignment:"left"},subheading:{text:"Sous-titre",level:2,alignment:"left"},text:{html:"<p>Saisissez votre texte ici...</p>"},separator:{style:"line"},callout:{type:"info",content:"Information importante..."},remember:{title:"À retenir",points:[""]},objective:{title:"Objectif pédagogique",html:"<p>À la fin de cette leçon, vous serez capable de...</p>"},example:{title:"Exemple",html:"<p>Décrivez ici un exemple concret...</p>"},summary:{title:"Résumé",html:"<p>Dans cette leçon, vous avez appris...</p>"},image:{url:"",alt:"",caption:""},video:{url:"",eco_data:true},audio:{url:"",description:"",transcription:""},pdf:{url:"",title:"",description:"",downloadable:true},word:{url:"",title:"",description:""},excel:{url:"",title:"",sheet:"",preview_rows:[]},scorm:{url:"",title:"",package_type:"scorm_12",duration_min:0},download:{url:"",title:"",description:""},qcm:{question:"",options:["","","",""],correctIndex:0,explanation:""},true_false:{statement:"",answer:true,explanation:""},open_question:{question:"",guidance:"",expected_answer:"",points:10,required:true},exercise:{title:"Exercice",instructions:"",task:"",resources:[],accepted_types:["pdf","doc","docx","xls","xlsx"],learner_upload_required:true,points:20},accordion:{items:[{id:crypto.randomUUID(),title:"Section 1",content:""}]},flashcards:{cards:[{id:crypto.randomUUID(),front:"Recto",back:"Verso"}]},interactive_table:{headers:["Colonne 1","Colonne 2"],rows:[["",""]],style:"table"},timeline:{steps:[{id:crypto.randomUUID(),title:"Étape 1",description:""}]},columns:{columns:[{id:crypto.randomUUID(),content:""},{id:crypto.randomUUID(),content:""}]},important:{title:"Important",html:"<p>Saisissez l’information importante...</p>"},case_study:{context:"",data:"",task:"",questions:[]},definition:{term:"",definition:"",example:""},correction:{title:"Correction",html:"<p>Saisissez ici la correction détaillée...</p>",key_points:[]},bullet_list:{items:[""]},numbered_list:{items:[""]},quote:{text:"Citation ou témoignage",author:""},code:{language:"text",code:""},checklist:{items:[{id:crypto.randomUUID(),text:"Action à réaliser",checked:false}]},link_button:{label:"Ouvrir le lien",url:"",open_new_tab:true},embed:{url:"",title:"Contenu intégré"},gallery:{images:[]},formula:{latex:""},chart:{chart_type:"bar",labels:["A","B"],values:[0,0]},assignment_upload:{title:"Travail à remettre",instructions:"",accepted_types:["pdf","docx"],max_size_mb:10},rubric:{criteria:[{name:"Critère 1",description:"",points:10}]}
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
   if(course.free_preview_mode!=="none"&&introLesson){const {data,error}=await sb.from("lesson_blocks").select("id,block_type,position,title,content_json,settings_json,file_url,file_name,file_size,file_mime").eq("lesson_id",introLesson.id).order("position");if(error)throw error;blocks=data||[]}
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
   const structureRoles=["gestionnaire_partenaire","responsable_structure","structure_admin","directeur","etablissement_directeur"];
   if(!isAdmin&&!userRoles.some((r:string)=>structureRoles.includes(r)))return json({success:false,error:"FORBIDDEN"},403);
   const {data:manager}=await sb.from("partner_managers").select("organization_id,status").eq("user_id",userId).order("is_primary",{ascending:false}).limit(1).maybeSingle();
   let organization:any=null;
   if(manager?.organization_id){
    const {data}=await sb.from("partner_organizations").select("id,org_name,org_type,status,logo_url,admin_comment,modification_note").eq("id",manager.organization_id).maybeSingle();organization=data;
   }
   const {count:courseCount}=await sb.from("courses").select("id",{count:"exact",head:true}).eq("creator_id",userId);
   let activeCodes=0;
   if(manager?.organization_id){const {count}=await sb.from("partner_codes").select("id",{count:"exact",head:true}).eq("organization_id",manager.organization_id).eq("status","active");activeCodes=count||0;}
   return json({success:true,structure:organization?{id:organization.id,name:organization.org_name,display_name:organization.org_name,structure_type:organization.org_type||"autre",status:organization.status||"pending_validation",status_label:organization.status||"pending_validation",logo_url:organization.logo_url,admin_comment:organization.admin_comment,modification_note:organization.modification_note}:null,stats:{members:0,active_codes:activeCodes,active_benefits:0,courses:courseCount||0},pending_members:[]});
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
   if(!String(input.title||"").trim()||!String(input.provider_name||"").trim()||!/^https:\/\//i.test(externalUrl))return json({success:false,error:"INVALID_EXTERNAL_COURSE",message:"Titre, fournisseur et URL HTTPS valides sont obligatoires."},400);
   const contentUsageConfirmed=input.content_usage_confirmed===true;
   if(String(input.status)==="published"&&!contentUsageConfirmed)return json({success:false,error:"EXTERNAL_COURSE_VERIFICATION_REQUIRED",message:"Confirmez la vérification du lien, des conditions d’accès et des droits d’utilisation avant publication."},400);
   const payload:any={title:String(input.title).trim().slice(0,500),short_description:String(input.short_description||"").trim().slice(0,4000)||null,provider_name:String(input.provider_name).trim().slice(0,240),external_url:externalUrl.slice(0,3000),cover_image_url:String(input.cover_image_url||"").trim().slice(0,3000)||null,category:String(input.category||"").trim().slice(0,200)||null,level:String(input.level||"").trim().slice(0,100)||null,language:String(input.language||"fr").trim().slice(0,20),duration_label:String(input.duration_label||"").trim().slice(0,100)||null,total_duration_seconds:Math.max(0,Math.round(Number(input.total_duration_seconds||0))),certificate_available:!!input.certificate_available,is_free:input.is_free!==false,access_mode:["public","registered","premium"].includes(String(input.access_mode))?String(input.access_mode):"public",premium_benefit_key:"external_course_premium_access",status:["draft","published","archived"].includes(String(input.status))?String(input.status):"draft",is_featured:!!input.is_featured,display_order:Math.round(Number(input.display_order||0)),admin_notes:String(input.admin_notes||"").trim().slice(0,4000)||null,content_usage_confirmed:contentUsageConfirmed,updated_by:userId,updated_at:new Date().toISOString()};
   if(contentUsageConfirmed){payload.last_verified_at=new Date().toISOString();payload.last_verified_by=userId;}
   if(payload.status==="published")payload.published_at=new Date().toISOString();
   const result=id?await sb.from("external_courses").update(payload).eq("id",id).select("*").single():await sb.from("external_courses").insert({...payload,created_by:userId}).select("*").single();if(result.error)throw result.error;
   await sb.from("course_audit_log").insert({actor_id:userId,action:id?"external_course_updated":"external_course_created",entity_type:"external_course",entity_id:result.data.id,metadata:{provider_name:payload.provider_name,access_mode:payload.access_mode,status:payload.status}}).then(()=>{}).catch(()=>{});
   return json({success:true,course:result.data});
  }
  if(action==="admin_archive_external_course"){
   if(!isAdmin)return json({success:false,error:"FORBIDDEN"},403);const id=String(b.external_course_id||"");if(!id)return json({success:false,error:"ID_REQUIRED"},400);
   const {data,error}=await sb.from("external_courses").update({status:"archived",updated_by:userId,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();if(error)throw error;return json({success:true,course:data});
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
   if(creatorContext==="structure"){const {data:manager}=await sb.from("partner_managers").select("organization_id").eq("user_id",userId).order("is_primary",{ascending:false}).limit(1).maybeSingle();structureId=manager?.organization_id||null;}
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
  if(courseId && !["learner_get_assessment","learner_submit_assessment","prepare_assessment_submission_upload","learner_complete_remediation"].includes(action) && !(await owns(sb,userId,courseId)))return json({success:false,error:"FORBIDDEN"},403);
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
   const {data:course,error:courseError}=await sb.from("courses").select("id,title,creator_id,studio_status,lesson_passing_score,module_passing_score,final_passing_score,assessment_policy").eq("id",courseId).maybeSingle();
   if(courseError)throw courseError;
   if(!course)return json({success:false,error:"NOT_FOUND"},404);
   if(!isAdmin&&["pending_validation","validated","published"].includes(String(course.studio_status||"")))return json({success:false,error:"COURSE_LOCKED",message:"Cette formation doit être renvoyée en modification avant de changer ses évaluations."},409);

   const [{data:mods,error:modsError},{data:lessons,error:lessonsError},{data:blocks,error:blocksError}]=await Promise.all([
    sb.from("course_modules").select("id,title,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position"),
    sb.from("course_lessons").select("id,module_id,title,is_intro,is_module_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position"),
    sb.from("lesson_blocks").select("id,lesson_id,block_type,position,content_json,file_url,file_name").eq("course_id",courseId).order("position"),
   ]);
   if(modsError)throw modsError;
   if(lessonsError)throw lessonsError;
   if(blocksError)throw blocksError;

   const policy=course.assessment_policy&&typeof course.assessment_policy==="object"?course.assessment_policy:{};
   const defaultCooldown=Math.max(0,Number(policy.default_retry_cooldown_hours??24));
   const defaultRemediation=Math.max(1,Number(policy.default_remediation_after_attempts??3));
   const defaultMode=String(policy.default_remediation_mode||"review_module");
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
      const questionPayload:any={assessment_id:assessment.id,question_type:questionType,position,prompt:content.question||content.statement||content.title||content.instructions||"Question à compléter",points:Number(content.points||10),grading_mode:["qcm","true_false"].includes(questionType)?"automatic":(content.grading_mode||"human"),options:content.options||[],correct_answer:questionType==="qcm"?content.correctIndex:questionType==="true_false"?content.answer:content.expected_answer||null,explanation:content.explanation||"",resource_files:content.resources||((block.file_url)?[{name:block.file_name||"Ressource",url:block.file_url}]:[]),accepted_submission_types:content.accepted_types||["pdf","doc","docx","xls","xlsx","zip","png","jpg"],rubric:content.rubric||[]};
      const {error:questionError}=await sb.from("assessment_questions").insert(questionPayload);
      if(questionError)throw questionError;
     }
    }
    return assessment;
   };

   for(const lesson of lessons||[]){if(!lesson.is_intro&&!lesson.is_module_intro&&!lesson.is_conclusion&&!lesson.is_final_exam)await ensureOne("lesson",`Évaluation — ${lesson.title}`,lesson.module_id,lesson.id,course.lesson_passing_score||80)}
   for(const module of mods||[]){if(!module.is_intro&&!module.is_conclusion&&!module.is_final_exam)await ensureOne("module",`Évaluation du module — ${module.title}`,module.id,undefined,course.module_passing_score||80)}
   await ensureOne("final",`Examen final — ${course.title}`,undefined,undefined,course.final_passing_score||70);

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
   if(!rows.length)return json({success:false,error:"ASSESSMENTS_REQUIRED",message:"Aucune règle d’évaluation à enregistrer."},400);
   const incomingIds=[...new Set(rows.map((item:any)=>String(item.id||"")).filter(Boolean))];
   if(incomingIds.length!==rows.length)return json({success:false,error:"INVALID_ASSESSMENT_IDS",message:"Une ou plusieurs évaluations sont invalides ou dupliquées."},400);
   const existingResult=await sb.from("course_assessments").select("id,scope").eq("course_id",courseId).in("id",incomingIds);
   if(existingResult.error)throw existingResult.error;
   const existingIds=new Set((existingResult.data||[]).map((item:any)=>String(item.id)));
   if(existingIds.size!==incomingIds.length)return json({success:false,error:"ASSESSMENT_OUTSIDE_COURSE",message:"Une évaluation n’appartient pas à cette formation."},400);

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
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation Super Admin ne crée aucune copie."},403);
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
   const {data:qs}=await sb.from("assessment_questions").select("id,question_type,position,prompt,options,explanation,points,resource_files,accepted_submission_types").eq("assessment_id",a.id).order("position");
   const {data:last}=isAdmin?{data:null}:await sb.from("assessment_attempts").select("id,score,passed,status,attempt_number,retry_available_at,remediation_required,remediation_completed_at,feedback,submitted_at").eq("assessment_id",a.id).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   let correction:any=null;if(last?.id){const {data:c}=await sb.from("assessment_corrections").select("score,max_score,comment,corrected_bucket_name,corrected_storage_path,corrected_file_name,published_at").eq("attempt_id",last.id).eq("status","published").order("published_at",{ascending:false}).limit(1).maybeSingle();if(c){let signed_url=null;if(c.corrected_bucket_name&&c.corrected_storage_path){const {data:signed}=await sb.storage.from(c.corrected_bucket_name).createSignedUrl(c.corrected_storage_path,3600);signed_url=signed?.signedUrl||null}correction={...c,signed_url}}}
   const now=Date.now();const retryAt=last?.retry_available_at?new Date(last.retry_available_at).getTime():0;const pending=last&&["pending_review","submitted","in_progress"].includes(last.status);const remediationBlocked=!!last?.remediation_required&&!last?.remediation_completed_at;
   return json({success:true,assessment:{...a,session,questions:qs||[],latest_attempt:last||null,correction,can_retry:!pending&&!remediationBlocked&&(!retryAt||retryAt<=now),retry_blocked_until:retryAt>now?last.retry_available_at:null,remediation_blocked:remediationBlocked}});
  }
  if(action==="learner_complete_remediation"){
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation Super Admin ne modifie aucune progression."},403);
   const assessmentId=String(b.assessment_id||"");
   const {data:a}=await sb.from("course_assessments").select("course_id,remediation_mode,is_active").eq("id",assessmentId).maybeSingle();if(!a||a.is_active===false)return json({success:false,error:"ASSESSMENT_NOT_FOUND"},404);
   const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",a.course_id).maybeSingle();if(!enroll)return json({success:false,error:"NOT_ENROLLED"},403);
   if(a.remediation_mode==="manual")return json({success:false,error:"MANUAL_REMEDIATION_REQUIRED",message:"Le formateur doit autoriser la nouvelle tentative."},409);
   const {data:last}=await sb.from("assessment_attempts").select("id,remediation_required").eq("assessment_id",assessmentId).eq("user_id",userId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();if(!last?.remediation_required)return json({success:true});
   const {error}=await sb.from("assessment_attempts").update({remediation_completed_at:new Date().toISOString(),remediation_note:String(b.note||"Contenu révisé par l’apprenant")}).eq("id",last.id);if(error)throw error;return json({success:true});
  }
  if(action==="learner_submit_assessment"){
   if(isAdmin)return json({success:false,error:"PREVIEW_READ_ONLY",message:"La prévisualisation Super Admin ne crée aucune tentative."},403);
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
   const attemptId=String(b.attempt_id||"");const {data:att}=await sb.from("assessment_attempts").select("course_id").eq("id",attemptId).maybeSingle();if(!att||!(await owns(sb,userId,att.course_id)))return json({success:false,error:"FORBIDDEN"},403);const fileName=String(b.file_name||"correction").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-160);if(Number(b.size_bytes||0)>52428800)return json({success:false,error:"FILE_TOO_LARGE"},400);const path=`${att.course_id}/${attemptId}/${userId}/${crypto.randomUUID()}-${fileName}`;const {data,error}=await sb.storage.from("assessment-corrections").createSignedUploadUrl(path,{upsert:false});if(error)throw error;return json({success:true,...data,bucket:"assessment-corrections",path});
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
   const {data:course}=await sb.from("courses").select("sale_mode,desired_price_amount,sale_currency,promotion_price_amount,structure_payment_mode,structure_fixed_amount,is_assisted,assisted_status,assisted_request_id,certification_requested").eq("id",courseId).single();
   const {data:settings}=await sb.from("site_settings").select("key,value").in("key",["commission_normal_sans_cpd","commission_normal_avec_cpd","commission_assistee_sans_cpd","commission_assistee_avec_cpd"]);
   const revenueRules:any={};for(const row of settings||[]){try{revenueRules[row.key]=typeof row.value==="string"?JSON.parse(row.value):row.value}catch{revenueRules[row.key]=row.value}}
   const [{data:certifications},organizationOptions]=await Promise.all([sb.from("course_certifications").select("*").eq("course_id",courseId).order("created_at"),certificationOrganizationOptions(sb,courseId)]);
   return json({success:true,course,revenue_rules:revenueRules,certifications:certifications||[],organization_options:organizationOptions});
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
   if(intro){ const introLessons=(l||[]).filter((x:any)=>x.module_id===intro.id); const introHasBlocks=introLessons.some((lesson:any)=>(bl||[]).some((block:any)=>block.lesson_id===lesson.id)); if(!introHasBlocks)errors.push("Construisez l’introduction avec au moins un bloc."); }
   const normalModules=(m||[]).filter((x:any)=>!x.is_intro&&!x.is_conclusion&&!x.is_final_exam);
   if(!intro)errors.push("Ajoutez l’introduction de la formation.");
   if(!normalModules.length)errors.push("Ajoutez au moins un module après l’introduction.");
   if(!conclusion)errors.push("Ajoutez la conclusion de la formation.");
   if(!finalExam)errors.push("Ajoutez l’examen final.");
   for(const mod of normalModules){
    const moduleLessons=(l||[]).filter((x:any)=>x.module_id===mod.id&&!x.is_module_intro);
    if(!moduleLessons.length)errors.push(`Le module « ${mod.title} » doit contenir au moins une leçon.`);
    const moduleAssessment=(assessments||[]).find((a:any)=>a.scope==="module"&&a.module_id===mod.id&&a.required!==false);
    if(!moduleAssessment)errors.push(`Le module « ${mod.title} » doit avoir une évaluation obligatoire.`);
    else {
      if(Number(moduleAssessment.passing_score)<1||Number(moduleAssessment.passing_score)>100)errors.push(`Le seuil du module « ${mod.title} » doit être compris entre 1 et 100 %.`);
      if(Number(moduleAssessment.assessment_questions?.[0]?.count||0)===0)errors.push(`L’évaluation du module « ${mod.title} » ne contient aucune question.`);
      if(Number(moduleAssessment.remediation_after_attempts||0)<1)errors.push(`Configurez le seuil de remédiation du module « ${mod.title} ».`);
    }
    for(const lesson of moduleLessons){
      const lessonBlocks=(bl||[]).filter((x:any)=>x.lesson_id===lesson.id);
      if(!lessonBlocks.length)errors.push(`La leçon « ${lesson.title} » ne contient aucun bloc.`);
      const lessonAssessment=(assessments||[]).find((a:any)=>a.scope==="lesson"&&a.lesson_id===lesson.id&&a.required!==false);
      if(!lessonAssessment)errors.push(`La leçon « ${lesson.title} » doit avoir une évaluation obligatoire.`);
      else {
        if(Number(lessonAssessment.passing_score)<1||Number(lessonAssessment.passing_score)>100)errors.push(`Le seuil de la leçon « ${lesson.title} » doit être compris entre 1 et 100 %.`);
        if(Number(lessonAssessment.assessment_questions?.[0]?.count||0)===0)errors.push(`L’évaluation de la leçon « ${lesson.title} » ne contient aucune question.`);
        if(Number(lessonAssessment.remediation_after_attempts||0)<1)errors.push(`Configurez le seuil de remédiation de la leçon « ${lesson.title} ».`);
      }
    }
   }
   const finalAssessment=(assessments||[]).find((a:any)=>a.scope==="final"&&a.required!==false);
   if(!finalAssessment)errors.push("L’examen final obligatoire est absent.");
   else {
    if(Number(finalAssessment.passing_score)<1||Number(finalAssessment.passing_score)>100)errors.push("Le seuil de l’examen final doit être compris entre 1 et 100 %.");
    if(Number(finalAssessment.assessment_questions?.[0]?.count||0)===0)errors.push("L’examen final ne contient aucune question.");
    if(Number(finalAssessment.remediation_after_attempts||0)<1)errors.push("Configurez le seuil de remédiation de l’examen final.");
   }
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)errors.push("Indiquez le prix de vente souhaité.");
   if(!c.sale_mode)errors.push("Choisissez si la formation est gratuite ou payante.");
   if(Number(c.calculated_duration_minutes||c.estimated_read_min||0)<=0)warnings.push("La durée pédagogique n’a pas encore été calculée.");
   const report={valid:errors.length===0,errors,warnings,checked_at:new Date().toISOString()};
   await sb.from("courses").update({quality_status:report.valid?"ready":"incomplete",quality_report:report,quality_checked_at:report.checked_at,ready_to_submit:report.valid,updated_at:new Date().toISOString()}).eq("id",courseId);
   await log(sb,courseId,userId,"quality_check",{valid:report.valid,error_count:errors.length,warning_count:warnings.length});
   return json({success:true,...report});
  }
  if(action==="submit_course"){
   const {data:c,error}=await sb.from("courses").select("ready_to_submit,quality_report,sale_mode,desired_price_amount,current_version,creator_context,creator_id,pricing_status,admin_selected_price_xof").eq("id",courseId).single();if(error)throw error;
   if(!c.ready_to_submit)return json({success:false,errors:c.quality_report?.errors||["Exécutez le contrôle qualité et corrigez les éléments manquants."],warnings:c.quality_report?.warnings||[]},400);
   if(c.sale_mode==="paid"&&Number(c.desired_price_amount||0)<=0)return json({success:false,errors:["Indiquez le prix de vente souhaité dans Commercialisation."],warnings:[]},400);
   const {data:mods}=await sb.from("course_modules").select("*").eq("course_id",courseId).order("position");
   const {data:lessons}=await sb.from("course_lessons").select("*").eq("course_id",courseId).order("position");
   const {data:blocks}=await sb.from("lesson_blocks").select("*").eq("course_id",courseId).order("position");
   const {data:assessments}=await sb.from("course_assessments").select("*").eq("course_id",courseId);
   const accelerated=isAdmin&&(c.creator_context==="super_admin"||c.creator_id===userId);
   if(c.sale_mode==="free"){
    await sb.from("courses").update({is_free:true,price_xof:0,pricing_status:"accepted",professor_price_accepted:true,professor_price_accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",courseId);
   }else if(accelerated&&c.pricing_status!=="accepted"){
    const pricing=await calculateCoursePricing(sb,courseId);const selected=Math.max(0,Number(c.desired_price_amount||pricing.price_xof||0));
    await sb.from("courses").update({score_calcule:pricing.score,prix_provisoire_xof:pricing.price_xof,pricing_snapshot:pricing,pricing_status:"accepted",admin_selected_price_source:Number(c.desired_price_amount||0)>0?"professor":"automatic",admin_selected_price_xof:selected,pricing_admin_decided_at:new Date().toISOString(),pricing_admin_decided_by:userId,professor_price_accepted:true,professor_price_accepted_at:new Date().toISOString(),price_xof:selected,is_free:false,updated_at:new Date().toISOString()}).eq("id",courseId);
   }else if(c.sale_mode==="paid"&&c.pricing_status!=="accepted"){
    if(c.pricing_status==="en_attente_acceptation_prix_professeur")return json({success:true,pricing_required:true,pricing_status:c.pricing_status,message:"Le prix attend votre acceptation dans l’espace Tarification."});
    const pricing=await calculateCoursePricing(sb,courseId);
    await sb.from("courses").update({score_calcule:pricing.score,prix_provisoire_xof:pricing.price_xof,pricing_snapshot:pricing,pricing_status:"en_attente_validation_prix_admin",professor_price_accepted:false,is_free:false,updated_at:new Date().toISOString()}).eq("id",courseId);
    await log(sb,courseId,userId,"course_pricing_calculated",pricing);
    return json({success:true,pricing_required:true,pricing_status:"en_attente_validation_prix_admin",score_calcule:pricing.score,prix_provisoire_xof:pricing.price_xof,message:"Le prix automatique et votre proposition ont été transmis au Super-admin."});
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
