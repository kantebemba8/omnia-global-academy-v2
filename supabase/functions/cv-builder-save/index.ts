import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    if (req.method === "GET") {
      const { data } = await sb.from("cv_builder_data").select("step1_data,step2_data,step3_data,step4_template").eq("user_id", userId).maybeSingle();
      return json({ cv: data ?? { step1_data: null, step2_data: null, step3_data: null, step4_template: "moderne" } });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body: { step?: number; data?: unknown; template?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
    const { step, data, template } = body;

    const { data: existing } = await sb.from("cv_builder_data").select("id").eq("user_id", userId).maybeSingle();

    const updates: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (step === 1) updates.step1_data = data;
    else if (step === 2) updates.step2_data = data;
    else if (step === 3) updates.step3_data = data;
    else if (step === 4 && template) updates.step4_template = template;
    else return json({ error: "step (1-4) requis" }, 400);

    if (existing) {
      await sb.from("cv_builder_data").update(updates).eq("user_id", userId);
    } else {
      await sb.from("cv_builder_data").insert(updates);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
