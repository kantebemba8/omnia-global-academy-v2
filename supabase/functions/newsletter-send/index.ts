import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeCorsHeaders, sha256Hex } from "../_shared/auth-security.ts";
import { brevoEmailConfig, sendOmniaEmail } from "../_shared/brevo-mail.ts";
import { BREVO_TEMPLATE_DEFINITIONS, omniaEmailLayout } from "../_shared/email-templates.ts";
import {
  NEWSLETTER_CONSENT_VERSION,
  normalizeNewsletterEmail,
  setNewsletterConsent,
  syncBrevoNewsletterContact,
} from "../_shared/newsletter.ts";

const ALLOWED_LOCALES = new Set(["fr", "en", "es", "pt", "ar", "zh", "ru", "de"]);
type DbClient = ReturnType<typeof createClient>;

// Configuration Newsletter validée manuellement dans Brevo.
// Ces valeurs peuvent être surchargées par variables d'environnement sans modifier le code.
const DEFAULT_NEWSLETTER_TEMPLATE_ID = 14;
const DEFAULT_NEWSLETTER_UPDATE_FORM_ID = "6a77a284e64b6a444a7d4c40";

function json(data: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanLocale(value: unknown) {
  const locale = String(value || "fr").trim().toLowerCase();
  return ALLOWED_LOCALES.has(locale) ? locale : "fr";
}

function cleanSource(value: unknown) {
  return String(value || "public_footer").replace(/[^a-z0-9_-]/gi, "").slice(0, 60) || "public_footer";
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

function newsletterListId() {
  const parsed = Number.parseInt(Deno.env.get("BREVO_NEWSLETTER_LIST_ID") || "7", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function newsletterTemplateId() {
  const parsed = Number.parseInt(Deno.env.get("BREVO_NEWSLETTER_TEMPLATE_ID") || String(DEFAULT_NEWSLETTER_TEMPLATE_ID), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NEWSLETTER_TEMPLATE_ID;
}

function newsletterUpdateFormId() {
  const value = (Deno.env.get("BREVO_NEWSLETTER_UPDATE_FORM_ID") || DEFAULT_NEWSLETTER_UPDATE_FORM_ID).trim();
  return /^[a-z0-9]{24}$/i.test(value) ? value : DEFAULT_NEWSLETTER_UPDATE_FORM_ID;
}

function newsletterEmailConfig() {
  const base = brevoEmailConfig();
  return {
    apiKey: base.apiKey,
    senderEmail: Deno.env.get("BREVO_NEWSLETTER_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
    senderName: Deno.env.get("BREVO_NEWSLETTER_SENDER_NAME") || "Omnia Global Academy",
  };
}

function cleanNewsletterActionUrl(value: unknown) {
  const raw = String(value || "").trim().slice(0, 2000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

async function verifyNewsletterTemplate(apiKey: string) {
  const templateId = newsletterTemplateId();
  const response = await fetch(`https://api.brevo.com/v3/smtp/templates/${templateId}`, {
    headers: { accept: "application/json", "api-key": apiKey },
  });
  const detail = await response.text();
  if (!response.ok) throw new Error(`BREVO_NEWSLETTER_TEMPLATE_UNAVAILABLE:${detail.slice(0, 800)}`);
  let data: { id?: number; name?: string; isActive?: boolean } = {};
  try { data = JSON.parse(detail || "{}"); } catch { /* noop */ }
  if (data.isActive === false) throw new Error("BREVO_NEWSLETTER_TEMPLATE_INACTIVE");
  return { id: templateId, name: String(data.name || "") };
}

function newsletterCampaignPayload(input: {
  subject: string;
  message: string;
  actionUrl: string;
  senderName: string;
  senderEmail: string;
  scheduledAt?: Date | null;
  includeRecipients?: boolean;
  test?: boolean;
}) {
  return {
    name: `${input.test ? "Omnia Newsletter TEST" : "Omnia Newsletter"} — ${new Date().toISOString().slice(0, 10)} — ${input.subject.slice(0, 80)}`,
    subject: input.subject,
    sender: { name: input.senderName, email: input.senderEmail },
    type: "classic",
    templateId: newsletterTemplateId(),
    params: {
      MESSAGE_PRINCIPAL: input.message,
      ACTION_URL: input.actionUrl,
    },
    updateFormId: newsletterUpdateFormId(),
    tag: input.test ? "omnia_newsletter_test" : "omnia_newsletter",
    ...(input.includeRecipients === false ? {} : { recipients: { listIds: [newsletterListId()] } }),
    ...(input.scheduledAt ? { scheduledAt: input.scheduledAt.toISOString() } : {}),
  };
}

async function createBrevoCampaign(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.brevo.com/v3/emailCampaigns", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const detail = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(detail || "{}") as Record<string, unknown>; } catch { /* noop */ }
  if (!response.ok || !data.id) {
    throw new Error(`BREVO_CREATE_FAILED:${detail.slice(0, 1600)}`);
  }
  return String(data.id);
}

async function deleteBrevoCampaignBestEffort(apiKey: string, campaignId: string) {
  try {
    await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}`, {
      method: "DELETE",
      headers: { "api-key": apiKey },
    });
  } catch {
    // Le test a déjà été envoyé : un échec de nettoyage ne doit pas masquer le résultat.
  }
}

async function syncBrevoWebhook() {
  const { apiKey } = brevoEmailConfig();
  if (!apiKey) throw new Error("BREVO_NOT_CONFIGURED");
  const webhookToken = Deno.env.get("BREVO_WEBHOOK_TOKEN") || "";
  if (!webhookToken) throw new Error("BREVO_WEBHOOK_TOKEN_MISSING");
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL_MISSING");
  const webhookUrl = `${supabaseUrl}/functions/v1/brevo-webhook-bounce`;
  const events = ["delivered", "hardBounce", "softBounce", "blocked", "spam", "invalid", "unsubscribed"];
  const headers = { accept: "application/json", "content-type": "application/json", "api-key": apiKey };

  const listResponse = await fetch("https://api.brevo.com/v3/webhooks?type=transactional&sort=desc", { headers });
  if (!listResponse.ok) throw new Error(`BREVO_WEBHOOK_LIST_FAILED:${await listResponse.text()}`);
  const listData = await listResponse.json() as { webhooks?: Array<{ id: number; url?: string; type?: string }> };
  const existing = (listData.webhooks || []).find(item => item.type === "transactional" && item.url === webhookUrl);
  const payload = {
    url: webhookUrl,
    description: "Omnia Global Academy — suivi transactionnel Brevo",
    events,
    type: "transactional",
    channel: "email",
    batched: false,
    auth: { type: "bearer", token: webhookToken },
  };

  if (existing?.id) {
    const response = await fetch(`https://api.brevo.com/v3/webhooks/${existing.id}`, {
      method: "PUT", headers, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`BREVO_WEBHOOK_UPDATE_FAILED:${await response.text()}`);
    return { id: existing.id, status: "updated", url: webhookUrl };
  }

  const response = await fetch("https://api.brevo.com/v3/webhooks", {
    method: "POST", headers, body: JSON.stringify(payload),
  });
  const detail = await response.text();
  if (!response.ok) throw new Error(`BREVO_WEBHOOK_CREATE_FAILED:${detail}`);
  const data = JSON.parse(detail || "{}") as { id?: number };
  return { id: data.id || null, status: "created", url: webhookUrl };
}

async function syncBrevoTemplates(sb: DbClient) {
  // Les templates sont administrés manuellement dans Brevo.
  // Cette action vérifie uniquement que les IDs 1 à 13 existent et sont actifs ;
  // elle ne crée, ne modifie et n'écrase jamais leur design.
  const { apiKey } = brevoEmailConfig();
  if (!apiKey) throw new Error("BREVO_NOT_CONFIGURED");

  const results: Array<{ key: string; id: number; status: string; name?: string; name_matches?: boolean; error?: string }> = [];
  for (const template of BREVO_TEMPLATE_DEFINITIONS) {
    try {
      const response = await fetch(`https://api.brevo.com/v3/smtp/templates/${template.id}`, {
        headers: { accept: "application/json", "api-key": apiKey },
      });
      const detail = await response.text();
      if (!response.ok) throw new Error(detail || `HTTP_${response.status}`);
      const data = JSON.parse(detail || "{}") as { id?: number; name?: string; isActive?: boolean };
      if (data.isActive === false) throw new Error("BREVO_TEMPLATE_INACTIVE");

      const brevoName = String(data.name || "").trim();
      const nameMatches = brevoName === template.name;

      await sb.from("email_template_registry").upsert({
        template_key: template.key,
        template_name: template.name,
        provider: "brevo",
        provider_template_id: template.id,
        provider_synced_at: new Date().toISOString(),
        provider_last_error: null,
        is_active: true,
        metadata: { mode: "manual_brevo", brevo_name: brevoName || null, fixed_id: true, name_matches: nameMatches },
        updated_at: new Date().toISOString(),
      }, { onConflict: "template_key" });
      results.push({ key: template.key, id: template.id, status: "verified", name: brevoName || template.name, name_matches: nameMatches });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sb.from("email_template_registry").upsert({
        template_key: template.key,
        template_name: template.name,
        provider: "brevo",
        provider_template_id: template.id,
        provider_last_error: message.slice(0, 2000),
        is_active: true,
        metadata: { mode: "manual_brevo", fixed_id: true },
        updated_at: new Date().toISOString(),
      }, { onConflict: "template_key" });
      results.push({ key: template.key, id: template.id, status: "error", error: message });
    }
  }
  return results;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405, corsHeaders);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || "send");

    if (action === "subscribe" || action === "unsubscribe") {
      if (String(body.website || "").trim()) return json({ success: true }, 200, corsHeaders);
      const email = normalizeNewsletterEmail(body.email);
      if (!email) return json({ error: "INVALID_EMAIL", message: "Saisissez une adresse e-mail valide." }, 400, corsHeaders);
      if (action === "subscribe" && body.consent !== true) {
        return json({ error: "CONSENT_REQUIRED", message: "Le consentement est obligatoire." }, 400, corsHeaders);
      }

      const ip = req.headers.get("cf-connecting-ip")?.trim()
        || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown";
      const ipHash = await sha256Hex(`${ip}:${Deno.env.get("NEWSLETTER_HASH_SALT") || "omnia-newsletter"}`);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await sb.from("newsletter_consent_events").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", oneHourAgo);
      if ((count || 0) >= 12) return json({ error: "RATE_LIMITED", message: "Trop de tentatives. Réessayez plus tard." }, 429, corsHeaders);

      const result = await setNewsletterConsent(sb, {
        email,
        active: action === "subscribe",
        source: cleanSource(body.source),
        locale: cleanLocale(body.locale),
        ipHash,
        userAgent: req.headers.get("user-agent") || null,
      });
      return json({
        success: true,
        status: action === "subscribe" ? "active" : "unsubscribed",
        provider_synced: result.providerSynced,
        message: action === "subscribe"
          ? "Votre inscription à Omnia Newsletter est enregistrée."
          : "Votre désinscription est enregistrée.",
      }, 200, corsHeaders);
    }

    const adminUserId = await requireAdmin(sb, req);
    if (!adminUserId) return json({ error: "FORBIDDEN" }, 403, corsHeaders);

    if (action === "admin_list") {
      const [
        { data: campaigns, error: campaignsError },
        { count: active }, { count: unsubscribed }, { count: syncErrors }, { count: pendingSync },
        { data: templates },
      ] = await Promise.all([
        sb.from("newsletter_campaigns").select("id,subject,channel,status,sent_at,scheduled_at,recipients_count,provider,provider_campaign_id,error_message,created_at").order("created_at", { ascending: false }).limit(50),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active").eq("provider_sync_status", "error"),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active").eq("provider_sync_status", "pending"),
        sb.from("email_template_registry").select("template_key,template_name,provider_template_id,provider_synced_at,provider_last_error,is_active").order("template_key"),
      ]);
      if (campaignsError) throw campaignsError;
      return json({
        success: true,
        campaigns: campaigns || [],
        stats: { active: active || 0, unsubscribed: unsubscribed || 0, sync_errors: syncErrors || 0, pending_sync: pendingSync || 0 },
        templates: templates || [],
        consent_version: NEWSLETTER_CONSENT_VERSION,
      }, 200, corsHeaders);
    }

    if (action === "sync_templates") {
      const results = await syncBrevoTemplates(sb);
      const failed = results.filter(item => item.status === "error");
      return json({ success: failed.length === 0, results, failed: failed.length }, failed.length ? 502 : 200, corsHeaders);
    }

    if (action === "sync_webhook") {
      const webhook = await syncBrevoWebhook();
      return json({ success: true, webhook }, 200, corsHeaders);
    }

    if (action === "resync_contacts") {
      const { data: subscribers, error } = await sb.from("newsletter_subscribers")
        .select("id,email,user_id")
        .eq("status", "active")
        .neq("provider_sync_status", "synced")
        .limit(100);
      if (error) throw error;
      let synced = 0;
      let failed = 0;
      for (const subscriber of subscribers || []) {
        const result = await syncBrevoNewsletterContact({ email: String(subscriber.email), active: true });
        await sb.from("newsletter_subscribers").update({
          provider_sync_status: result.ok ? "synced" : "error",
          provider_synced_at: result.ok ? new Date().toISOString() : null,
          provider_last_error: result.ok ? null : result.error || "BREVO_SYNC_FAILED",
        }).eq("id", subscriber.id);
        result.ok ? synced++ : failed++;
      }
      return json({ success: failed === 0, processed: (subscribers || []).length, synced, failed, remaining_hint: (subscribers || []).length === 100 }, failed ? 207 : 200, corsHeaders);
    }

    if (action === "test_email") {
      const { data: admin } = await sb.from("users").select("email,full_name").eq("id", adminUserId).single();
      const sent = await sendOmniaEmail({
        to: { email: String(admin.email), name: String(admin.full_name || "") },
        templateKey: "status_update",
        params: {
          PRENOM: String(admin.full_name || "").split(" ")[0],
          FORMATION_TITRE: "Configuration e-mail",
          STATUT: "Test Brevo réussi",
          MESSAGE_SPECIFIQUE: "Cet e-mail confirme que l’envoi transactionnel Omnia vers Brevo fonctionne.",
          ACTION_URL: `${Deno.env.get("APP_URL") || "https://omniaglobalacademy.com"}/admin/cms`,
        },
        userId: adminUserId,
        sb,
      });
      return json({ success: sent }, sent ? 200 : 502, corsHeaders);
    }

    if (action === "test_newsletter" || action === "send_newsletter") {
      const subject = String(body.subject || "").trim().slice(0, 500);
      const message = String(body.message_principal || "").trim().slice(0, 20000);
      const actionUrl = cleanNewsletterActionUrl(body.action_url);
      const scheduleAt = action === "send_newsletter" && body.schedule_at ? new Date(String(body.schedule_at)) : null;

      if (!subject) return json({ error: "MISSING_SUBJECT", message: "L’objet de la campagne est requis." }, 400, corsHeaders);
      if (!message) return json({ error: "MISSING_MESSAGE", message: "Le message principal est requis." }, 400, corsHeaders);
      if (!actionUrl) return json({ error: "INVALID_ACTION_URL", message: "Le lien du bouton doit être une URL http(s) valide." }, 400, corsHeaders);
      if (scheduleAt && (Number.isNaN(scheduleAt.getTime()) || scheduleAt.getTime() <= Date.now())) {
        return json({ error: "INVALID_SCHEDULE_DATE", message: "La date de programmation doit être valide et située dans le futur." }, 400, corsHeaders);
      }

      const { apiKey, senderEmail, senderName } = newsletterEmailConfig();
      if (!apiKey) return json({ error: "BREVO_NOT_CONFIGURED" }, 503, corsHeaders);

      await verifyNewsletterTemplate(apiKey);

      if (action === "test_newsletter") {
        const { data: admin, error: adminError } = await sb.from("users").select("email").eq("id", adminUserId).single();
        if (adminError || !admin?.email) return json({ error: "ADMIN_EMAIL_MISSING", message: "Adresse e-mail Super-admin introuvable." }, 409, corsHeaders);

        let campaignId = "";
        try {
          campaignId = await createBrevoCampaign(apiKey, newsletterCampaignPayload({
            subject,
            message,
            actionUrl,
            senderName,
            senderEmail,
            includeRecipients: false,
            test: true,
          }));
          const testResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendTest`, {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ emailTo: [String(admin.email)] }),
          });
          const detail = await testResponse.text();
          if (!testResponse.ok) {
            return json({ error: "BREVO_NEWSLETTER_TEST_FAILED", message: detail.slice(0, 1200) || "Brevo a refusé l’e-mail test." }, 502, corsHeaders);
          }
          return json({
            success: true,
            status: "tested",
            template_id: newsletterTemplateId(),
            list_id: newsletterListId(),
          }, 200, corsHeaders);
        } finally {
          if (campaignId) await deleteBrevoCampaignBestEffort(apiKey, campaignId);
        }
      }

      const [{ count: recipientsCount }, { count: unsyncedCount }] = await Promise.all([
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active").neq("provider_sync_status", "synced"),
      ]);
      if ((recipientsCount || 0) < 1) return json({ error: "NO_ACTIVE_SUBSCRIBERS", message: "Aucun abonné Newsletter actif." }, 400, corsHeaders);
      if ((unsyncedCount || 0) > 0) {
        return json({ error: "NEWSLETTER_SYNC_REQUIRED", message: `${unsyncedCount} abonné(s) actif(s) ne sont pas encore synchronisés avec Brevo.` }, 409, corsHeaders);
      }

      let campaignId = "";
      try {
        campaignId = await createBrevoCampaign(apiKey, newsletterCampaignPayload({
          subject,
          message,
          actionUrl,
          senderName,
          senderEmail,
          scheduledAt: scheduleAt,
        }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await sb.from("newsletter_campaigns").insert({
          subject,
          content_html: message,
          channel: "email",
          status: "failed",
          sent_by: adminUserId,
          recipients_count: recipientsCount || 0,
          error_message: detail.slice(0, 2000),
          provider: "brevo",
          metadata: { template_id: newsletterTemplateId(), list_id: newsletterListId(), param_keys: ["MESSAGE_PRINCIPAL", "ACTION_URL"] },
        });
        return json({ error: "BREVO_CREATE_FAILED", message: detail.slice(0, 1200) }, 502, corsHeaders);
      }

      if (!scheduleAt) {
        const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
          method: "POST",
          headers: { "api-key": apiKey },
        });
        if (!sendResponse.ok) {
          const detail = await sendResponse.text();
          await sb.from("newsletter_campaigns").insert({
            subject,
            content_html: message,
            channel: "email",
            status: "failed",
            sent_by: adminUserId,
            recipients_count: recipientsCount || 0,
            provider_campaign_id: campaignId,
            error_message: detail.slice(0, 2000),
            provider: "brevo",
            metadata: { template_id: newsletterTemplateId(), list_id: newsletterListId(), param_keys: ["MESSAGE_PRINCIPAL", "ACTION_URL"] },
          });
          return json({ error: "BREVO_SEND_FAILED", message: detail.slice(0, 1200), campaign_id: campaignId }, 502, corsHeaders);
        }
      }

      const status = scheduleAt ? "scheduled" : "sent";
      const { data: stored, error: storeError } = await sb.from("newsletter_campaigns").insert({
        subject,
        content_html: message,
        channel: "email",
        status,
        sent_at: scheduleAt ? null : new Date().toISOString(),
        scheduled_at: scheduleAt?.toISOString() || null,
        sent_by: adminUserId,
        recipients_count: recipientsCount || 0,
        provider: "brevo",
        provider_campaign_id: campaignId,
        metadata: {
          mode: "manual_brevo_template",
          template_id: newsletterTemplateId(),
          list_id: newsletterListId(),
          update_form_id: newsletterUpdateFormId(),
          consent_version: NEWSLETTER_CONSENT_VERSION,
          param_keys: ["MESSAGE_PRINCIPAL", "ACTION_URL"],
        },
      }).select("id").single();
      if (storeError) throw storeError;

      return json({
        success: true,
        campaign_id: campaignId,
        record_id: stored.id,
        status,
        recipients_count: recipientsCount || 0,
        template_id: newsletterTemplateId(),
        list_id: newsletterListId(),
      }, 200, corsHeaders);
    }

    if (action !== "send") return json({ error: "UNKNOWN_ACTION" }, 400, corsHeaders);

    const subject = String(body.subject || "").trim().slice(0, 500);
    const contentHtml = String(body.content_html || "").trim();
    const scheduleAt = body.schedule_at ? new Date(String(body.schedule_at)) : null;
    if (!subject) return json({ error: "MISSING_SUBJECT" }, 400, corsHeaders);
    if (!contentHtml) return json({ error: "MISSING_CONTENT_HTML" }, 400, corsHeaders);
    if (scheduleAt && (Number.isNaN(scheduleAt.getTime()) || scheduleAt.getTime() <= Date.now())) {
      return json({ error: "INVALID_SCHEDULE_DATE" }, 400, corsHeaders);
    }

    const { apiKey, senderEmail, senderName } = brevoEmailConfig();
    if (!apiKey) return json({ error: "BREVO_NOT_CONFIGURED" }, 503, corsHeaders);

    const [{ count: recipientsCount }, { count: unsyncedCount }] = await Promise.all([
      sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
      sb.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active").neq("provider_sync_status", "synced"),
    ]);
    if ((recipientsCount || 0) < 1) return json({ error: "NO_ACTIVE_SUBSCRIBERS" }, 400, corsHeaders);
    if ((unsyncedCount || 0) > 0) {
      return json({ error: "NEWSLETTER_SYNC_REQUIRED", message: `${unsyncedCount} abonné(s) actif(s) ne sont pas encore synchronisés avec Brevo.` }, 409, corsHeaders);
    }

    const preferencesUrl = `${Deno.env.get("APP_URL") || "https://omniaglobalacademy.com"}/newsletter`;
    const brandedHtml = omniaEmailLayout({
      title: subject,
      preheader: subject,
      bodyHtml: `${contentHtml}<p style="margin:32px 0 0;padding-top:18px;border-top:1px solid #e7ebf0;color:#6b7788;font-size:12px">Vous recevez cet e-mail parce que vous êtes inscrit(e) à Omnia Newsletter. <a href="${preferencesUrl}" style="color:#002050">Gérer mon abonnement</a>.</p>`,
      footerText: "Omnia Newsletter — communication envoyée uniquement aux abonnés ayant donné leur consentement.",
    });

    const campaignPayload = {
      name: `Omnia Newsletter — ${new Date().toISOString().slice(0, 10)} — ${subject.slice(0, 80)}`,
      subject,
      sender: { name: senderName, email: senderEmail },
      type: "classic",
      htmlContent: brandedHtml,
      recipients: { listIds: [newsletterListId()] },
      ...(scheduleAt ? { scheduledAt: scheduleAt.toISOString() } : {}),
    };

    const createResponse = await fetch("https://api.brevo.com/v3/emailCampaigns", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(campaignPayload),
    });
    const createText = await createResponse.text();
    let createData: Record<string, unknown> = {};
    try { createData = JSON.parse(createText || "{}") as Record<string, unknown>; } catch { /* noop */ }
    if (!createResponse.ok || !createData.id) {
      await sb.from("newsletter_campaigns").insert({
        subject, content_html: contentHtml, channel: "email", status: "failed", sent_by: adminUserId,
        recipients_count: recipientsCount || 0, error_message: createText.slice(0, 2000), provider: "brevo",
      });
      return json({ error: "BREVO_CREATE_FAILED", detail: createText }, 502, corsHeaders);
    }

    const campaignId = String(createData.id);
    if (!scheduleAt) {
      const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, { method: "POST", headers: { "api-key": apiKey } });
      if (!sendResponse.ok) {
        const detail = await sendResponse.text();
        await sb.from("newsletter_campaigns").insert({
          subject, content_html: contentHtml, channel: "email", status: "failed", sent_by: adminUserId,
          recipients_count: recipientsCount || 0, provider_campaign_id: campaignId, error_message: detail.slice(0, 2000), provider: "brevo",
        });
        return json({ error: "BREVO_SEND_FAILED", detail, campaign_id: campaignId }, 502, corsHeaders);
      }
    }

    const status = scheduleAt ? "scheduled" : "sent";
    const { data: stored, error: storeError } = await sb.from("newsletter_campaigns").insert({
      subject,
      content_html: contentHtml,
      channel: "email",
      status,
      sent_at: scheduleAt ? null : new Date().toISOString(),
      scheduled_at: scheduleAt?.toISOString() || null,
      sent_by: adminUserId,
      recipients_count: recipientsCount || 0,
      provider: "brevo",
      provider_campaign_id: campaignId,
      metadata: { list_id: newsletterListId(), consent_version: NEWSLETTER_CONSENT_VERSION },
    }).select("id").single();
    if (storeError) throw storeError;

    return json({ success: true, campaign_id: campaignId, record_id: stored.id, status, recipients_count: recipientsCount || 0 }, 200, corsHeaders);
  } catch (error) {
    console.error("newsletter-send", error);
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    if (message === "BREVO_NOT_CONFIGURED") return json({ error: message }, 503, makeCorsHeaders(req));
    if (message === "BREVO_NEWSLETTER_TEMPLATE_INACTIVE") {
      return json({ error: message, message: `Le template Newsletter Brevo #${newsletterTemplateId()} est inactif.` }, 409, makeCorsHeaders(req));
    }
    if (message.startsWith("BREVO_NEWSLETTER_TEMPLATE_UNAVAILABLE")) {
      return json({ error: "BREVO_NEWSLETTER_TEMPLATE_UNAVAILABLE", message: `Le template Newsletter Brevo #${newsletterTemplateId()} est introuvable ou inaccessible.` }, 502, makeCorsHeaders(req));
    }
    if (message.startsWith("BREVO_CREATE_FAILED")) {
      return json({ error: "BREVO_CREATE_FAILED", message: "Brevo n’a pas pu préparer la campagne Newsletter." }, 502, makeCorsHeaders(req));
    }
    return json({ error: "SERVER_ERROR", message: "Le service e-mail est momentanément indisponible." }, 500, makeCorsHeaders(req));
  }
});
