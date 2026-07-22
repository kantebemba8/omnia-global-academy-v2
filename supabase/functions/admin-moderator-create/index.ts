import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization,X-Client-Info,Apikey,x-omnia-session-token"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function admin(sb:any,req:Request){
 const token=(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return null;
 const {data:s}=await sb.from("user_sessions").select("user_id").eq("session_token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(!s)return null;
 const {data:r}=await sb.from("user_roles").select("role").eq("user_id",s.user_id).eq("role","super_admin").maybeSingle();
 return r?s.user_id:null;
}
async function sha256(str:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function password(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";return Array.from({length:14},()=>chars[Math.floor(Math.random()*chars.length)]).join("")}
const ALLOWED=[
"can_see_pending_courses","can_review_course_content","can_request_course_modification","can_recommend_course_price","can_approve_transmit_course","can_manage_course_certifications","can_create_assisted_course",
"can_see_learners_list","can_see_professors_list","can_see_structures_list","can_see_organizers_list","can_validate_professor_kyc","can_validate_structure_kyc","can_request_account_suspension",
"can_moderate_forum","can_moderate_jobs","can_manage_support","can_view_ai_conversations","can_manage_reports",
"can_review_live_events","can_review_live_reports","can_review_live_refunds","can_review_live_organizers",
"can_review_structure_requests","can_review_structure_codes","can_review_structure_benefits","can_view_analytics"
];
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 try{
  const adminId=await admin(sb,req);if(!adminId)return json({error:"FORBIDDEN"},403);
  if(req.method==="GET"){
   const {data:roles,error:e1}=await sb.from("user_roles").select("user_id").in("role",["moderateur","moderator"]);if(e1)throw e1;
   const ids=[...new Set((roles||[]).map((x:any)=>x.user_id))];if(!ids.length)return json({moderators:[]});
   const {data:users,error:e2}=await sb.from("users").select("id,full_name,email,status,created_at").in("id",ids);if(e2)throw e2;
   const {data:perms}=await sb.from("moderator_permissions").select("*").in("moderator_user_id",ids);
   const map=new Map((perms||[]).map((p:any)=>[p.moderator_user_id,p]));
   return json({moderators:(users||[]).map((u:any)=>({...u,permissions:map.get(u.id)?.permissions||Object.fromEntries(ALLOWED.map(k=>[k,!!map.get(u.id)?.[k]]))}))});
  }
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  const b=await req.json();if(!String(b.full_name||"").trim()||!String(b.email||"").trim())return json({error:"INVALID_PARAMS"},400);
  const {data:existing}=await sb.from("users").select("id").ilike("email",String(b.email).trim()).maybeSingle();if(existing)return json({error:"EMAIL_TAKEN"},409);
  const temp=password();const {data:u,error}=await sb.from("users").insert({full_name:String(b.full_name).trim(),email:String(b.email).trim().toLowerCase(),phone_number:b.phone_number||null,password_hash:await sha256(temp),status:"actif",force_password_change:true}).select("id").single();if(error)throw error;
  await sb.from("user_roles").insert({user_id:u.id,role:"moderateur"});
  const safe:any={};for(const k of ALLOWED)safe[k]=!!b.permissions?.[k];
  await sb.from("moderator_permissions").upsert({moderator_user_id:u.id,permissions:safe,permission_version:2},{onConflict:"moderator_user_id"});
  return json({success:true,moderator_id:u.id,temporary_password:temp});
 }catch(e){console.error(e);return json({error:"SERVER_ERROR",message:(e as Error).message},500)}
});