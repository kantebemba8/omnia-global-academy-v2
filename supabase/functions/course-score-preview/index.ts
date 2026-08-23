import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization,X-Client-Info,Apikey"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
function roundPrice(value:number,step:number){const safe=Math.max(1,Math.round(step||1));return Math.round(Math.max(0,value)/safe)*safe}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body)return json({error:"INVALID_BODY"},400);
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    let durationMinutes=Math.max(0,Math.round(Number(body.duration_minutes||0)));
    let desiredPrice:number|null=body.desired_price_xof==null?null:Number(body.desired_price_xof);
    let courseId=String(body.course_id||"").trim();
    if(courseId){
      const {data:course,error}=await sb.from("courses").select("id,total_duration_seconds,calculated_duration_minutes,cpd_hours,desired_price_amount,creator_context").eq("id",courseId).maybeSingle();
      if(error)throw error;if(!course)return json({error:"COURSE_NOT_FOUND"},404);
      if(String(course.creator_context||"")!=="professeur"&&String(course.creator_context||"")!=="professor")return json({error:"AUTOMATIC_PRICING_PROFESSOR_ONLY"},409);
      durationMinutes=Math.max(0,Math.round(Number(course.total_duration_seconds||0)/60)||Math.round(Number(course.calculated_duration_minutes||0))||durationMinutes);
      if(desiredPrice==null&&course.desired_price_amount!=null)desiredPrice=Number(course.desired_price_amount);
    }
    const [{data:bands,error:bandsError},{data:factors,error:factorsError},{data:settings,error:settingsError}]=await Promise.all([
      sb.from("professor_pricing_duration_bands").select("*").eq("is_active",true).order("min_minutes"),
      sb.from("professor_pricing_factors").select("*").eq("is_active",true).order("display_order"),
      sb.from("professor_pricing_settings").select("*").eq("singleton_key","default").maybeSingle(),
    ]);
    if(bandsError)throw bandsError;if(factorsError)throw factorsError;if(settingsError)throw settingsError;
    const band=(bands||[]).find((row:any)=>durationMinutes>=Number(row.min_minutes||0)&&(row.max_minutes==null||durationMinutes<Number(row.max_minutes)))||(bands||[]).slice(-1)[0]||null;
    let value=Number(band?.base_price_xof||0);const applied:any[]=[];
    const requestedFactors=new Set(Array.isArray(body.factor_keys)?body.factor_keys.map(String):[]);
    for(const factor of factors||[]){
      const cfg=factor.config||{};const applies=cfg.always===true||requestedFactors.has(String(factor.factor_key));if(!applies)continue;
      const before=value;if(factor.factor_type==="fixed_amount")value+=Number(factor.fixed_amount_xof||0);else if(factor.factor_type==="percentage")value*=1+Number(factor.multiplier||0)/100;else value*=Number(factor.multiplier||1);
      applied.push({key:factor.factor_key,name:factor.name_fr,type:factor.factor_type,before,after:value});
    }
    const step=Number(settings?.rounding_step_xof||1);const recommended=roundPrice(value,step);const lower=roundPrice(recommended*(1-Number(settings?.lower_range_percent||0)/100),step);const upper=Math.max(lower,roundPrice(recommended*(1+Number(settings?.upper_range_percent||0)/100),step));
    return json({engine:"v3",duration_minutes:durationMinutes,duration_band:band?{id:band.id,label:band.label,min_minutes:band.min_minutes,max_minutes:band.max_minutes,base_price_xof:Number(band.base_price_xof||0)}:null,applied_factors:applied,price_xof:recommended,range_min_xof:Math.max(0,lower),range_max_xof:upper,desired_price_xof:desiredPrice,rounding_step_xof:step,legacy_score_engine:false});
  }catch(error){console.error("course-score-preview v3",error);return json({error:"SERVER_ERROR",message:error instanceof Error?error.message:String(error)},500)}
});
