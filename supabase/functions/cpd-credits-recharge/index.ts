import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-omnia-session-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

async function verifyAdmin(sb:any,req:Request){
 const token=(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return null;
 const {data:s}=await sb.from("user_sessions").select("user_id").eq("session_token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(!s)return null;
 const {data:r}=await sb.from("user_roles").select("role").eq("user_id",s.user_id).eq("role","super_admin").maybeSingle();
 return r?s.user_id:null;
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const uid=await verifyAdmin(sb,req); if(!uid)return json({success:false,error:"FORBIDDEN"},403);

  if(req.method==="GET"){
   let {data:credit}=await sb.from("cpd_credits").select("*").order("updated_at",{ascending:false}).limit(1).maybeSingle();
   if(!credit){
    const ins=await sb.from("cpd_credits").insert({total_credits:0,used_credits:0}).select("*").single();
    if(ins.error)throw ins.error; credit=ins.data;
   }
   const {data:pending}=await sb.from("certificates")
    .select("id,student_full_name,course_title,issued_at,omnia_certificate_id")
    .eq("cpd_pending",true).eq("cpd_accredited",true).order("issued_at",{ascending:false}).limit(100);
   const {data:history}=await sb.from("cpd_credit_transactions")
    .select("id,credits_added,created_at,operator_name").order("created_at",{ascending:false}).limit(30);
   return json({success:true,credits:{
     total_credits:Number(credit?.total_credits||0),
     used_credits:Number(credit?.used_credits||0),
     available_credits:Math.max(0,Number(credit?.total_credits||0)-Number(credit?.used_credits||0))
   },pending:pending||[],history:history||[],integration:{
     provider:"Open CPD",
     direct_api_enabled:false,
     note:"Configurez uniquement une intégration directe à partir des identifiants et de la documentation API fournis officiellement par Open CPD."
   }});
  }

  if(req.method!=="POST")return json({success:false,error:"METHOD_NOT_ALLOWED"},405);
  const b=await req.json();const add=Number(b.credits_to_add);
  if(!Number.isInteger(add)||add<=0)return json({success:false,error:"INVALID_AMOUNT",message:"Le nombre de crédits doit être un entier positif."},400);

  let {data:credit}=await sb.from("cpd_credits").select("*").order("updated_at",{ascending:false}).limit(1).maybeSingle();
  if(!credit){
   const ins=await sb.from("cpd_credits").insert({total_credits:0,used_credits:0}).select("*").single();
   if(ins.error)throw ins.error; credit=ins.data;
  }
  const newTotal=Number(credit.total_credits||0)+add;
  const {error:updateError}=await sb.from("cpd_credits").update({
    total_credits:newTotal,last_recharged_at:new Date().toISOString(),last_recharged_by:uid,updated_at:new Date().toISOString()
  }).eq("id",credit.id);
  if(updateError)throw updateError;

  const {data:u}=await sb.from("users").select("full_name,email").eq("id",uid).maybeSingle();
  const {error:historyError}=await sb.from("cpd_credit_transactions").insert({
    credits_added:add,created_by:uid,operator_name:u?.full_name||u?.email||"Super-admin"
  });
  if(historyError)throw historyError;

  // IMPORTANT: adding credits does NOT automatically call a guessed Open CPD endpoint.
  // Pending certificates remain pending until an official workflow (manual, Zapier/Zoho, or direct API) confirms issuance.
  return json({success:true,credits_added:add,new_total:newTotal});
 }catch(e){return json({success:false,error:"SERVER_ERROR",message:(e as Error).message},500)}
});
