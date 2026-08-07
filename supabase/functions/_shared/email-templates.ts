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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function value(params: Record<string, unknown>, key: string, fallback = ""): string {
  const raw = params[key];
  return raw === undefined || raw === null || raw === "" ? fallback : String(raw);
}

function button(label: string, href: string): string {
  if (!href) return "";
  return `<p style="margin:28px 0 8px"><a href="${esc(href)}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(label)}</a></p>`;
}

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
  | "auth_verification_otp"
  | "auth_login_otp"
  | "auth_password_reset"
  | "account_welcome"
  | "account_pending_validation"
  | "platform_invitation"
  | "status_update"
  | "professor_approved"
  | "structure_approved"
  | "transaction_update"
  | "certificate_ready"
  | "learning_reminder";

export type RenderedEmail = { subject: string; html: string; tag: string };

export function renderTemplate(key: OmniaTemplateKey, params: Record<string, unknown> = {}): RenderedEmail {
  const firstName = value(params, "PRENOM", value(params, "FIRST_NAME", ""));
  const hello = firstName ? `<p style="margin:0 0 16px">Bonjour ${esc(firstName)},</p>` : "";
  const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";

  if (key === "auth_verification_otp" || key === "auth_login_otp") {
    const code = value(params, "OTP");
    const isLogin = key === "auth_login_otp";
    const title = isLogin ? "Votre code de connexion" : "Confirmez votre adresse e-mail";
    return {
      subject: `${title} — Omnia Global Academy`,
      tag: key,
      html: omniaEmailLayout({
        title,
        preheader: `Code ${code}`,
        bodyHtml: `${hello}<p style="margin:0 0 18px;line-height:1.7">${isLogin ? "Utilisez ce code pour terminer votre connexion." : "Utilisez ce code pour confirmer votre adresse e-mail et poursuivre votre inscription."}</p><div style="margin:24px 0;padding:18px;text-align:center;background:#f7f9fc;border:1px solid #e4e9f0;border-radius:10px;font-size:34px;font-weight:800;letter-spacing:8px;color:${BRAND.primary}">${esc(code)}</div><p style="margin:0;color:#6b7788;font-size:13px">Ce code expire dans ${esc(value(params, "EXPIRES_MINUTES", "5"))} minutes. Ne le partagez jamais.</p>`,
      }),
    };
  }

  if (key === "auth_password_reset") {
    const resetUrl = value(params, "RESET_URL");
    return {
      subject: "Réinitialiser votre mot de passe — Omnia Global Academy",
      tag: key,
      html: omniaEmailLayout({
        title: "Réinitialiser votre mot de passe",
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7">Une demande de réinitialisation de mot de passe a été reçue pour votre compte.</p>${button("Choisir un nouveau mot de passe", resetUrl)}<p style="margin:18px 0 0;color:#6b7788;font-size:13px">Le lien est temporaire et ne peut être utilisé qu’une seule fois.</p>`,
      }),
    };
  }

  if (key === "platform_invitation") {
    const role = value(params, "ROLE_NAME", "membre");
    const loginUrl = value(params, "LOGIN_URL", `${appUrl}/connexion`);
    const tempPassword = value(params, "TEMPORARY_PASSWORD");
    const organizationName = value(params, "ORGANIZATION_NAME");
    const message = value(params, "MESSAGE_SPECIFIQUE");
    return {
      subject: `Invitation Omnia — ${role}`,
      tag: key,
      html: omniaEmailLayout({
        title: "Vous êtes invité(e) sur Omnia",
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7">${organizationName ? `<strong>${esc(organizationName)}</strong> vous invite à rejoindre` : "Une invitation vous donne accès à"} l’espace <strong>${esc(role)}</strong>.</p>${message ? `<p style="margin:16px 0 0;line-height:1.7">${esc(message)}</p>` : ""}${tempPassword ? `<p style="margin:18px 0 0">Mot de passe temporaire : <strong>${esc(tempPassword)}</strong></p>` : ""}${button("Examiner l’invitation", loginUrl)}<p style="margin:16px 0 0;color:#6b7788;font-size:13px">Ce lien est personnel et expire automatiquement.</p>`,
      }),
    };
  }

  if (key === "account_welcome" || key === "account_pending_validation") {
    const role = value(params, "ROLE_NAME", "Membre");
    const message = value(params, "MESSAGE_SPECIFIQUE", key === "account_pending_validation" ? "Votre dossier a bien été reçu et sera examiné par l’Administration Omnia." : "Votre compte est actif.");
    const url = value(params, "DASHBOARD_URL", `${appUrl}/home`);
    const title = key === "account_pending_validation" ? "Votre inscription est enregistrée" : "Bienvenue sur Omnia Global Academy";
    return {
      subject: `${title} — Omnia Global Academy`,
      tag: key,
      html: omniaEmailLayout({
        title,
        bodyHtml: `${hello}<p style="margin:0 0 10px;line-height:1.7">Profil : <strong>${esc(role)}</strong></p><p style="margin:0;line-height:1.7">${esc(message)}</p>${button("Ouvrir Omnia", url)}`,
      }),
    };
  }

  if (key === "professor_approved") {
    return {
      subject: "Votre profil Professeur est validé — Omnia Global Academy",
      tag: key,
      html: omniaEmailLayout({
        title: "Profil Professeur validé",
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7">Votre profil Professeur a été validé. Vous pouvez maintenant accéder aux fonctions qui vous sont ouvertes.</p>${button("Accéder à mon espace", value(params, "DASHBOARD_URL", `${appUrl}/professeur/dashboard`))}`,
      }),
    };
  }

  if (key === "structure_approved") {
    const structure = value(params, "SCHOOL_NAME", "Votre Structure");
    return {
      subject: "Votre Structure est validée — Omnia Global Academy",
      tag: key,
      html: omniaEmailLayout({
        title: "Structure validée",
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7"><strong>${esc(structure)}</strong> a été validée par l’Administration Omnia.</p>${button("Accéder à l’espace Structure", value(params, "DASHBOARD_URL", `${appUrl}/structure/dashboard`))}`,
      }),
    };
  }

  if (key === "certificate_ready") {
    const title = value(params, "FORMATION_TITRE", "Votre formation");
    return {
      subject: `Certificat disponible — ${title}`,
      tag: key,
      html: omniaEmailLayout({
        title: "Votre certificat est disponible",
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7">Votre certificat pour <strong>${esc(title)}</strong> est disponible dans votre espace Omnia.</p>${button("Consulter mon certificat", value(params, "CERTIFICATE_URL", value(params, "ACTION_URL", `${appUrl}/home`)))}`,
      }),
    };
  }

  if (key === "learning_reminder") {
    const title = value(params, "FORMATION_TITRE", "Votre formation");
    return {
      subject: `Reprendre votre formation — ${title}`,
      tag: key,
      html: omniaEmailLayout({
        title: "Continuez votre parcours",
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7">Votre formation <strong>${esc(title)}</strong> vous attend${value(params, "COMPLETION_PERCENT") ? ` — progression : ${esc(value(params, "COMPLETION_PERCENT"))}%` : ""}.</p>${button("Reprendre ma formation", value(params, "COURSE_URL", `${appUrl}/home`))}`,
      }),
    };
  }

  if (key === "transaction_update") {
    const title = value(params, "FORMATION_TITRE", value(params, "PRODUCT_TITLE", "Transaction Omnia"));
    const message = value(params, "MESSAGE_SPECIFIQUE", value(params, "STATUT", "Une mise à jour est disponible."));
    return {
      subject: `Mise à jour — ${title}`,
      tag: key,
      html: omniaEmailLayout({
        title,
        bodyHtml: `${hello}<p style="margin:0;line-height:1.7">${esc(message)}</p>${button("Voir les détails", value(params, "ACTION_URL", `${appUrl}/home`))}`,
      }),
    };
  }

  const title = value(params, "FORMATION_TITRE", value(params, "ROLE_NAME", "Information Omnia"));
  const status = value(params, "STATUT");
  const message = value(params, "MESSAGE_SPECIFIQUE", "Une mise à jour concernant votre compte ou votre activité est disponible.");
  const comment = value(params, "COMMENTAIRE");
  return {
    subject: `${status ? `${status} — ` : ""}${title}`,
    tag: "status_update",
    html: omniaEmailLayout({
      title: status || title,
      bodyHtml: `${hello}<p style="margin:0;line-height:1.7">${esc(message)}</p>${comment ? `<p style="margin:16px 0 0;padding:14px;background:#f7f9fc;border-left:3px solid ${BRAND.accent};line-height:1.6">${esc(comment)}</p>` : ""}${button("Ouvrir Omnia", value(params, "ACTION_URL", `${appUrl}/home`))}`,
    }),
  };
}

