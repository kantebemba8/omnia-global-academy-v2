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
    const body = await req.json();
    const { certificate_id, user_email, course_title, cpd_hours } = body;
    if (!certificate_id || !user_email) return new Response(JSON.stringify({ error: "MISSING_FIELDS" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check credit availability
    const { data: credits } = await sb.from("cpd_credits").select("id, total_credits, used_credits").order("id").limit(1).maybeSingle();
    const available = (credits?.total_credits ?? 0) - (credits?.used_credits ?? 0);

    if (available <= 0) {
      // Mark certificate as pending
      await sb.from("certificates").update({ cpd_pending: true }).eq("omnia_certificate_id", certificate_id);

      // Notify super-admin
      const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
      if (brevoKey) {
        const { data: pendingCount } = await sb.from("certificates").select("id", { count: "exact" }).eq("cpd_pending", true).eq("cpd_accredited", true);
        const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "super_admin");
        if (admins?.length) {
          const { data: adminUsers } = await sb.from("users").select("email").in("id", admins.map(a => a.user_id));
          for (const admin of adminUsers ?? []) {
            await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { "api-key": brevoKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                to: [{ email: admin.email }],
                subject: "⚠️ Pack CPD épuisé — Omnia Global Academy",
                htmlContent: `<p>Le pack CPD est épuisé. <strong>${pendingCount?.length ?? "?"}</strong> badge(s) en attente d'émission.</p><p>Rechargez les crédits dans le panneau super-admin pour traiter les badges en attente.</p>`,
                sender: { email: "admission@omniaglobalacademy.com", name: "Omnia Global Academy" },
              }),
            }).catch(() => {});
          }
        }
      }
      return new Response(JSON.stringify({ badge_issued: false, pending: true, message: "Crédits CPD épuisés" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Issue badge via Open CPD API
    const cpdApiKey = Deno.env.get("OPENCPD_API_KEY") ?? "";
    let badgeUrl = "";
    try {
      const cpdRes = await fetch("https://api.opencpd.com/v1/badges/issue", {
        method: "POST",
        headers: { "Authorization": `Bearer ${cpdApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user_email,
          course_name: course_title,
          cpd_hours: cpd_hours,
          issuer: "Omnia Global Academy",
          certificate_ref: certificate_id,
        }),
      });
      if (cpdRes.ok) {
        const cpdData = await cpdRes.json();
        badgeUrl = cpdData.badge_url ?? cpdData.url ?? "";
      }
    } catch { /* API unavailable — still increment credits */ }

    // Increment used_credits
    if (credits) {
      await sb.from("cpd_credits").update({
        used_credits: (credits.used_credits || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", credits.id);
    }

    // Update certificate with badge URL
    await sb.from("certificates").update({
      cpd_badge_url: badgeUrl || null,
      cpd_pending: false,
    }).eq("omnia_certificate_id", certificate_id);

    return new Response(JSON.stringify({ badge_issued: true, badge_url: badgeUrl, pending: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
