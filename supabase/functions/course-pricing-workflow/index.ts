import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Client-Info,Apikey",
};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});

async function auth(sb:any,token:string){
  const {data:s}=await sb.from("user_sessions").select("user_id").eq("session_token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!s)return null;
  const {data:roles}=await sb.from("user_roles").select("role").eq("user_id",s.user_id);
  return {user_id:s.user_id,roles:(roles||[]).map((r:any)=>r.role)};
}
async function notify(sb:any,user_id:string,title:string,message:string){
  try{await sb.from("notifications").insert({user_id,title,message,type:"course_pricing",is_read:false});}catch{/* table may differ */}
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
  const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({error:"AUTH_REQUIRED"},401);
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const me=await auth(sb,token); if(!me)return json({error:"SESSION_INVALID"},401);

    if(req.method==="GET"){
      if(me.roles.includes("super_admin")){
        const {data,error}=await sb.from("courses")
          .select("id,title,instructor_id,status,pricing_status,score_calcule,prix_provisoire_xof,desired_price_amount,admin_selected_price_source,admin_selected_price_xof,pricing_snapshot,pricing_revision_comment,updated_at")
          .in("pricing_status",["en_attente_validation_prix_admin","prix_revision_demandee"])
          .order("updated_at",{ascending:true});
        if(error)throw error; return json({courses:data||[]});
      }
      const {data,error}=await sb.from("courses")
        .select("id,title,status,pricing_status,score_calcule,prix_provisoire_xof,desired_price_amount,admin_selected_price_source,admin_selected_price_xof,pricing_snapshot,pricing_revision_comment,updated_at")
        .eq("instructor_id",me.user_id)
        .in("pricing_status",["en_attente_validation_prix_admin","en_attente_acceptation_prix_professeur","prix_revision_demandee"])
        .order("updated_at",{ascending:false});
      if(error)throw error; return json({courses:data||[]});
    }

    const b=await req.json();
    if(!b.course_id||!b.action)return json({error:"INVALID_PARAMS"},400);
    const {data:course}=await sb.from("courses")
      .select("id,title,instructor_id,prix_provisoire_xof,desired_price_amount,pricing_status")
      .eq("id",b.course_id).maybeSingle();
    if(!course)return json({error:"COURSE_NOT_FOUND"},404);

    if(b.action==="admin_decide"){
      if(!me.roles.includes("super_admin"))return json({error:"FORBIDDEN"},403);
      if(!["automatic","professor"].includes(b.source))return json({error:"INVALID_SOURCE"},400);
      const selected=b.source==="automatic"?Number(course.prix_provisoire_xof||0):Number(course.desired_price_amount||0);
      if(selected<=0)return json({error:"INVALID_PRICE"},400);
      await sb.from("courses").update({
        pricing_status:"en_attente_acceptation_prix_professeur",
        status:"en_attente_acceptation_prix_professeur",
        admin_selected_price_source:b.source,
        admin_selected_price_xof:selected,
        pricing_admin_decided_at:new Date().toISOString(),
        pricing_admin_decided_by:me.user_id,
        pricing_revision_comment:b.comment||null,
      }).eq("id",b.course_id);
      await notify(sb,course.instructor_id,"Tarification de votre formation",`Omnia a retenu un prix de ${selected.toLocaleString("fr-FR")} XOF. Votre validation est requise avant soumission.`);
      return json({success:true,selected_price_xof:selected});
    }

    if(course.instructor_id!==me.user_id&&!me.roles.includes("super_admin"))return json({error:"FORBIDDEN"},403);

    if(b.action==="professor_accept"){
      if(course.pricing_status!=="en_attente_acceptation_prix_professeur")return json({error:"INVALID_STATUS"},409);
      const {data:updated,error}=await sb.from("courses").update({
        pricing_status:"accepted",
        professor_price_accepted:true,
        professor_price_accepted_at:new Date().toISOString(),
        price_xof:b.selected_price_xof||undefined,
        status:"en_attente_validation_manuelle",
        updated_at:new Date().toISOString(),
      }).eq("id",b.course_id).select("admin_selected_price_xof").single();
      if(error)throw error;
      if(updated?.admin_selected_price_xof){
        await sb.from("courses").update({price_xof:updated.admin_selected_price_xof}).eq("id",b.course_id);
      }
      return json({success:true,status:"en_attente_validation_manuelle"});
    }

    if(b.action==="professor_revision"){
      await sb.from("courses").update({
        pricing_status:"prix_revision_demandee",
        status:"prix_revision_demandee",
        pricing_revision_comment:b.comment||"Révision demandée par le professeur",
        desired_price_amount:b.desired_price_amount==null?course.desired_price_amount:Number(b.desired_price_amount),
        updated_at:new Date().toISOString(),
      }).eq("id",b.course_id);
      return json({success:true,status:"prix_revision_demandee"});
    }
    return json({error:"UNKNOWN_ACTION"},400);
  }catch(e){console.error(e);return json({error:"SERVER_ERROR"},500);}
});
