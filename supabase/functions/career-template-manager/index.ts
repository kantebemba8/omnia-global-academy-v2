import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireAdmin(sb: any, req: Request): Promise<string | null> {
  const token = (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;

  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", session.user_id);
  return (roles || []).some((row: any) => ["super_admin", "admin"].includes(row.role)) ? session.user_id : null;
}

async function uploadImage(sb: any, dataUrl: string, filename: string, mime: string) {
  if (!dataUrl) throw new Error("IMAGE_REQUIRED");
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `thumbnails/${crypto.randomUUID()}-${safeName}`;
  const { error } = await sb.storage.from("career-templates").upload(path, bytes, {
    contentType: mime || "image/png",
    upsert: false,
  });
  if (error) throw error;
  return sb.storage.from("career-templates").getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);

    const sb = createClient(supabaseUrl, serviceKey);
    const adminId = await requireAdmin(sb, req);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data, error } = await sb.from("career_templates").select("*").order("template_type").order("display_order");
      if (error) throw error;
      return json({ templates: data || [] });
    }

    if (action === "upload_thumbnail") {
      const url = await uploadImage(sb, String(body.data_url || ""), String(body.filename || "template.png"), String(body.mime || "image/png"));
      return json({ success: true, url });
    }

    if (action === "delete") {
      const { error } = await sb
        .from("career_templates")
        .delete()
        .eq("template_key", body.template_key)
        .eq("is_custom", true);
      if (error) throw error;
      return json({ success: true });
    }

    if (action !== "upsert") return json({ error: "UNKNOWN_ACTION" }, 400);

    const template = body.template || {};
    const key = String(template.template_key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_");
    if (!key || !["cv", "lm"].includes(template.template_type)) return json({ error: "INVALID_TEMPLATE" }, 400);

    const layout = template.layout_config || {};
    if (!layout.variant || !layout.primary || !layout.accent) {
      return json({ error: "LAYOUT_REQUIRED", message: "Choisissez une mise en page et ses couleurs avant de publier le modèle." }, 400);
    }

    const payload = {
      template_key: key,
      template_type: template.template_type,
      name_fr: String(template.name_fr || key),
      description_fr: String(template.description_fr || ""),
      category: String(template.category || "custom"),
      is_free: Boolean(template.is_free),
      is_active: template.is_active !== false,
      is_ats_compatible: Boolean(template.is_ats_compatible),
      display_order: Number(template.display_order || 99),
      thumbnail_url: template.thumbnail_url || null,
      layout_config: layout,
      is_custom: true,
      created_by: adminId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from("career_templates")
      .upsert(payload, { onConflict: "template_key" })
      .select("*")
      .single();
    if (error) throw error;

    return json({ template: data });
  } catch (error) {
    console.error("career-template-manager error:", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
