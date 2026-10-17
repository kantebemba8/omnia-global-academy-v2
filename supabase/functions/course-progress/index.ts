import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { canPreviewCourse } from "../_shared/course-preview-access.ts";
import { loadCourseCurriculum } from "../_shared/course-curriculum.ts";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});

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
    const enroll=previewAllowed?null:(await sb.from("user_enrollments").select("id").eq("user_id",userId).eq("course_id",courseId).maybeSingle()).data;
    if(!previewAllowed&&!enroll)return json({error:"NOT_ENROLLED"},403);

    const {data:courseMeta}=await sb.from("courses").select("learning_design_settings").eq("id",courseId).maybeSingle();
    const design=(courseMeta?.learning_design_settings||{}) as Record<string,unknown>;
    const sequential=design.require_sequential_progress!==false;
    const curriculum=await loadCourseCurriculum(sb,courseId);
    const modules=curriculum.modules;
    const lessons=curriculum.lessons;
    const orderedLessons=curriculum.orderedLessons;
    if(curriculum.orphanLessonIds.length)console.warn("course-progress orphan lessons",courseId,curriculum.orphanLessonIds);
    const {data:assessments}=await sb.from("course_assessments").select("id,scope,module_id,lesson_id,passing_score,required").eq("course_id",courseId).eq("is_active",true);
    const assessmentFor=(scope:string,targetId?:string)=> (assessments??[]).find((a:any)=>a.scope===scope&&(scope==="lesson"?a.lesson_id===targetId:scope==="module"?a.module_id===targetId:true));

    // Une prévisualisation Créateur/Admin doit reproduire le vrai curriculum sans
    // dépendre d'une inscription, d'une progression ou de tentatives apprenant.
    if(previewAllowed){
      const previewModules=(modules??[]).map((mod:any)=>({
        module_id:mod.id,title:mod.title,position:mod.position,description:mod.objective??null,
        is_required:mod.is_required!==false,is_unlocked:true,is_completed:false,
        is_intro:!!mod.is_intro,is_conclusion:!!mod.is_conclusion,is_final_exam:!!mod.is_final_exam,
        section_type:mod.section_type|| (mod.is_intro?"introduction":mod.is_conclusion?"conclusion":mod.is_final_exam?"final_exam":"module"),
        exam_exists:Boolean(assessmentFor("module",mod.id)),exam_required:Boolean(assessmentFor("module",mod.id)?.required),exam_unlocked:true,exam_passed:false,exam_score:null,exam_attempts:0,
        lessons:(lessons??[]).filter((l:any)=>l.module_id===mod.id).sort((a:any,b:any)=>a.position-b.position).map((lesson:any)=>({
          lesson_id:lesson.id,title:lesson.title,position:lesson.position,
          content_type:lesson.is_external?"external":(lesson.video_url?"video":lesson.audio_url?"audio":"text"),
          duration_seconds:lesson.cpd_calculated_time_seconds??0,is_free:lesson.is_free_preview===true,
          is_required:lesson.is_required!==false,is_completed:false,time_spent_seconds:0,quiz_passed:false,is_unlocked:true,
          is_intro:!!lesson.is_intro,is_module_intro:!!lesson.is_module_intro,is_conclusion:!!lesson.is_conclusion,is_final_exam:!!lesson.is_final_exam,
          assessment_exists:Boolean(assessmentFor("lesson",lesson.id)),assessment_required:Boolean(assessmentFor("lesson",lesson.id)?.required),assessment_passed:false,
          stage_type:lesson.is_intro?"introduction":lesson.is_module_intro?"module_presentation":lesson.is_conclusion?"conclusion":lesson.is_final_exam?"final_exam":(lesson.stage_type||"lesson")
        }))
      }));
      return json({modules:previewModules,preview:true,preview_mode:previewMode,final_validation_unlocked:true,final_assessment_exists:Boolean(assessmentFor("final")),final_assessment_required:Boolean(assessmentFor("final")?.required),final_validation:null,progress:{total_lessons:0,completed_lessons:0,percent:0}});
    }
    const lessonUnlock:Record<string,boolean>={};
    const {data:lessonProgress}=previewAllowed?{data:[]} : await sb.from("user_lesson_progress").select("lesson_id,time_spent_seconds,quiz_passed,is_completed").eq("user_id",userId).eq("course_id",courseId);
    // Politique canonique OGA : une progression acquise reste acquise. Pour les évaluations
    // obligatoires, toute tentative publiée réussie satisfait la condition; une tentative
    // ultérieure moins bonne ne retire pas une réussite déjà obtenue.
    const assessmentIds=(assessments??[]).map((a:any)=>a.id);
    const {data:attempts}=!previewAllowed&&assessmentIds.length?await sb.from("assessment_attempts").select("assessment_id,score,passed,status,result_status,attempt_number,submitted_at").eq("user_id",userId).in("assessment_id",assessmentIds).order("attempt_number",{ascending:false}):{data:[]};

    const progressMap:Record<string,any>={};for(const p of lessonProgress??[])progressMap[(p as any).lesson_id]=p;
    const latestByAssessment:Record<string,any>={};for(const a of attempts??[]){const id=(a as any).assessment_id;if(!latestByAssessment[id])latestByAssessment[id]=a;}
    const passedByAssessment:Record<string,any>={};for(const a of attempts??[]){const row=a as any;if(row.passed&&!passedByAssessment[row.assessment_id])passedByAssessment[row.assessment_id]=row;}

    for(let i=0;i<orderedLessons.length;i++){const lesson:any=orderedLessons[i];const previousRequired:any=orderedLessons.slice(0,i).reverse().find((candidate:any)=>candidate.is_required!==false);lessonUnlock[lesson.id]=previewAllowed||!sequential||!previousRequired||Boolean(progressMap[previousRequired.id]?.is_completed===true);}
    const enriched=(modules??[]).map((mod:any,index:number)=>{
      const moduleLessons=(lessons??[]).filter((l:any)=>l.module_id===mod.id).sort((a:any,b:any)=>a.position-b.position).map((lesson:any)=>{
        const assessment=assessmentFor("lesson",lesson.id);const passedAttempt=assessment?passedByAssessment[assessment.id]:null;const p=progressMap[lesson.id];
        return {lesson_id:lesson.id,title:lesson.title,position:lesson.position,content_type:lesson.is_external?"external":(lesson.video_url?"video":lesson.audio_url?"audio":"text"),duration_seconds:lesson.cpd_calculated_time_seconds??0,is_free:lesson.is_free_preview===true,is_required:lesson.is_required!==false,is_completed:p?.is_completed??false,time_spent_seconds:p?.time_spent_seconds??0,quiz_passed:!!passedAttempt||!!p?.quiz_passed,is_unlocked:lessonUnlock[lesson.id]!==false,assessment_exists:Boolean(assessment),assessment_required:Boolean(assessment?.required),assessment_passed:Boolean(passedAttempt),is_intro:!!lesson.is_intro,is_module_intro:!!lesson.is_module_intro,is_conclusion:!!lesson.is_conclusion,is_final_exam:!!lesson.is_final_exam,stage_type:lesson.is_intro?"introduction":lesson.is_module_intro?"module_presentation":lesson.is_conclusion?"conclusion":lesson.is_final_exam?"final_exam":(lesson.stage_type||"lesson")};
      });
      const assessment=assessmentFor("module",mod.id);const passedAttempt=assessment?passedByAssessment[assessment.id]:null;const latest=assessment?latestByAssessment[assessment.id]:null;
      const normalLessons=moduleLessons.filter((l:any)=>l.stage_type==='lesson');
      const mandatoryLessons=normalLessons.filter((l:any)=>l.is_required!==false);
      let previousPassed=true;const previous=(modules??[]).slice(0,index).reverse().find((m:any)=>(m.section_type||(m.is_intro?'introduction':m.is_conclusion?'conclusion':m.is_final_exam?'final_exam':'module'))==='module'&&m.is_required!==false);if(previous){const prevLessons=(lessons??[]).filter((l:any)=>l.module_id===previous.id&&l.is_required!==false&&(l.stage_type||(l.is_module_intro?'module_presentation':'lesson'))==='lesson');const prevLessonsPassed=prevLessons.every((l:any)=>Boolean(progressMap[l.id]?.is_completed));const previousAssessment=assessmentFor("module",previous.id);const prevAssessmentPassed=!previousAssessment||previousAssessment.required===false||Boolean(passedByAssessment[previousAssessment.id]);previousPassed=prevLessonsPassed&&prevAssessmentPassed;}
      const moduleCompleted=mandatoryLessons.every((l:any)=>l.is_completed)&&(!assessment||assessment.required===false||Boolean(passedAttempt));
      return {module_id:mod.id,title:mod.title,position:mod.position,description:mod.objective??null,is_required:mod.is_required!==false,lessons:moduleLessons,exam_exists:Boolean(assessment),exam_required:Boolean(assessment?.required),exam_unlocked:previewAllowed||(!!assessment&&mandatoryLessons.length>0&&mandatoryLessons.every((l:any)=>l.is_completed)),exam_passed:!!passedAttempt,exam_score:(passedAttempt?.result_status==="published"?passedAttempt.score:(latest?.result_status==="published"?latest.score:null)),exam_attempts:latest?.attempt_number??0,is_completed:moduleCompleted,is_unlocked:previewAllowed||mod.is_intro||index===0||previousPassed,is_intro:!!mod.is_intro,is_conclusion:!!mod.is_conclusion,is_final_exam:!!mod.is_final_exam,section_type:mod.section_type||(mod.is_intro?"introduction":mod.is_conclusion?"conclusion":mod.is_final_exam?"final_exam":"module")};
    });

    const requiredModules=enriched.filter((m:any)=>(m.section_type||(m.is_intro?'introduction':m.is_conclusion?'conclusion':m.is_final_exam?'final_exam':'module'))==='module'&&m.is_required!==false);const allModulesPassed=requiredModules.every((m:any)=>m.is_completed===true);
    const finalAssessment=(assessments??[]).find((a:any)=>a.scope==="final");const finalRequiredAssessment=finalAssessment?.required!==false?finalAssessment:null;const finalAttempt=finalAssessment?(passedByAssessment[finalAssessment.id]||latestByAssessment[finalAssessment.id]):null;
    const allRequiredLessons=enriched.flatMap((m:any)=>m.lessons.filter((l:any)=>l.is_required!==false&&l.stage_type==='lesson'));const totalLessons=allRequiredLessons.length;const completed=allRequiredLessons.filter((l:any)=>l.is_completed).length;
    const courseCompleted=totalLessons>0&&completed===totalLessons&&allModulesPassed&&(!finalRequiredAssessment||Boolean(passedByAssessment[finalRequiredAssessment.id]));
    if(courseCompleted&&!previewAllowed){try{await sb.rpc("oga_referral_record_event",{p_referred_user_id:userId,p_event_type:"course_completed",p_event_key:`course-completed:${courseId}:${userId}`,p_metadata:{course_id:courseId}})}catch{/* le parrainage ne bloque jamais la progression */}}
    return json({modules:enriched,preview:previewAllowed,preview_mode:previewAllowed?previewMode:null,final_validation_unlocked:previewAllowed||allModulesPassed,final_assessment_exists:Boolean(finalAssessment),final_assessment_required:Boolean(finalAssessment?.required),final_validation:finalAttempt?{status:finalAttempt.result_status==="published"?(finalAttempt.passed?"passed":finalAttempt.status):"pending_review",score:finalAttempt.result_status==="published"?finalAttempt.score:null,validation_type:"assessment"}:null,progress:{total_lessons:totalLessons,completed_lessons:completed,percent:totalLessons?Math.round(completed/totalLessons*100):0}});
  }catch(error){console.error("course-progress",error);return json({error:"SERVER_ERROR",message:(error as Error).message},500);}
});
