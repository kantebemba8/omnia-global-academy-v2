import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

const CONSENT_VERSION = "2026-08";
const ALLOWED_LOCALES = new Set(["fr", "en", "es", "pt", "ar", "zh", "ru", "de"]);

type DbClient = ReturnType<typeof createClient>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255 ? email : "";
}

function cleanLocale(value: unknown) {
  const locale = String(value || "fr").trim().toLowerCase();
  return ALLOWED_LOCALES.has(locale) ? locale : "fr";
}

function cleanSource(value: unknown) {
  return String(value || "public_footer").replace(/[^a-z0-9_-]/gi, "").slice(0, 60) || "public_footer";
}

async function hashValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function sessionToken(req: Request) {
  return req.headers.get("x-omnia-session-token")?.trim()
    || req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim()
    || "";
}

async function requireAdmin(sb: DbClient, req: Request) {
  const token = sessionToken(req);
  if (!token) return null;
  const { data: session } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session?.user_id) return null;
  const { data: role } = await sb.from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();
  return role ? String(session.user_id) : null;
}

function brevoConfig() {
  const apiKey = Deno.env.get("BREVO_API_KEY") || "";
  const listId = Number.parseInt(Deno.env.get("BREVO_NEWSLETTER_LIST_ID") || "7", 10);
  return { apiKey, listId: Number.isFinite(listId) && listId > 0 ? listId : 7 };
}

