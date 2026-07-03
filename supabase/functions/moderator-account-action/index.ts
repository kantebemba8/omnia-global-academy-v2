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

    const { data: permsRow } = await sb.from("moderator_permissions").select("can_see_learners_list,can_see_professors_list,can_suspend_account").eq("moderator_user_id", modId).maybeSingle();
    const perms = permsRow as unknown as Record<string, boolean> | null ?? {};

    // GET — list users
    if (req.method === "GET") {
      if (!perms.can_see_learners_list && !perms.can_see_professors_list) return json({ error: "FORBIDDEN" }, 403);
      const url = new URL(req.url);
      const search = url.searchParams.get("search") || "";
      const statusFilter = url.searchParams.get("status") || "";
      const userType = url.searchParams.get("type") || "all";

      let query = sb.from("users").select("id,full_name,email,phone_number,status,country_code,created_at").limit(100).order("created_at", { ascending: false });
      if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      if (statusFilter) query = query.eq("status", statusFilter);

      const { data: users } = await query;
      // Get roles for each user
      const enriched = await Promise.all((users ?? []).map(async (u) => {
        const uu = u as unknown as { id: string; full_name: string; email: string; status: string; country_code: string; created_at: string };
        const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", uu.id);
        const roleList = (roles ?? []).map((r) => (r as unknown as { role: string }).role);
        // Filter by type
        if (userType === "apprenant" && !perms.can_see_learners_list) return null;
        if (userType === "professeur" && !perms.can_see_professors_list) return null;
        if (userType === "apprenant" && !roleList.includes("apprenant")) return null;
        if (userType === "professeur" && !roleList.includes("professeur")) return null;
        return { ...uu, roles: roleList };
      }));

      return json({ users: enriched.filter(Boolean) });
    }

    // POST — suspend / reactivate
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!perms.can_suspend_account) return json({ error: "FORBIDDEN", message: "Permission can_suspend_account requise." }, 403);

    const body = await req.json();
    const { target_user_id, action } = body as { target_user_id: string; action: "suspend" | "reactivate" };
    if (!target_user_id || !["suspend", "reactivate"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const newStatus = action === "suspend" ? "suspendu" : "actif";
    await sb.from("users").update({ status: newStatus }).eq("id", target_user_id);

    // Invalidate sessions if suspending
    if (action === "suspend") {
      await sb.from("user_sessions").update({ expires_at: new Date().toISOString() }).eq("user_id", target_user_id);
    }

    await sb.from("moderation_log").insert({ moderator_id: modId, action_type: action === "suspend" ? "account_suspended" : "account_reactivated", target_type: "user", target_id: target_user_id });
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
