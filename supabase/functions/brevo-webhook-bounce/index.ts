import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeCorsHeaders, sha256Hex } from "../_shared/auth-security.ts";
import { NEWSLETTER_CONSENT_VERSION, normalizeNewsletterEmail } from "../_shared/newsletter.ts";

type BrevoScope = "transactional" | "marketing";
type DbClient = ReturnType<typeof createClient>;

function cleanScalar(value: unknown, max = 300): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, max);
  return null;
}

function cleanTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.slice(0, 10).map(item => String(item).slice(0, 100));
  if (typeof value === "string" && value.trim()) return [value.trim().slice(0, 100)];
  return [];
}

async function suppressNewsletterFromProvider(
  sb: DbClient,
  input: { email: string; userId?: string | null; action: "provider_unsubscribe" | "bounce_suppression" },
) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await sb.from("newsletter_subscribers")
    .select("id,status,locale,user_id")
    .eq("email", input.email)
    .maybeSingle();
  if (existingError) throw existingError;

  const providerSyncStatus = input.action === "bounce_suppression" ? "suppressed" : "synced";
  const payload = {
    email: input.email,
    user_id: input.userId || existing?.user_id || null,
    status: "unsubscribed",
    locale: String(existing?.locale || "fr"),
    source: "brevo_webhook",
    consent_version: NEWSLETTER_CONSENT_VERSION,
    consented_at: null,
    unsubscribed_at: now,
    provider_synced_at: now,
    provider_sync_status: providerSyncStatus,
    provider_last_error: null,
    updated_at: now,
  };

  const { data: subscriber, error } = existing?.id
    ? await sb.from("newsletter_subscribers").update(payload).eq("id", existing.id).select("id").single()
    : await sb.from("newsletter_subscribers").insert(payload).select("id").single();
  if (error) throw error;

  // Les retries Brevo ne doivent pas multiplier le journal de consentement.
  if (existing?.status !== "unsubscribed") {
    const { error: eventError } = await sb.from("newsletter_consent_events").insert({
      subscriber_id: subscriber.id,
      email: input.email,
      user_id: input.userId || existing?.user_id || null,
      action: input.action,
      source: "brevo_webhook",
      locale: String(existing?.locale || "fr"),
      consent_version: NEWSLETTER_CONSENT_VERSION,
      metadata: { provider: "brevo" },
    });
    if (eventError) throw eventError;
  }

  const linkedUserId = input.userId || existing?.user_id || null;
  if (linkedUserId) {
    await sb.from("users").update({ subscribe_newsletter: false }).eq("id", linkedUserId);
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    // Fail closed : verify_jwt=false est nécessaire pour Brevo, donc le secret
    // Bearer devient la barrière d'authentification du webhook.
    const configuredToken = Deno.env.get("BREVO_WEBHOOK_TOKEN") || "";
    if (!configuredToken) return json({ error: "WEBHOOK_NOT_CONFIGURED" }, 503);

    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
    const legacyCustom = req.headers.get("x-brevo-webhook-token")?.trim() || "";
    if (bearer !== configuredToken && legacyCustom !== configuredToken) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json() as Record<string, unknown>;
    const rawEvent = String(body.event || "").trim();
    const event = rawEvent.toLowerCase().replace(/[^a-z]/g, "");
    const email = normalizeNewsletterEmail(body.email);
    if (!email) return json({ received: true, ignored: true, reason: "missing_email" });

    const scopeHeader = String(req.headers.get("x-omnia-brevo-scope") || "").toLowerCase();
    const scope: BrevoScope = scopeHeader === "marketing" || body.camp_id || body.campaign_id
      ? "marketing"
      : "transactional";

    const trackedStatus: Record<string, string> = {
      request: "sent",
      sent: "sent",
      delivered: "delivered",
      deferred: "deferred",
      opened: "opened",
      uniqueopened: "opened",
      click: "clicked",
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
    if (!trackedStatus[event]) return json({ received: true, ignored: true, reason: "untracked_event" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: user } = await sb.from("users").select("id,email_status").eq("email", email).maybeSingle();

    // Seuls les événements prouvant que l'adresse est invalide affectent le statut global.
    // Spam, désinscription marketing, blocage, soft bounce ou report restent isolés du compte.
    const globallyInvalidEvents = new Set(["hardbounce", "invalidemail", "invalid"]);
    const marketingSuppressionEvents = new Set(["hardbounce", "spam", "complaint"]);
    const unsubscribeEvents = new Set(["unsubscribe", "unsubscribed"]);

    if (globallyInvalidEvents.has(event) && user?.id) {
      await sb.from("users").update({ email_status: "invalide" }).eq("id", user.id);
    }

    const suppressNewsletter = globallyInvalidEvents.has(event)
      || (scope === "marketing" && marketingSuppressionEvents.has(event));
    const unsubscribeNewsletter = scope === "marketing" && unsubscribeEvents.has(event);

    if (suppressNewsletter || unsubscribeNewsletter) {
      await suppressNewsletterFromProvider(sb, {
        email,
        userId: user?.id || null,
        action: suppressNewsletter ? "bounce_suppression" : "provider_unsubscribe",
      });
    }

    const messageId = cleanScalar(body["message-id"] ?? body.messageId, 500);
    const campaignId = cleanScalar(body.camp_id ?? body.campaign_id, 300);
    const eventTs = cleanScalar(body.ts_event ?? body.ts, 100);
    const webhookId = cleanScalar(body.id, 100);
    const eventKey = await sha256Hex([
      scope,
      event,
      email,
      String(messageId || ""),
      String(campaignId || ""),
      String(eventTs || ""),
      String(webhookId || ""),
    ].join("|"));

    const { data: duplicate } = await sb.from("notification_log")
      .select("id")
      .eq("channel", "email")
      .contains("metadata", { event_key: eventKey })
      .limit(1)
      .maybeSingle();

    if (!duplicate?.id) {
      const safeMetadata = {
        provider: "brevo",
        scope,
        event: rawEvent.slice(0, 80),
        event_key: eventKey,
        webhook_id: webhookId,
        message_id: messageId,
        template_id: cleanScalar(body.template_id, 100),
        campaign_id: campaignId,
        event_ts: eventTs,
        tags: cleanTags(body.tags ?? body.tag),
      };

      const isDeliveryProblem = new Set(["softbounce", "hardbounce", "spam", "complaint", "blocked", "invalidemail", "invalid"])
        .has(event);
      const { error: logError } = await sb.from("notification_log").insert({
        user_id: user?.id ?? null,
        channel: "email",
        template_id: `brevo_${scope}_${event}`,
        recipient: email,
        status: trackedStatus[event],
        error_message: isDeliveryProblem ? `Brevo event: ${rawEvent.slice(0, 80)}` : null,
        metadata: safeMetadata,
      });
      if (logError) console.error("brevo-webhook-bounce notification_log", logError.message);
    }

    return json({ received: true, scope, event });
  } catch (error) {
    console.error("brevo-webhook-bounce", error);
    return json({ error: "INTERNAL" }, 500);
  }
});
