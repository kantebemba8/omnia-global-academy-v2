import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
  if(req.method!=="GET")return json({error:"Method not allowed"},405);
  const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({error:"AUTH_REQUIRED"},401);
  const courseId=new URL(req.url).searchParams.get("course_id");
  if(!courseId)return json({error:"course_id requis"},400);
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const {data:sess}=await sb.from("user_sessions").select("user_id").eq("session_token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
    if(!sess)return json({error:"SESSION_INVALID"},401);
    const userId=sess.user_id;
    const {data:enroll}=await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",courseId).maybeSingle();
    if(!enroll)return json({error:"NOT_ENROLLED"},403);

    const {data:modules}=await sb.from("course_modules").select("id,title,position,description,is_intro,is_conclusion,is_final_exam").eq("course_id",courseId).order("position");
    const moduleIds=(modules??[]).map((m:any)=>m.id);
    const {data:lessons}=moduleIds.length?await sb.from("course_lessons").select("id,title,position,module_id,content_type,duration_seconds,is_free,is_module_intro").in("module_id",moduleIds).order("position"):{data:[]};
    const {data:lessonProgress}=await sb.from("user_lesson_progress").select("lesson_id,time_spent_seconds,quiz_passed,is_completed").eq("user_id",userId).eq("course_id",courseId);
    const {data:assessments}=await sb.from("course_assessments").select("id,scope,module_id,lesson_id,passing_score,required").eq("course_id",courseId).eq("is_active",true);
    const assessmentIds=(assessments??[]).map((a:any)=>a.id);
    const {data:attempts}=assessmentIds.length?await sb.from("assessment_attempts").select("assessment_id,score,passed,status,attempt_number,submitted_at").eq("user_id",userId).in("assessment_id",assessmentIds).order("attempt_number",{ascending:false}):{data:[]};

    const progressMap:Record<string,any>={};for(const p of lessonProgress??[])progressMap[(p as any).lesson_id]=p;
    const latestByAssessment:Record<string,any>={};for(const a of attempts??[]){const id=(a as any).assessment_id;if(!latestByAssessment[id])latestByAssessment[id]=a;}
    const passedByAssessment:Record<string,any>={};for(const a of attempts??[]){const row=a as any;if(row.passed&&!passedByAssessment[row.assessment_id])passedByAssessment[row.assessment_id]=row;}
    const assessmentFor=(scope:string,targetId?:string)=> (assessments??[]).find((a:any)=>a.scope===scope&&(scope==="lesson"?a.lesson_id===targetId:scope==="module"?a.module_id===targetId:true));

    const enriched=(modules??[]).map((mod:any,index:number)=>{
      const moduleLessons=(lessons??[]).filter((l:any)=>l.module_id===mod.id).sort((a:any,b:any)=>a.position-b.position).map((lesson:any)=>{
        const assessment=assessmentFor("lesson",lesson.id);const passedAttempt=assessment?passedByAssessment[assessment.id]:null;const p=progressMap[lesson.id];
        return {lesson_id:lesson.id,title:lesson.title,position:lesson.position,content_type:lesson.content_type,duration_seconds:lesson.duration_seconds??0,is_free:lesson.is_free??false,is_completed:p?.is_completed??false,time_spent_seconds:p?.time_spent_seconds??0,quiz_passed:!!passedAttempt||!!p?.quiz_passed};
      });
      const assessment=assessmentFor("module",mod.id);const passedAttempt=assessment?passedByAssessment[assessment.id]:null;const latest=assessment?latestByAssessment[assessment.id]:null;
      const previous=(modules??[]).slice(0,index).reverse().find((m:any)=>!m.is_intro&&!m.is_conclusion&&!m.is_final_exam);const previousAssessment=previous?assessmentFor("module",previous.id):null;const previousPassed=!previousAssessment||!!passedByAssessment[previousAssessment.id];
      const normalLessons=moduleLessons.filter((l:any)=>!(lessons??[]).find((raw:any)=>raw.id===l.lesson_id)?.is_module_intro);
      return {module_id:mod.id,title:mod.title,position:mod.position,description:mod.description??null,lessons:moduleLessons,exam_unlocked:!!assessment&&normalLessons.length>0&&normalLessons.every((l:any)=>l.is_completed),exam_passed:!!passedAttempt,exam_score:passedAttempt?.score??latest?.score??null,exam_attempts:latest?.attempt_number??0,is_unlocked:mod.is_intro||index===0||previousPassed,is_intro:!!mod.is_intro,is_conclusion:!!mod.is_conclusion,is_final_exam:!!mod.is_final_exam};
    });

    const requiredModuleAssessments=(assessments??[]).filter((a:any)=>a.scope==="module"&&a.required!==false);const allModulesPassed=requiredModuleAssessments.every((a:any)=>!!passedByAssessment[a.id]);
    const finalAssessment=(assessments??[]).find((a:any)=>a.scope==="final"&&a.required!==false);const finalAttempt=finalAssessment?(passedByAssessment[finalAssessment.id]||latestByAssessment[finalAssessment.id]):null;
    const totalLessons=enriched.reduce((n:number,m:any)=>n+m.lessons.length,0);const completed=enriched.reduce((n:number,m:any)=>n+m.lessons.filter((l:any)=>l.is_completed).length,0);
    return json({modules:enriched,final_validation_unlocked:allModulesPassed,final_validation:finalAttempt?{status:finalAttempt.passed?"passed":finalAttempt.status,score:finalAttempt.score,validation_type:"assessment"}:null,progress:{total_lessons:totalLessons,completed_lessons:completed,percent:totalLessons?Math.round(completed/totalLessons*100):0}});
  }catch(error){console.error("course-progress",error);return json({error:"SERVER_ERROR",message:(error as Error).message},500);}
});
