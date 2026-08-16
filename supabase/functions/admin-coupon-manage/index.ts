import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function admin(sb:any,token:string){const{data:s}=await getActiveOmniaSessionResult(sb,token);if(!s)return null;const{data:r}=await sb.from("user_roles").select("role").eq("user_id",s.user_id).eq("role","super_admin").maybeSingle();return r?s.user_id:null}
function code(){return `OGA-${crypto.randomUUID().slice(0,8).toUpperCase()}`}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
 const token=(req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return json({error:"AUTH_REQUIRED"},401);
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
  const adminId=await admin(sb,token);if(!adminId)return json({error:"FORBIDDEN"},403);
  if(req.method==="GET"){
   const[{data:coupons,error},{data:assignments,error:aerr}]=await Promise.all([
    sb.from("coupons").select("*").order("created_at",{ascending:false}),
    sb.from("coupon_recipient_assignments").select("*").order("created_at",{ascending:false}).limit(1000)
   ]);if(error)throw error;if(aerr)throw aerr;
   return json({coupons:coupons||[],assignments:assignments||[]});
  }
  const b=await req.json().catch(()=>({}));
  if(b.action==="create"){
   const c=b.coupon_data||{};const dtype=String(c.discount_type||"percentage");
   const value=Number(c.discount_value||0);if(!["percentage","fixed_xof"].includes(dtype)||value<0)return json({error:"INVALID_DISCOUNT"},400);
   if(dtype==="percentage"&&value>100)return json({error:"INVALID_PERCENT"},400);
   if(c.applicable_to==="course"&&!c.applicable_id)return json({error:"COURSE_REQUIRED"},400);
   if(c.applicable_to==="category"&&!c.applicable_id)return json({error:"CATEGORY_REQUIRED"},400);
   const generated=String(c.code||"").trim()==="";
   let couponCode=String(c.code||code()).trim().toUpperCase();
   for(let i=0;i<5;i++){const{data:x}=await sb.from("coupons").select("id").eq("code",couponCode).maybeSingle();if(!x)break;couponCode=code()}
   const emails=[...new Set((Array.isArray(c.recipient_emails)?c.recipient_emails:[]).map((x:unknown)=>String(x).trim().toLowerCase()).filter((x:string)=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))];
   const requestedMax=c.max_uses?Number(c.max_uses):null;
   const effectiveMax=(c.distribution_mode==="targeted_email"&&emails.length) ? Math.max(emails.length,requestedMax||0) : requestedMax;
   const payload={
    code:couponCode,name:String(c.name||"").trim()||null,discount_type:dtype,discount_value:value,
    max_uses:effectiveMax,applicable_to:c.applicable_to||"all",applicable_id:c.applicable_id||null,
    starts_at:c.starts_at||null,expires_at:c.expires_at||null,is_active:c.is_active!==false,distribution_mode:c.distribution_mode||"private",
    message:String(c.message||"").trim()||null,generated_code:generated,created_by:adminId
   };
   const{data:created,error}=await sb.from("coupons").insert(payload).select("*").single();if(error)throw error;
   const assigned=[];
   if(emails.length){
    for(const email of emails){
     const{data:u}=await sb.from("users").select("id,full_name,email").eq("email",email).maybeSingle();
     const{data:a,error:ae}=await sb.from("coupon_recipient_assignments").insert({coupon_id:created.id,recipient_email:email,user_id:u?.id||null,created_by:adminId}).select("*").single();if(ae)throw ae;
     assigned.push(a);
     if(c.send_now===true){
      const app=(Deno.env.get("APP_URL")||"https://omniaglobalacademy.com").replace(/\/$/,"");
      const delivered=await sendOmniaEmail({to:{email,name:u?.full_name||undefined},templateKey:"status_update",params:{
       SUBJECT:String(c.email_subject||"Un avantage Omnia Global Academy vous a été attribué"),
       STATUS_LABEL:value===100&&dtype==="percentage"?"Accès gratuit":"Coupon attribué",
       MESSAGE:String(c.message||"Un avantage personnel vous a été attribué par Omnia Global Academy."),
       ADDITIONAL_INFORMATION:`Code : ${couponCode}`,
       CTA_LABEL:"Utiliser mon avantage",CTA_URL:`${app}/formations`
      },userId:u?.id||null,sb});
      if(delivered) await sb.from("coupon_recipient_assignments").update({status:"sent",sent_at:new Date().toISOString()}).eq("id",a.id);
     }
    }
   }
   return json({success:true,coupon:created,assigned:assigned.length});
  }
  if(b.action==="deactivate"){if(!b.coupon_id)return json({error:"INVALID_PARAMS"},400);const{error}=await sb.from("coupons").update({is_active:false}).eq("id",b.coupon_id);if(error)throw error;return json({success:true})}
  if(b.action==="delete"){if(!b.coupon_id)return json({error:"INVALID_PARAMS"},400);const{data:c}=await sb.from("coupons").select("used_count").eq("id",b.coupon_id).maybeSingle();if(Number(c?.used_count||0)>0)return json({error:"COUPON_USED"},409);const{error}=await sb.from("coupons").delete().eq("id",b.coupon_id);if(error)throw error;return json({success:true})}
  return json({error:"INVALID_ACTION"},400);
 }catch(e){console.error("admin-coupon-manage",e);return json({error:"SERVER_ERROR",message:e instanceof Error?e.message:String(e)},500)}
});
