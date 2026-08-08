import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  brevoTemplateId,
  normalizeBrevoTemplateParams,
  type OmniaTemplateKey,
} from "./email-templates.ts";

export type SendOmniaEmailParams = {
  to: { email: string; name?: string };
  templateKey: OmniaTemplateKey;
  params?: Record<string, unknown>;
  /** @deprecated L'expéditeur est défini dans le template Brevo manuel. */
  senderEmail?: string;
  /** @deprecated Le nom d'expéditeur est défini dans le template Brevo manuel. */
  senderName?: string;
  /** @deprecated Le Reply-To est défini dans le template Brevo manuel. */
  replyTo?: string;
  userId?: string | null;
  sb?: SupabaseClient;
};

export type SendBrevoTemplateEmailParams = {
  to: { email: string; name?: string };
  templateId: number;
  params?: Record<string, unknown>;
  userId?: string | null;
  sb?: SupabaseClient;
  templateKey?: string;
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
  templateId: number;
  status: "sent" | "failed";
  error?: string | null;
  messageId?: string | null;
  params?: Record<string, unknown>;
}) {
  if (!sb) return;
  try {
    // Ne jamais journaliser les valeurs des paramètres : elles peuvent contenir
    // un OTP, un token d'invitation ou d'autres données temporaires sensibles.
    const paramKeys = Object.keys(input.params || {}).sort();
    await sb.from("notification_log").insert({
      user_id: input.userId || null,
      channel: "email",
      template_id: input.templateKey,
      recipient: input.email,
      status: input.status,
      error_message: input.error || null,
      metadata: {
        provider: "brevo",
        provider_template_id: input.templateId,
        message_id: input.messageId || null,
        param_keys: paramKeys,
      },
    });
  } catch (error) {
    console.error("email delivery log failed", error);
  }
}

type LegacyBrevoRoute = {
  templateId: number;
  templateKey?: string;
  params: Record<string, unknown>;
};

/**
 * Couche de compatibilité pour les anciens producteurs d'e-mails.
 * Elle permet de conserver intégralement notify-dispatch et les autres fonctions
 * historiques tout en utilisant le catalogue Brevo manuel 1 à 13.
 */
