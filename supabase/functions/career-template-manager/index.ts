import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function adminUser(sb: ReturnType<typeof createClient>, token: string) {
  const { data: session } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const { data: user } = await sb.from("users").select("id, role").eq("id", session.user_id).maybeSingle();
  return user && ["super_admin", "admin"].includes(String(user.role)) ? user : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const user = await adminUser(sb, token);
    if (!user) return json({ error: "FORBIDDEN" }, 403);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const { data, error } = await sb.from("career_templates").select("*").order("template_type").order("display_order");
      if (error) throw error;
      return json({ templates: data || [] });
    }

    if (action === "delete") {
      const { error } = await sb.from("career_templates").delete().eq("template_key", body.template_key).eq("is_custom", true);
      if (error) throw error;
      return json({ success: true });
    }

    const t = body.template || {};
    const key = String(t.template_key || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key || !["cv", "lm"].includes(t.template_type)) return json({ error: "INVALID_TEMPLATE" }, 400);
    const layout = t.layout_config || {};
    if (!layout.variant || !layout.primary || !layout.accent) return json({ error: "LAYOUT_REQUIRED" }, 400);

    const payload = {
      template_key: key,
      template_type: t.template_type,
      name_fr: String(t.name_fr || key),
      description_fr: String(t.description_fr || ""),
      category: String(t.category || "custom"),
      is_free: Boolean(t.is_free),
      is_active: t.is_active !== false,
      is_ats_compatible: Boolean(t.is_ats_compatible),
      display_order: Number(t.display_order || 99),
      thumbnail_url: t.thumbnail_url || null,
      layout_config: layout,
      is_custom: true,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("career_templates").upsert(payload, { onConflict: "template_key" }).select().single();
    if (error) throw error;
    return json({ template: data });
  } catch (error) {
    return json({ error: "SERVER_ERROR", message: (error as Error).message }, 500);
  }
});
