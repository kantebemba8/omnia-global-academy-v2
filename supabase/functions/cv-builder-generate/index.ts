import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildCvHtml(cvData: any, template: string, withPhoto: boolean): string {
  const d = cvData;
  const colors: Record<string, { primary: string; accent: string; sidebar: string }> = {
    classique: { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA' },
    moderne_ats: { primary: '#1A1A2E', accent: '#E94560', sidebar: '#FFFFFF' },
    etudiant: { primary: '#002050', accent: '#BF8813', sidebar: '#EEF2FF' },
    international: { primary: '#002050', accent: '#BF8813', sidebar: '#F0F4F8' },
    qse: { primary: '#1B4332', accent: '#52B788', sidebar: '#D8F3DC' },
    it_digital: { primary: '#0D1B2A', accent: '#00B4D8', sidebar: '#1B263B' },
    business: { primary: '#002050', accent: '#BF8813', sidebar: '#FFF8F0' },
    formateur: { primary: '#2D3561', accent: '#C84B31', sidebar: '#F5F5F5' },
  };

  const c = colors[template] || colors.classique;
  const isAts = template === 'moderne_ats';
  const isDark = template === 'it_digital';

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '';

  const skillBar = (level: number) => isAts ? '' : `
    <div style="background:#e0e0e0;border-radius:4px;height:4px;margin-top:3px">
      <div style="background:${c.accent};border-radius:4px;height:4px;width:${level}%"></div>
    </div>`;

  const sidebarContent = `
    ${d.contact ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:${isDark ? '#aaa' : c.primary};letter-spacing:.15em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Contact</div>
      ${d.contact.email ? `<div style="font-size:9px;color:${isDark ? '#ccc' : '#374151'};margin-bottom:5px">📧 ${d.contact.email}</div>` : ''}
      ${d.contact.phone ? `<div style="font-size:9px;color:${isDark ? '#ccc' : '#374151'};margin-bottom:5px">📞 ${d.contact.phone}</div>` : ''}
      ${d.contact.location ? `<div style="font-size:9px;color:${isDark ? '#ccc' : '#374151'};margin-bottom:5px">📍 ${d.contact.location}</div>` : ''}
      ${d.contact.linkedin ? `<div style="font-size:9px;color:${c.accent};margin-bottom:5px">🔗 LinkedIn</div>` : ''}
      ${d.contact.portfolio ? `<div style="font-size:9px;color:${c.accent};margin-bottom:5px">🌐 Portfolio</div>` : ''}
    </div>` : ''}

    ${d.skills?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:${isDark ? '#aaa' : c.primary};letter-spacing:.15em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Compétences</div>
      ${d.skills.map((s: any) => `
        <div style="margin-bottom:8px">
          <div style="font-size:9px;font-weight:600;color:${isDark ? '#fff' : '#374151'}">${s.name}</div>
          ${s.level ? skillBar(s.level) : ''}
        </div>
      `).join('')}
    </div>` : ''}

    ${d.languages?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:${isDark ? '#aaa' : c.primary};letter-spacing:.15em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Langues</div>
      ${d.languages.map((l: any) => `
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:9px">
            <span style="font-weight:600;color:${isDark ? '#fff' : '#374151'}">${l.name}</span>
            <span style="color:${c.accent}">${l.level}</span>
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    ${d.certifications_external?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:${isDark ? '#aaa' : c.primary};letter-spacing:.15em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Certifications</div>
      ${d.certifications_external.map((cert: any) => `
        <div style="margin-bottom:8px">
          <div style="font-size:9px;font-weight:600;color:${isDark ? '#fff' : '#374151'}">${cert.name}</div>
          <div style="font-size:8px;color:${isDark ? '#ccc' : '#6B7280'}">${cert.issuer || ''} ${cert.year || ''}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${d.interests?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:${isDark ? '#aaa' : c.primary};letter-spacing:.15em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Centres d'intérêt</div>
      <div style="font-size:9px;color:${isDark ? '#ccc' : '#374151'};line-height:1.6">${Array.isArray(d.interests) ? d.interests.join(' • ') : d.interests}</div>
    </div>` : ''}
  `;

  const mainContent = `
    ${d.summary ? `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Profil professionnel</div>
      <p style="font-size:10px;color:#374151;line-height:1.7;text-align:justify">${d.summary}</p>
    </div>` : ''}

    ${d.experiences?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:12px">Expériences professionnelles</div>
      ${d.experiences.map((exp: any) => `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:11px;font-weight:700;color:${c.primary}">${exp.position}</div>
              <div style="font-size:10px;font-weight:600;color:${c.accent}">${exp.company}${exp.location ? ` · ${exp.location}` : ''}</div>
            </div>
            <div style="font-size:9px;color:#6B7280;text-align:right;white-space:nowrap">
              ${exp.start_date ? formatDate(exp.start_date) : ''} — ${exp.current ? "Présent" : (exp.end_date ? formatDate(exp.end_date) : '')}
            </div>
          </div>
          ${exp.description ? `<p style="font-size:9px;color:#374151;line-height:1.6;margin-top:4px">${exp.description}</p>` : ''}
        </div>
      `).join('')}
    </div>` : ''}

    ${d.omnia_formations?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:12px">Formations Omnia Global Academy</div>
      ${d.omnia_formations.map((f: any) => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:10px;font-weight:700;color:${c.primary}">${f.title}</div>
              <div style="font-size:9px;color:${c.accent}">Omnia Global Academy${f.cpd_accredited ? ' · CPD Certifié' : ''}</div>
              ${f.certificate_id ? `<div style="font-size:8px;color:#9CA3AF">Cert. ${f.certificate_id}${f.verify_url ? ' · Vérifiable en ligne' : ''}</div>` : ''}
            </div>
            ${f.completed_at ? `<div style="font-size:9px;color:#6B7280">${formatDate(f.completed_at)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    ${d.education?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:12px">Formation académique</div>
      ${d.education.map((edu: any) => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between">
            <div>
              <div style="font-size:10px;font-weight:700;color:${c.primary}">${edu.degree}</div>
              <div style="font-size:9px;color:#374151">${edu.school}${edu.location ? ` · ${edu.location}` : ''}</div>
            </div>
            <div style="font-size:9px;color:#6B7280">${edu.year || ''}</div>
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    ${d.projects?.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:12px">Projets</div>
      ${d.projects.map((p: any) => `
        <div style="margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;color:${c.primary}">${p.name}</div>
          ${p.description ? `<p style="font-size:9px;color:#374151;line-height:1.6;margin-top:2px">${p.description}</p>` : ''}
          ${p.technologies ? `<div style="font-size:8px;color:${c.accent};margin-top:2px">${p.technologies}</div>` : ''}
        </div>
      `).join('')}
    </div>` : ''}
  `;

  const atsLayout = `
    <div style="font-family:Arial,sans-serif;max-width:794px;margin:0 auto;padding:40px;background:#fff;color:#1A1A2E">
      <div style="border-bottom:3px solid ${c.accent};padding-bottom:16px;margin-bottom:20px">
        <div style="font-size:28px;font-weight:900;color:${c.primary};line-height:1.1">${d.name || ''}</div>
        <div style="font-size:14px;color:${c.accent};font-weight:600;margin-top:4px">${d.title || ''}</div>
        <div style="font-size:10px;color:#6B7280;margin-top:8px;display:flex;gap:20px;flex-wrap:wrap">
          ${d.contact?.email ? `<span>${d.contact.email}</span>` : ''}
          ${d.contact?.phone ? `<span>${d.contact.phone}</span>` : ''}
          ${d.contact?.location ? `<span>${d.contact.location}</span>` : ''}
          ${d.contact?.linkedin ? `<span>LinkedIn</span>` : ''}
        </div>
      </div>
      ${mainContent}
      ${d.skills?.length ? `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Compétences</div>
        <div style="font-size:10px;color:#374151;line-height:1.8">${d.skills.map((s: any) => s.name).join(' • ')}</div>
      </div>` : ''}
      ${d.languages?.length ? `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid ${c.accent};padding-bottom:4px;margin-bottom:10px">Langues</div>
        <div style="font-size:10px;color:#374151;line-height:1.8">${d.languages.map((l: any) => `${l.name} (${l.level})`).join(' • ')}</div>
      </div>` : ''}
    </div>`;

  const twoColLayout = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:794px;margin:0 auto;background:#fff;display:flex;min-height:1123px">
      <!-- Sidebar -->
      <div style="width:220px;min-width:220px;background:${isDark ? '#1B263B' : c.sidebar};padding:30px 20px;${isDark ? 'color:#fff' : ''}">
        ${withPhoto && d.photo_url ? `
        <div style="text-align:center;margin-bottom:20px">
          <img src="${d.photo_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid ${c.accent}" />
        </div>` : ''}
        ${withPhoto && !d.photo_url ? `
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:80px;height:80px;border-radius:50%;background:${c.primary};display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:white">
            ${(d.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
        </div>` : ''}
        ${sidebarContent}
      </div>
      <!-- Main -->
      <div style="flex:1;padding:30px 30px 30px 25px">
        <div style="border-bottom:3px solid ${c.accent};padding-bottom:12px;margin-bottom:20px">
          <div style="font-size:24px;font-weight:900;color:${c.primary};line-height:1.1">${d.name || ''}</div>
          <div style="font-size:13px;color:${c.accent};font-weight:600;margin-top:4px">${d.title || ''}</div>
          ${d.objective ? `<div style="font-size:9px;color:#6B7280;margin-top:6px;font-style:italic">${d.objective}</div>` : ''}
        </div>
        ${mainContent}
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { width: 794px; }
</style>
</head>
<body>
${isAts ? atsLayout : twoColLayout}
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);

  const body = await req.json();
  const { cv_id, preview_only } = body;

  if (!cv_id) return json({ error: "cv_id requis" }, 400);

  // Récupérer le CV
  const { data: cv } = await sb
    .from("cv_profiles")
    .select("*")
    .eq("id", cv_id)
    .eq("user_id", sess.user_id)
    .maybeSingle();

  if (!cv) return json({ error: "CV non trouvé" }, 404);

  // Générer le HTML
  const html = buildCvHtml(cv.cv_data, cv.template_id, cv.with_photo);

  // Mode aperçu — gratuit, retourne juste le HTML
  if (preview_only) {
    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── MODE TÉLÉCHARGEMENT PDF ──

  // Vérifier les jetons
  const { data: user } = await sb
    .from("users")
    .select("cv_tokens")
    .eq("id", sess.user_id)
    .maybeSingle();

  const currentTokens = user?.cv_tokens ?? 0;

  // Vérifier si le contenu a changé depuis le dernier téléchargement
  const contentUnchanged = !!(
    cv.content_hash &&
    cv.last_pdf_hash &&
    cv.content_hash === cv.last_pdf_hash
  );

  if (!contentUnchanged && currentTokens < 1) {
    return json({
      error: "INSUFFICIENT_TOKENS",
      message: "Vous n'avez plus de jetons. Achetez une formation pour en obtenir.",
      tokens: currentTokens,
    }, 402);
  }

  // Appel à html2pdf.app pour obtenir le PDF binaire
  const apiKey = Deno.env.get("HTML2PDF_API_KEY") ?? "";
  
  const pdfResp = await fetch("https://api.html2pdf.app/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      apiKey,
      format: "A4",
      landscape: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
    }),
  });

  if (!pdfResp.ok) {
    const errText = await pdfResp.text();
    console.error("html2pdf.app error:", pdfResp.status, errText);
    return json({ error: "PDF_GENERATION_FAILED", detail: errText }, 500);
  }

  // Récupérer le PDF en binaire
  const pdfBuffer = await pdfResp.arrayBuffer();

  // Consommer 1 jeton si le contenu a changé
  if (!contentUnchanged) {
    await sb.from("users")
      .update({ cv_tokens: Math.max(0, currentTokens - 1) })
      .eq("id", sess.user_id);
  }

  // Mettre à jour le hash du dernier téléchargement
  await sb.from("cv_profiles").update({
    last_pdf_hash: cv.content_hash,
    updated_at: new Date().toISOString(),
  }).eq("id", cv_id);

  // ✅ Retourner le PDF directement au navigateur (pas de R2)
  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cv-omnia.pdf"`,
      "X-Tokens-Remaining": String(contentUnchanged ? currentTokens : Math.max(0, currentTokens - 1)),
      "X-Token-Consumed": contentUnchanged ? "false" : "true",
    },
  });
});
