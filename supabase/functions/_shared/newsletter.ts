import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const NEWSLETTER_CONSENT_VERSION = "2026-08-email-governance-v2";
export const NEWSLETTER_LOCALES = new Set(["fr", "en", "es", "pt", "ar", "zh", "ru", "de"]);

export function normalizeNewsletterEmail(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255 ? email : "";
}

function listId(): number {
  const parsed = Number.parseInt(Deno.env.get("BREVO_NEWSLETTER_LIST_ID") || "7", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

export async function syncBrevoNewsletterContact(params: {
  email: string;
  active: boolean;
  firstName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY") || "";
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY_MISSING" };
  try {
    if (params.active) {
      const response = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          email: params.email,
          attributes: params.firstName ? { FIRSTNAME: params.firstName } : undefined,
          listIds: [listId()],
          updateEnabled: true,
        }),
      });
      const detail = await response.text();
      return response.ok ? { ok: true } : { ok: false, error: detail.slice(0, 1000) };
    }

    const response = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(params.email)}`,
      {
        method: "PUT",
        headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({ unlinkListIds: [listId()] }),
      },
    );
    const detail = await response.text();
    // 404 signifie que le contact n'existe déjà plus chez Brevo : l'état souhaité est donc atteint.
    return response.ok || response.status === 404 ? { ok: true } : { ok: false, error: detail.slice(0, 1000) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function setNewsletterConsent(sb: SupabaseClient, params: {
  email: string;
  userId?: string | null;
  active: boolean;
  source: string;
  locale?: string | null;
  firstName?: string;
  ipHash?: string | null;
  userAgent?: string | null;
  actionOverride?: string | null;
}) {
  const email = normalizeNewsletterEmail(params.email);
  if (!email) throw new Error("INVALID_EMAIL");
  const now = new Date().toISOString();
  const locale = NEWSLETTER_LOCALES.has(String(params.locale || "").toLowerCase())
    ? String(params.locale).toLowerCase()
    : "fr";

  const { data: existing, error: existingError } = await sb.from("newsletter_subscribers")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw existingError;

  const subscriberPayload = {
    email,
    user_id: params.userId || null,
    status: params.active ? "active" : "unsubscribed",
    locale,
    source: params.source,
    consent_version: NEWSLETTER_CONSENT_VERSION,
    consented_at: params.active ? now : null,
    unsubscribed_at: params.active ? null : now,
    provider_sync_status: "pending",
    provider_last_error: null,
    updated_at: now,
  };

  const { data: subscriber, error } = existing?.id
    ? await sb.from("newsletter_subscribers").update(subscriberPayload).eq("id", existing.id).select("id").single()
    : await sb.from("newsletter_subscribers").insert(subscriberPayload).select("id").single();
  if (error) throw error;

  const defaultAction = params.active
    ? (existing?.status === "unsubscribed" ? "resubscribe" : params.source === "registration" ? "registration_opt_in" : params.source === "profile" ? "profile_opt_in" : "subscribe")
    : (params.source === "profile" ? "profile_opt_out" : "unsubscribe");

  const { error: eventError } = await sb.from("newsletter_consent_events").insert({
    subscriber_id: subscriber.id,
    email,
    user_id: params.userId || null,
    action: params.actionOverride || defaultAction,
    source: params.source,
    locale,
    consent_version: NEWSLETTER_CONSENT_VERSION,
    ip_hash: params.ipHash || null,
    user_agent: params.userAgent?.slice(0, 500) || null,
  });
  if (eventError) throw eventError;

  const synced = await syncBrevoNewsletterContact({ email, active: params.active, firstName: params.firstName });
  await sb.from("newsletter_subscribers").update({
    provider_synced_at: synced.ok ? now : null,
    provider_sync_status: synced.ok ? "synced" : "error",
    provider_last_error: synced.ok ? null : synced.error || "BREVO_SYNC_FAILED",
  }).eq("id", subscriber.id);

  if (params.userId) {
    await sb.from("users").update({ subscribe_newsletter: params.active }).eq("id", params.userId);
  }

  return { subscriberId: subscriber.id, providerSynced: synced.ok, providerError: synced.error || null };
}
