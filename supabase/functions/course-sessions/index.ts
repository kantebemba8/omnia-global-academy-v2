
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { notifyUser } from "../_shared/notifications.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validatedStructureAccess, hasStructurePermission } from "../_shared/structure-access.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const token=(req:Request)=>(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
const sb=()=>createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");

async function sessionUser(db:any,req:Request){
 const t=token(req); if(!t)return null;
 const {data}=await getActiveOmniaSessionResult(db,t); return data?.user_id?String(data.user_id):null;
}
async function canManage(db:any,userId:string,courseId:string){
 const {data:roles}=await db.from("user_roles").select("role").eq("user_id",userId);
 if((roles||[]).some((r:any)=>String(r.role)==="super_admin"))return true;
 const {data:c}=await db.from("courses").select("creator_id,structure_id").eq("id",courseId).maybeSingle();
 if(!c)return false;
 if(String(c.creator_id||"")===userId)return true;
 if(c.structure_id){
   const access=await validatedStructureAccess(db,userId,String(c.structure_id));
   if(access && (hasStructurePermission(access,"can_edit_courses") || hasStructurePermission(access,"can_create_courses")))return true;
 }
 return false;
}
async function publicRows(db:any,courseId:string){
 const {data:sessions,error}=await db.from("course_training_sessions").select("*").eq("course_id",courseId)
  .in("status",["published","registration_open","full","completed"]).order("starts_at");
 if(error)throw error;
 const ids=(sessions||[]).map((s:any)=>s.id);
 const {data:days}=ids.length?await db.from("course_training_session_days").select("*").in("session_id",ids).order("day_no"):{data:[]};
 const {data:regs}=ids.length?await db.from("course_training_registrations").select("session_id,status").in("session_id",ids).in("status",["registered","paid","attended","completed"]):{data:[]};
 return (sessions||[]).map((s:any)=>{
   const count=(regs||[]).filter((r:any)=>r.session_id===s.id).length;
   return {...s,days:(days||[]).filter((d:any)=>d.session_id===s.id),registered_count:count,places_remaining:s.capacity==null?null:Math.max(0,Number(s.capacity)-count)};
 });
}

async function issueCredential(db:any,reg:any,session:any,course:any,attendancePercent:number){
 const existing=await db.from("course_training_credentials").select("*").eq("registration_id",reg.id).maybeSingle();if(existing.data)return existing.data;
 const code=`PTS-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase()}`;
 const verify=crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase();
 const {data:user}=await db.from("users").select("full_name,email").eq("id",reg.user_id).maybeSingle();
 const pdf=await PDFDocument.create();const page=pdf.addPage([841.89,595.28]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 page.drawRectangle({x:16,y:16,width:809,height:563,borderColor:rgb(.75,.53,.07),borderWidth:3});
 page.drawText("OMNIA GLOBAL ACADEMY",{x:55,y:520,size:20,font:bold,color:rgb(0,.125,.314)});
 page.drawText("CERTIFICAT DE FORMATION PRESENTIELLE",{x:55,y:460,size:24,font:bold,color:rgb(.75,.53,.07)});
 page.drawText("Certifie que",{x:55,y:410,size:14,font:regular});
 page.drawText(String(user?.full_name||user?.email||"Participant"),{x:55,y:365,size:24,font:bold,color:rgb(0,.125,.314)});
 page.drawText(`a suivi avec succes : ${String(course?.title||"Formation")}`.slice(0,95),{x:55,y:320,size:14,font:regular});
 page.drawText(`Session : ${String(session.title||"")}`.slice(0,100),{x:55,y:285,size:12,font:regular});
 page.drawText(`Presence validee : ${attendancePercent.toFixed(1)} %`,{x:55,y:255,size:12,font:regular});
 page.drawText(`Identifiant : ${code}`,{x:55,y:100,size:10,font:regular});page.drawText(`Verification : ${verify}`,{x:55,y:80,size:10,font:regular});
 const bytes=await pdf.save();const path=`presentiel/${reg.user_id}/${code}.pdf`;const up=await db.storage.from("certificates").upload(path,bytes,{contentType:"application/pdf",upsert:false});if(up.error)throw up.error;
 const {data:cred,error}=await db.from("course_training_credentials").insert({registration_id:reg.id,user_id:reg.user_id,course_id:reg.course_id,session_id:reg.session_id,credential_type:"completion",credential_number:code,verification_code:verify,attendance_percent:attendancePercent,pdf_storage_path:path}).select("*").single();if(error)throw error;return cred;
}

async function sendRegistrationNotice(db:any,userId:string,courseTitle:string,session:any){
 await notifyUser({userId,sb:db,emailConfig:{templateId:4,from:"formation@omniaglobalacademy.com",params:{
   ROLE_NAME:"Participant",MESSAGE_SPECIFIQUE:`Votre inscription à « ${courseTitle} » est confirmée pour le ${new Date(session.starts_at).toLocaleString("fr-FR")}. ${session.venue||""} ${session.city||""}`.trim(),
   DASHBOARD_URL:`${Deno.env.get("APP_URL")||"https://omniaglobalacademy.com"}/dashboard/mes-cours`
 }}});
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
 const db=sb(),url=new URL(req.url);
 try{
  if(req.method==="GET"){
    const verifyCode=url.searchParams.get("verify")||"";
    if(verifyCode){const {data}=await db.from("course_training_credentials").select("credential_number,verification_code,attendance_percent,issued_at,status,courses(title),course_training_sessions(title,starts_at,ends_at,city,venue),users(full_name)").eq("verification_code",verifyCode).maybeSingle();return data?json({success:true,credential:data}):json({success:false,error:"CREDENTIAL_NOT_FOUND"},404)}
    const courseId=url.searchParams.get("course_id")||"";
    if(!courseId)return json({success:false,error:"COURSE_ID_REQUIRED"},400);
    return json({success:true,sessions:await publicRows(db,courseId)});
  }
  if(req.method!=="POST")return json({success:false,error:"METHOD_NOT_ALLOWED"},405);
  const b=await req.json().catch(()=>({})); const action=String(b.action||""); const userId=await sessionUser(db,req);
  if(!userId)return json({success:false,error:"AUTH_REQUIRED"},401);


  if(action==="set_course_mode"){
    const courseId=String(b.course_id||"");if(!courseId||!await canManage(db,userId,courseId))return json({success:false,error:"FORBIDDEN"},403);
    const mode=["online","in_person","hybrid"].includes(String(b.training_delivery_mode))?String(b.training_delivery_mode):"online";
    const {error}=await db.from("courses").update({training_delivery_mode:mode}).eq("id",courseId);if(error)throw error;
    return json({success:true,training_delivery_mode:mode});
  }

  if(action==="list_manage"){
    if(!await canManage(db,userId,String(b.course_id||"")))return json({success:false,error:"FORBIDDEN"},403);
    const {data,error}=await db.from("course_training_sessions").select("*").eq("course_id",b.course_id).order("starts_at");if(error)throw error;
    const ids=(data||[]).map((x:any)=>x.id);
    const {data:days}=ids.length?await db.from("course_training_session_days").select("*").in("session_id",ids).order("day_no"):{data:[]};
    const {data:regs}=ids.length?await db.from("course_training_registrations").select("*,users(full_name,email)").in("session_id",ids).order("registered_at"):{data:[]};
    return json({success:true,sessions:(data||[]).map((s:any)=>({...s,days:(days||[]).filter((d:any)=>d.session_id===s.id),registrations:(regs||[]).filter((r:any)=>r.session_id===s.id)}))});
  }

  if(action==="create_session"||action==="update_session"){
    const courseId=String(b.course_id||"");if(!courseId||!await canManage(db,userId,courseId))return json({success:false,error:"FORBIDDEN"},403);
    const row:any={course_id:courseId,title:String(b.title||"Session présentielle").trim(),delivery_mode:b.delivery_mode==="hybrid"?"hybrid":"in_person",
      starts_at:b.starts_at,ends_at:b.ends_at,timezone:b.timezone||"UTC",registration_deadline:b.registration_deadline||null,country:b.country||null,city:b.city||null,venue:b.venue||null,address:b.address||null,
      access_instructions:b.access_instructions||null,capacity:b.capacity?Number(b.capacity):null,price_xof:Math.max(0,Number(b.price_xof||0)),is_free:Number(b.price_xof||0)<=0,
      certificate_enabled:b.certificate_enabled===true,minimum_attendance_percent:Number(b.minimum_attendance_percent??80),assessment_required:b.assessment_required===true,organizer_id:userId,updated_at:new Date().toISOString()};
    let session:any;
    if(action==="create_session"){const r=await db.from("course_training_sessions").insert({...row,created_by:userId}).select("*").single();if(r.error)throw r.error;session=r.data}
    else {const id=String(b.session_id||"");const r=await db.from("course_training_sessions").update(row).eq("id",id).eq("course_id",courseId).select("*").single();if(r.error)throw r.error;session=r.data}
    await db.from("courses").update({training_delivery_mode:row.delivery_mode==="hybrid"?"hybrid":"in_person"}).eq("id",courseId);
    if(Array.isArray(b.days)){
      await db.from("course_training_session_days").delete().eq("session_id",session.id);
      const days=b.days.filter((d:any)=>d.starts_at&&d.ends_at).map((d:any,i:number)=>({session_id:session.id,day_no:i+1,label:d.label||`Jour ${i+1}`,starts_at:d.starts_at,ends_at:d.ends_at}));
      if(days.length){const er=await db.from("course_training_session_days").insert(days);if(er.error)throw er.error}
    }
    return json({success:true,session});
  }

  if(["publish_session","cancel_session","complete_session"].includes(action)){
    const id=String(b.session_id||"");const {data:s}=await db.from("course_training_sessions").select("*").eq("id",id).maybeSingle();
    if(!s||!await canManage(db,userId,s.course_id))return json({success:false,error:"FORBIDDEN"},403);
    if(action==="publish_session"){
      const {error}=await db.from("course_training_sessions").update({status:"registration_open",published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error;return json({success:true});
    }
    if(action==="cancel_session"){
      const {error}=await db.from("course_training_sessions").update({status:"cancelled",cancelled_at:new Date().toISOString(),cancellation_reason:String(b.reason||""),updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error;return json({success:true});
    }
    const [{data:days},{data:regs},{data:course}]=await Promise.all([
      db.from("course_training_session_days").select("id").eq("session_id",id),
      db.from("course_training_registrations").select("*").eq("session_id",id).in("status",["registered","paid","attended"]),
      db.from("courses").select("id,title").eq("id",s.course_id).maybeSingle()
    ]);
    const dayIds=(days||[]).map((d:any)=>d.id);let issued=0;
    for(const reg of regs||[]){
      const {data:att}=dayIds.length?await db.from("course_training_attendance").select("status").eq("registration_id",reg.id).in("session_day_id",dayIds):{data:[]};
      const present=(att||[]).filter((a:any)=>["present","late"].includes(String(a.status))).length;
      const pct=dayIds.length?Math.round((present/dayIds.length)*10000)/100:100;
      const assessmentOk=!s.assessment_required||reg.assessment_passed===true;
      const eligible=pct>=Number(s.minimum_attendance_percent||0)&&assessmentOk;
      await db.from("course_training_registrations").update({status:eligible?"completed":"no_show",completed_at:eligible?new Date().toISOString():null,metadata:{...(reg.metadata||{}),attendance_percent:pct}}).eq("id",reg.id);
      if(eligible&&s.certificate_enabled){await issueCredential(db,reg,s,course,pct);issued++}
    }
    await db.from("course_training_sessions").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",id);
    return json({success:true,credentials_issued:issued});
  }

  if(action==="register"){
    const sessionId=String(b.session_id||"");const {data:s}=await db.from("course_training_sessions").select("*,courses(title,is_published)").eq("id",sessionId).maybeSingle();
    if(!s||s.courses?.is_published!==true||!["published","registration_open"].includes(String(s.status)))return json({success:false,error:"SESSION_NOT_OPEN"},409);
    if(s.registration_deadline&&new Date(s.registration_deadline).getTime()<Date.now())return json({success:false,error:"REGISTRATION_CLOSED"},409);
    const {data:existing}=await db.from("course_training_registrations").select("*").eq("session_id",sessionId).eq("user_id",userId).maybeSingle();
    if(existing&&!["cancelled","waitlisted"].includes(existing.status))return json({success:true,registration:existing,existing:true});
    const {count}=await db.from("course_training_registrations").select("id",{count:"exact",head:true}).eq("session_id",sessionId).in("status",["registered","paid","attended","completed"]);
    const full=s.capacity!=null&&Number(count||0)>=Number(s.capacity);
    const status=full?"waitlisted":s.is_free?"registered":"payment_pending";
    const payment_status=s.is_free?"free":"pending";
    const payload={session_id:sessionId,course_id:s.course_id,user_id:userId,status,payment_status,registered_at:new Date().toISOString()};
    const q=existing?db.from("course_training_registrations").update(payload).eq("id",existing.id):db.from("course_training_registrations").insert(payload);
    const {data:reg,error}=await q.select("*").single();if(error)throw error;
    if(!full&&s.is_free)await sendRegistrationNotice(db,userId,s.courses?.title||"Formation",s).catch(()=>{});
    return json({success:true,registration:reg,waitlisted:full,payment_required:!full&&!s.is_free});
  }

  if(action==="cancel_registration"){
    const {error}=await db.from("course_training_registrations").update({status:"cancelled",cancelled_at:new Date().toISOString()}).eq("session_id",b.session_id).eq("user_id",userId);if(error)throw error;
    return json({success:true});
  }


  if(action==="assessment_mark"){
    const {data:reg}=await db.from("course_training_registrations").select("id,course_id").eq("id",b.registration_id).maybeSingle();
    if(!reg||!await canManage(db,userId,reg.course_id))return json({success:false,error:"FORBIDDEN"},403);
    const {error}=await db.from("course_training_registrations").update({assessment_passed:b.passed===true}).eq("id",reg.id);if(error)throw error;return json({success:true});
  }

  if(action==="attendance_mark"){
    const {data:reg}=await db.from("course_training_registrations").select("id,course_id,session_id").eq("id",b.registration_id).maybeSingle();
    if(!reg||!await canManage(db,userId,reg.course_id))return json({success:false,error:"FORBIDDEN"},403);
    const row={registration_id:reg.id,session_day_id:b.session_day_id,status:b.status||"present",checked_in_at:["present","late"].includes(b.status||"present")?new Date().toISOString():null,method:b.method||"manual",validated_by:userId,notes:b.notes||null,updated_at:new Date().toISOString()};
    const {data:existing}=await db.from("course_training_attendance").select("id").eq("registration_id",reg.id).eq("session_day_id",b.session_day_id).maybeSingle();
    const q=existing?db.from("course_training_attendance").update(row).eq("id",existing.id):db.from("course_training_attendance").insert(row);
    const {error}=await q;if(error)throw error;return json({success:true});
  }

  if(action==="generate_qr"){
    const {data:day}=await db.from("course_training_session_days").select("id,session_id,course_training_sessions(course_id)").eq("id",b.session_day_id).maybeSingle();
    const courseId=day?.course_training_sessions?.course_id;if(!courseId||!await canManage(db,userId,courseId))return json({success:false,error:"FORBIDDEN"},403);
    const value=crypto.randomUUID().replaceAll("-","");const validFrom=new Date(Date.now()-15*60_000).toISOString(),validUntil=new Date(Date.now()+18*60*60_000).toISOString();
    await db.from("course_training_qr_tokens").insert({session_day_id:day.id,token:value,valid_from:validFrom,valid_until:validUntil,created_by:userId});
    return json({success:true,token:value,valid_from:validFrom,valid_until:validUntil});
  }

  if(action==="qr_check_in"){
    const {data:q}=await db.from("course_training_qr_tokens").select("*,course_training_session_days(session_id)").eq("token",String(b.token||"")).maybeSingle();
    if(!q||Date.now()<new Date(q.valid_from).getTime()||Date.now()>new Date(q.valid_until).getTime())return json({success:false,error:"QR_INVALID_OR_EXPIRED"},409);
    const sessionId=q.course_training_session_days?.session_id;
    const {data:reg}=await db.from("course_training_registrations").select("id").eq("session_id",sessionId).eq("user_id",userId).in("status",["registered","paid"]).maybeSingle();
    if(!reg)return json({success:false,error:"REGISTRATION_REQUIRED"},403);
    const row={registration_id:reg.id,session_day_id:q.session_day_id,status:"present",checked_in_at:new Date().toISOString(),method:"qr",validated_by:userId,updated_at:new Date().toISOString()};
    const {data:e}=await db.from("course_training_attendance").select("id").eq("registration_id",reg.id).eq("session_day_id",q.session_day_id).maybeSingle();
    const z=e?db.from("course_training_attendance").update(row).eq("id",e.id):db.from("course_training_attendance").insert(row);const {error}=await z;if(error)throw error;
    return json({success:true});
  }

  return json({success:false,error:"UNKNOWN_ACTION"},400);
 }catch(e){console.error("course-sessions",e);return json({success:false,error:e instanceof Error?e.message:"SERVER_ERROR"},500)}
});
