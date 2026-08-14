import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Client-Info,Apikey,x-omnia-session-token",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getAuthenticatedUser(sb: any, token: string) {
  const { data: session, error: sessionError } = await getActiveOmniaSessionResult(sb, token);

  if (sessionError || !session) return null;

  const { data: roles, error: rolesError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id);

  if (rolesError) return null;

  return {
    user_id: session.user_id,
    roles: (roles ?? []).map((r: any) => r.role),
  };
}

async function createNotification(
  sb: any,
  userId: string,
  title: string,
  message: string,
) {
  try {
    await sb.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type: "course_pricing",
      is_read: false,
    });
  } catch (error) {
    console.warn("Notification non créée :", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);
    const me = await getAuthenticatedUser(sb, token);

    if (!me) return json({ error: "SESSION_INVALID" }, 401);

    if (req.method === "GET") {
      if (me.roles.includes("super_admin")) {
        const { data, error } = await sb
          .from("courses")
          .select(
            "id,title,creator_id,instructor_id,creator_context,structure_id,status,pricing_status,score_calcule,prix_provisoire_xof,desired_price_amount,admin_selected_price_source,admin_selected_price_xof,pricing_snapshot,pricing_revision_comment,updated_at",
          )
          .in("pricing_status", [
            "en_attente_validation_prix_admin",
            "prix_revision_demandee",
          ])
          .order("updated_at", { ascending: true });

        if (error) throw error;
        return json({ courses: data ?? [] });
      }

      const { data, error } = await sb
        .from("courses")
        .select(
          "id,title,creator_id,instructor_id,creator_context,structure_id,status,pricing_status,score_calcule,prix_provisoire_xof,desired_price_amount,admin_selected_price_source,admin_selected_price_xof,pricing_snapshot,pricing_revision_comment,updated_at",
        )
        .or(`instructor_id.eq.${me.user_id},creator_id.eq.${me.user_id}`)
        .in("pricing_status", [
          "en_attente_validation_prix_admin",
          "en_attente_acceptation_prix_professeur",
          "en_attente_acceptation_prix_structure",
          "prix_revision_demandee",
        ])
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return json({ courses: data ?? [] });
    }

    const body = await req.json().catch(() => null);

    if (!body?.course_id || !body?.action) {
      return json({ error: "INVALID_PARAMS" }, 400);
    }

    const { data: course, error: courseError } = await sb
      .from("courses")
      .select(
        "id,title,creator_id,instructor_id,creator_context,structure_id,prix_provisoire_xof,desired_price_amount,pricing_status,admin_selected_price_xof",
      )
      .eq("id", body.course_id)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);

    if (body.action === "admin_decide") {
      if (!me.roles.includes("super_admin")) {
        return json({ error: "FORBIDDEN" }, 403);
      }

      const creatorContext = String(course.creator_context || "professeur");
      const isStructure = creatorContext === "structure";
      const allowedSources = isStructure ? ["owner", "custom"] : ["automatic", "professor", "custom"];
      if (!allowedSources.includes(String(body.source || ""))) {
        return json({ error: "INVALID_SOURCE" }, 400);
      }

      const selectedPrice = body.source === "automatic"
        ? Number(course.prix_provisoire_xof ?? 0)
        : (body.source === "professor" || body.source === "owner")
          ? Number(course.desired_price_amount ?? 0)
          : Number(body.custom_price_xof ?? 0);

      if (!Number.isFinite(selectedPrice) || selectedPrice <= 0) {
        return json({ error: "INVALID_PRICE" }, 400);
      }

      const desiredPrice = Number(course.desired_price_amount ?? 0);
      const structureNeedsAcceptance = isStructure && selectedPrice !== desiredPrice;
      const nextStatus = isStructure
        ? (structureNeedsAcceptance ? "en_attente_acceptation_prix_structure" : "accepted")
        : "en_attente_acceptation_prix_professeur";

      const patch: Record<string, unknown> = {
        pricing_status: nextStatus,
        admin_selected_price_source: body.source,
        admin_selected_price_xof: selectedPrice,
        pricing_admin_decided_at: new Date().toISOString(),
        pricing_admin_decided_by: me.user_id,
        pricing_revision_comment: body.comment || null,
        updated_at: new Date().toISOString(),
      };
      if (isStructure && !structureNeedsAcceptance) {
        patch.price_xof = selectedPrice;
        patch.professor_price_accepted = true;
        patch.professor_price_accepted_at = new Date().toISOString();
      }

      const { error: updateError } = await sb.from("courses").update(patch).eq("id", body.course_id);
      if (updateError) throw updateError;

      if (isStructure) {
        await createNotification(
          sb,
          course.creator_id,
          "Tarification de votre formation Structure",
          structureNeedsAcceptance
            ? `Omnia a ajusté le prix à ${selectedPrice.toLocaleString("fr-FR")} XOF. La Structure doit accepter ce nouveau montant avant la soumission pédagogique.`
            : `Omnia a validé votre prix proposé de ${selectedPrice.toLocaleString("fr-FR")} XOF. Aucune nouvelle acceptation n’est requise.`,
        );
      } else {
        await createNotification(
          sb,
          course.instructor_id || course.creator_id,
          "Tarification de votre formation",
          `Omnia a retenu un prix de ${selectedPrice.toLocaleString("fr-FR")} XOF (${body.source === "automatic" ? "calcul automatique" : body.source === "professor" ? "proposition du professeur" : "ajustement Omnia"}). Votre validation est requise avant la soumission pédagogique.`,
        );
      }

      return json({ success: true, selected_price_xof: selectedPrice, pricing_status: nextStatus });
    }

    if (
      (course.instructor_id || course.creator_id) !== me.user_id &&
      !me.roles.includes("super_admin")
    ) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    if (["professor_accept", "structure_accept", "owner_accept"].includes(body.action)) {
      const expectedStatus = String(course.creator_context || "") === "structure" ? "en_attente_acceptation_prix_structure" : "en_attente_acceptation_prix_professeur";
      if (course.pricing_status !== expectedStatus) {
        return json({ error: "INVALID_STATUS" }, 409);
      }

      const selectedPrice = Number(course.admin_selected_price_xof ?? 0);
      if (!Number.isFinite(selectedPrice) || selectedPrice <= 0) {
        return json({ error: "INVALID_SELECTED_PRICE" }, 400);
      }

      const { error: updateError } = await sb
        .from("courses")
        .update({
          pricing_status: "accepted",
          professor_price_accepted: true,
          professor_price_accepted_at: new Date().toISOString(),
          price_xof: selectedPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.course_id);

      if (updateError) throw updateError;

      return json({
        success: true,
        pricing_status: "accepted",
        price_xof: selectedPrice,
        next_action: "submit_course",
      });
    }

    if (["professor_revision", "structure_revision", "owner_revision"].includes(body.action)) {
      const desiredPrice =
        body.desired_price_amount == null
          ? course.desired_price_amount
          : Number(body.desired_price_amount);

      const { error: updateError } = await sb
        .from("courses")
        .update({
          pricing_status: "prix_revision_demandee",
          pricing_revision_comment:
            body.comment || (String(course.creator_context || "") === "structure" ? "Révision demandée par la Structure" : "Révision demandée par le professeur"),
          desired_price_amount: desiredPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.course_id);

      if (updateError) throw updateError;

      return json({
        success: true,
        pricing_status: "prix_revision_demandee",
      });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("course-pricing-workflow error:", error);
    return json(
      {
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
