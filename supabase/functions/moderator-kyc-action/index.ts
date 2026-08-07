import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getModeratorAccess, hasModeratorConflict } from "../_shared/moderator-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifyModerator(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const userId = String(sess.user_id);
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "moderateur").maybeSingle();
  return role ? userId : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const modId = await verifyModerator(sb, token);
    if (!modId) return json({ error: "FORBIDDEN" }, 403);

    const access = await getModeratorAccess(sb, modId);
    if (!access.active) return json({ error: "TEAM_ACCESS_SUSPENDED", message: "Votre accès interne est suspendu ou terminé." }, 403);
    if (!access.permissions.can_validate_professor_kyc) return json({ error: "FORBIDDEN", message: "Permission de contrôle d’identité Professeur requise." }, 403);

    if (req.method === "GET") {
      const { data: profs, error: profsError } = await sb.from("professeur_profiles")
        .select("id,user_id,expertise_domain,bio,kyc_status,created_at")
        .eq("kyc_status", "en_attente")
        .order("created_at", { ascending: true });
      if (profsError) throw profsError;
      const result = await Promise.all((profs ?? []).map(async (profile) => {
        const row = profile as { id: string; user_id: string; expertise_domain: string; bio: string; kyc_status: string; created_at: string };
        const { data: user } = await sb.from("users").select("full_name,email").eq("id", row.user_id).maybeSingle();
        return { ...row, ...((user as { full_name: string; email: string } | null) ?? {}) };
      }));
      return json({ professeurs: result, permissions: { can_validate_professor_kyc: true }, decision_mode: "recommendation" });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const userId = String(body.user_id || "").trim();
    const kycType = String(body.kyc_type || "");
    const action = String(body.action || "");
    const reason = String(body.reason || "").trim();
    if (!userId || kycType !== "professeur" || !["approve", "reject"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);
    if (action === "reject" && reason.length < 3) return json({ error: "REASON_REQUIRED", message: "Le motif de la recommandation de rejet est obligatoire." }, 400);

    if (await hasModeratorConflict(sb, modId, "professor_kyc", userId, [userId])) {
      return json({ error: "CONFLICT_OF_INTEREST", message: "Ce dossier ne peut pas être traité par ce membre de l’équipe." }, 403);
    }

    const requestAction = action === "approve" ? "kyc_approve" : "kyc_reject";
    const requestReason = reason || "Contrôle d’identité terminé : recommandation de validation.";
    const { data: existing, error: existingError } = await sb.from("moderator_action_requests")
      .select("id")
      .eq("moderator_id", modId)
      .eq("target_user_id", userId)
      .eq("action_type", requestAction)
      .eq("status", "pending")
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ error: "REQUEST_ALREADY_PENDING", message: "Une recommandation identique est déjà en attente de décision." }, 409);

    const { data: created, error: insertError } = await sb.from("moderator_action_requests").insert({
      moderator_id: modId,
      action_type: requestAction,
      target_user_id: userId,
      reason: requestReason,
      status: "pending",
    }).select("id").single();
    if (insertError) throw insertError;

    const { error: logError } = await sb.from("moderation_log").insert({
      moderator_id: modId,
      action_type: action === "approve" ? "kyc_validation_recommended" : "kyc_rejection_recommended",
      target_type: "user",
      target_id: userId,
      comment: requestReason,
    });
    if (logError) console.error("moderator-kyc-action: log failed", logError.message);

    return json({ success: true, request_id: created.id, message: "Recommandation transmise à l’Administration Omnia pour décision finale." }, 201);
  } catch (err) {
    console.error("moderator-kyc-action", err);
    return json({ error: "SERVER_ERROR", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});
