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

// Returns first name + last initial: "Jean-Pierre Bemba" → "Jean-Pierre B."
function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const firsts = parts.slice(0, -1).join(" ");
  return `${firsts} ${last[0]}.`;
}

// Protected roles — never visible to a moderator
const PROTECTED_ROLES = ["super_admin", "moderateur"];

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

    const { data: permsRow } = await sb.from("moderator_permissions")
      .select("can_see_learners_list,can_see_professors_list,can_validate_establishment_kyc")
      .eq("moderator_user_id", modId)
      .maybeSingle();
    const perms = permsRow as unknown as Record<string, boolean> | null ?? {};

    // GET — list users (never returns email, phone, password_hash, session tokens)
    if (req.method === "GET") {
      if (!perms.can_see_learners_list && !perms.can_see_professors_list && !perms.can_validate_establishment_kyc) {
        return json({ error: "FORBIDDEN" }, 403);
      }
      const url = new URL(req.url);
      const search = url.searchParams.get("search") || "";
      const statusFilter = url.searchParams.get("status") || "";
      const userType = url.searchParams.get("type") || "all";

      // Determine which role types this moderator may see
      const allowedTypes: string[] = [];
      if (perms.can_see_learners_list) allowedTypes.push("apprenant");
      if (perms.can_see_professors_list) allowedTypes.push("professeur");
      if (perms.can_validate_establishment_kyc) allowedTypes.push("etablissement_directeur", "etablissement_enseignant");

      if (userType !== "all" && !allowedTypes.some((t) => t.startsWith(userType))) {
        return json({ users: [] });
      }

      // Fetch IDs of protected roles (super_admin, moderateur) — never expose these users
      const { data: protectedRows } = await sb.from("user_roles")
        .select("user_id")
        .in("role", PROTECTED_ROLES);
      const protectedIds: string[] = (protectedRows ?? []).map((r) => (r as unknown as { user_id: string }).user_id);

      // Build base query — safe fields only (NO email, phone_number, password_hash)
      let query = sb.from("users")
        .select("id,full_name,status,country_code,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (protectedIds.length > 0) {
        query = query.not("id", "in", `(${protectedIds.join(",")})`);
      }
      if (search) query = query.ilike("full_name", `%${search}%`);
      if (statusFilter) query = query.eq("status", statusFilter);

      const { data: users } = await query;

      const enriched: unknown[] = [];
      for (const u of users ?? []) {
        const uu = u as unknown as { id: string; full_name: string; status: string; country_code: string; created_at: string };

        const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", uu.id);
        const roleList: string[] = (roles ?? []).map((r) => (r as unknown as { role: string }).role);

        // Double-check: skip if user has a protected role (safety net)
        if (roleList.some((r) => PROTECTED_ROLES.includes(r))) continue;

        // Filter by requested type
        if (userType === "apprenant" && !roleList.includes("apprenant")) continue;
        if (userType === "professeur" && !roleList.includes("professeur")) continue;
        if (userType === "etablissement" && !roleList.some((r) => r.startsWith("etablissement"))) continue;

        // Permission gate per type
        if (roleList.includes("apprenant") && !perms.can_see_learners_list) continue;
        if (roleList.includes("professeur") && !perms.can_see_professors_list) continue;
        if (roleList.some((r) => r.startsWith("etablissement")) && !perms.can_validate_establishment_kyc) continue;

        enriched.push({
          id: uu.id,
          full_name: maskName(uu.full_name),
          status: uu.status,
          country_code: uu.country_code,
          created_at: uu.created_at,
          roles: roleList,
        });
      }

      return json({ users: enriched });
    }

    // POST — action (suspend / reactivate). Moderators can NO longer execute directly.
    // This path is now only reachable from the Super-admin approval flow (admin_override=true).
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json() as { target_user_id: string; action: string; admin_override?: boolean };
    const { target_user_id, action, admin_override } = body;

    if (!target_user_id || !action) return json({ error: "INVALID_PARAMS" }, 400);

    // Moderators must NOT execute actions directly — require admin_override
    if (!admin_override) {
      return json({
        error: "FORBIDDEN",
        message: "Les actions directes ne sont pas autorisées. Soumettez une demande au Super-admin.",
      }, 403);
    }

    // Safety check: never act on a protected account
    const { data: targetRoles } = await sb.from("user_roles").select("role").eq("user_id", target_user_id);
    if ((targetRoles ?? []).some((r) => PROTECTED_ROLES.includes((r as unknown as { role: string }).role))) {
      return json({ error: "FORBIDDEN", message: "Action non autorisée sur ce compte." }, 403);
    }

    if (!["suspend", "reactivate", "validate"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    if (action === "suspend") {
      await sb.from("users").update({ status: "suspendu" }).eq("id", target_user_id);
      await sb.from("user_sessions").update({ expires_at: new Date().toISOString() }).eq("user_id", target_user_id);
    } else if (action === "reactivate") {
      await sb.from("users").update({ status: "actif" }).eq("id", target_user_id);
    } else if (action === "validate") {
      await sb.from("users").update({ status: "actif" }).eq("id", target_user_id);
    }

    await sb.from("moderation_log").insert({
      moderator_id: modId,
      action_type: `account_${action}`,
      target_type: "user",
      target_id: target_user_id,
      comment: "admin_override",
    });

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
