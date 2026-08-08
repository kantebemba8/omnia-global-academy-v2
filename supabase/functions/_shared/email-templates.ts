const BRAND = {
  name: "Omnia Global Academy",
  primary: "#002050",
  accent: "#BF8813",
  slogan: "EMPOWER SKILLS. TRANSFORM AFRICA. IMPACT THE WORLD.",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Mise en page réservée aux campagnes Omnia Newsletter créées depuis la plateforme.
 * Les 13 templates transactionnels sont, eux, entièrement administrés dans Brevo.
 */
export function omniaEmailLayout(params: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerText?: string;
}): string {
  const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
  const logoUrl = `${appUrl.replace(/\/$/, "")}/omnia-sidebar-logo.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#27364b">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(params.preheader || params.title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e6eaf0;border-radius:16px;overflow:hidden">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #edf0f4">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="padding-right:12px"><img src="${esc(logoUrl)}" width="44" height="44" alt="Omnia Global Academy" style="display:block;object-fit:contain"></td>
          <td><div style="font-size:15px;font-weight:800;letter-spacing:.08em;color:${BRAND.primary}">OMNIA</div><div style="font-size:9px;font-weight:700;letter-spacing:.16em;color:${BRAND.accent};margin-top:3px">GLOBAL ACADEMY</div><div style="font-size:9px;font-weight:600;letter-spacing:.04em;color:#7b8798;margin-top:5px">${BRAND.slogan}</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 28px"><h1 style="margin:0 0 18px;color:${BRAND.primary};font-size:24px;line-height:1.25">${esc(params.title)}</h1>${params.bodyHtml}</td></tr>
      <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #edf0f4;color:#6b7788;font-size:12px;line-height:1.6">${esc(params.footerText || "Message envoyé par Omnia Global Academy. Si vous n’êtes pas à l’origine de cette action, vous pouvez ignorer cet e-mail.")}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export type OmniaTemplateKey =
  | "platform_invitation"
  | "auth_password_reset"
  | "status_update"
  | "account_welcome"
  | "structure_pricing_proposal"
  | "professor_approved"
  | "structure_approved"
  | "payment_invoice"
  | "certificate_ready"
  | "learning_reminder"
  | "auth_verification_otp"
  | "auth_login_otp"
  | "account_pending_validation";

export type BrevoTemplateDefinition = {
  id: number;
  key: OmniaTemplateKey;
  name: string;
};

/**
 * Catalogue Brevo manuel validé dans l'interface Brevo.
 * Les IDs 1 à 13 sont fixes. Le code n'envoie jamais htmlContent, subject ou sender
 * pour ces templates, afin de ne pas écraser le design ni les expéditeurs configurés.
 */
export const BREVO_TEMPLATE_DEFINITIONS: readonly BrevoTemplateDefinition[] = [
  { id: 1, key: "platform_invitation", name: "OGA - 01 - Invitation à rejoindre Omnia" },
  { id: 2, key: "auth_password_reset", name: "OGA - 02 - Réinitialisation du mot de passe" },
  { id: 3, key: "status_update", name: "OGA - 03 - Statut et notification" },
  { id: 4, key: "account_welcome", name: "OGA - 04 - Bienvenue sur Omnia Global Academy" },
  { id: 5, key: "structure_pricing_proposal", name: "OGA - 05 - Proposition tarifaire Structure" },
  { id: 6, key: "professor_approved", name: "OGA - 06 - Validation compte Professeur" },
  { id: 7, key: "structure_approved", name: "OGA - 07 - Validation compte Structure" },
  { id: 8, key: "payment_invoice", name: "OGA - 08 - Confirmation paiement et facture" },
  { id: 9, key: "certificate_ready", name: "OGA - 09 - Certificat disponible" },
  { id: 10, key: "learning_reminder", name: "OGA - 10 - Reprise de formation" },
  { id: 11, key: "auth_verification_otp", name: "OGA - 11 - Vérification adresse e-mail OTP" },
  { id: 12, key: "auth_login_otp", name: "OGA - 12 - Connexion sécurisée OTP" },
  { id: 13, key: "account_pending_validation", name: "OGA - 13 - Compte en attente de validation" },
] as const;

const TEMPLATE_ID_BY_KEY = new Map<OmniaTemplateKey, number>(
  BREVO_TEMPLATE_DEFINITIONS.map((template) => [template.key, template.id]),
);

export function brevoTemplateId(key: OmniaTemplateKey): number {
  const id = TEMPLATE_ID_BY_KEY.get(key);
  if (!id) throw new Error(`UNKNOWN_BREVO_TEMPLATE_KEY:${key}`);
  return id;
}

export function templateKeyFromLegacyId(templateId: number): OmniaTemplateKey {
  const definition = BREVO_TEMPLATE_DEFINITIONS.find((template) => template.id === templateId);
  return definition?.key || "status_update";
}

function text(params: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = params[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function firstName(params: Record<string, unknown>, recipientName = ""): string {
  const direct = text(params, "FIRST_NAME", "PRENOM", "CONTACT_NAME", "NOM");
  const source = direct || recipientName;
  return source.trim().split(/\s+/)[0] || "";
}

function joinInfo(parts: Array<string | null | undefined>): string {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" · ");
}

function appUrl(): string {
  return (Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
}

function futureDateFr(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  try {
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function todayFr(): string {
  try {
    return new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Convertit les paramètres historiques du projet vers les variables exactes des
 * 13 templates Brevo manuels. Cette couche de compatibilité évite de modifier
 * toutes les fonctions productrices d'e-mails en une seule livraison.
 */
export function normalizeBrevoTemplateParams(
  templateId: number,
  params: Record<string, unknown> = {},
  recipientName = "",
): Record<string, unknown> {
  const FIRST_NAME = firstName(params, recipientName);

  switch (templateId) {
    case 1: {
      const organization = text(params, "ORGANIZATION_NAME", "SCHOOL_NAME");
      return {
        FIRST_NAME,
        INVITER_NAME: text(params, "INVITER_NAME") || organization || "Omnia Global Academy",
        ORGANIZATION_NAME: organization || "Omnia Global Academy",
        INVITATION_URL: text(params, "INVITATION_URL", "LOGIN_URL", "ACTION_URL"),
        EXPIRY_DATE: text(params, "EXPIRY_DATE", "EXPIRES_AT") || futureDateFr(7),
      };
    }

    case 2:
    case 11:
    case 12:
      return {
        FIRST_NAME,
        OTP_CODE: text(params, "OTP_CODE", "OTP"),
        EXPIRY_MINUTES: text(params, "EXPIRY_MINUTES", "EXPIRES_MINUTES") || (templateId === 2 ? "15" : "5"),
      };

    case 3: {
      const title = text(params, "FORMATION_TITRE", "ROLE_NAME", "PRODUCT_TITLE");
      const status = text(params, "STATUS_LABEL", "STATUT");
      return {
        SUBJECT: text(params, "SUBJECT") || joinInfo([status, title]) || "Notification Omnia Global Academy",
        FIRST_NAME,
        MESSAGE: text(params, "MESSAGE", "MESSAGE_SPECIFIQUE") || "Une mise à jour concernant votre compte ou votre activité est disponible.",
        STATUS_LABEL: status || "Information",
        ADDITIONAL_INFORMATION: text(params, "ADDITIONAL_INFORMATION", "COMMENTAIRE", "COMMENT") || "",
        CTA_LABEL: text(params, "CTA_LABEL") || "Consulter dans Omnia",
        CTA_URL: text(params, "CTA_URL", "ACTION_URL") || `${appUrl()}/home`,
      };
    }

    case 4:
      return {
        FIRST_NAME,
        DASHBOARD_URL: text(params, "DASHBOARD_URL", "ACTION_URL") || `${appUrl()}/home`,
      };

    case 5: {
      const schoolAmount = Number(params.SCHOOL_AMOUNT || 0);
      const platformAmount = Number(params.PLATFORM_AMOUNT || 0);
      const explicitAmount = text(params, "AMOUNT");
      const totalAmount = explicitAmount || (schoolAmount + platformAmount > 0 ? String(schoolAmount + platformAmount) : "—");
      const splitInfo = joinInfo([
        params.SCHOOL_PERCENT != null ? `Part Structure : ${params.SCHOOL_PERCENT}%` : "",
        params.PLATFORM_PERCENT != null ? `Part Omnia : ${params.PLATFORM_PERCENT}%` : "",
      ]);
      return {
        CONTACT_NAME: text(params, "CONTACT_NAME", "DIRECTOR_NAME") || FIRST_NAME,
        ORGANIZATION_NAME: text(params, "ORGANIZATION_NAME", "SCHOOL_NAME") || "Votre Structure",
        OFFER_NAME: text(params, "OFFER_NAME", "FORMATION_TITRE") || "Proposition Omnia Global Academy",
        SEAT_COUNT: text(params, "SEAT_COUNT", "BENEFICIARIES_COUNT") || "—",
        AMOUNT: totalAmount,
        CURRENCY: text(params, "CURRENCY") || "XOF",
        DURATION: text(params, "DURATION") || "—",
        ADDITIONAL_INFORMATION: text(params, "ADDITIONAL_INFORMATION") || splitInfo,
        PROPOSAL_URL: text(params, "PROPOSAL_URL", "ACTION_URL") || `${appUrl()}/structure/dashboard`,
        EXPIRY_DATE: text(params, "EXPIRY_DATE", "EXPIRES_AT") || "—",
      };
    }

    case 6:
      return {
        FIRST_NAME,
        DASHBOARD_URL: text(params, "DASHBOARD_URL", "ACTION_URL") || `${appUrl()}/professeur/dashboard`,
      };

    case 7:
      return {
        CONTACT_NAME: text(params, "CONTACT_NAME", "DIRECTOR_NAME") || FIRST_NAME,
        ORGANIZATION_NAME: text(params, "ORGANIZATION_NAME", "SCHOOL_NAME") || "Votre Structure",
        DASHBOARD_URL: text(params, "DASHBOARD_URL", "ACTION_URL") || `${appUrl()}/structure/dashboard`,
      };

    case 8: {
      const details = joinInfo([
        text(params, "ADDITIONAL_INFORMATION", "MESSAGE", "MESSAGE_SPECIFIQUE"),
      ]);
      const invoiceUrl = text(params, "INVOICE_URL", "FACTURE_URL");
      return {
        FIRST_NAME,
        TRANSACTION_REFERENCE: text(params, "TRANSACTION_REFERENCE", "FACTURE_NUM", "INVOICE_NUMBER", "PAYMENT_ID", "ORDER_ID") || "—",
        PAYMENT_DESCRIPTION: text(params, "PAYMENT_DESCRIPTION", "FORMATION_TITRE", "PRODUCT_TITLE") || "Transaction Omnia Global Academy",
        AMOUNT: text(params, "AMOUNT", "MONTANT_XOF", "PRICE_XOF", "TOTAL_XOF") || "—",
        CURRENCY: text(params, "CURRENCY") || "XOF",
        PAYMENT_DATE: text(params, "PAYMENT_DATE", "TRANSACTION_DATE", "CREATED_AT") || todayFr(),
        PAYMENT_STATUS: text(params, "PAYMENT_STATUS", "STATUT") || "Confirmé",
        ADDITIONAL_INFORMATION: details,
        PAYMENT_URL: text(params, "PAYMENT_URL", "ACTION_URL") || invoiceUrl || `${appUrl()}/home`,
        INVOICE_URL: invoiceUrl,
      };
    }

    case 9: {
      const courseName = text(params, "COURSE_NAME", "FORMATION_TITRE") || "Votre formation";
      return {
        FIRST_NAME,
        COURSE_NAME: courseName,
        CERTIFICATE_NAME: text(params, "CERTIFICATE_NAME") || `Certificat — ${courseName}`,
        ISSUE_DATE: text(params, "ISSUE_DATE", "CERTIFICATE_DATE") || todayFr(),
        CERTIFICATE_NUMBER: text(params, "CERTIFICATE_NUMBER", "CERTIFICATE_ID") || "—",
        PDF_URL: text(params, "PDF_URL", "CERTIFICATE_URL"),
        VERIFY_URL: text(params, "VERIFY_URL"),
      };
    }

    case 10:
      return {
        FIRST_NAME,
        COURSE_NAME: text(params, "COURSE_NAME", "FORMATION_TITRE") || "Votre formation",
        PROGRESS_PERCENT: text(params, "PROGRESS_PERCENT", "COMPLETION_PERCENT") || "0",
        LAST_ACTIVITY_DATE: text(params, "LAST_ACTIVITY_DATE", "LAST_ACCESS_AT") || "Récemment",
        COURSE_URL: text(params, "COURSE_URL", "ACTION_URL") || `${appUrl()}/home`,
      };

    case 13:
      return {
        FIRST_NAME,
        ROLE_LABEL: text(params, "ROLE_LABEL", "ROLE_NAME") || "Compte Omnia",
        ADDITIONAL_INFORMATION: text(params, "ADDITIONAL_INFORMATION", "MESSAGE_SPECIFIQUE") || "Votre dossier sera examiné par l’Administration Omnia.",
        STATUS_URL: text(params, "STATUS_URL", "DASHBOARD_URL", "ACTION_URL") || `${appUrl()}/connexion`,
      };

    default:
      return params;
  }
}