async function syncBrevoContact(email: string, active: boolean) {
  const { apiKey, listId } = brevoConfig();
  if (!apiKey) return false;
  try {
    if (active) {
      const response = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
      });
      return response.ok;
    }
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}/lists/${listId}`, {
      method: "DELETE",
      headers: { accept: "application/json", "api-key": apiKey },
    });
    return response.ok || response.status === 404;
  } catch (error) {
    console.error("newsletter Brevo sync", error);
    return false;
  }
}

async function registerConsent(
  sb: DbClient,
  params: {
    email: string;
    active: boolean;
    source: string;
    locale: string;
    userId?: string | null;
    req: Request;
  },
) {
  const now = new Date().toISOString();
  const ip = params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || params.req.headers.get("cf-connecting-ip")?.trim()
    || "unknown";
  const ipHash = await hashValue(`${ip}:${Deno.env.get("NEWSLETTER_HASH_SALT") || "omnia-newsletter"}`);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await sb.from("newsletter_consent_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);
  if ((count || 0) >= 12) throw new Error("RATE_LIMITED");

  const { data: existing } = await sb.from("newsletter_subscribers")
    .select("id,status")
    .eq("email", params.email)
    .maybeSingle();
  const previousStatus = String(existing?.status || "");

  const subscriberPayload = {
    email: params.email,
    user_id: params.userId || null,
    status: params.active ? "active" : "unsubscribed",
    locale: params.locale,
    source: params.source,
    consent_version: CONSENT_VERSION,
    consented_at: params.active ? now : null,
    unsubscribed_at: params.active ? null : now,
    updated_at: now,
  };

  const { data: subscriber, error } = existing?.id
    ? await sb.from("newsletter_subscribers").update(subscriberPayload).eq("id", existing.id).select("id").single()
    : await sb.from("newsletter_subscribers").insert(subscriberPayload).select("id").single();
  if (error) throw error;

  const action = params.active
    ? (previousStatus === "unsubscribed" ? "resubscribe" : params.source === "registration" ? "registration_opt_in" : params.source === "profile" ? "profile_opt_in" : "subscribe")
    : (params.source === "profile" ? "profile_opt_out" : "unsubscribe");

  const { error: eventError } = await sb.from("newsletter_consent_events").insert({
    subscriber_id: subscriber.id,
    email: params.email,
    user_id: params.userId || null,
    action,
    source: params.source,
    locale: params.locale,
    consent_version: CONSENT_VERSION,
    ip_hash: ipHash,
    user_agent: String(params.req.headers.get("user-agent") || "").slice(0, 500),
  });
  if (eventError) throw eventError;

  const providerSynced = await syncBrevoContact(params.email, params.active);
  if (providerSynced) {
    await sb.from("newsletter_subscribers")
      .update({ provider_synced_at: now })
      .eq("id", subscriber.id);
  }
  return { subscriberId: subscriber.id, providerSynced };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || "send");

    if (action === "subscribe" || action === "unsubscribe") {
      if (String(body.website || "").trim()) return json({ success: true });
      const email = cleanEmail(body.email);
      if (!email) return json({ error: "INVALID_EMAIL", message: "Saisissez une adresse e-mail valide." }, 400);
      if (action === "subscribe" && body.consent !== true) {
        return json({ error: "CONSENT_REQUIRED", message: "Le consentement est obligatoire." }, 400);
      }
      const result = await registerConsent(sb, {
        email,
        active: action === "subscribe",
        source: cleanSource(body.source),
        locale: cleanLocale(body.locale),
        req,
      });
      return json({
        success: true,
        status: action === "subscribe" ? "active" : "unsubscribed",
        provider_synced: result.providerSynced,
        message: action === "subscribe"
          ? "Votre inscription à la newsletter est enregistrée."
          : "Votre désinscription est enregistrée.",
      });
    }

    const adminUserId = await requireAdmin(sb, req);
    if (!adminUserId) return json({ error: "FORBIDDEN" }, 403);

    if (action === "admin_list") {
      const [{ data: campaigns, error: campaignsError }, { count: active }, { count: unsubscribed }] = await Promise.all([
        sb.from("newsletter_campaigns").select("id,subject,channel,status,sent_at,scheduled_at,recipients_count,provider,provider_campaign_id,error_message,created_at").order("created_at", { ascending: false }).limit(50),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
      ]);
      if (campaignsError) throw campaignsError;
      return json({ success: true, campaigns: campaigns || [], stats: { active: active || 0, unsubscribed: unsubscribed || 0 } });
    }

    const subject = String(body.subject || "").trim().slice(0, 500);
    const contentHtml = String(body.content_html || "");
    const channel = body.channel === "sms" ? "sms" : "email";
    const smsText = String(body.sms_text || "").trim().slice(0, 160);
    const scheduleAt = body.schedule_at ? new Date(String(body.schedule_at)) : null;

    if (!subject) return json({ error: "MISSING_SUBJECT" }, 400);
    if (channel === "email" && !contentHtml.trim()) return json({ error: "MISSING_CONTENT_HTML" }, 400);
    if (channel === "sms" && !smsText) return json({ error: "MISSING_SMS_TEXT" }, 400);
    if (scheduleAt && (Number.isNaN(scheduleAt.getTime()) || scheduleAt.getTime() <= Date.now())) {
      return json({ error: "INVALID_SCHEDULE_DATE" }, 400);
    }

    const { apiKey, listId } = brevoConfig();
    if (!apiKey) return json({ error: "BREVO_NOT_CONFIGURED" }, 503);

    const { count: recipientsCount } = await sb.from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const campaignPayload = channel === "email"
      ? {
          name: `Newsletter ${new Date().toISOString().slice(0, 10)}`,
          subject,
          sender: {
            name: Deno.env.get("BREVO_SENDER_NAME") || "Omnia Global Academy",
            email: Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
          },
          type: "classic",
          htmlContent: contentHtml,
          recipients: { listIds: [listId] },
          ...(scheduleAt ? { scheduledAt: scheduleAt.toISOString() } : {}),
        }
      : {
          name: `SMS ${new Date().toISOString().slice(0, 10)}`,
          sender: Deno.env.get("BREVO_SMS_SENDER") || "OmniaAcad",
          content: smsText,
          recipients: { listIds: [listId] },
          ...(scheduleAt ? { scheduledAt: scheduleAt.toISOString() } : {}),
        };

    const createUrl = channel === "email"
      ? "https://api.brevo.com/v3/emailCampaigns"
      : "https://api.brevo.com/v3/smsCampaigns";
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(campaignPayload),
    });
    const createText = await createResponse.text();
    let createData: Record<string, unknown> = {};
    if (createText) {
      try {
        createData = JSON.parse(createText) as Record<string, unknown>;
      } catch {
        createData = {};
      }
    }
    if (!createResponse.ok || !createData.id) {
      await sb.from("newsletter_campaigns").insert({
        subject,
        content_html: channel === "email" ? contentHtml : smsText,
        channel,
        status: "failed",
        sent_by: adminUserId,
        recipients_count: recipientsCount || 0,
        error_message: createText.slice(0, 2000),
      });
      return json({ error: "BREVO_CREATE_FAILED", detail: createText }, 502);
    }

    const campaignId = String(createData.id);
    if (!scheduleAt) {
      const sendUrl = channel === "email"
        ? `https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`
        : `https://api.brevo.com/v3/smsCampaigns/${campaignId}/sendNow`;
      const sendResponse = await fetch(sendUrl, { method: "POST", headers: { "api-key": apiKey } });
      if (!sendResponse.ok) {
        const detail = await sendResponse.text();
        await sb.from("newsletter_campaigns").insert({
          subject,
          content_html: channel === "email" ? contentHtml : smsText,
          channel,
          status: "failed",
          sent_by: adminUserId,
          recipients_count: recipientsCount || 0,
          provider_campaign_id: campaignId,
          error_message: detail.slice(0, 2000),
        });
        return json({ error: "BREVO_SEND_FAILED", detail, campaign_id: campaignId }, 502);
      }
    }

    const status = scheduleAt ? "scheduled" : "sent";
    const { data: stored, error: storeError } = await sb.from("newsletter_campaigns").insert({
      subject,
      content_html: channel === "email" ? contentHtml : smsText,
      channel,
      status,
      sent_at: scheduleAt ? null : new Date().toISOString(),
      scheduled_at: scheduleAt?.toISOString() || null,
      sent_by: adminUserId,
      recipients_count: recipientsCount || 0,
      provider: "brevo",
      provider_campaign_id: campaignId,
      metadata: { list_id: listId },
    }).select("id").single();
    if (storeError) throw storeError;

    return json({ success: true, campaign_id: campaignId, record_id: stored.id, status, recipients_count: recipientsCount || 0 });
  } catch (error) {
    console.error("newsletter-send", error);
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    if (message === "RATE_LIMITED") return json({ error: "RATE_LIMITED", message: "Trop de tentatives. Réessayez plus tard." }, 429);
    return json({ error: "SERVER_ERROR", message: "Le service newsletter est momentanément indisponible." }, 500);
  }
});
