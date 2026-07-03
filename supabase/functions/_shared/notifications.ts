import { createClient } from "npm:@supabase/supabase-js@2";

export function getSupabase() {
  return createClient(Deno.env.get("DB_URL")!, Deno.env.get("DB_SERVICE_ROLE_KEY")!);
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
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return false;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: { email: from || "admission@omniaglobalacademy.com", name: "Omnia Global Academy" },
      to: [to],
      templateId,
      params,
    }),
  }).catch(() => null);

  const ok = response?.ok ?? false;

  if (sb) {
    await sb.from("notification_log").insert({
      user_id: userId ?? null,
      channel: "email",
      template_id: String(templateId),
      recipient: to.email,
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (response ? await response.text().catch(() => "unknown") : "fetch_error"),
      metadata: { templateId, params },
    }).catch(() => {});
  }

  return ok;
}

export async function sendAfricasTalkingSMS({ to, message, userId, sb }: SendSMSParams): Promise<boolean> {
  const apiKey = Deno.env.get("AFRICASTALKING_API_KEY") ?? "";
  if (!apiKey) return false;

  const isSandbox = Deno.env.get("AFRICASTALKING_ENV") === "sandbox";
  const baseUrl = isSandbox
    ? "https://api.sandbox.africastalking.com"
    : "https://api.africastalking.com";
  const username = Deno.env.get("AFRICASTALKING_USERNAME") || "sandbox";

  const response = await fetch(`${baseUrl}/version1/messaging`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "apiKey": apiKey,
    },
    body: new URLSearchParams({
      username,
      to,
      message: message.substring(0, 160),
      from: "OmniaAcad",
    }),
  }).catch(() => null);

  const ok = response?.ok ?? false;

  if (sb) {
    await sb.from("notification_log").insert({
      user_id: userId ?? null,
      channel: "sms",
      template_id: "sms_custom",
      recipient: to,
      status: ok ? "sent" : "failed",
      error_message: ok ? null : (response ? await response.text().catch(() => "unknown") : "fetch_error"),
      metadata: { message },
    }).catch(() => {});
  }

  return ok;
}

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
    await sendAfricasTalkingSMS({
      to: user.phone_number,
      message: smsMessage,
      userId,
      sb: client,
    });
  }
}
