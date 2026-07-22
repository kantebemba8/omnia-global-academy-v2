import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,x-omnia-session-token,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

async function ctx(sb:any,req:Request){
  const token=(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"")
    .replace(/^Bearer\s+/i,"").trim();
  if(!token)return null;
  const {data:session}=await sb.from("user_sessions").select("user_id")
    .eq("session_token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!session)return null;
  const {data:roles}=await sb.from("user_roles").select("role").eq("user_id",session.user_id);
  return {user_id:session.user_id,roles:(roles||[]).map((r:any)=>r.role)};
}
const isAdmin=(c:any)=>c?.roles?.includes("super_admin");

async function uploadBase64(sb:any,folder:string,filename:string,mime:string,dataUrl:string){
  const base64=dataUrl.includes(",")?dataUrl.split(",")[1]:dataUrl;
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const path=`${folder}/${crypto.randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const {error}=await sb.storage.from("certificates").upload(path,bytes,{contentType:mime,upsert:false});
  if(error)throw error;
  return sb.storage.from("certificates").getPublicUrl(path).data.publicUrl;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try{
    const url=new URL(req.url);
    const action=url.searchParams.get("action")||"";
    if(req.method==="GET" && action==="public_settings"){
      const {data}=await sb.from("certificate_settings").select("key,value");
      const out:any={};for(const r of data||[])out[r.key]=r.value;
      return json({success:true,settings:out});
    }

    const c=await ctx(sb,req);
    if(!c)return json({success:false,error:"AUTH_REQUIRED"},401);

    if(req.method==="GET" && action==="list"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const {data,error}=await sb.from("certificate_registry_unified")
        .select("*")
        .order("issued_at",{ascending:false});
      if(error)throw error;
      return json({success:true,certificates:data||[]});
    }

    if(req.method==="GET" && action==="templates"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const {data,error}=await sb.from("certificate_templates").select("*").order("created_at");
      if(error)throw error;return json({success:true,templates:data||[]});
    }

    if(req.method==="GET" && action==="settings"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const {data,error}=await sb.from("certificate_settings").select("key,value");
      if(error)throw error;const settings:any={};for(const r of data||[])settings[r.key]=r.value;
      return json({success:true,settings});
    }

    if(req.method!=="POST")return json({success:false,error:"METHOD_NOT_ALLOWED"},405);
    const b=await req.json();
    const a=String(b.action||"");

    if(a==="save_settings"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const entries=Object.entries(b.settings||{});
      for(const [key,value] of entries){
        await sb.from("certificate_settings").upsert({
          key,value:String(value??""),updated_at:new Date().toISOString(),updated_by:c.user_id
        },{onConflict:"key"});
      }
      return json({success:true});
    }

    if(a==="save_template"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const t=b.template||{};
      if(!String(t.name||"").trim())return json({success:false,error:"NAME_REQUIRED"},400);
      const code=String(t.code||t.name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
      const payload={
        name:String(t.name).trim(),code,
        document_type:t.document_type||"completion_certificate",
        source_type:t.source_type||"course",
        issuer_scope:t.issuer_scope||"platform",
        language_code:t.language_code||"fr",
        is_default:Boolean(t.is_default),is_active:t.is_active!==false,
        layout_json:t.layout_json||{},
        updated_at:new Date().toISOString(),
        created_by:c.user_id
      };
      if(t.id){
        const {data,error}=await sb.from("certificate_templates").update(payload).eq("id",t.id).select("*").single();
        if(error)throw error;return json({success:true,template:data});
      }
      const {data,error}=await sb.from("certificate_templates").insert(payload).select("*").single();
      if(error)throw error;return json({success:true,template:data});
    }

    if(a==="upload_asset"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const url=await uploadBase64(sb,"admin-assets",String(b.filename||"asset.png"),String(b.mime||"image/png"),String(b.data_url||""));
      return json({success:true,url});
    }

    if(a==="upload_my_signature"){
      const allowed=c.roles.some((r:string)=>["professeur","responsable_structure","gestionnaire_partenaire"].includes(r));
      if(!allowed)return json({success:false,error:"FORBIDDEN"},403);
      const url=await uploadBase64(sb,"signatures",String(b.filename||"signature.png"),String(b.mime||"image/png"),String(b.data_url||""));
      if(c.roles.includes("professeur")){
        await sb.from("professeur_profiles").upsert({user_id:c.user_id,signature_url:url},{onConflict:"user_id"});
      }
      return json({success:true,url});
    }

    if(a==="revoke"){
      if(!isAdmin(c))return json({success:false,error:"FORBIDDEN"},403);
      const source=String(b.registry_source||"");
      const sourceRecordId=String(b.source_record_id||"");
      const reason=String(b.reason||"").trim();
      if(!source||!sourceRecordId||!reason)return json({success:false,error:"MISSING_FIELDS"},400);

      if(source==="omnia_live"){
        const {error}=await sb.from("live_issued_documents").update({
          status:"revoked",
          revocation_reason:reason,
          revoked_at:new Date().toISOString(),
          revoked_by:c.user_id
        }).eq("id",sourceRecordId);
        if(error)throw error;
        await sb.from("live_document_audit_log").insert({
          document_id:sourceRecordId,
          actor_user_id:c.user_id,
          action:"revoked",
          metadata:{reason}
        });
        return json({success:true});
      }

      const {error}=await sb.from("certificates").update({
        status:"revoked",
        validity_status:"revoked",
        revocation_reason:reason,
        revoked_at:new Date().toISOString(),
        revoked_by:c.user_id
      }).eq("id",sourceRecordId);
      if(error)throw error;
      return json({success:true});
    }

    return json({success:false,error:"UNKNOWN_ACTION"},400);
  }catch(e){return json({success:false,error:"SERVER_ERROR",message:(e as Error).message},500)}
});