export function templateKeyFromLegacyId(templateId: number): OmniaTemplateKey {
  const map: Record<number, OmniaTemplateKey> = {
    1: "platform_invitation",
    3: "status_update",
    4: "account_welcome",
    5: "transaction_update",
    6: "professor_approved",
    7: "structure_approved",
    8: "transaction_update",
    9: "certificate_ready",
    10: "learning_reminder",
  };
  return map[templateId] || "status_update";
}

export type BrevoSyncTemplate = {
  key: OmniaTemplateKey;
  templateName: string;
  subject: string;
  htmlContent: string;
  sender: { name: string; email: string };
  replyTo: string;
  tag: string;
};

export function brevoSyncTemplates(): BrevoSyncTemplate[] {
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com";
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || BRAND.name;
  const replyTo = Deno.env.get("BREVO_REPLY_TO") || senderEmail;
  const defs: Array<[OmniaTemplateKey, string, Record<string, unknown>]> = [
    ["auth_verification_otp", "OGA — Vérification e-mail", { PRENOM: "{{params.PRENOM}}", OTP: "{{params.OTP}}", EXPIRES_MINUTES: "{{params.EXPIRES_MINUTES}}" }],
    ["auth_login_otp", "OGA — Connexion OTP", { PRENOM: "{{params.PRENOM}}", OTP: "{{params.OTP}}", EXPIRES_MINUTES: "{{params.EXPIRES_MINUTES}}" }],
    ["auth_password_reset", "OGA — Réinitialisation mot de passe", { PRENOM: "{{params.PRENOM}}", RESET_URL: "{{params.RESET_URL}}" }],
    ["account_welcome", "OGA — Bienvenue", { PRENOM: "{{params.PRENOM}}", ROLE_NAME: "{{params.ROLE_NAME}}", MESSAGE_SPECIFIQUE: "{{params.MESSAGE_SPECIFIQUE}}", DASHBOARD_URL: "{{params.DASHBOARD_URL}}" }],
    ["account_pending_validation", "OGA — Inscription en validation", { PRENOM: "{{params.PRENOM}}", ROLE_NAME: "{{params.ROLE_NAME}}", MESSAGE_SPECIFIQUE: "{{params.MESSAGE_SPECIFIQUE}}", DASHBOARD_URL: "{{params.DASHBOARD_URL}}" }],
    ["platform_invitation", "OGA — Invitation", { PRENOM: "{{params.PRENOM}}", ROLE_NAME: "{{params.ROLE_NAME}}", ORGANIZATION_NAME: "{{params.ORGANIZATION_NAME}}", MESSAGE_SPECIFIQUE: "{{params.MESSAGE_SPECIFIQUE}}", TEMPORARY_PASSWORD: "{{params.TEMPORARY_PASSWORD}}", LOGIN_URL: "{{params.LOGIN_URL}}" }],
    ["status_update", "OGA — Statut et notification", { PRENOM: "{{params.PRENOM}}", FORMATION_TITRE: "{{params.FORMATION_TITRE}}", STATUT: "{{params.STATUT}}", MESSAGE_SPECIFIQUE: "{{params.MESSAGE_SPECIFIQUE}}", COMMENTAIRE: "{{params.COMMENTAIRE}}", ACTION_URL: "{{params.ACTION_URL}}" }],
    ["professor_approved", "OGA — Professeur validé", { PRENOM: "{{params.PRENOM}}", DASHBOARD_URL: "{{params.DASHBOARD_URL}}" }],
    ["structure_approved", "OGA — Structure validée", { PRENOM: "{{params.PRENOM}}", SCHOOL_NAME: "{{params.SCHOOL_NAME}}", DASHBOARD_URL: "{{params.DASHBOARD_URL}}" }],
    ["transaction_update", "OGA — Transaction", { PRENOM: "{{params.PRENOM}}", FORMATION_TITRE: "{{params.FORMATION_TITRE}}", MESSAGE_SPECIFIQUE: "{{params.MESSAGE_SPECIFIQUE}}", ACTION_URL: "{{params.ACTION_URL}}" }],
    ["certificate_ready", "OGA — Certificat", { PRENOM: "{{params.PRENOM}}", FORMATION_TITRE: "{{params.FORMATION_TITRE}}", CERTIFICATE_URL: "{{params.CERTIFICATE_URL}}" }],
    ["learning_reminder", "OGA — Reprise formation", { PRENOM: "{{params.PRENOM}}", FORMATION_TITRE: "{{params.FORMATION_TITRE}}", COMPLETION_PERCENT: "{{params.COMPLETION_PERCENT}}", COURSE_URL: "{{params.COURSE_URL}}" }],
  ];

  return defs.map(([key, templateName, params]) => {
    const rendered = renderTemplate(key, params);
    return {
      key,
      templateName,
      subject: rendered.subject,
      htmlContent: rendered.html,
      sender: { name: senderName, email: senderEmail },
      replyTo,
      tag: `omnia_${key}`,
    };
  });
}
