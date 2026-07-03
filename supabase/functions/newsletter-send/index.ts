import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";

    // Auth: session token → super_admin role
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const { data: sess } = await sb.from("user_sessions").select("user_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "UNAUTHORIZED" }, 401);

    const { data: role } = await sb.from("user_roles").select("role")
      .eq("user_id", sess.user_id).eq("role", "super_admin").maybeSingle();
    if (!role) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json();
    const { subject, content_html, channel, sms_text, schedule_at } = body as {
      subject: string;
      content_html: string;
      channel: "email" | "sms";
      sms_text?: string;
      schedule_at?: string;
    };

    if (!subject || !channel) return json({ error: "MISSING_FIELDS" }, 400);
    if (channel === "email" && !content_html) return json({ error: "MISSING_CONTENT_HTML" }, 400);
    if (channel === "sms" && !sms_text) return json({ error: "MISSING_SMS_TEXT" }, 400);

    if (!brevoKey) return json({ error: "BREVO_NOT_CONFIGURED" }, 500);

    let campaignId: number | null = null;

    if (channel === "email") {
      // Create email campaign
      const campaignRes = await fetch("https://api.brevo.com/v3/emailCampaigns", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Newsletter ${new Date().toISOString().slice(0, 10)}`,
          subject,
          sender: { name: "Omnia Global Academy", email: "contact@omniaglobalacademy.com" },
          type: "classic",
          htmlContent: content_html,
          recipients: { listIds: [7] },
          ...(schedule_at ? { scheduledAt: schedule_at } : {}),
        }),
      });

      if (!campaignRes.ok) {
        const err = await campaignRes.text();
        return json({ error: "BREVO_CREATE_FAILED", detail: err }, 500);
      }
      const campaignData = await campaignRes.json();
      campaignId = campaignData.id;

      // Send now if no schedule
      if (!schedule_at && campaignId) {
        await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
          method: "POST",
          headers: { "api-key": brevoKey },
        });
      }
    } else {
      // Create SMS campaign via Brevo
      const smsRes = await fetch("https://api.brevo.com/v3/smsCampaigns", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `SMS ${new Date().toISOString().slice(0, 10)}`,
          sender: "OmniaAcad",
          content: (sms_text || "").substring(0, 160),
          recipients: { listIds: [7] },
          ...(schedule_at ? { scheduledAt: schedule_at } : {}),
        }),
      });

      if (!smsRes.ok) {
        const err = await smsRes.text();
        return json({ error: "BREVO_SMS_FAILED", detail: err }, 500);
      }
      const smsData = await smsRes.json();
      campaignId = smsData.id;

      if (!schedule_at && campaignId) {
        await fetch(`https://api.brevo.com/v3/smsCampaigns/${campaignId}/sendNow`, {
          method: "POST",
          headers: { "api-key": brevoKey },
        });
      }
    }

    // Record in newsletter_campaigns
    await sb.from("newsletter_campaigns").insert({
      subject,
      content_html: content_html || sms_text || "",
      channel,
      status: schedule_at ? "scheduled" : "sent",
      sent_at: schedule_at ? null : new Date().toISOString(),
      sent_by: sess.user_id,
    });

    return json({ success: true, campaign_id: campaignId, scheduled: !!schedule_at });
  } catch (err) {
    return json({ error: "INTERNAL", message: (err as Error).message }, 500);
  }
});