function resolveLegacyBrevoRoute(
  templateId: number,
  params: Record<string, unknown> = {},
  templateKey?: string,
): LegacyBrevoRoute {
  const message = String(params.MESSAGE_SPECIFIQUE || params.MESSAGE || "").toLowerCase();
  const roleName = String(params.ROLE_NAME || params.ROLE_LABEL || "").toLowerCase();
  const title = String(params.FORMATION_TITRE || params.PAYMENT_DESCRIPTION || "").trim();
  const appUrl = (Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");

  // Les inscriptions Professeur/Structure historiques appellent encore le template 4.
  // Elles doivent désormais utiliser le template 13 "Compte en attente de validation".
  if (
    templateId === 4 &&
    (
      roleName === "professeur" ||
      roleName === "structure" ||
      message.includes("dossier") ||
      message.includes("décision") ||
      message.includes("validation") ||
      message.includes("vérification") ||
      message.includes("examin")
    )
  ) {
    return {
      templateId: 13,
      templateKey: "account_pending_validation",
      params,
    };
  }

  // Certaines notifications financières internes utilisaient historiquement le template 8.
  // Le template 8 est maintenant réservé à une confirmation de paiement/facture utilisateur.
  // Vente Professeur et retrait approuvé deviennent donc des notifications de statut (template 3).
  if (templateId === 8) {
    const amount = String(params.MONTANT_XOF ?? "");
    const commission = String(params.COMMISSION_XOF ?? "");
    const balance = String(params.SOLDE_TOTAL_XOF ?? "");
    const invoiceNumber = String(params.FACTURE_NUM || params.INVOICE_NUMBER || "").trim();
    const invoiceUrl = String(params.FACTURE_URL || params.INVOICE_URL || "").trim();
    const hasInvoiceArtifacts = Boolean(invoiceNumber || invoiceUrl);
    const isWithdrawal = title.toLowerCase().includes("retrait") || message.includes("retrait");
    const hasSaleCommission =
      Object.prototype.hasOwnProperty.call(params, "COMMISSION_XOF") &&
      Number(params.COMMISSION_XOF || 0) > 0;

    // Les factures restent impérativement sur le template 8.
    if (hasInvoiceArtifacts) {
      return { templateId, templateKey, params };
    }

    if (isWithdrawal) {
      return {
        templateId: 3,
        templateKey: "status_update",
        params: {
          ...params,
          SUBJECT: "Mise à jour de votre retrait Omnia Global Academy",
          STATUT: "Retrait approuvé",
          MESSAGE_SPECIFIQUE:
            String(params.MESSAGE || params.MESSAGE_SPECIFIQUE || "").trim() ||
            `Votre retrait de ${amount || "—"} XOF a été approuvé. Le traitement de votre retrait a commencé.`,
          COMMENTAIRE: balance ? `Solde restant : ${balance} XOF` : "",
          ACTION_URL: `${appUrl}/professeur/portefeuille`,
        },
      };
    }

    if (hasSaleCommission) {
      return {
        templateId: 3,
        templateKey: "status_update",
        params: {
          ...params,
          SUBJECT: title ? `Nouvelle vente — ${title}` : "Nouvelle vente Omnia Global Academy",
          STATUT: "Nouvelle vente",
          MESSAGE_SPECIFIQUE: commission
            ? `Une nouvelle vente a été enregistrée. Votre revenu est de ${commission} XOF.`
            : "Une nouvelle vente a été enregistrée sur votre espace.",
          COMMENTAIRE: [
            amount ? `Montant de la vente : ${amount} XOF` : "",
            balance ? `Solde : ${balance} XOF` : "",
          ].filter(Boolean).join(" · "),
          ACTION_URL: `${appUrl}/professeur/portefeuille`,
        },
      };
    }
  }

  return { templateId, templateKey, params };
}

/**
 * Envoie un template Brevo manuel par ID.
 * IMPORTANT : aucun sender, subject, replyTo ou htmlContent n'est envoyé ici.
 * Brevo applique donc exactement la configuration enregistrée dans le template.
 */
export async function sendBrevoTemplateEmail(input: SendBrevoTemplateEmailParams): Promise<boolean> {
  const cfg = brevoEmailConfig();
  const route = resolveLegacyBrevoRoute(input.templateId, input.params || {}, input.templateKey);
  const templateId = route.templateId;
  const templateKey = route.templateKey || input.templateKey || `brevo_${templateId}`;
  const normalizedParams = normalizeBrevoTemplateParams(templateId, route.params, input.to.name || "");

  if (!cfg.apiKey) {
    await logDelivery(input.sb, {
      userId: input.userId,
      email: input.to.email,
      templateKey,
      templateId,
      status: "failed",
      error: "BREVO_API_KEY_MISSING",
      params: normalizedParams,
    });
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": cfg.apiKey,
      },
      body: JSON.stringify({
        to: [input.to],
        templateId,
        params: normalizedParams,
        tags: [`omnia_${templateKey}`],
      }),
    });

    const responseText = await response.text();
    let messageId = "";
    try {
      messageId = String(JSON.parse(responseText || "{}").messageId || "");
    } catch {
      // Une réponse non JSON sera conservée uniquement comme message d'erreur.
    }

    if (!response.ok) {
      await logDelivery(input.sb, {
        userId: input.userId,
        email: input.to.email,
        templateKey,
        templateId,
        status: "failed",
        error: responseText.slice(0, 2000),
        params: normalizedParams,
      });
      console.error("Brevo transactional email failed", templateKey, templateId, response.status, responseText);
      return false;
    }

    await logDelivery(input.sb, {
      userId: input.userId,
      email: input.to.email,
      templateKey,
      templateId,
      status: "sent",
      messageId,
      params: normalizedParams,
    });
    return true;
  } catch (error) {
    await logDelivery(input.sb, {
      userId: input.userId,
      email: input.to.email,
      templateKey,
      templateId,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      params: normalizedParams,
    });
    return false;
  }
}

export async function sendOmniaEmail(input: SendOmniaEmailParams): Promise<boolean> {
  return sendBrevoTemplateEmail({
    to: input.to,
    templateId: brevoTemplateId(input.templateKey),
    params: input.params,
    userId: input.userId,
    sb: input.sb,
    templateKey: input.templateKey,
  });
}
