import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
function textArray(v:unknown){return Array.isArray(v)?v.map(String).map(x=>x.trim()).filter(Boolean).slice(0,50):[]}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST') return json({error:'METHOD_NOT_ALLOWED'},405);
 const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=req.headers.get('Authorization')||'';
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const admin=createClient(url,service);
 const {data:{user}}=await userClient.auth.getUser(); if(!user) return json({error:'UNAUTHORIZED'},401);
 const body=await req.json().catch(()=>({})); const action=String(body.action||'');
 const {data:roles}=await admin.from('user_roles').select('role').eq('user_id',user.id);
 const roleList=(roles||[]).map((r:any)=>r.role); const isAdmin=roleList.some((r:string)=>['super_admin','admin'].includes(r));
 const isRecruiter=roleList.some((r:string)=>['recruteur','recruteur_independant'].includes(r));
 try{
  if(action==='learner_dashboard'){
   let {data:profile}=await admin.from('employability_profiles').select('*').eq('user_id',user.id).maybeSingle();
   if(!profile){const ins=await admin.from('employability_profiles').insert({user_id:user.id}).select().single(); if(ins.error) throw ins.error; profile=ins.data}
   const [career,portfolio,clr,passport,matches,apps]=await Promise.all([
    admin.from('career_public_profiles').select('professional_title,skills,sectors,visibility').eq('user_id',user.id).maybeSingle(),
    admin.from('project_portfolio_profiles').select('status,allow_recruiter_contact,target_roles').eq('user_id',user.id).maybeSingle(),
    admin.from('clr_records').select('id').eq('user_id',user.id).limit(1),
    admin.from('skills_passports').select('id,status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1),
    admin.from('employability_opportunity_matches').select('*,job_offers(id,title,location,contract_type,category,deadline,status,recruiter_company)').eq('user_id',user.id).neq('status','dismissed').order('match_score',{ascending:false}).limit(30),
    admin.from('job_applications').select('id,job_id,status,submitted_at').eq('applicant_id',user.id).order('submitted_at',{ascending:false}).limit(20)
   ]);
   return json({success:true,profile,sources:{career:career.data,portfolio:portfolio.data,learning_record:!!clr.data?.length,skills_passport:passport.data?.[0]||null},matches:matches.data||[],applications:apps.data||[]});
  }
  if(action==='save_preferences'){
   const input=body.profile||{}; const active=input.status==='active';
   const row={user_id:user.id,status:['draft','active','paused','archived'].includes(input.status)?input.status:'draft',talent_visibility:['private','recruiters','public'].includes(input.talent_visibility)?input.talent_visibility:'private',use_project_evidence:!!input.use_project_evidence,use_skills_passport:!!input.use_skills_passport,use_learning_record:!!input.use_learning_record,use_career_documents:!!input.use_career_documents,allow_opportunity_matching:!!input.allow_opportunity_matching,allow_recruiter_contact:!!input.allow_recruiter_contact,target_roles:textArray(input.target_roles),target_sectors:textArray(input.target_sectors),target_countries:textArray(input.target_countries),contract_preferences:textArray(input.contract_preferences),consented_at:active?new Date().toISOString():null,paused_at:input.status==='paused'?new Date().toISOString():null};
   const {data,error}=await admin.from('employability_profiles').upsert(row,{onConflict:'user_id'}).select().single(); if(error) throw error;
   await admin.from('employability_audit_log').insert({actor_user_id:user.id,subject_user_id:user.id,action:'preferences_updated',details:{status:row.status,visibility:row.talent_visibility}});
   return json({success:true,profile:data});
  }
  if(action==='refresh_matches'){
   const {data:p}=await admin.from('employability_profiles').select('*').eq('user_id',user.id).single();
   if(!p?.allow_opportunity_matching) return json({error:'MATCHING_NOT_AUTHORIZED'},403);
   const {data:career}=await admin.from('career_public_profiles').select('skills,sectors').eq('user_id',user.id).maybeSingle();
   const skills=(career?.skills||[]).map((x:string)=>x.toLowerCase()); const sectors=(career?.sectors||[]).map((x:string)=>x.toLowerCase());
   const {data:jobs,error}=await admin.from('job_offers').select('id,title,description,skills_required,category,status,deadline').in('status',['approved','published']).limit(200); if(error) throw error;
   const rows=(jobs||[]).map((j:any)=>{const req=(j.skills_required||[]).map((x:string)=>x.toLowerCase()); const matched=req.filter((x:string)=>skills.some((s:string)=>s.includes(x)||x.includes(s))); const sectorHit=sectors.some((s:string)=>String(j.category||'').toLowerCase().includes(s)); const score=Math.min(100,Math.round((req.length?matched.length/req.length:0)*80+(sectorHit?20:0))); return {user_id:user.id,job_id:j.id,match_score:score,matched_skills:matched,missing_skills:req.filter((x:string)=>!matched.includes(x)),explanation:score>=70?'Forte correspondance avec vos compétences vérifiées.':score>=40?'Correspondance partielle; certaines compétences restent à développer.':'Opportunité exploratoire selon vos préférences.',generated_at:new Date().toISOString()}}).filter((x:any)=>x.match_score>0);
   if(rows.length){const up=await admin.from('employability_opportunity_matches').upsert(rows,{onConflict:'user_id,job_id'}); if(up.error) throw up.error}
   return json({success:true,count:rows.length});
  }
  if(action==='set_match_status'){
   const status=String(body.status||'viewed'); if(!['viewed','saved','dismissed','applied'].includes(status)) return json({error:'INVALID_STATUS'},400);
   const patch:any={status}; if(status==='viewed') patch.viewed_at=new Date().toISOString(); if(status==='dismissed') patch.dismissed_at=new Date().toISOString();
   const {error}=await admin.from('employability_opportunity_matches').update(patch).eq('id',body.match_id).eq('user_id',user.id); if(error) throw error; return json({success:true});
  }
  if(action==='verified_candidates'){
   if(!isRecruiter&&!isAdmin) return json({error:'FORBIDDEN'},403);
   const {data:profiles,error}=await admin.from('employability_profiles').select('user_id,target_roles,target_sectors,target_countries,contract_preferences,use_project_evidence,use_skills_passport,use_learning_record,use_career_documents,allow_recruiter_contact,talent_visibility').eq('status','active').in('talent_visibility',['recruiters','public']).limit(100); if(error) throw error;
   const ids=(profiles||[]).map((x:any)=>x.user_id); if(!ids.length) return json({success:true,candidates:[]});
   const [career,portfolios,evidence]=await Promise.all([
    admin.from('career_public_profiles').select('user_id,full_name,professional_title,location,skills,sectors,languages,certifications,photo_url').in('user_id',ids),
    admin.from('project_portfolio_profiles').select('user_id,headline,professional_summary,status').in('user_id',ids),
    admin.from('omnia_project_verified_evidence').select('user_id,id,skill_codes,validation_status').in('user_id',ids).eq('validation_status','validated')
   ]);
   const cMap=new Map((career.data||[]).map((x:any)=>[x.user_id,x])), pMap=new Map((portfolios.data||[]).map((x:any)=>[x.user_id,x]));
   const count=new Map<string,number>(); for(const e of evidence.data||[]) count.set(e.user_id,(count.get(e.user_id)||0)+1);
   const candidates=(profiles||[]).map((p:any)=>({...p,career:cMap.get(p.user_id)||null,portfolio:pMap.get(p.user_id)||null,verified_project_evidence_count:count.get(p.user_id)||0}));
   return json({success:true,candidates});
  }
  if(action==='log_candidate_access'){
   if(!isRecruiter&&!isAdmin) return json({error:'FORBIDDEN'},403);
   const {data:p}=await admin.from('employability_profiles').select('status,talent_visibility').eq('user_id',body.talent_user_id).single(); if(!p||p.status!=='active'||!['recruiters','public'].includes(p.talent_visibility)) return json({error:'ACCESS_NOT_AUTHORIZED'},403);
   await admin.from('employability_recruiter_access_log').insert({recruiter_user_id:user.id,talent_user_id:body.talent_user_id,action:body.access_action||'profile_view',purpose:body.purpose||null,job_id:body.job_id||null}); return json({success:true});
  }
  if(action==='admin_dashboard'){
   if(!isAdmin) return json({error:'FORBIDDEN'},403);
   const [profiles,matches,access]=await Promise.all([admin.from('employability_profiles').select('*',{count:'exact'}).limit(100),admin.from('employability_opportunity_matches').select('status',{count:'exact'}).limit(500),admin.from('employability_recruiter_access_log').select('*').order('created_at',{ascending:false}).limit(100)]);
   return json({success:true,profiles:profiles.data||[],profile_count:profiles.count||0,matches:matches.data||[],access_log:access.data||[]});
  }
  return json({error:'UNKNOWN_ACTION'},400);
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'INTERNAL_ERROR'},500)}
});
