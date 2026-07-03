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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "etablissement_directeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json();
    const { title, description, location, contract_type, category, deadline } = body as {
      title: string; description: string; location?: string;
      contract_type?: string; category?: string; deadline?: string;
    };
    if (!title || !description) return json({ error: "MISSING_FIELDS" }, 400);

    const { data: etab } = await sb.from("etablissement_profiles").select("id").eq("user_id", userId).maybeSingle();
    const estabId = etab ? (etab as unknown as { id: string }).id : null;

    const { data: offer, error: offerErr } = await sb.from("job_offers").insert({
      posted_by_id: userId,
      establishment_id: estabId,
      title,
      description,
      location: location ?? null,
      contract_type: contract_type ?? null,
      category: category ?? null,
      deadline: deadline ?? null,
      status: "pending_moderation",
    }).select("id").single();
    if (offerErr || !offer) return json({ error: "CREATE_FAILED", message: offerErr?.message }, 500);

    return json({ success: true, job_id: (offer as unknown as { id: string }).id });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
