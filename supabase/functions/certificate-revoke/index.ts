import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: sess } = await sb.from("user_sessions").select("user_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // La révocation définitive d’un certificat est une décision finale réservée au Super-admin
    const { data: role } = await sb.from("user_roles").select("role")
      .eq("user_id", sess.user_id).eq("role", "super_admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { certificate_id, reason } = body;
    if (!certificate_id) return new Response(JSON.stringify({ error: "MISSING_CERTIFICATE_ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cert } = await sb.from("certificates").select("id, status").eq("omnia_certificate_id", certificate_id).maybeSingle();
    if (!cert) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (cert.status === "revoque") return new Response(JSON.stringify({ error: "ALREADY_REVOKED" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await sb.from("certificates").update({
      status: "revoque",
      revocation_reason: reason || null,
      revoked_by: sess.user_id,
      revoked_at: new Date().toISOString(),
    }).eq("id", cert.id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
