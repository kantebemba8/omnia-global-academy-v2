import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')!;const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const body=await req.json();const admin=createClient(url,service);const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
    if(body.action==='list'){
      const {data,error}=await admin.from('career_public_profiles').select('user_id,full_name,professional_title,location,bio,skills,sectors,photo_url').eq('visibility','public').order('updated_at',{ascending:false});
      if(error)throw error;return json({profiles:(data||[]).map((p:any)=>({...p,id:p.user_id}))});
    }
    if(body.action==='contact'){
      if(!body.profile_id||!String(body.message||'').trim())return json({error:'INVALID_REQUEST'},400);
      const {error}=await admin.from('career_recruiter_contacts').insert({profile_user_id:body.profile_id,recruiter_name:body.recruiter_name||null,recruiter_email:body.recruiter_email||null,company_name:body.company_name||null,message:String(body.message).trim()});
      if(error)throw error;return json({success:true});
    }
    const {data:{user}}=await auth.auth.getUser();if(!user)return json({error:'UNAUTHORIZED'},401);
    if(body.action==='save'){
      const p=body.profile||{};const row={user_id:user.id,full_name:p.full_name||'',professional_title:p.title||p.professional_title||null,email:p.email||user.email||null,phone:p.phone||null,location:p.location||null,linkedin:p.linkedin||null,bio:p.summary||p.bio||null,skills:p.skills||[],sectors:p.sectors||[],languages:p.languages||[],certifications:p.certifications||[],photo_url:p.photo_url||null,visibility:p.visibility||'private',documents_visibility:p.documents_visibility||'private',updated_at:new Date().toISOString()};
      const {data,error}=await admin.from('career_public_profiles').upsert(row,{onConflict:'user_id'}).select().single();if(error)throw error;return json({profile:data});
    }
    return json({error:'UNKNOWN_ACTION'},400);
  }catch(e){return json({error:'SERVER_ERROR',message:e instanceof Error?e.message:String(e)},500)}
});
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}
