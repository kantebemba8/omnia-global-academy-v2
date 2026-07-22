import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  return sess?.user_id ?? null;
}

async function generateUniqueCertId(sb: ReturnType<typeof createClient>): Promise<string> {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  while (true) {
    const suffix = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const id = `CERT-${year}-${suffix}`;
    const { data } = await sb.from("certificates").select("id").eq("omnia_certificate_id", id).maybeSingle();
    if (!data) return id;
  }
}

async function generateQrSvg(url: string): Promise<string> {
  try {
    const QRCode = (await import("npm:qrcode@1.5.3")).default;
    const svg: string = await QRCode.toString(url, {
      type: "svg", width: 80, margin: 1,
      color: { dark: "#002050", light: "#FFFFFF" },
    });
    return svg;
  } catch {
    // Fallback deterministic pseudo-QR SVG
    const size = 80, cell = 8, cells = Math.floor(size / cell);
    let seed = url.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    let rects = "";
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        if (seed % 3 === 0) rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#002050"/>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rects}</svg>`;
  }
}

function buildTemplateA(d: Record<string, unknown>, qrSvg: string): string {
  const certDate = new Date(d.issued_at as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1122px;height:794px;font-family:'Inter',sans-serif;background:#fff;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.border-outer{position:absolute;inset:12px;border:3px solid #BF8813;border-radius:8px}
.border-inner{position:absolute;inset:18px;border:1px solid rgba(191,136,19,.35);border-radius:6px}
.corner{position:absolute;width:60px;height:60px}
.corner svg{width:100%;height:100%}
.corner-tl{top:24px;left:24px}.corner-tr{top:24px;right:24px;transform:rotate(90deg)}.corner-bl{bottom:24px;left:24px;transform:rotate(-90deg)}.corner-br{bottom:24px;right:24px;transform:rotate(180deg)}
.content{position:absolute;inset:40px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:20px 60px}
.header{display:flex;align-items:center;gap:16px;width:100%}
.brand-name{font-size:20px;font-weight:900;color:#002050;letter-spacing:.12em}
.brand-sub{font-size:10px;font-weight:600;color:#BF8813;letter-spacing:.22em}
.cert-title{font-size:13px;font-weight:600;color:#BF8813;letter-spacing:.25em;text-transform:uppercase;border-bottom:1px solid #BF8813;padding-bottom:8px}
.student-name{font-size:42px;font-weight:900;color:#002050;text-align:center;line-height:1.1}
.course-name{font-weight:700;color:#002050;font-size:18px}
.completion{font-size:15px;color:#374151;text-align:center;line-height:1.6;max-width:700px}
.badges{display:flex;gap:24px;align-items:center}
.badge{display:flex;flex-direction:column;align-items:center;gap:4px}
.badge-label{font-size:10px;color:#6B7280;letter-spacing:.1em;text-transform:uppercase}
.badge-value{font-size:13px;font-weight:700;color:#002050}
.sep{width:1px;height:40px;background:#E4E7EC}
.cpd-badge{display:flex;align-items:center;gap:8px;padding:6px 14px;border:2px solid #BF8813;border-radius:24px;background:rgba(191,136,19,.05)}
.cpd-text{font-size:11px;font-weight:700;color:#BF8813;letter-spacing:.08em}
.footer{display:flex;justify-content:space-between;align-items:flex-end;width:100%;padding-top:14px;border-top:1px solid #E4E7EC}
.sig-block{display:flex;flex-direction:column;align-items:center;gap:4px}
.sig-line{width:140px;height:1px;background:#002050}
.sig-name{font-size:11px;font-weight:600;color:#002050}
.sig-title{font-size:10px;color:#6B7280}
.qr-block{display:flex;flex-direction:column;align-items:center;gap:3px}
.cert-id{font-size:8px;font-family:monospace;color:#9CA3AF;letter-spacing:.08em}
.qr-label{font-size:8px;color:#6B7280}
</style>
</head>
<body>
<div class="border-outer"></div>
<div class="border-inner"></div>
<div class="corner corner-tl"><svg viewBox="0 0 60 60" fill="none"><path d="M2 2 L2 30 M2 2 L30 2" stroke="#BF8813" stroke-width="3" stroke-linecap="round"/><path d="M8 8 L8 24 M8 8 L24 8" stroke="#BF8813" stroke-width="1" stroke-linecap="round" opacity="0.4"/></svg></div>
<div class="corner corner-tr"><svg viewBox="0 0 60 60" fill="none"><path d="M2 2 L2 30 M2 2 L30 2" stroke="#BF8813" stroke-width="3" stroke-linecap="round"/><path d="M8 8 L8 24 M8 8 L24 8" stroke="#BF8813" stroke-width="1" stroke-linecap="round" opacity="0.4"/></svg></div>
<div class="corner corner-bl"><svg viewBox="0 0 60 60" fill="none"><path d="M2 2 L2 30 M2 2 L30 2" stroke="#BF8813" stroke-width="3" stroke-linecap="round"/><path d="M8 8 L8 24 M8 8 L24 8" stroke="#BF8813" stroke-width="1" stroke-linecap="round" opacity="0.4"/></svg></div>
<div class="corner corner-br"><svg viewBox="0 0 60 60" fill="none"><path d="M2 2 L2 30 M2 2 L30 2" stroke="#BF8813" stroke-width="3" stroke-linecap="round"/><path d="M8 8 L8 24 M8 8 L24 8" stroke="#BF8813" stroke-width="1" stroke-linecap="round" opacity="0.4"/></svg></div>

<div class="content">
  <div class="header">
    ${d.logo_url && !d.logo_url.startsWith('/') ? `<img src="${d.logo_url}" style="height:40px;object-fit:contain;margin-right:10px" alt="Omnia"/>` : ''}
<div>
  <div class="brand-name">OMNIA</div>
  <div class="brand-sub">GLOBAL ACADEMY</div>
</div>
    ${d.cpd_accredited ? `<div style="margin-left:auto"><div class="cpd-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#BF8813" stroke-width="2"/><path d="M8 12l3 3 5-5" stroke="#BF8813" stroke-width="2" stroke-linecap="round"/></svg><span class="cpd-text">CPD CERTIFIED</span></div><div style="font-size:9px;color:#6B7280;text-align:center;margin-top:4px">${d.cpd_hours}h · ${d.cpd_provider_code || "Omnia CPD"}</div></div>` : ""}
  </div>
  <div style="text-align:center">
    <div class="cert-title">CERTIFICAT DE RÉUSSITE</div>
    <div style="margin:14px 0 8px;font-size:13px;color:#6B7280">Ce certificat est décerné à</div>
    <div class="student-name">${d.student_full_name}</div>
  </div>
  <div class="completion">pour avoir complété avec succès la formation<br/><span class="course-name">${d.course_title}</span></div>
  <div class="badges">
    <div class="badge"><span class="badge-label">Niveau</span><span class="badge-value">${d.course_level}</span></div>
    <div class="sep"></div>
    <div class="badge"><span class="badge-label">Catégorie</span><span class="badge-value">${d.course_category}</span></div>
    ${d.cpd_hours ? `<div class="sep"></div><div class="badge"><span class="badge-label">Durée CPD</span><span class="badge-value">${d.cpd_hours} heures</span></div>` : ""}
  </div>
  <div class="footer">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${d.creator_name}</div><div class="sig-title">Formateur</div></div>
    <div class="qr-block">${qrSvg}<div class="cert-id">${d.omnia_certificate_id}</div><div class="qr-label">Vérifier l'authenticité</div><div style="font-size:9px;color:#6B7280">${certDate}</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-name">Administration</div><div class="sig-title">Omnia Global Academy</div></div>
  </div>
</div>
</body></html>`;
}

function buildTemplateB(d: Record<string, unknown>, qrSvg: string): string {
  const certDate = new Date(d.issued_at as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1122px;height:794px;font-family:'Inter',sans-serif;background:#fff;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.border-outer{position:absolute;inset:12px;border:3px solid #002050;border-radius:8px}
.border-inner{position:absolute;inset:18px;border:1px solid rgba(0,32,80,.2);border-radius:6px}
.content{position:absolute;inset:40px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:20px 60px}
.header{display:flex;align-items:center;justify-content:space-between;width:100%;border-bottom:2px solid #002050;padding-bottom:16px}
.logo-block{display:flex;align-items:center;gap:12px}
.brand-name{font-size:18px;font-weight:900;color:#002050;letter-spacing:.1em}
.brand-sub{font-size:9px;font-weight:600;color:#BF8813;letter-spacing:.2em}
.est-name{font-size:14px;font-weight:700;color:#002050;text-align:right}
.est-sub{font-size:10px;color:#6B7280;text-align:right}
.cert-title{font-size:13px;font-weight:600;color:#BF8813;letter-spacing:.25em;text-transform:uppercase;border-bottom:1px solid #BF8813;padding-bottom:8px}
.student-name{font-size:40px;font-weight:900;color:#002050;text-align:center;line-height:1.1}
.course-name{font-weight:700;color:#002050;font-size:18px}
.footer{display:flex;justify-content:space-between;align-items:flex-end;width:100%;padding-top:14px;border-top:1px solid #E4E7EC}
.sig-block{display:flex;flex-direction:column;align-items:center;gap:4px}
.sig-line{width:140px;height:1px;background:#002050}
.sig-name{font-size:11px;font-weight:600;color:#002050}
.sig-title{font-size:10px;color:#6B7280}
.qr-block{display:flex;flex-direction:column;align-items:center;gap:3px}
.cert-id{font-size:8px;font-family:monospace;color:#9CA3AF;letter-spacing:.08em}
</style>
</head>
<body>
<div class="border-outer"></div>
<div class="border-inner"></div>
<div class="content">
  <div class="header">
    <div class="logo-block">${d.logo_url && !d.logo_url.startsWith('/') ? `<img src="${d.logo_url}" style="height:40px;object-fit:contain;margin-right:10px" alt="Omnia"/>` : ''}
<div>
  <div class="brand-name">OMNIA</div>
  <div class="brand-sub">GLOBAL ACADEMY</div>
</div>
    <div style="display:flex;align-items:center;gap:12px">${d.establishment_logo_url ? `<img src="${d.establishment_logo_url}" style="height:40px;object-fit:contain" alt="">` : ""}<div><div class="est-name">${d.establishment_name}</div><div class="est-sub">Établissement partenaire</div></div></div>
  </div>
  <div style="text-align:center">
    <div class="cert-title">CERTIFICAT DE RÉUSSITE</div>
    <div style="margin:14px 0 8px;font-size:13px;color:#6B7280">Ce certificat est décerné à</div>
    <div class="student-name">${d.student_full_name}</div>
  </div>
  <div style="font-size:15px;color:#374151;text-align:center;line-height:1.6;max-width:700px">pour avoir complété avec succès la formation<br/><span class="course-name">${d.course_title}</span></div>
  <div style="display:flex;gap:24px;align-items:center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em">Niveau</span><span style="font-size:13px;font-weight:700;color:#002050">${d.course_level}</span></div>
    <div style="width:1px;height:40px;background:#E4E7EC"></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em">Catégorie</span><span style="font-size:13px;font-weight:700;color:#002050">${d.course_category}</span></div>
  </div>${d.external_accreditation_logo ? `
  <div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border:1px solid #E4E7EC;border-radius:8px;margin-bottom:8px">
    <img src="${d.external_accreditation_logo}" style="height:32px;object-fit:contain" alt="Accréditation"/>
    <div>
      <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em">Accréditation</div>
      <div style="font-size:12px;font-weight:700;color:#002050">${d.external_accreditation_number || ""}</div>
    </div>
  </div>` : ""}
  <div class="footer">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${d.director_name || "Le Directeur"}</div><div class="sig-title">${d.establishment_name}</div></div>
    <div class="qr-block">${qrSvg}<div class="cert-id">${d.omnia_certificate_id}</div><div style="font-size:8px;color:#6B7280">Vérifier l'authenticité</div><div style="font-size:9px;color:#6B7280">${certDate}</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-name">Administration</div><div class="sig-title">Omnia Global Academy</div></div>
  </div>
</div>
</body></html>`;
}
function buildTemplateC(d: Record<string, unknown>, qrSvg: string): string {
  const certDate = new Date(d.issued_at as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1122px;height:794px;font-family:'Inter',sans-serif;background:#fff;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.border-outer{position:absolute;inset:12px;border:3px solid #002050;border-radius:8px}
.border-inner{position:absolute;inset:18px;border:1px solid rgba(0,32,80,.2);border-radius:6px}
.content{position:absolute;inset:40px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:20px 60px}
.header{display:flex;align-items:center;justify-content:center;width:100%;border-bottom:2px solid #002050;padding-bottom:16px;gap:16px}
.brand-name{font-size:22px;font-weight:900;color:#002050;letter-spacing:.1em}
.brand-sub{font-size:9px;font-weight:600;color:#BF8813;letter-spacing:.2em}
.cert-title{font-size:13px;font-weight:600;color:#BF8813;letter-spacing:.25em;text-transform:uppercase;border-bottom:1px solid #BF8813;padding-bottom:8px}
.student-name{font-size:40px;font-weight:900;color:#002050;text-align:center;line-height:1.1}
.course-name{font-weight:700;color:#002050;font-size:18px}
.platform-mention{font-size:13px;color:#6B7280;font-style:italic;text-align:center;margin-top:8px}
.footer{display:flex;justify-content:space-between;align-items:flex-end;width:100%;padding-top:14px;border-top:1px solid #E4E7EC}
.sig-block{display:flex;flex-direction:column;align-items:center;gap:4px}
.sig-line{width:140px;height:1px;background:#002050}
.sig-name{font-size:11px;font-weight:600;color:#002050}
.sig-title{font-size:10px;color:#6B7280}
.qr-block{display:flex;flex-direction:column;align-items:center;gap:3px}
.cert-id{font-size:8px;font-family:monospace;color:#9CA3AF;letter-spacing:.08em}
.cpd-badge{display:flex;align-items:center;gap:8px;padding:6px 14px;border:2px solid #BF8813;border-radius:24px;background:rgba(191,136,19,.05)}
.cpd-text{font-size:11px;font-weight:700;color:#BF8813;letter-spacing:.08em}
</style>
</head>
<body>
<div class="border-outer"></div>
<div class="border-inner"></div>
<div class="content">
  <div class="header">
    <div style="text-align:center">
     ${d.logo_url && !d.logo_url.startsWith('/') ? `<img src="${d.logo_url}" style="height:40px;object-fit:contain;margin-right:10px" alt="Omnia"/>` : ''}
<div>
  <div class="brand-name">OMNIA</div>
  <div class="brand-sub">GLOBAL ACADEMY</div>
</div>
    ${d.cpd_accredited ? `<div class="cpd-badge">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#BF8813" stroke-width="2"/>
        <path d="M8 12l3 3 5-5" stroke="#BF8813" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="cpd-text">CPD CERTIFIED</span>
    </div>
    <div style="font-size:9px;color:#6B7280;text-align:center;margin-top:4px">
      ${d.cpd_hours}h · ${d.cpd_provider_code || "Omnia CPD"}
    </div>` : ""}
  </div>
  <div style="text-align:center">
    <div class="cert-title">CERTIFICAT DE RÉUSSITE</div>
    <div style="margin:14px 0 8px;font-size:13px;color:#6B7280">Ce certificat est décerné à</div>
    <div class="student-name">${d.student_full_name}</div>
  </div>
  <div style="font-size:15px;color:#374151;text-align:center;line-height:1.6;max-width:700px">
    pour avoir complété avec succès la formation<br/>
    <span class="course-name">${d.course_title}</span>
  </div>
  <div class="platform-mention">Formation certifiée par Omnia Global Academy</div>
  <div style="display:flex;gap:24px;align-items:center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em">Niveau</span>
      <span style="font-size:13px;font-weight:700;color:#002050">${d.course_level}</span>
    </div>
    <div style="width:1px;height:40px;background:#E4E7EC"></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em">Catégorie</span>
      <span style="font-size:13px;font-weight:700;color:#002050">${d.course_category}</span>
    </div>
    ${d.cpd_hours ? `<div style="width:1px;height:40px;background:#E4E7EC"></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.1em">Durée CPD</span>
      <span style="font-size:13px;font-weight:700;color:#002050">${d.cpd_hours} heures</span>
    </div>` : ""}
  </div>
  <div class="footer">
    <div style="width:140px"></div>
    <div class="qr-block">
      ${qrSvg}
      <div class="cert-id">${d.omnia_certificate_id}</div>
      <div style="font-size:8px;color:#6B7280">Vérifier l'authenticité</div>
      <div style="font-size:9px;color:#6B7280">${certDate}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Administration</div>
      <div class="sig-title">Omnia Global Academy</div>
    </div>
  </div>
</div>
</body></html>`;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null,{status:200,headers:corsHeaders});
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
  try {
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token=req.headers.get("Authorization")?.replace("Bearer ","")||"";
    let callerId=token?await verifySession(sb,token):null;
    if(!callerId&&token){const {data}=await sb.auth.getUser(token);callerId=data.user?.id||null;}
    if(!callerId)return json({error:"UNAUTHORIZED"},401);
    const body=await req.json(); const userId=body.user_id||callerId, courseId=body.course_id;
    if(!courseId)return json({error:"MISSING_FIELDS"},400);
    if(userId!==callerId){const {data:r}=await sb.from("user_roles").select("role").eq("user_id",callerId).in("role",["super_admin","admin"]).maybeSingle();if(!r)return json({error:"FORBIDDEN"},403);}

    const {data:assessments}=await sb.from("course_assessments").select("id,scope,passing_score").eq("course_id",courseId).eq("required",true).eq("is_active",true);
    const missing:string[]=[];
    for(const a of assessments||[]){const {data:best}=await sb.from("assessment_attempts").select("score,passed,status").eq("assessment_id",a.id).eq("user_id",userId).eq("passed",true).order("score",{ascending:false}).limit(1).maybeSingle();if(!best||Number(best.score||0)<Number(a.passing_score||(a.scope==="final"?70:80)))missing.push(`${a.scope}:${a.id}`);}
    const {data:attemptIds}=await sb.from("assessment_attempts").select("id").eq("course_id",courseId).eq("user_id",userId);
    if(attemptIds?.length){const {count}=await sb.from("assessment_answers").select("id",{count:"exact",head:true}).eq("review_status","pending").in("attempt_id",attemptIds.map((x:any)=>x.id));if((count||0)>0)missing.push("manual_reviews_pending");}
    const {data:course}=await sb.from("courses").select("*").eq("id",courseId).maybeSingle();
    const {data:user}=await sb.from("users").select("full_name,email").eq("id",userId).maybeSingle();
    if(!course||!user)return json({error:"NOT_FOUND"},404);
    const {data:progress}=await sb.from("user_lesson_progress").select("is_completed,time_spent_seconds").eq("user_id",userId).eq("course_id",courseId);
    if((progress||[]).some((x:any)=>!x.is_completed))missing.push("lessons_incomplete");
    const spent=(progress||[]).reduce((n:number,x:any)=>n+Number(x.time_spent_seconds||0),0)+(await sb.from("assessment_attempts").select("time_spent_seconds").eq("course_id",courseId).eq("user_id",userId)).data?.reduce((n:number,x:any)=>n+Number(x.time_spent_seconds||0),0)||0;
    const requiredSeconds=Number(course.calculated_duration_minutes||0)*60;
    if(requiredSeconds>0&&spent<requiredSeconds)missing.push("minimum_time_not_reached");
    if(missing.length){await sb.from("certificate_generation_audit").insert({user_id:userId,course_id:courseId,result:"blocked",missing_conditions:missing,source:body.source||"automatic"});return json({error:"CONDITIONS_NOT_MET",missing},422);}

    const {data:existing}=await sb.from("certificates").select("id,omnia_certificate_id,pdf_url,cpd_pending,verification_url").eq("user_id",userId).eq("course_id",courseId).maybeSingle();
    if(existing)return json({certificate_id:existing.omnia_certificate_id,pdf_url:existing.pdf_url,verification_url:existing.verification_url,cpd_pending:existing.cpd_pending,existing:true});

    const {data:accreditations}=await sb.from("course_certifications").select("*").eq("course_id",courseId).eq("status","validated").order("created_at");
    const certId=await generateUniqueCertId(sb); const appUrl=Deno.env.get("APP_URL")||"https://omniaglobalacademy.com"; const verifyUrl=`${appUrl}/verify/${certId}`; const qrSvg=await generateQrSvg(verifyUrl);
    const {data:settingsRows}=await sb.from("certificate_settings").select("key,value"); const settings:Record<string,string>={}; for(const r of settingsRows||[])settings[r.key]=r.value;
    let creatorName="",establishmentName="",establishmentLogoUrl="",directorName="",directorSigUrl="";
    if(course.establishment_id){const {data:e}=await sb.from("etablissement_profiles").select("school_name,logo_url,director_name,signature_url").eq("id",course.establishment_id).maybeSingle();if(e){establishmentName=e.school_name||"";establishmentLogoUrl=e.logo_url||"";directorName=e.director_name||"";directorSigUrl=e.signature_url||"";}}
    if(course.creator_id){const {data:p}=await sb.from("users").select("full_name").eq("id",course.creator_id).maybeSingle();creatorName=p?.full_name||"";}
    const issuerType=course.establishment_id?"structure":course.creator_type==="plateforme"?"omnia":"professor";
    const issuerName=establishmentName||creatorName||"Omnia Global Academy";
    const cpd=(accreditations||[]).find((a:any)=>a.certification_type==="cpd");
    const certData:any={omnia_certificate_id:certId,student_full_name:user.full_name,course_title:course.title,course_level:course.level||"",course_category:course.category||"",cpd_accredited:!!cpd||!!course.cpd_accredited,cpd_hours:Number(cpd?.credit_value||course.cpd_hours||0),cpd_provider_code:cpd?.certification_code||"",logo_url:settings.certificate_logo_url||"/IMG_0349.png",certificate_text:(String(course.language||"fr").toLowerCase().startsWith("en")?settings.certificate_text_en:String(course.language||"fr").toLowerCase().startsWith("es")?settings.certificate_text_es:settings.certificate_text_fr)||"pour avoir complété avec succès la formation",creator_name:creatorName,establishment_name:establishmentName,establishment_logo_url:establishmentLogoUrl,director_name:directorName,issued_at:new Date().toISOString()};
    const isB=!!course.establishment_id,isC=course.creator_type==="plateforme"&&!course.establishment_id;
    let html=isC?buildTemplateC(certData,qrSvg):isB?buildTemplateB(certData,qrSvg):buildTemplateA(certData,qrSvg);
    const badges=(accreditations||[]).map((a:any)=>`<div style="display:flex;align-items:center;gap:5px">${a.badge_url||a.logo_url?`<img src="${a.badge_url||a.logo_url}" style="height:28px;max-width:80px;object-fit:contain"/>`:''}<span style="font-size:9px;color:#002050;font-weight:600">${a.organization_name}${a.credit_value?` · ${a.credit_value} ${a.credit_unit||''}`:''}</span></div>`).join('');
    if(badges)html=html.replace('</body>',`<div style="position:absolute;left:180px;right:180px;bottom:18px;display:flex;justify-content:center;gap:18px;align-items:center">${badges}</div></body>`);
    const filename=`certificates/${userId}/${certId}.html`; const {error:upErr}=await sb.storage.from("certificates").upload(filename,html,{contentType:"text/html; charset=utf-8",upsert:true});if(upErr)throw upErr; const pdfUrl=sb.storage.from("certificates").getPublicUrl(filename).data.publicUrl;
    const {data:cert,error:certErr}=await sb.from("certificates").insert({omnia_certificate_id:certId,user_id:userId,course_id:courseId,student_full_name:user.full_name,course_title:course.title,course_level:course.level||"",course_category:course.category||"",cpd_hours:certData.cpd_hours,template_type:isC?"C":isB?"B":"A",creator_name:creatorName||null,establishment_name:establishmentName||null,establishment_logo_url:establishmentLogoUrl||null,director_name:directorName||null,director_signature_url:directorSigUrl||null,cpd_accredited:certData.cpd_accredited,cpd_provider_code:certData.cpd_provider_code||null,pdf_url:pdfUrl,validity_status:"valid",verification_url:verifyUrl,qr_svg:qrSvg,duration_minutes:Number(course.calculated_duration_minutes||0),course_version:String(course.current_version||"1.0"),issuer_type:issuerType,issuer_name:issuerName,language_code:String(course.language||"fr").slice(0,2).toLowerCase(),document_type:"completion_certificate",source_type:"course",issuance_snapshot:{student_full_name:user.full_name,course_title:course.title,course_version:String(course.current_version||"1.0"),issuer_type:issuerType,issuer_name:issuerName,language:String(course.language||"fr"),template_type:isC?"C":isB?"B":"A",generated_at:new Date().toISOString()},metadata:{assessment_thresholds:{lesson:80,module:80,final:70},time_spent_seconds:spent}}).select("*").single();if(certErr)throw certErr;
    if(accreditations?.length)await sb.from("certificate_accreditations").insert(accreditations.map((a:any)=>({certificate_id:cert.id,course_certification_id:a.id,organization_name:a.organization_name,certification_name:a.certification_name,certification_code:a.certification_code,credit_value:a.credit_value,credit_unit:a.credit_unit,badge_url:a.badge_url,logo_url:a.logo_url,signature_url:a.signature_url,stamp_url:a.stamp_url,verification_url:a.verification_url,valid_from:a.valid_from,expires_at:a.expires_at,status:a.expires_at&&new Date(a.expires_at)<new Date()?"expired":"valid"})));
    const creditSummary=(accreditations||[]).map((a:any)=>({organization:a.organization_name,value:a.credit_value,unit:a.credit_unit}));
    await sb.from("user_profile_certifications").upsert({user_id:userId,certificate_id:cert.id,course_id:courseId,title:course.title,issuer:issuerName,credential_id:certId,verification_url:verifyUrl,issued_at:cert.issued_at,expires_at:null,hours_or_credits:creditSummary,status:"valid",updated_at:new Date().toISOString()},{onConflict:"user_id,certificate_id"});
    await sb.from("user_enrollments").update({completed_at:new Date().toISOString()}).eq("user_id",userId).eq("course_id",courseId);
    await sb.from("certificate_generation_audit").insert({user_id:userId,course_id:courseId,certificate_id:cert.id,result:"generated",source:body.source||"automatic"});
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-dispatch`,{method:"POST",headers:{Authorization:`Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify({type:"certificat_genere",payload:{userId,formation_titre:course.title,certificate_id:certId,verify_url:verifyUrl,pdf_url:pdfUrl}})}).catch(()=>{});
    return json({certificate_id:certId,pdf_url:pdfUrl,verification_url:verifyUrl,accreditations:creditSummary});
  } catch(err){return json({error:"INTERNAL",message:(err as Error).message},500);}
});
