import { createClient } from "npm:@supabase/supabase-js@2";
import { sendOmniaEmail } from "./brevo-mail.ts";
import { templateKeyFromLegacyId } from "./email-templates.ts";
import { omniaInternalHeaders } from "./omnia-auth.ts";

export function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export interface SendEmailParams {
  templateId: number;
  to: { email: string; name?: string };
  params: Record<string, unknown>;
  from?: string;
  userId?: string;
  sb?: ReturnType<typeof createClient>;
}

export interface SendSMSParams {
  to: string;
  message: string;
  userId?: string;
  sb?: ReturnType<typeof createClient>;
}

export interface NotifyUserParams {
  userId: string;
  emailConfig?: { templateId: number; from?: string; params: Record<string, unknown> };
  smsMessage?: string;
  sb?: ReturnType<typeof createClient>;
}

export async function sendBrevoEmail({ templateId, to, params, from, userId, sb }: SendEmailParams): Promise<boolean> {
  const message = String(params.MESSAGE_SPECIFIQUE || "").toLowerCase();
  const templateKey = templateId === 4 && (message.includes("validation") || message.includes("vérification") || message.includes("examin"))
    ? "account_pending_validation"
    : templateKeyFromLegacyId(templateId);
  return sendOmniaEmail({
    to,
    templateKey,
    params,
    senderEmail: Deno.env.get("BREVO_SENDER_EMAIL") || from,
    userId: userId ?? null,
    sb,
  });
}

export async function sendBrevoSMS({ to, message, userId, sb }: SendSMSParams): Promise<boolean> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return false;

  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: Deno.env.get("BREVO_SMS_SENDER") || "OmniaAcad",
      recipient: to,
      content: message.substring(0, 160),
      type: "transactional",
    }),
  }).catch(() => null);

  const ok = response?.ok ?? false;

  if (sb) {
    await sb.from("notification_log").insert({
      user_id: userId ?? null,
      channel: "sms",
      template_id: "sms_brevo",
      recipient: to,
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (response ? await response.text().catch(() => "unknown") : "fetch_error"),
      metadata: {
        provider: "brevo",
        endpoint: "transactionalSMS/send",
        character_count: message.length,
      },
    }).catch(() => {});
  }

  return ok;
}

// Alias pour compatibilité avec l'ancien code
export const sendAfricasTalkingSMS = sendBrevoSMS;

export async function notifyUser({ userId, emailConfig, smsMessage, sb }: NotifyUserParams): Promise<void> {
  const client = sb ?? getSupabase();
  const { data: user } = await client
    .from("users")
    .select("email, phone_number, full_name, allow_email, allow_sms, email_status")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return;
  const prenom = (user.full_name || "").split(" ")[0] || user.full_name;
  if (emailConfig && user.allow_email !== false && user.email_status !== "invalide") {
    await sendBrevoEmail({
      templateId: emailConfig.templateId,
      to: { email: user.email, name: user.full_name },
      params: { PRENOM: prenom, ...emailConfig.params },
      from: emailConfig.from,
      userId,
      sb: client,
    });
  }
  if (smsMessage && user.allow_sms === true && user.phone_number) {
    await sendBrevoSMS({
      to: user.phone_number,
      message: smsMessage,
      userId,
      sb: client,
    });
  }

  const params = emailConfig?.params || {};
  const firstText = (...keys: string[]) => {
    for (const key of keys) {
      const value = params[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const contextLabel = firstText("FORMATION_TITRE", "ROLE_NAME", "SCHOOL_NAME", "STATUT", "FACTURE_NUM", "PRODUCT_TITLE", "OFFER_TITLE");
  const inAppMessage = (
    smsMessage ||
    firstText("MESSAGE_SPECIFIQUE", "MESSAGE", "DESCRIPTION", "DETAIL", "COMMENTAIRE") ||
    (emailConfig ? (contextLabel ? `Nouvelle mise à jour Omnia : ${contextLabel}.` : "Une nouvelle information concernant votre compte Omnia est disponible.") : "")
  ).slice(0, 1000);

  // La boîte Omnia est indépendante des préférences Push : une notification métier
  // doit rester visible dans la plateforme même si l'utilisateur refuse FCM/APNs.
  if (inAppMessage) {
    const title = (firstText("TITRE", "TITLE", "OBJET", "SUBJECT", "FORMATION_TITRE", "ROLE_NAME") || "Omnia Global Academy").slice(0, 180);
    const actionUrl = firstText("ACTION_URL", "URL_ACTION", "LIEN_ACTION", "CTA_URL", "LIEN", "URL", "DASHBOARD_URL", "COURSE_URL", "PDF_URL") || null;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (supabaseUrl) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/mobile-notifications?action=dispatch`, {
          method: "POST",
          headers: omniaInternalHeaders(),
          body: JSON.stringify({
            user_id: userId,
            title,
            message: inAppMessage,
            action_url: actionUrl,
            notification_type: "business_event",
            payload: { source: "notify-dispatch" },
          }),
        });
        if (!response.ok) {
          console.warn("notifyUser in-app dispatch failed", response.status);
        }
      } catch (error) {
        // Une panne du centre de notifications ne doit jamais annuler l'e-mail/SMS
        // ni le traitement métier principal.
        console.warn("notifyUser in-app unavailable", error instanceof Error ? error.message : String(error));
      }
    }
  }
}
