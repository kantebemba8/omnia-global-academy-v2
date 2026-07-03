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

    const { data: role } = await sb.from("user_roles").select("role").eq("user_id", sess.user_id).eq("role", "super_admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { credits_to_add } = body;
    if (!credits_to_add || credits_to_add <= 0) return new Response(JSON.stringify({ error: "INVALID_AMOUNT" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Update credits
    const { data: credits } = await sb.from("cpd_credits").select("*").order("id").limit(1).maybeSingle();
    if (!credits) return new Response(JSON.stringify({ error: "CPD_CREDITS_NOT_FOUND" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await sb.from("cpd_credits").update({
      total_credits: (credits.total_credits || 0) + credits_to_add,
      last_recharged_at: new Date().toISOString(),
      last_recharged_by: sess.user_id,
      updated_at: new Date().toISOString(),
    }).eq("id", credits.id);

    // Process pending CPD badges
    const remaining = credits_to_add;
    const { data: pendingCerts } = await sb.from("certificates")
      .select("id, omnia_certificate_id, user_id, course_title, cpd_hours")
      .eq("cpd_pending", true).eq("cpd_accredited", true)
      .order("issued_at").limit(remaining);

    let processed = 0;
    for (const cert of pendingCerts ?? []) {
      const { data: user } = await sb.from("users").select("email").eq("id", cert.user_id).maybeSingle();
      if (!user) continue;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/cpd-badge-request`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            certificate_id: cert.omnia_certificate_id,
            user_email: user.email,
            course_title: cert.course_title,
            cpd_hours: cert.cpd_hours,
          }),
        });
        const d = await res.json();
        if (d.badge_issued) processed++;
      } catch { /* continue */ }
    }

    return new Response(JSON.stringify({
      success: true,
      credits_added: credits_to_add,
      new_total: (credits.total_credits || 0) + credits_to_add,
      pending_processed: processed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
