import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendBrevoEmail, sendAfricasTalkingSMS, notifyUser } from "../_shared/notifications.ts";

import { isOmniaInternalRequest } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-internal-secret",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!isOmniaInternalRequest(req)) return json({ error: "UNAUTHORIZED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";

    const body = await req.json();
    const { type, payload } = body as { type: string; payload: Record<string, unknown> };
    if (!type || !payload) return json({ error: "MISSING_FIELDS" }, 400);

    switch (type) {

      case "inscription_apprenant": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 4,
            from: "admission@omniaglobalacademy.com",
            params: {
              ROLE_NAME: "Apprenant",
              MESSAGE_SPECIFIQUE: "Votre compte est actif. Explorez des centaines de formations !",
              DASHBOARD_URL: `${appUrl}/home`,
            },
          },
          smsMessage: `Bienvenue sur Omnia Academy ! Votre compte est actif. Commencez dès maintenant : ${appUrl}`,
          sb,
        });
        break;
      }

      case "inscription_professeur": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 4,
            from: "admission@omniaglobalacademy.com",
            params: {
              ROLE_NAME: "Professeur",
              MESSAGE_SPECIFIQUE: "Votre dossier a bien été reçu. Vous serez notifié dès qu’une décision de l’Administration Omnia sera disponible.",
              DASHBOARD_URL: `${appUrl}/professeur/dashboard`,
            },
          },
          sb,
        });
        break;
      }

      case "inscription_etablissement": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 4,
            from: "admission@omniaglobalacademy.com",
            params: {
              ROLE_NAME: "Structure",
              MESSAGE_SPECIFIQUE: "Votre dossier a bien été reçu. Vous serez notifié dès qu’une décision de l’Administration Omnia sera disponible.",
              DASHBOARD_URL: `${appUrl}/structure/dashboard`,
            },
          },
          sb,
        });
        break;
      }

      case "kyc_professeur_valide": {
        const { data: user } = await sb.from("users").select("full_name, email").eq("id", payload.userId as string).maybeSingle();
        const nameParts = (user?.full_name || "").split(" ");
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 6,
            from: "admission@omniaglobalacademy.com",
            params: {
              NOM: nameParts.slice(1).join(" ") || nameParts[0],
              DOMAINE: payload.domaine as string || "",
              DASHBOARD_URL: `${appUrl}/professeur/dashboard`,
            },
          },
          smsMessage: `Omnia Academy : Votre profil Professeur est validé ! Créez votre première formation : ${appUrl}/professeur/dashboard`,
          sb,
        });
        break;
      }

      case "kyc_etablissement_valide": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 7,
            from: "admission@omniaglobalacademy.com",
            params: {
              SCHOOL_NAME: payload.school_name as string,
              DIRECTOR_NAME: payload.director_name as string,
              DASHBOARD_URL: `${appUrl}/structure/dashboard`,
            },
          },
          smsMessage: `Omnia Academy : Votre Structure ${payload.school_name} est validée. Accédez à votre espace : ${appUrl}/structure/dashboard`,
          sb,
        });
        break;
      }

      case "kyc_rejete": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 3,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: "Votre dossier",
              STATUT: "Rejeté",
              COMMENTAIRE: payload.raison as string || "Dossier incomplet.",
              MESSAGE_SPECIFIQUE: "Votre dossier n'a pas été validé. Veuillez corriger les éléments indiqués et resoumettre.",
              ACTION_URL: `${appUrl}/home`,
            },
          },
          smsMessage: `Omnia Academy : Votre dossier n'a pas été validé. Consultez votre email pour les détails et corrections nécessaires.`,
          sb,
        });
        break;
      }

      case "formation_soumise_confirmation": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 3,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              STATUT: "En attente de validation",
              MESSAGE_SPECIFIQUE: "Votre formation a été soumise et sera examinée par l’Administration Omnia. Vous serez notifié dès qu’une décision sera disponible.",
              ACTION_URL: `${appUrl}/professeur/courses`,
            },
          },
          sb,
        });
        break;
      }

      case "formation_validee": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 3,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              STATUT: "Validée",
              PRIX_DEFINITIF: payload.prix_xof as string,
              MESSAGE_SPECIFIQUE: `Votre formation a été validée au prix de ${payload.prix_xof} XOF.`,
              ACTION_URL: `${appUrl}/professeur/courses`,
            },
          },
          sb,
        });
        break;
      }

      case "formation_publiee": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 3,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              STATUT: "Publiée",
              ACTION_URL: `${appUrl}/cours/${payload.course_id}`,
              MESSAGE_SPECIFIQUE: "Votre formation est maintenant visible dans le catalogue. Partagez le lien pour attirer vos premiers élèves !",
            },
          },
          smsMessage: `Omnia Academy : Votre formation "${payload.formation_titre}" est maintenant en ligne !`,
          sb,
        });
        break;
      }

      case "formation_rejetee": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 3,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              STATUT: "Rejetée",
              COMMENTAIRE: payload.commentaire as string,
              ACTION_URL: `${appUrl}/professeur/courses/${payload.course_id}/edit`,
              MESSAGE_SPECIFIQUE: "Votre formation n'a pas été acceptée. Consultez les corrections demandées.",
            },
          },
          smsMessage: `Omnia Academy : Votre formation "${payload.formation_titre}" nécessite des corrections. Consultez votre email.`,
          sb,
        });
        break;
      }

      case "modification_demandee": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 3,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              STATUT: "Modifications requises",
              COMMENTAIRE: payload.commentaire as string,
              ACTION_URL: `${appUrl}/professeur/courses/${payload.course_id}/edit`,
              MESSAGE_SPECIFIQUE: "Des modifications sont demandées pour votre formation. Consultez les détails ci-dessous.",
            },
          },
          sb,
        });
        break;
      }

      case "alerte_vente": {
        // Fetch current wallet balance
        const { data: wallet } = await sb.from("wallets").select("balance_xof").eq("user_id", payload.userId as string).maybeSingle();
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 8,
            from: "contact@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              MONTANT_XOF: payload.montant_xof as number,
              COMMISSION_XOF: payload.commission_xof as number,
              ACHETEUR_PAYS: payload.acheteur_pays as string || "",
              SOLDE_TOTAL_XOF: wallet?.balance_xof ?? 0,
            },
          },
          smsMessage: `Omnia Academy : Nouvelle vente ! "${payload.formation_titre}" vendu. +${payload.commission_xof} XOF crédités. Solde : ${wallet?.balance_xof ?? 0} XOF`,
          sb,
        });
        break;
      }

      case "certificat_genere": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 9,
            from: "admission@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              CERTIFICATE_ID: payload.certificate_id as string,
              VERIFY_URL: payload.verify_url as string,
              PDF_URL: payload.pdf_url as string,
              CPD_HOURS: payload.cpd_hours as number,
              IS_CPD: payload.is_cpd as boolean,
            },
          },
          smsMessage: `Omnia Academy : Felicitations ! Votre certificat "${payload.formation_titre}" est disponible. Telechargez-le : ${payload.pdf_url}`,
          sb,
        });
        break;
      }

      case "retrait_approuve": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 8,
            from: "contact@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: "Demande de retrait",
              MONTANT_XOF: payload.montant_xof as number,
              COMMISSION_XOF: 0,
              ACHETEUR_PAYS: "",
              SOLDE_TOTAL_XOF: payload.solde_xof as number || 0,
              MESSAGE: `Votre retrait de ${payload.montant_xof} XOF a été approuvé. Le traitement de votre retrait a commencé.`,
            },
          },
          smsMessage: `Omnia Academy : Votre retrait de ${payload.montant_xof} XOF a été approuvé. Le traitement de votre retrait a commencé.`,
          sb,
        });
        break;
      }

      case "retrait_rejete": {
        await notifyUser({
          userId: payload.userId as string,
          smsMessage: `Omnia Academy : Votre demande de retrait de ${payload.montant_xof} XOF a été refusée. Raison : ${payload.raison}. Contactez le support.`,
          sb,
        });
        break;
      }

      case "facture_disponible": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 8,
            from: "contact@omniaglobalacademy.com",
            params: {
              FORMATION_TITRE: payload.formation_titre as string,
              MONTANT_XOF: payload.montant_xof as number,
              COMMISSION_XOF: 0,
              ACHETEUR_PAYS: "",
              SOLDE_TOTAL_XOF: 0,
              FACTURE_NUM: payload.invoice_number as string,
              FACTURE_URL: payload.invoice_url as string,
            },
          },
          smsMessage: `Omnia Academy : Votre facture #${payload.invoice_number} pour "${payload.formation_titre}" est disponible : ${payload.invoice_url}`,
          sb,
        });
        break;
      }

      case "invitation_enseignant":
      case "invitation_moderateur": {
        const roleName = type === "invitation_enseignant" ? "Enseignant" : "Modérateur";
        await sendBrevoEmail({
          templateId: 1,
          to: { email: payload.email as string, name: payload.full_name as string },
          params: {
            PRENOM: (payload.full_name as string || "").split(" ")[0],
            ROLE_NAME: roleName,
            EMAIL: payload.email as string,
            TEMPORARY_PASSWORD: payload.temporary_password as string,
            LOGIN_URL: `${appUrl}/connexion`,
          },
          from: "support@omniaglobalacademy.com",
          userId: payload.userId as string,
          sb,
        });
        break;
      }

      case "tarif_ecole_propose": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 5,
            from: "contact@omniaglobalacademy.com",
            params: {
              SCHOOL_NAME: payload.school_name as string,
              DIRECTOR_NAME: payload.director_name as string,
              FORMATION_TITRE: payload.formation_titre as string,
              SCHOOL_PERCENT: payload.school_percent as number,
              PLATFORM_PERCENT: payload.platform_percent as number,
              SCHOOL_AMOUNT: payload.school_amount as number,
              PLATFORM_AMOUNT: payload.platform_amount as number,
              ACTION_URL: payload.action_url as string || `${appUrl}/structure/dashboard`,
            },
          },
          sb,
        });
        break;
      }

      case "anti_abandon": {
        const courseUrl = payload.last_lesson_id
          ? `${appUrl}/cours/${payload.course_id}/apprendre/${payload.last_lesson_id}`
          : `${appUrl}/cours/${payload.course_id}/apprendre`;

        await notifyUser({
          userId: payload.userId as string,
          emailConfig: {
            templateId: 10,
            from: "admission@omniaglobalacademy.com",
            params: {
              ROLE_NAME: "Apprenant",
              MESSAGE_SPECIFIQUE: `Votre formation "${payload.formation_titre}" vous attend ! Vous en êtes à ${payload.completion_percent ?? 0}%. Continuez sur votre lancée !`,
              COURSE_URL: courseUrl,
FORMATION_TITRE: payload.formation_titre as string,
COMPLETION_PERCENT: payload.completion_percent ?? 0,
            },
          },
          smsMessage: `Omnia Academy : Votre formation "${payload.formation_titre}" vous attend ! Reprenez dès maintenant.`,
          sb,
        });
        break;
      }

      case "coaching_custom_request_received": {
        const when = payload.scheduled_start ? new Date(String(payload.scheduled_start)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "à confirmer";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Demande de coaching personnalisée",
            STATUT: "Nouvelle demande personnalisée",
            MESSAGE_SPECIFIQUE: `${payload.learner_name || "Un apprenant"} propose une session le ${when}.`,
            COMMENTAIRE: `Durée : ${payload.duration_minutes || "—"} minutes`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/sessions"}`,
          } },
          smsMessage: `Omnia Coaching : nouvelle demande personnalisée pour le ${when}.`,
          sb,
        });
        break;
      }

      case "coaching_custom_request_accepted": {
        const when = payload.scheduled_start ? new Date(String(payload.scheduled_start)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "à confirmer";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching personnalisée",
            STATUT: "Demande acceptée — paiement requis",
            MESSAGE_SPECIFIQUE: `${payload.coach_name || "Votre coach"} a accepté votre demande pour le ${when}.`,
            COMMENTAIRE: `Durée : ${payload.duration_minutes || "—"} minutes. Finalisez le paiement avant l’expiration du créneau.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : votre demande est acceptée. Finalisez le paiement dans votre espace.`,
          sb,
        });
        break;
      }

      case "coaching_custom_request_declined": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Demande de coaching personnalisée",
            STATUT: "Demande non acceptée",
            MESSAGE_SPECIFIQUE: `${payload.coach_name || "Le coach"} n’a pas accepté cette demande.`,
            COMMENTAIRE: payload.reason as string || "",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : votre demande personnalisée n’a pas été acceptée.`,
          sb,
        });
        break;
      }

      case "coaching_booking_confirmed": {
        const when = payload.scheduled_start ? new Date(String(payload.scheduled_start)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "à confirmer";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Réservation confirmée",
            MESSAGE_SPECIFIQUE: `Votre session avec ${payload.coach_name || "votre coach"} est confirmée pour le ${when}.`,
            COMMENTAIRE: `Durée : ${payload.duration_minutes || "—"} minutes — Montant : ${payload.amount_xof || 0} XOF`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : réservation confirmée avec ${payload.coach_name || "votre coach"} le ${when}.`,
          sb,
        });
        break;
      }

      case "coaching_new_booking": {
        const when = payload.scheduled_start ? new Date(String(payload.scheduled_start)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "à confirmer";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Nouvelle réservation",
            MESSAGE_SPECIFIQUE: `${payload.learner_name || "Un apprenant"} a réservé une session le ${when}.`,
            COMMENTAIRE: `Durée : ${payload.duration_minutes || "—"} minutes`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/sessions"}`,
          } },
          smsMessage: `Omnia Coaching : nouvelle réservation le ${when}. Consultez votre espace coach.`,
          sb,
        });
        break;
      }

      case "coaching_payment_failed": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Paiement de coaching",
            STATUT: "Paiement non abouti",
            MESSAGE_SPECIFIQUE: "Le paiement de votre session n’a pas été confirmé. Vous pouvez réessayer tant que le créneau reste disponible.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : votre paiement n’a pas été confirmé. Consultez votre espace pour réessayer.",
          sb,
        });
        break;
      }

      case "coaching_payment_issue": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Paiement de coaching",
            STATUT: "Paiement reçu après expiration du créneau",
            MESSAGE_SPECIFIQUE: "Votre paiement a été reçu, mais le créneau n’était plus sécurisé. L’équipe Omnia Coaching va vérifier la situation et organiser la confirmation ou le remboursement.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : paiement reçu après expiration du créneau. Notre équipe vérifie la situation.",
          sb,
        });
        break;
      }

      case "coaching_reminder": {
        const when = payload.scheduled_start ? new Date(String(payload.scheduled_start)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "prochainement";
        const soon = payload.reminder_type === "reminder_soon";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: soon ? "Session imminente" : "Rappel de session",
            MESSAGE_SPECIFIQUE: `Votre session de coaching est prévue le ${when}.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : rappel, votre session est prévue le ${when}.`,
          sb,
        });
        break;
      }

      case "coaching_session_started": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "La session commence",
            MESSAGE_SPECIFIQUE: "Votre session de coaching commence maintenant. Rejoignez votre espace Omnia Coaching.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : votre session commence maintenant.",
          sb,
        });
        break;
      }

      case "coaching_cancelled": {
        const actor = payload.cancelled_by === "coach" ? "le coach" : "l’apprenant";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Session annulée",
            MESSAGE_SPECIFIQUE: `La session a été annulée par ${actor}.`,
            COMMENTAIRE: `Montant remboursable calculé : ${payload.refund_amount_xof || 0} XOF.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : session annulée par ${actor}. Consultez votre espace pour le remboursement.`,
          sb,
        });
        break;
      }

      case "coaching_refund_update": {
        const status = String(payload.status || "mis à jour").replace(/_/g, " ");
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Remboursement coaching",
            STATUT: status,
            MESSAGE_SPECIFIQUE: `Votre remboursement de ${payload.amount_xof || 0} XOF a été ${status}.`,
            COMMENTAIRE: payload.reason as string || "",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : remboursement ${status} — ${payload.amount_xof || 0} XOF.`,
          sb,
        });
        break;
      }

      case "coaching_invoice_available": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 8, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            MONTANT_XOF: payload.amount_xof as number || 0,
            COMMISSION_XOF: 0,
            ACHETEUR_PAYS: "",
            SOLDE_TOTAL_XOF: 0,
            FACTURE_NUM: payload.invoice_number as string,
            FACTURE_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : votre facture ${payload.invoice_number} est disponible dans votre espace.`,
          sb,
        });
        break;
      }


      case "coaching_external_link_ready": {
        const when = payload.scheduled_start ? new Date(String(payload.scheduled_start)).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "prochainement";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Lien de session disponible",
            MESSAGE_SPECIFIQUE: `Le lien externe de votre session avec ${payload.coach_name || "votre coach"} est prêt pour le ${when}.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : le lien de votre session du ${when} est disponible dans votre espace.`,
          sb,
        });
        break;
      }

      case "coaching_session_closed": {
        const status = String(payload.status || "completed");
        const isNoShowCoach = status === "no_show_coach";
        const isNoShowLearner = status === "no_show_learner";
        const label = isNoShowCoach ? "Absence du coach constatée" : isNoShowLearner ? "Absence de l’apprenant constatée" : "Session terminée";
        const message = isNoShowCoach
          ? "Aucune présence du coach n’a été enregistrée. Une demande de remboursement total a été créée automatiquement."
          : isNoShowLearner
            ? "Aucune présence de l’apprenant n’a été enregistrée pendant la session."
            : "La session est terminée. Le compte rendu de présence est disponible dans Omnia Coaching.";
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: label,
            MESSAGE_SPECIFIQUE: message,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: `Omnia Coaching : ${label}. Consultez votre espace pour les détails.`,
          sb,
        });
        break;
      }

      case "coaching_rating_invitation": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Votre avis compte",
            MESSAGE_SPECIFIQUE: `Votre session avec ${payload.coach_name || "votre coach"} est terminée. Partagez votre expérience vérifiée.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : votre session est terminée. Vous pouvez maintenant laisser un avis vérifié.",
          sb,
        });
        break;
      }

      case "coaching_rating_received": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Nouvel avis reçu",
            MESSAGE_SPECIFIQUE: `Une session vérifiée a reçu la note de ${payload.rating || "—"}/5.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/avis"}`,
          } },
          smsMessage: `Omnia Coaching : nouvel avis reçu (${payload.rating || "—"}/5).`,
          sb,
        });
        break;
      }

      case "coaching_rating_response": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Avis Omnia Coaching",
            STATUT: "Réponse du coach",
            MESSAGE_SPECIFIQUE: "Le coach a répondu à votre avis vérifié.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : le coach a répondu à votre avis.",
          sb,
        });
        break;
      }

      case "coaching_rating_warning": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Qualité de votre activité de coaching",
            STATUT: "Avertissement qualité",
            MESSAGE_SPECIFIQUE: `Votre note moyenne est de ${payload.average_rating || 0}/5 sur ${payload.rating_count || 0} avis. Consultez les retours et améliorez votre accompagnement.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/avis"}`,
          } },
          smsMessage: `Omnia Coaching : avertissement qualité, note moyenne ${payload.average_rating || 0}/5.`,
          sb,
        });
        break;
      }

      case "coaching_rating_suspension": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Qualité de votre activité de coaching",
            STATUT: "Profil coaching suspendu",
            MESSAGE_SPECIFIQUE: `Votre profil coaching a été suspendu après le contrôle automatique de la note moyenne (${payload.average_rating || 0}/5 sur ${payload.rating_count || 0} avis). L’Administration Omnia peut examiner votre situation.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/avis"}`,
          } },
          smsMessage: "Omnia Coaching : votre profil coach a été suspendu après contrôle qualité.",
          sb,
        });
        break;
      }

      case "coaching_dispute_opened": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Litige ouvert",
            MESSAGE_SPECIFIQUE: "Un litige a été ouvert concernant cette session. Les revenus associés restent bloqués pendant l’examen.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : un litige a été ouvert concernant une session.",
          sb,
        });
        break;
      }

      case "coaching_dispute_message": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Litige Omnia Coaching",
            STATUT: "Nouveau message",
            MESSAGE_SPECIFIQUE: "Un nouveau message a été ajouté au dossier de litige.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : nouveau message dans votre dossier de litige.",
          sb,
        });
        break;
      }

      case "coaching_dispute_resolved": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Litige Omnia Coaching",
            STATUT: "Décision administrative",
            MESSAGE_SPECIFIQUE: payload.reason as string || "Le dossier a été traité par l’Administration Omnia.",
            COMMENTAIRE: `Décision : ${String(payload.decision || "résolue").replace(/_/g, " ")}`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : une décision a été prise concernant votre litige.",
          sb,
        });
        break;
      }

      case "coaching_revenue_available": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Revenu Omnia Coaching",
            STATUT: "Revenu disponible",
            MESSAGE_SPECIFIQUE: `${payload.amount_xof || 0} XOF ont été libérés dans votre portefeuille après le délai de contestation.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/revenus"}`,
          } },
          smsMessage: `Omnia Coaching : ${payload.amount_xof || 0} XOF sont disponibles dans votre portefeuille.`,
          sb,
        });
        break;
      }


      case "coaching_recording_available": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.offer_title as string || "Session de coaching",
            STATUT: "Enregistrement disponible",
            MESSAGE_SPECIFIQUE: "L’enregistrement privé de votre session est disponible dans Omnia Coaching pendant sa période de conservation.",
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching"}`,
          } },
          smsMessage: "Omnia Coaching : l’enregistrement privé de votre session est disponible.",
          sb,
        });
        break;
      }

      case "coaching_advanced_purchase_confirmed": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.product_title as string || "Produit Omnia Coaching",
            STATUT: "Achat confirmé",
            MESSAGE_SPECIFIQUE: `Votre achat ${String(payload.product_type || "coaching").replace(/_/g, " ")} est confirmé.`,
            COMMENTAIRE: `Montant : ${payload.amount_xof || 0} XOF`,
            ACTION_URL: `${appUrl}${payload.action_url || "/dashboard/coaching/avance"}`,
          } },
          smsMessage: `Omnia Coaching : votre achat « ${payload.product_title || "coaching"} » est confirmé.`,
          sb,
        });
        break;
      }

      case "coaching_advanced_sale": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: payload.product_title as string || "Produit Omnia Coaching",
            STATUT: "Nouvelle vente",
            MESSAGE_SPECIFIQUE: `Un apprenant a acheté votre ${String(payload.product_type || "produit").replace(/_/g, " ")}.`,
            COMMENTAIRE: `Montant brut : ${payload.amount_xof || 0} XOF`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/produits"}`,
          } },
          smsMessage: `Omnia Coaching : nouvelle vente de « ${payload.product_title || "votre produit"} ».`,
          sb,
        });
        break;
      }

      case "coaching_advanced_revenue_available": {
        await notifyUser({
          userId: payload.userId as string,
          emailConfig: { templateId: 3, from: "contact@omniaglobalacademy.com", params: {
            FORMATION_TITRE: "Revenu Coaching avancé",
            STATUT: "Revenu disponible",
            MESSAGE_SPECIFIQUE: `${payload.amount_xof || 0} XOF provenant d’un ${String(payload.source_type || "produit").replace(/_/g, " ")} ont été crédités dans votre portefeuille.`,
            ACTION_URL: `${appUrl}${payload.action_url || "/coach/revenus"}`,
          } },
          smsMessage: `Omnia Coaching : ${payload.amount_xof || 0} XOF sont disponibles dans votre portefeuille.`,
          sb,
        });
        break;
      }

      default:
        return json({ error: "UNKNOWN_TYPE", type }, 400);
    }

    return json({ success: true, type });
  } catch (err) {
    return json({ error: "INTERNAL", message: (err as Error).message }, 500);
  }
});
