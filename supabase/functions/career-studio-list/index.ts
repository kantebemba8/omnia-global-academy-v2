import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;
  const { data: user } = await sb.from("users")
    .select("id, full_name, email, cv_tokens, career_studio_enabled, profile_completion")
    .eq("id", (sess as { user_id: string }).user_id)
    .maybeSingle();
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── GET public : templates uniquement ───────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const type = url.searchParams.get("type") || "cv";
      const category = url.searchParams.get("category");

      let query = sb.from("career_templates")
        .select("*")
        .eq("template_type", type)
        .eq("is_active", true)
        .order("display_order");

      if (category) query = query.eq("category", category);

      const { data: templates } = await query;

      // Packs de jetons publics
      const { data: packs } = await sb.from("career_token_packs")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      return json({ templates: templates ?? [], packs: packs ?? [] });
    }

    // ── POST : données personnalisées de l'apprenant ────────
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

    const user = await verifySession(sb, token);
    if (!user) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json().catch(() => ({}));
    const doc_type = body.doc_type || "cv";

    // Documents de l'apprenant
    const { data: documents } = await sb.from("career_documents")
      .select("id, title, doc_type, template_key, language, status, ats_score, target_job, application_type, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("doc_type", doc_type)
      .order("updated_at", { ascending: false });

    // Templates disponibles
    const { data: templates } = await sb.from("career_templates")
      .select("*")
      .eq("template_type", doc_type)
      .eq("is_active", true)
      .order("display_order");

    // Packs de jetons
    const { data: packs } = await sb.from("career_token_packs")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    // Config jetons
    const { data: tokenConfig } = await sb.from("career_token_config")
      .select("config_key, config_value")
      .eq("is_active", true);

    const configMap: Record<string, number> = {};
    (tokenConfig ?? []).forEach((c: { config_key: string; config_value: number }) => {
      configMap[c.config_key] = c.config_value;
    });

    // Config IA
    const { data: aiConfig } = await sb.from("career_ai_config").select("config_key, config_value");
    const aiConfigMap: Record<string, string> = {};
    (aiConfig ?? []).forEach((c: { config_key: string; config_value: string }) => {
      aiConfigMap[c.config_key] = c.config_value;
    });

    // Formations Omnia terminées de l'apprenant (pour intégration CV)
    const { data: completedFormations } = await sb.from("enrollments")
      .select("course_id, completed_at, courses(title, category)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("completed_at", "is", null);

    // Certificats obtenus
    const { data: certificates } = await sb.from("certificates")
      .select("id, course_id, omnia_certificate_id, issued_at, courses(title)")
      .eq("user_id", user.id);

    // Code partenaire actif
    const { data: partnerLink } = await sb.from("partner_code_users")
      .select("*, partner_codes(code, advantages), partner_organizations(org_name)")
      .eq("user_id", user.id)
      .eq("status", "validated")
      .maybeSingle();

    return json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        cv_tokens: user.cv_tokens ?? 0,
        career_studio_enabled: user.career_studio_enabled ?? true,
        profile_completion: user.profile_completion ?? 0,
      },
      documents: documents ?? [],
      templates: templates ?? [],
      packs: packs ?? [],
      token_config: configMap,
      ai_config: aiConfigMap,
      completed_formations: completedFormations ?? [],
      certificates: certificates ?? [],
      partner_link: partnerLink ?? null,
    });

  } catch (err) {
    console.error("career-studio-list error:", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});