import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization,X-Client-Info,Apikey",
};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});

const DEFAULT_RULES:any={
  module_points:2,lesson_points:.5,hour_points:1,
  level_points:{debutant:2,intermediaire:5,avance:8,expert:12},
  validation_points:{qcm:3,projet_soumettre:8,projet_corriger:12},
  oral_exam_points:6,resource_global_cap:5,
  resources:{
    pdf_fiche:{points:.5,max:4},url_externe:{points:.3,max:5},glossaire:{points:1,max:1},
    exercice_pratique:{points:.5,max:3},audio:{points:.5,max:2},template:{points:.7,max:3},etude_de_cas:{points:1,max:2}
  }
};
const normalize=(v:string)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g,"_");
const CATEGORY_ALIASES:Record<string,string>={
  "comptabilite_&_finance":"Finance & Comptabilité","finance_&_comptabilite":"Finance & Comptabilité",
  "informatique_&_developpement":"Informatique & Développement","developpement_web":"Informatique & Développement",
  "cybersecurite_&_reseaux":"Cybersécurité & Réseaux","droit_des_affaires":"Droit & Juridique",
  "marketing_&_communication":"Marketing & Communication","data_&_intelligence_artificielle":"Data & Intelligence Artificielle"
};

async function loadRules(sb:any){
  const {data}=await sb.from("site_settings").select("value").eq("key","course_pricing_rules").maybeSingle();
  if(!data?.value)return DEFAULT_RULES;
  try{return typeof data.value==="string"?{...DEFAULT_RULES,...JSON.parse(data.value)}:{...DEFAULT_RULES,...data.value};}catch{return DEFAULT_RULES;}
}
async function resolveMultiplier(sb:any,category:string){
  const direct=await sb.from("category_multipliers").select("category_name,multiplier").eq("category_name",category).maybeSingle();
  if(direct.data)return {name:direct.data.category_name,multiplier:Number(direct.data.multiplier||1)};
  const alias=CATEGORY_ALIASES[normalize(category)];
  if(alias){
    const r=await sb.from("category_multipliers").select("category_name,multiplier").eq("category_name",alias).maybeSingle();
    if(r.data)return {name:r.data.category_name,multiplier:Number(r.data.multiplier||1)};
  }
  const {data:rows}=await sb.from("category_multipliers").select("category_name,multiplier");
  const n=normalize(category);
  const match=(rows||[]).find((x:any)=>normalize(x.category_name)===n);
  return match?{name:match.category_name,multiplier:Number(match.multiplier||1)}:{name:category,multiplier:1};
}
async function resolveTier(sb:any,score:number){
  const {data}=await sb.from("pricing_tiers").select("id,label,score_min,score_max,price_xof,is_protected").order("score_min");
  const tier=(data||[]).find((t:any)=>score>=Number(t.score_min)&&(t.score_max==null||score<=Number(t.score_max)));
  return tier||{id:null,label:"Non configuré",score_min:0,score_max:null,price_xof:0};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  const body=await req.json().catch(()=>null);
  if(!body)return json({error:"INVALID_BODY"},400);
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const rules=await loadRules(sb);
    const level=normalize(body.level);
    const validation=normalize(body.final_validation_type);
    const breakdown:any={
      modules:Number(body.modules_count||0)*Number(rules.module_points||2),
      lessons:Number(body.lessons_count||0)*Number(rules.lesson_points||.5),
      cpd_hours:Number(body.cpd_hours||0)*Number(rules.hour_points||1),
      level:Number(rules.level_points?.[level]||0),
      validation:Number(rules.validation_points?.[validation]||0),
      oral_exam:body.has_oral_exam?Number(rules.oral_exam_points||6):0,
      resources_bonus:0,
    };
    let bonus=0;
    for(const r of body.resources||[]){
      const cfg=rules.resources?.[normalize(r.type)];
      if(cfg)bonus+=Math.min(Number(r.count||0),Number(cfg.max||0))*Number(cfg.points||0);
    }
    breakdown.resources_bonus=Math.min(bonus,Number(rules.resource_global_cap||5));
    const subtotal=Object.values(breakdown).reduce((a:any,b:any)=>Number(a)+Number(b),0);
    const mult=await resolveMultiplier(sb,String(body.category||""));
    const score=Math.round(subtotal*mult.multiplier*10)/10;
    const tier=await resolveTier(sb,score);
    return json({
      score,price_xof:Number(tier.price_xof||0),palier:tier.label,tier_id:tier.id,
      multiplier:mult.multiplier,multiplier_category:mult.name,
      breakdown:{...breakdown,subtotal_before_multiplier:Math.round(subtotal*10)/10,multiplier_applied:mult.multiplier},
      rules_version:"course_pricing_rules",
    });
  }catch(e){console.error(e);return json({error:"SERVER_ERROR"},500);}
});
