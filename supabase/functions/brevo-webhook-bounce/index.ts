import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeCorsHeaders } from "../_shared/auth-security.ts";
import { normalizeNewsletterEmail, setNewsletterConsent } from "../_shared/newsletter.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const configuredToken = Deno.env.get("BREVO_WEBHOOK_TOKEN") || "";
    if (configuredToken) {
      const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
      const custom = req.headers.get("x-brevo-webhook-token")?.trim() || "";
      if (bearer !== configuredToken && custom !== configuredToken) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const event = String(body.event || "").trim();
    const normalizedEvent = event.toLowerCase().replace(/[^a-z]/g, "");
    const email = normalizeNewsletterEmail(body.email);
    if (!email) return json({ received: true });

    const { data: user } = await sb.from("users").select("id,email_status").eq("email", email).maybeSingle();
    const hardFailureEvents = new Set(["hardbounce", "spam", "complaint", "blocked", "invalidemail", "invalid"]);
    const unsubscribeEvents = new Set(["unsubscribe", "unsubscribed"]);

    if (hardFailureEvents.has(normalizedEvent)) {
      if (user?.id) await sb.from("users").update({ email_status: "invalide" }).eq("id", user.id);
      const { data: subscriber } = await sb.from("newsletter_subscribers").select("id").eq("email", email).maybeSingle();
      if (subscriber?.id) {
        await setNewsletterConsent(sb, {
          email,
          userId: user?.id || null,
          active: false,
          source: "brevo_webhook",
          actionOverride: "bounce_suppression",
        });
        await sb.from("newsletter_subscribers").update({ provider_sync_status: "suppressed" }).eq("id", subscriber.id);
      }
    } else if (unsubscribeEvents.has(normalizedEvent)) {
      const { data: subscriber } = await sb.from("newsletter_subscribers").select("id").eq("email", email).maybeSingle();
      if (subscriber?.id) {
        await setNewsletterConsent(sb, {
          email,
          userId: user?.id || null,
          active: false,
          source: "brevo_webhook",
          actionOverride: "provider_unsubscribe",
        });
      }
    }

    const trackedStatus: Record<string, string> = {
      sent: "sent",
      delivered: "delivered",
      deferred: "deferred",
      softbounce: "bounced",
      hardbounce: "bounced",
      spam: "bounced",
      complaint: "bounced",
      blocked: "bounced",
      invalidemail: "bounced",
      invalid: "bounced",
      unsubscribe: "unsubscribed",
      unsubscribed: "unsubscribed",
    };
    if (trackedStatus[normalizedEvent]) {
      await sb.from("notification_log").insert({
        user_id: user?.id ?? null,
        channel: "email",
        template_id: `brevo_${normalizedEvent || "event"}`,
        recipient: email,
        status: trackedStatus[normalizedEvent],
        error_message: hardFailureEvents.has(normalizedEvent) || normalizedEvent === "softbounce"
          ? `Brevo event: ${event}`
          : null,
        metadata: body,
      }).catch(() => {});
    }

    return json({ received: true });
  } catch (error) {
    console.error("brevo-webhook-bounce", error);
    return json({ error: "INTERNAL" }, 500);
  }
});
