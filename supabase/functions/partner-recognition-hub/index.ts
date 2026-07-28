import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function session(sb:any,token:string){const {data:s}=await sb.from('user_sessions').select('user_id').eq('session_token',token).gt('expires_at',new Date().toISOString()).maybeSingle();if(!s)return null;const {data:r}=await sb.from('user_roles').select('role').eq('user_id',s.user_id);return {userId:s.user_id,roles:(r||[]).map((x:any)=>x.role)}}
const clean=(o:any,keys:string[])=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});try{
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token)return json({error:'AUTH_REQUIRED'},401);
 const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); const me=await session(sb,token); if(!me)return json({error:'SESSION_INVALID'},401);
 const body=await req.json().catch(()=>({})); const action=body.action; const admin=me.roles.includes('super_admin'); const manager=me.roles.includes('gestionnaire_partenaire');
 async function partnerAccess(partnerId:string){if(admin)return true;if(!manager)return false;const {data:p}=await sb.from('recognition_partners').select('linked_organization_id').eq('id',partnerId).maybeSingle();if(!p?.linked_organization_id)return false;const {data:m}=await sb.from('partner_managers').select('id').eq('organization_id',p.linked_organization_id).eq('user_id',me.userId).maybeSingle();return !!m}
 async function audit(partnerId:string|null,entityType:string,entityId:string|null,a:string,details:any={}){await sb.from('recognition_audit_log').insert({partner_id:partnerId,entity_type:entityType,entity_id:entityId,action:a,actor_id:me.userId,details})}
 if(action==='dashboard'){
  if(!admin)return json({error:'FORBIDDEN'},403);
  const [{data:partners},{data:agreements},{data:programs},{data:logos},{data:submissions},{data:courses},{data:orgs}]=await Promise.all([
   sb.from('recognition_partners').select('*').order('created_at',{ascending:false}),sb.from('recognition_agreements').select('*').order('created_at',{ascending:false}),sb.from('recognition_programs').select('*,courses(title)').order('created_at',{ascending:false}),sb.from('recognition_logo_permissions').select('*').order('created_at',{ascending:false}),sb.from('recognition_submissions').select('*').order('created_at',{ascending:false}),sb.from('courses').select('id,title,status').order('title').limit(500),sb.from('partner_organizations').select('id,org_name,status').order('org_name').limit(500)
  ]);return json({success:true,partners:partners||[],agreements:agreements||[],programs:programs||[],logo_permissions:logos||[],submissions:submissions||[],courses:courses||[],organizations:orgs||[]});
 }
 if(action==='my_workspace'){
  if(!manager&&!admin)return json({error:'FORBIDDEN'},403);
  if(admin&&body.partner_id){const ok=await partnerAccess(body.partner_id);if(!ok)return json({error:'FORBIDDEN'},403);}
  let partnerId=body.partner_id;
  if(!partnerId){const {data:m}=await sb.from('partner_managers').select('organization_id').eq('user_id',me.userId).maybeSingle();if(!m)return json({success:true,partner:null});const {data:p}=await sb.from('recognition_partners').select('*').eq('linked_organization_id',m.organization_id).maybeSingle();if(!p)return json({success:true,partner:null});partnerId=p.id;}
  if(!await partnerAccess(partnerId))return json({error:'FORBIDDEN'},403);
  const [{data:partner},{data:agreements},{data:programs},{data:logos},{data:submissions}]=await Promise.all([sb.from('recognition_partners').select('*').eq('id',partnerId).single(),sb.from('recognition_agreements').select('*').eq('partner_id',partnerId),sb.from('recognition_programs').select('*,courses(title)').eq('partner_id',partnerId),sb.from('recognition_logo_permissions').select('*').eq('partner_id',partnerId),sb.from('recognition_submissions').select('*').eq('partner_id',partnerId).order('created_at',{ascending:false})]);return json({success:true,partner,agreements:agreements||[],programs:programs||[],logo_permissions:logos||[],submissions:submissions||[]});
 }
 if(action==='save_partner'){
  if(!admin)return json({error:'FORBIDDEN'},403); const fields=clean(body,['linked_organization_id','name','slug','partner_type','description','logo_url','website','country_code','territories','contact_name','contact_title','contact_email','contact_phone','status','publication_status','start_date','end_date','renewal_date','fee_amount','fee_currency','validation_process','audit_process','required_documents','metadata']);
  if(!fields.name||!fields.slug||!fields.partner_type)return json({error:'MISSING_REQUIRED_FIELDS'},400);
  let q=body.id?sb.from('recognition_partners').update(fields).eq('id',body.id):sb.from('recognition_partners').insert({...fields,created_by:me.userId});const {data,error}=await q.select('*').single();if(error)throw error;await audit(data.id,'partner',data.id,body.id?'updated':'created');return json({success:true,partner:data});
 }
 if(action==='set_partner_status'){
  if(!admin)return json({error:'FORBIDDEN'},403);const allowed=['preparation','pending','active','suspended','expired','ended','rejected'];if(!allowed.includes(body.status))return json({error:'INVALID_STATUS'},400);const patch:any={status:body.status};if(body.status==='active'){patch.approved_by=me.userId;patch.approved_at=new Date().toISOString()}const {error}=await sb.from('recognition_partners').update(patch).eq('id',body.partner_id);if(error)throw error;await audit(body.partner_id,'partner',body.partner_id,'status_changed',{status:body.status,reason:body.reason});return json({success:true});
 }
 if(action==='save_agreement'){
  if(!await partnerAccess(body.partner_id))return json({error:'FORBIDDEN'},403);const fields=clean(body,['partner_id','agreement_type','reference','title','status','document_url','signed_at','start_date','end_date','renewal_terms','notes']);if(!fields.title)return json({error:'TITLE_REQUIRED'},400);let q=body.id?sb.from('recognition_agreements').update(fields).eq('id',body.id):sb.from('recognition_agreements').insert({...fields,created_by:me.userId});const {data,error}=await q.select('*').single();if(error)throw error;await audit(body.partner_id,'agreement',data.id,body.id?'updated':'created');return json({success:true,item:data});
 }
 if(action==='save_program'){
  if(!admin)return json({error:'FORBIDDEN'},403);const fields=clean(body,['partner_id','course_id','title','recognition_type','status','certificate_label','credit_value','credit_unit','validity_months','effective_from','effective_until','renewal_date','validation_rules','required_evidence','decision_notes']);if(!fields.partner_id||!fields.title||!fields.recognition_type)return json({error:'MISSING_REQUIRED_FIELDS'},400);if(['approved'].includes(String(fields.status))){fields.approved_by=me.userId;fields.approved_at=new Date().toISOString()}let q=body.id?sb.from('recognition_programs').update(fields).eq('id',body.id):sb.from('recognition_programs').insert({...fields,created_by:me.userId});const {data,error}=await q.select('*').single();if(error)throw error;await audit(body.partner_id,'program',data.id,body.id?'updated':'created');return json({success:true,item:data});
 }
 if(action==='save_logo_permission'){
  if(!admin)return json({error:'FORBIDDEN'},403);const fields=clean(body,['partner_id','program_id','scope','status','permitted_uses','prohibited_uses','brand_guidelines_url','valid_from','valid_until','conditions']);if(fields.status==='authorized'){fields.approved_by=me.userId;fields.approved_at=new Date().toISOString()}let q=body.id?sb.from('recognition_logo_permissions').update(fields).eq('id',body.id):sb.from('recognition_logo_permissions').insert(fields);const {data,error}=await q.select('*').single();if(error)throw error;await audit(body.partner_id,'logo_permission',data.id,body.id?'updated':'created');return json({success:true,item:data});
 }
 if(action==='submit_evidence'){
  if(!await partnerAccess(body.partner_id))return json({error:'FORBIDDEN'},403);const {data,error}=await sb.from('recognition_submissions').insert({partner_id:body.partner_id,program_id:body.program_id||null,submission_type:body.submission_type||'evidence',status:'submitted',submitted_documents:body.submitted_documents||[],message:body.message||null,submitted_by:me.userId,submitted_at:new Date().toISOString()}).select('*').single();if(error)throw error;await audit(body.partner_id,'submission',data.id,'submitted');return json({success:true,item:data});
 }
 if(action==='review_submission'){
  if(!admin)return json({error:'FORBIDDEN'},403);const status=body.status;if(!['under_review','changes_requested','accepted','rejected'].includes(status))return json({error:'INVALID_STATUS'},400);const {data,error}=await sb.from('recognition_submissions').update({status,response_message:body.response_message||null,reviewed_by:me.userId,reviewed_at:new Date().toISOString()}).eq('id',body.id).select('*').single();if(error)throw error;await audit(data.partner_id,'submission',data.id,'reviewed',{status});return json({success:true,item:data});
 }
 return json({error:'UNKNOWN_ACTION'},400);
}catch(e){console.error(e);return json({error:'SERVER_ERROR',message:(e as Error).message},500)}});
