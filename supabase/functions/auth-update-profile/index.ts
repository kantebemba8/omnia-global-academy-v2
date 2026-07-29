import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const ALLOWED_FIELDS = ["full_name", "email", "phone_number", "country_code", "avatar_url", "allow_email", "allow_sms", "allow_push", "subscribe_newsletter"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "PATCH" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }

  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) return json({ error: "Aucun champ valide fourni" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Check email uniqueness if updating email
    if (updates.email) {
      const { data: existing } = await sb.from("users").select("id").eq("email", updates.email as string).neq("id", userId).maybeSingle();
      if (existing) return json({ error: "EMAIL_TAKEN" }, 409);
    }

    // Check phone uniqueness if updating phone
    if (updates.phone_number) {
      const { data: existing } = await sb.from("users").select("id").eq("phone_number", updates.phone_number as string).neq("id", userId).maybeSingle();
      if (existing) return json({ error: "PHONE_TAKEN" }, 409);
    }

    updates.updated_at = new Date().toISOString();
    const { error } = await sb.from("users").update(updates).eq("id", userId);
    if (error) throw error;

    const { data: user } = await sb.from("users").select("id,full_name,email,phone_number,country_code,avatar_url,allow_email,allow_sms,allow_push,subscribe_newsletter,ai_tokens").eq("id", userId).maybeSingle();
    return json({ success: true, user });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
