import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { renderTemplate, type OmniaTemplateKey } from "./email-templates.ts";

export type SendOmniaEmailParams = {
  to: { email: string; name?: string };
  templateKey: OmniaTemplateKey;
  params?: Record<string, unknown>;
  senderEmail?: string;
  senderName?: string;
  replyTo?: string;
  userId?: string | null;
  sb?: SupabaseClient;
};

export function brevoEmailConfig() {
  return {
    apiKey: Deno.env.get("BREVO_API_KEY") || "",
    senderEmail: Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
    senderName: Deno.env.get("BREVO_SENDER_NAME") || "Omnia Global Academy",
    replyTo: Deno.env.get("BREVO_REPLY_TO") || Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
  };
}

async function logDelivery(sb: SupabaseClient | undefined, input: {
  userId?: string | null;
  email: string;
  templateKey: string;
  status: "sent" | "failed";
  error?: string | null;
  messageId?: string | null;
  params?: Record<string, unknown>;
}) {
  if (!sb) return;
  try {
    await sb.from("notification_log").insert({
      user_id: input.userId || null,
      channel: "email",
      template_id: input.templateKey,
      recipient: input.email,
      status: input.status,
      error_message: input.error || null,
      metadata: {
        provider: "brevo",
        message_id: input.messageId || null,
        params: input.params || {},
      },
    });
  } catch (error) {
    console.error("email delivery log failed", error);
  }
}

export async function sendOmniaEmail(input: SendOmniaEmailParams): Promise<boolean> {
  const cfg = brevoEmailConfig();
  if (!cfg.apiKey) {
    await logDelivery(input.sb, {
      userId: input.userId,
      email: input.to.email,
      templateKey: input.templateKey,
      status: "failed",
      error: "BREVO_API_KEY_MISSING",
      params: input.params,
    });
    return false;
  }

  const rendered = renderTemplate(input.templateKey, input.params || {});
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": cfg.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: input.senderName || cfg.senderName,
          email: input.senderEmail || cfg.senderEmail,
        },
        to: [input.to],
        replyTo: { email: input.replyTo || cfg.replyTo },
        subject: rendered.subject,
        htmlContent: rendered.html,
        tags: [`omnia_${input.templateKey}`],
      }),
    });
    const text = await response.text();
    let messageId = "";
    try { messageId = String(JSON.parse(text || "{}").messageId || ""); } catch { /* noop */ }
    if (!response.ok) {
      await logDelivery(input.sb, {
        userId: input.userId,
        email: input.to.email,
        templateKey: input.templateKey,
        status: "failed",
        error: text.slice(0, 2000),
        params: input.params,
      });
      console.error("Brevo transactional email failed", input.templateKey, response.status, text);
      return false;
    }
    await logDelivery(input.sb, {
      userId: input.userId,
      email: input.to.email,
      templateKey: input.templateKey,
      status: "sent",
      messageId,
      params: input.params,
    });
    return true;
  } catch (error) {
    await logDelivery(input.sb, {
      userId: input.userId,
      email: input.to.email,
      templateKey: input.templateKey,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      params: input.params,
    });
    return false;
  }
}
