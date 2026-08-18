import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { hasStructurePermission, validatedStructureAccess } from "../_shared/structure-access.ts";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});

async function canPreviewCourse(sb:any,userId:string,courseId:string){
  const {data:course}=await sb.from("courses").select("creator_id,creator_context,structure_id").eq("id",courseId).maybeSingle();
  if(!course)return false;
  const {data:roleRows}=await sb.from("user_roles").select("role").eq("user_id",userId);
  if((roleRows||[]).some((row:any)=>row.role==="super_admin"))return true;
  if(String(course.creator_id||"")!==userId)return false;
  if(String(course.creator_context||"")!=="structure")return true;
  if(!course.structure_id)return false;
  const access=await validatedStructureAccess(sb,userId,String(course.structure_id));
  return hasStructurePermission(access,"can_edit_courses");
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
  if(req.method!=="GET")return json({error:"Method not allowed"},405);
  const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({error:"AUTH_REQUIRED"},401);
  const url=new URL(req.url);
  const courseId=url.searchParams.get("course_id");
  const previewMode=String(url.searchParams.get("preview")||"").toLowerCase();
  const preview=["learner","admin"].includes(previewMode);
  if(!courseId)return json({error:"course_id requis"},400);
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const {data:sess}=await getActiveOmniaSessionResult(sb, token);
    if(!sess)return json({error:"SESSION_INVALID"},401);
    const userId=sess.user_id;
    const previewAllowed=preview&&await canPreviewCourse(sb,userId,courseId);
    if(preview&&!previewAllowed)return json({error:"PREVIEW_FORBIDDEN"},403);
    const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",courseId).maybeSingle();
    if(!previewAllowed&&!enroll)return json({error:"NOT_ENROLLED"},403);

    const {data:courseMeta}=await sb.from("courses").select("learning_design_settings").eq("id",courseId).maybeSingle();
    const design=(courseMeta?.learning_design_settings||{}) as Record<string,unknown>;
    const sequential=design.require_sequential_progress!==false;
    const {data:modules}=await sb.from("course_modules").select("id,title,position,description,is_intro,is_conclusion,is_final_exam,is_required").eq("course_id",courseId).order("position");
    const moduleIds=(modules??[]).map((m:any)=>m.id);
    const {data:lessons}=moduleIds.length?await sb.from("course_lessons").select("id,title,position,module_id,content_type,duration_seconds,is_free,is_module_intro,is_required").in("module_id",moduleIds).order("position"):{data:[]};
    const modulePosition:Record<string,number>={};for(const m of modules??[])modulePosition[(m as any).id]=Number((m as any).position||0);
    const orderedLessons=[...(lessons??[])].sort((a:any,b:any)=>(modulePosition[a.module_id]-modulePosition[b.module_id])||(Number(a.position||0)-Number(b.position||0)));
    const lessonUnlock:Record<string,boolean>={};
    const {data:lessonProgress}=previewAllowed?{data:[]} : await sb.from("user_lesson_progress").select("lesson_id,time_spent_seconds,quiz_passed,is_completed").eq("user_id",userId).eq("course_id",courseId);
    const {data:assessments}=await sb.from("course_assessments").select("id,scope,module_id,lesson_id,passing_score,required").eq("course_id",courseId).eq("is_active",true);
    const assessmentIds=(assessments??[]).map((a:any)=>a.id);
    const {data:attempts}=!previewAllowed&&assessmentIds.length?await sb.from("assessment_attempts").select("assessment_id,score,passed,status,attempt_number,submitted_at").eq("user_id",userId).in("assessment_id",assessmentIds).order("attempt_number",{ascending:false}):{data:[]};

    const progressMap:Record<string,any>={};for(const p of lessonProgress??[])progressMap[(p as any).lesson_id]=p;
    const latestByAssessment:Record<string,any>={};for(const a of attempts??[]){const id=(a as any).assessment_id;if(!latestByAssessment[id])latestByAssessment[id]=a;}
    const passedByAssessment:Record<string,any>={};for(const a of attempts??[]){const row=a as any;if(row.passed&&!passedByAssessment[row.assessment_id])passedByAssessment[row.assessment_id]=row;}
    const assessmentFor=(scope:string,targetId?:string)=> (assessments??[]).find((a:any)=>a.scope===scope&&(scope==="lesson"?a.lesson_id===targetId:scope==="module"?a.module_id===targetId:true));

    for(let i=0;i<orderedLessons.length;i++){const lesson:any=orderedLessons[i];const previous:any=i>0?orderedLessons[i-1]:null;lessonUnlock[lesson.id]=previewAllowed||!sequential||i===0||Boolean(previous&&progressMap[previous.id]?.is_completed===true);}
    const enriched=(modules??[]).map((mod:any,index:number)=>{
      const moduleLessons=(lessons??[]).filter((l:any)=>l.module_id===mod.id).sort((a:any,b:any)=>a.position-b.position).map((lesson:any)=>{
        const assessment=assessmentFor("lesson",lesson.id);const passedAttempt=assessment?passedByAssessment[assessment.id]:null;const p=progressMap[lesson.id];
        return {lesson_id:lesson.id,title:lesson.title,position:lesson.position,content_type:lesson.content_type,duration_seconds:lesson.duration_seconds??0,is_free:lesson.is_free??false,is_required:lesson.is_required!==false,is_completed:p?.is_completed??false,time_spent_seconds:p?.time_spent_seconds??0,quiz_passed:!!passedAttempt||!!p?.quiz_passed,is_unlocked:lessonUnlock[lesson.id]!==false};
      });
      const assessment=assessmentFor("module",mod.id);const passedAttempt=assessment?passedByAssessment[assessment.id]:null;const latest=assessment?latestByAssessment[assessment.id]:null;
      const normalLessons=moduleLessons.filter((l:any)=>!(lessons??[]).find((raw:any)=>raw.id===l.lesson_id)?.is_module_intro);
      const mandatoryLessons=normalLessons.filter((l:any)=>l.is_required!==false);
      let previousPassed=true;const previous=(modules??[]).slice(0,index).reverse().find((m:any)=>!m.is_intro&&!m.is_conclusion&&!m.is_final_exam&&m.is_required!==false);if(previous){const prevLessons=(lessons??[]).filter((l:any)=>l.module_id===previous.id&&l.is_required!==false&&!l.is_module_intro);const prevLessonsPassed=prevLessons.every((l:any)=>Boolean(progressMap[l.id]?.is_completed));const previousAssessment=assessmentFor("module",previous.id);const prevAssessmentPassed=!previousAssessment||previousAssessment.required===false||Boolean(passedByAssessment[previousAssessment.id]);previousPassed=prevLessonsPassed&&prevAssessmentPassed;}
      const moduleCompleted=mandatoryLessons.every((l:any)=>l.is_completed)&&(!assessment||assessment.required===false||Boolean(passedAttempt));
      return {module_id:mod.id,title:mod.title,position:mod.position,description:mod.description??null,is_required:mod.is_required!==false,lessons:moduleLessons,exam_required:Boolean(assessment?.required),exam_unlocked:previewAllowed||(!!assessment&&mandatoryLessons.length>0&&mandatoryLessons.every((l:any)=>l.is_completed)),exam_passed:!!passedAttempt,exam_score:passedAttempt?.score??latest?.score??null,exam_attempts:latest?.attempt_number??0,is_completed:moduleCompleted,is_unlocked:previewAllowed||mod.is_intro||index===0||previousPassed,is_intro:!!mod.is_intro,is_conclusion:!!mod.is_conclusion,is_final_exam:!!mod.is_final_exam};
    });

    const requiredModules=enriched.filter((m:any)=>!m.is_intro&&!m.is_conclusion&&!m.is_final_exam&&m.is_required!==false);const allModulesPassed=requiredModules.every((m:any)=>m.is_completed===true);
    const finalAssessment=(assessments??[]).find((a:any)=>a.scope==="final"&&a.required!==false);const finalAttempt=finalAssessment?(passedByAssessment[finalAssessment.id]||latestByAssessment[finalAssessment.id]):null;
    const allRequiredLessons=enriched.flatMap((m:any)=>m.lessons.filter((l:any)=>l.is_required!==false));const totalLessons=allRequiredLessons.length;const completed=allRequiredLessons.filter((l:any)=>l.is_completed).length;
    const courseCompleted=totalLessons>0&&completed===totalLessons&&allModulesPassed&&(!finalAssessment||Boolean(passedByAssessment[finalAssessment.id]));
    if(courseCompleted&&!previewAllowed){try{await sb.rpc("oga_referral_record_event",{p_referred_user_id:userId,p_event_type:"course_completed",p_event_key:`course-completed:${courseId}:${userId}`,p_metadata:{course_id:courseId}})}catch{/* le parrainage ne bloque jamais la progression */}}
    return json({modules:enriched,preview:previewAllowed,preview_mode:previewAllowed?previewMode:null,final_validation_unlocked:previewAllowed||allModulesPassed,final_validation:finalAttempt?{status:finalAttempt.passed?"passed":finalAttempt.status,score:finalAttempt.score,validation_type:"assessment"}:null,progress:{total_lessons:totalLessons,completed_lessons:completed,percent:totalLessons?Math.round(completed/totalLessons*100):0}});
  }catch(error){console.error("course-progress",error);return json({error:"SERVER_ERROR",message:(error as Error).message},500);}
});
