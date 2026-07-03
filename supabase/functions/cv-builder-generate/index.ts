import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Anthropic from "npm:@anthropic-ai/sdk@0.40.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getTemplateStyle(template: string): string {
  const styles: Record<string, string> = {
    "template_a": "Professionnel classique avec colonnes, couleurs navy #002050 et blanc",
    "template_b": "Moderne avec sidebar colorée, navy #002050 et or #BF8813",
    "template_c": "Minimaliste, typographie forte, noir et blanc exclusivement",
    "moderne": "Moderne avec accent or #BF8813 sur fond navy #002050",
    "classique": "Classique sobre, #1a1a1a et #444",
    "elegant": "Élégant avec vert #1E7A52",
  };
  return styles[template] || styles["moderne"];
}

function buildEnrichedSystemPrompt(): string {
  return `Tu es un expert en rédaction de CV professionnels africains.

RÈGLES ABSOLUES :
- Aucune photo (lutter contre discrimination visuelle)
- Génère uniquement du HTML structuré, élégant
- CSS inline uniquement (pas de balise <style> externe)
- Pas de préambule, pas de backticks markdown — juste le HTML
- Langue : français professionnel
- Structure claire : En-tête, Résumé professionnel, Formations & Certifications, Expériences, Compétences
- Valorise les certifications CPD comme atout majeur (badge visuel distinct)
- Adapte le ton au marché africain (UEMOA/CEDEAO)
- Largeur max 800px, centré, format A4 approximatif
- Police : Arial ou sans-serif
- Aucune image, aucune photo, aucun SVG complexe`;
}

function buildEnrichedUserPrompt(
  step1: Record<string, unknown>,
  step2: Record<string, unknown>,
  step3: Record<string, unknown>,
  template: string
): string {
  const formations = Array.isArray(step2) ? step2 : (step2 as Record<string, unknown[]>).formations || [];
  const experiences = Array.isArray(step3) ? step3 : (step3 as Record<string, unknown[]>).experiences || [];

  const formationsBlock = (formations as Array<Record<string, unknown>>).map((f) =>
    `- ${f.title || f.formation} (${f.completed_at || f.annee})
  Niveau : ${f.level || f.niveau || "N/A"} | Catégorie : ${f.category || f.categorie || "N/A"}
  ${f.cpd_accredited ? `CPD Certifié : ${f.cpd_hours}h` : ""}
  ${f.omnia_certificate_id ? `Certificat vérifiable : CERT-${f.omnia_certificate_id}` : ""}`
  ).join("\n");

  const experiencesBlock = (experiences as Array<Record<string, unknown>>).map((exp) =>
    `- ${exp.position || exp.poste} chez ${exp.company || exp.entreprise}
  ${exp.country || exp.pays || ""} | ${exp.start_date || exp.debut} - ${exp.current ? "Aujourd'hui" : exp.end_date || exp.fin}
  ${exp.description || ""}`
  ).join("\n");

  return `Génère un CV HTML complet (CSS inline, sans photo) avec le template "${template}" : ${getTemplateStyle(template)}.

INFORMATIONS PERSONNELLES :
${JSON.stringify(step1, null, 2)}

FORMATIONS & CERTIFICATIONS OMNIA :
${formationsBlock || JSON.stringify(step2, null, 2)}

EXPÉRIENCES PROFESSIONNELLES :
${experiencesBlock || JSON.stringify(step3, null, 2)}

Génère le HTML du CV UNIQUEMENT, sans commentaires, sans backticks.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { preview?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const isPreview = body.preview === true;

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Rate limit: 5 generations / hour / user (skip for preview)
    if (!isPreview) {
      const { count: cvCount } = await sb.from("rate_limit_log")
        .select("*", { count: "exact", head: true })
        .eq("rate_key", `cv-generate:${userId}`)
        .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
      if ((cvCount ?? 0) >= 5) {
        return json({ error: "RATE_LIMIT", message: "Limite de 5 générations par heure atteinte. Réessayez plus tard." }, 429);
      }
      await sb.from("rate_limit_log").insert({ rate_key: `cv-generate:${userId}`, created_at: new Date().toISOString() });
    }

    const { data: cvRow } = await sb.from("cv_builder_data").select("step1_data,step2_data,step3_data,step4_template").eq("user_id", userId).maybeSingle();
    if (!cvRow || !cvRow.step1_data) return json({ error: "CV_DATA_INCOMPLETE", message: "Complétez au moins l'étape 1 du CV builder." }, 400);

    const template = cvRow.step4_template ?? "moderne";

    if (!isPreview) {
      const { data: user } = await sb.from("users").select("ai_tokens").eq("id", userId).maybeSingle();
      if (((user as unknown as { ai_tokens: number } | null)?.ai_tokens ?? 0) < 1) {
        return json({ error: "INSUFFICIENT_TOKENS", message: "Vous n'avez plus de jetons IA. Parrainez un ami pour en obtenir." }, 402);
      }
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: buildEnrichedSystemPrompt(), cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: buildEnrichedUserPrompt(
          cvRow.step1_data as Record<string, unknown>,
          cvRow.step2_data as Record<string, unknown> ?? {},
          cvRow.step3_data as Record<string, unknown> ?? {},
          template
        ),
      }],
    });

    const htmlContent = msg.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");

    if (!isPreview) {
      await sb.rpc("decrement_ai_tokens", { p_user_id: userId }).catch(async () => {
        const { data: u } = await sb.from("users").select("ai_tokens").eq("id", userId).maybeSingle();
        const current = (u as unknown as { ai_tokens: number } | null)?.ai_tokens ?? 0;
        await sb.from("users").update({ ai_tokens: Math.max(0, current - 1) }).eq("id", userId);
      });
    }

    return json({ html: htmlContent, tokens_used: isPreview ? 0 : 1 });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
