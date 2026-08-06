import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifyModerator(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as unknown as { user_id: string }).user_id).eq("role", "moderateur").maybeSingle();
  if (!role) return null;
  return (sess as unknown as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const modId = await verifyModerator(sb, token);
    if (!modId) return json({ error: "FORBIDDEN" }, 403);

    const { data: permsRow } = await sb.from("moderator_permissions").select("can_validate_professor_kyc").eq("moderator_user_id", modId).maybeSingle();
    const perms = permsRow as unknown as Record<string, boolean> | null ?? {};

    // GET — list pending professor KYC. Structure validation is reserved for the Administration Omnia.
    if (req.method === "GET") {
      const result: Record<string, unknown[]> = { professeurs: [] };
      if (perms.can_validate_professor_kyc) {
        const { data: profs } = await sb.from("professeur_profiles").select("id,user_id,expertise_domain,bio,kyc_status,created_at").eq("kyc_status", "en_attente").order("created_at", { ascending: true });
        result.professeurs = await Promise.all((profs ?? []).map(async (profile) => {
          const row = profile as { id: string; user_id: string; expertise_domain: string; bio: string; kyc_status: string; created_at: string };
          const { data: user } = await sb.from("users").select("full_name,email").eq("id", row.user_id).maybeSingle();
          return { ...row, ...((user as { full_name: string; email: string } | null) ?? {}) };
        }));
      }
      return json({ ...result, permissions: { can_validate_professor_kyc: !!perms.can_validate_professor_kyc } });
    }

    // POST — KYC action
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.json();
    const { user_id, kyc_type, action, reason } = body as { user_id: string; kyc_type: "professeur"; action: "approve" | "reject"; reason?: string };
    if (!user_id || !kyc_type || !["approve", "reject"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);
    if (kyc_type !== "professeur" || !perms.can_validate_professor_kyc) return json({ error: "FORBIDDEN" }, 403);
    if (action === "reject" && !reason) return json({ error: "REASON_REQUIRED" }, 400);

    const now = new Date().toISOString();
    const table = "professeur_profiles";

    if (action === "approve") {
      await sb.from(table).update({ kyc_status: "valide", kyc_validated_by: modId, kyc_validated_at: now }).eq("user_id", user_id);
      await sb.from("users").update({ status: "actif" }).eq("id", user_id);
    } else {
      await sb.from(table).update({ kyc_status: "rejete", kyc_rejection_reason: reason, kyc_validated_by: modId, kyc_validated_at: now }).eq("user_id", user_id);
      await sb.from("users").update({ status: "en_attente_validation" }).eq("id", user_id);
    }

    await sb.from("moderation_log").insert({ moderator_id: modId, action_type: action === "approve" ? "kyc_approved" : "kyc_rejected", target_type: "user", target_id: user_id, comment: reason ?? null });

    // Brevo notification
    const { data: u } = await sb.from("users").select("email,full_name").eq("id", user_id).maybeSingle();
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && u) {
      const uu = u as unknown as { email: string; full_name: string };
      const templateId = action === "approve" ? 6 : 3;
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          to: [{ email: uu.email, name: uu.full_name }],
          params: { STATUS: action === "approve" ? "valide" : "rejete", REASON: reason ?? "" },
          sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
        }),
      });
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
