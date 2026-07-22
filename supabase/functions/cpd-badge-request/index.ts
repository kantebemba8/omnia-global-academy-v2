import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return json({success:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const b=await req.json();
  const certificateId=String(b.certificate_id||"");
  if(!certificateId)return json({badge_issued:false,error:"CERTIFICATE_ID_REQUIRED"},400);

  const {data:cert,error}=await sb.from("certificates")
   .select("id,omnia_certificate_id,cpd_accredited,cpd_badge_url,cpd_pending")
   .eq("omnia_certificate_id",certificateId).maybeSingle();
  if(error)throw error;
  if(!cert)return json({badge_issued:false,error:"CERTIFICATE_NOT_FOUND"},404);
  if(!cert.cpd_accredited)return json({badge_issued:false,error:"NOT_OPEN_CPD_ELIGIBLE",message:"Ce certificat n’est pas marqué pour le workflow Open CPD."},409);
  if(cert.cpd_badge_url)return json({badge_issued:true,badge_url:cert.cpd_badge_url,pending:false,already_issued:true});

  // Open CPD publicly documents three integration paths:
  // manual CSV, Zapier/Zoho Flow, and a dedicated Auth0 direct API.
  // This project does not contain official account-specific Auth0 credentials or endpoint documentation.
  // Never call a guessed endpoint and never consume a credit without confirmed issuance.
  await sb.from("certificates").update({cpd_pending:true}).eq("id",cert.id);

  return json({
    badge_issued:false,
    pending:true,
    error:"OPEN_CPD_WORKFLOW_REQUIRED",
    message:"Certificat placé en attente Open CPD. Utilisez votre workflow Open CPD officiel (manuel/CSV, Zapier/Zoho ou API directe configurée). Aucun crédit n’a été consommé."
  },202);
 }catch(e){return json({badge_issued:false,error:"SERVER_ERROR",message:(e as Error).message},500)}
});
