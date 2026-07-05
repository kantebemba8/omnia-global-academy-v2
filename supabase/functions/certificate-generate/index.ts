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
    <div><div class="brand-name">OMNIA</div><div class="brand-sub">GLOBAL ACADEMY</div></div>
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
    <div class="logo-block"><div><div class="brand-name">OMNIA</div><div class="brand-sub">GLOBAL ACADEMY</div></div></div>
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
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const callerId = await verifySession(sb, token);
    if (!callerId) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { user_id, course_id } = body;
    if (!user_id || !course_id) return new Response(JSON.stringify({ error: "MISSING_FIELDS" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Verify 3 conditions server-side
    const [lessonsRes, modulesRes, finalRes] = await Promise.all([
      sb.from("user_lesson_progress").select("id", { count: "exact" }).eq("user_id", user_id).eq("course_id", course_id).eq("is_completed", false),
      sb.from("user_module_progress").select("id", { count: "exact" }).eq("user_id", user_id).eq("course_id", course_id).eq("exam_passed", false),
      sb.from("user_final_validation").select("status").eq("user_id", user_id).eq("course_id", course_id).maybeSingle(),
    ]);

    const missing: string[] = [];
    if ((lessonsRes.count ?? 0) > 0) missing.push("lessons_incomplete");
    if ((modulesRes.count ?? 0) > 0) missing.push("module_exams");
    if (!finalRes.data || finalRes.data.status !== "passed") missing.push("final_validation");
    if (missing.length > 0) return new Response(JSON.stringify({ error: "CONDITIONS_NOT_MET", missing }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check if cert already exists
    const { data: existingCert } = await sb.from("certificates").select("omnia_certificate_id, pdf_url, cpd_pending").eq("user_id", user_id).eq("course_id", course_id).maybeSingle();
    if (existingCert) return new Response(JSON.stringify({ certificate_id: existingCert.omnia_certificate_id, pdf_url: existingCert.pdf_url, cpd_pending: existingCert.cpd_pending }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Load user and course
    const [{ data: user }, { data: course }] = await Promise.all([
      sb.from("users").select("full_name, email").eq("id", user_id).maybeSingle(),
      sb.from("courses").select("title, level, category, cpd_accredited, cpd_hours, establishment_id, creator_id, is_assisted").eq("id", course_id).maybeSingle(),
    ]);
    if (!user || !course) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isTemplateB = !!course.establishment_id;
const isTemplateC = course.creator_type === 'plateforme' && !course.establishment_id;
    const certId = await generateUniqueCertId(sb);
    const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
    const verifyUrl = `${appUrl}/verify/${certId}`;

    // Get template-specific data
    let creatorName = "";
    let establishmentName = "", establishmentLogoUrl = "", directorName = "", directorSigUrl = "";

    if (isTemplateB) {
      const { data: est } = await sb.from("etablissement_profiles").select("school_name, logo_url, director_name, signature_url").eq("id", course.establishment_id).maybeSingle();
      if (est) { establishmentName = est.school_name; establishmentLogoUrl = est.logo_url; directorName = est.director_name; directorSigUrl = est.signature_url; }
    } else {
      const { data: prof } = await sb.from("users").select("full_name").eq("id", course.creator_id).maybeSingle();
      creatorName = prof?.full_name ?? "";
    }

    const certData = {
      omnia_certificate_id: certId,
      student_full_name: user.full_name,
      course_title: course.title,
      course_level: course.level,
      course_category: course.category,
      cpd_accredited: course.cpd_accredited,
      cpd_hours: course.cpd_hours ?? 0,
      cpd_provider_code: "Omnia-CPD",
      creator_name: creatorName,
      establishment_name: establishmentName,
      establishment_logo_url: establishmentLogoUrl,
      director_name: directorName,
      external_accreditation_logo: course.external_accreditation_logo || null,
external_accreditation_number: course.external_accreditation_number || null,
creator_type: course.creator_type || 'professeur',
      issued_at: new Date().toISOString(),
    };

    const qrSvgStr = await generateQrSvg(verifyUrl);
    const htmlContent = isTemplateC 
  ? buildTemplateC(certData, qrSvg)
  : isTemplateB 
    ? buildTemplateB(certData, qrSvg) 
    : buildTemplateA(certData, qrSvg);

    // Upload HTML to Supabase Storage
    const filename = `certificates/${user_id}/${certId}.html`;
    await sb.storage.from("certificates").upload(filename, html, { contentType: "text/html; charset=utf-8", upsert: true });
    const { data: urlData } = sb.storage.from("certificates").getPublicUrl(filename);
    const pdfUrl = urlData.publicUrl;

    // Insert certificate record
    const { data: cert, error: certErr } = await sb.from("certificates").insert({
      omnia_certificate_id: certId,
      user_id, course_id,
      student_full_name: user.full_name,
      course_title: course.title,
      course_level: course.level,
      course_category: course.category,
      cpd_hours: certData.cpd_hours,
      template_type: isTemplateB ? "B" : "A",
      creator_name: creatorName || null,
      establishment_name: establishmentName || null,
      establishment_logo_url: establishmentLogoUrl || null,
      director_name: directorName || null,
      director_signature_url: directorSigUrl || null,
      cpd_accredited: course.cpd_accredited,
      cpd_provider_code: certData.cpd_provider_code,
      pdf_url: pdfUrl,
    }).select("id, omnia_certificate_id, pdf_url").single();
    if (certErr) throw certErr;

    // Handle CPD badge if accredited
    let cpdPending = false;
    if (course.cpd_accredited && cert) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const cpdRes = await fetch(`${supabaseUrl}/functions/v1/cpd-badge-request`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ certificate_id: certId, user_email: user.email, course_title: course.title, cpd_hours: certData.cpd_hours }),
        });
        const cpdData = await cpdRes.json();
        cpdPending = cpdData.pending ?? false;
      } catch { cpdPending = true; }
    }

    // Send notification via notify-dispatch (replaces direct Brevo call)
    const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl2}/functions/v1/notify-dispatch`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "certificat_genere",
        payload: {
          userId: user_id,
          formation_titre: course.title,
          certificate_id: certId,
          verify_url: verifyUrl,
          pdf_url: pdfUrl,
          cpd_hours: certData.cpd_hours,
          is_cpd: course.cpd_accredited,
        },
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ certificate_id: certId, pdf_url: pdfUrl, cpd_pending: cpdPending }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
