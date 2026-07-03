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

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json() as {
      moderator_id: string;
      action: "update_permissions" | "suspend" | "activate" | "delete";
      permissions?: Record<string, boolean>;
    };
    const { moderator_id, action, permissions } = body;
    if (!moderator_id || !["update_permissions", "suspend", "activate", "delete"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const now = new Date().toISOString();

    if (action === "update_permissions") {
      const safePerms: Record<string, boolean> = {};
      const allowed = ["can_see_pending_courses","can_validate_course_price","can_reject_course","can_transmit_course_to_admin","can_validate_professor_kyc","can_validate_establishment_kyc","can_see_learners_list","can_see_professors_list","can_suspend_account","can_moderate_forum","can_post_job_offers","can_moderate_jobs","can_manage_support","can_view_moderation_log","can_view_analytics","can_view_financial_summary"];
      for (const k of allowed) safePerms[k] = !!(permissions ?? {})[k];
      await sb.from("moderator_permissions").upsert({ moderator_user_id: moderator_id, ...safePerms }, { onConflict: "moderator_user_id" });
    } else if (action === "suspend") {
      await sb.from("users").update({ status: "suspendu" }).eq("id", moderator_id);
      await sb.from("user_sessions").update({ expires_at: now }).eq("user_id", moderator_id);
    } else if (action === "activate") {
      await sb.from("users").update({ status: "actif" }).eq("id", moderator_id);
    } else if (action === "delete") {
      await sb.from("user_sessions").update({ expires_at: now }).eq("user_id", moderator_id);
      await sb.from("users").update({ status: "supprime" }).eq("id", moderator_id);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
