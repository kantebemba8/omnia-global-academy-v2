import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function auth(sb:any,token:string){const {data:s}=await sb.from('user_sessions').select('user_id').eq('session_token',token).gt('expires_at',new Date().toISOString()).maybeSingle();if(!s)return null;const {data:r}=await sb.from('user_roles').select('role').eq('user_id',s.user_id);return (r||[]).some((x:any)=>x.role==='super_admin')?s.user_id:null;}
async function count(sb:any,table:string,filters:(q:any)=>any=(q)=>q){try{let q=sb.from(table).select('*',{count:'exact',head:true});q=filters(q);const {count}=await q;return count||0}catch{return 0}}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:200,headers:corsHeaders});try{const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!token||!await auth(sb,token))return json({error:'FORBIDDEN'},403);const b=await req.json().catch(()=>({}));
if(b.action==='get_config'){
 const [rules,tc,packs,ai,templates,questions,exports,transactions]=await Promise.all([
  sb.from('career_admin_rules').select('*').order('group_key').order('display_order'),sb.from('career_token_config').select('*').order('display_order'),sb.from('career_token_packs').select('*').order('display_order'),sb.from('career_ai_config').select('*').order('config_key'),sb.from('career_templates').select('*').order('template_type').order('display_order'),sb.from('career_interview_questions').select('*').order('created_at',{ascending:false}).limit(500),sb.from('career_export_logs').select('*').order('created_at',{ascending:false}).limit(250),sb.from('career_token_transactions').select('*').order('created_at',{ascending:false}).limit(250)
 ]);
 const stats={total_cv:await count(sb,'career_documents',(q)=>q.eq('doc_type','cv')),total_lm:await count(sb,'career_documents',(q)=>q.eq('doc_type','lm')),total_exports:exports.data?.length||0,tokens_consumed:(transactions.data||[]).filter((x:any)=>Number(x.amount)<0).reduce((a:number,x:any)=>a+Math.abs(Number(x.amount)||0),0),active_templates:(templates.data||[]).filter((x:any)=>x.is_active).length,active_packs:(packs.data||[]).filter((x:any)=>x.is_active).length};
 return json({rules:rules.data||[],token_config:tc.data||[],token_packs:packs.data||[],ai_config:ai.data||[],templates:templates.data||[],questions:questions.data||[],exports:exports.data||[],transactions:transactions.data||[],stats});}
if(b.action==='save_rules'){for(const r of b.rules||[]){await sb.from('career_admin_rules').upsert({...r,updated_at:new Date().toISOString()},{onConflict:'rule_key'})}return json({success:true,updated:(b.rules||[]).length})}
if(b.action==='save_ai_config'){for(const c of b.configs||[]){await sb.from('career_ai_config').upsert({...c,updated_at:new Date().toISOString()},{onConflict:'config_key'})}return json({success:true,updated:(b.configs||[]).length})}
if(b.action==='save_template'){const t=b.template||{};await sb.from('career_templates').upsert({...t,updated_at:new Date().toISOString()},{onConflict:'template_key'});return json({success:true})}
if(b.action==='question_create'){const {data,error}=await sb.from('career_interview_questions').insert({...b.question,created_by:await auth(sb,token)}).select('*').single();if(error)throw error;return json({question:data})}
if(b.action==='question_toggle'){const {data,error}=await sb.from('career_interview_questions').update({is_active:b.is_active,updated_at:new Date().toISOString()}).eq('id',b.id).select('*').single();if(error)throw error;return json({question:data})}
if(b.action==='question_delete'){const {error}=await sb.from('career_interview_questions').delete().eq('id',b.id);if(error)throw error;return json({success:true})}
return json({error:'UNKNOWN_ACTION'},400)}catch(e){console.error(e);return json({error:'SERVER_ERROR',message:(e as Error).message},500)}});
