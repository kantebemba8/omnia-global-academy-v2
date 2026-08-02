import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const USER_FIELDS = [
  "full_name",
  "email",
  "phone_number",
  "country_code",
  "avatar_url",
  "allow_email",
  "allow_sms",
  "allow_push",
  "subscribe_newsletter",
] as const;

const PROFESSOR_FIELDS = ["bio", "expertise_domain"] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "PATCH" && req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "INVALID_BODY" }, 400);

  const action = typeof body.action === "string" ? body.action.trim() : "";

  const userUpdates: Record<string, unknown> = {};
  for (const field of USER_FIELDS) {
    if (body[field] !== undefined) userUpdates[field] = body[field] === "" ? null : body[field];
  }

  const requestedProfessorProfile = body.professor_profile && typeof body.professor_profile === "object"
    ? body.professor_profile as Record<string, unknown>
    : null;
  const professorUpdates: Record<string, unknown> = {};
  if (requestedProfessorProfile) {
    for (const field of PROFESSOR_FIELDS) {
      if (requestedProfessorProfile[field] !== undefined) {
        professorUpdates[field] = requestedProfessorProfile[field] === "" ? null : requestedProfessorProfile[field];
      }
    }
  }

  const accountActions = new Set(["delete_account", "block_user", "unblock_user", "list_blocked_users"]);
  if (!accountActions.has(action) && Object.keys(userUpdates).length === 0 && Object.keys(professorUpdates).length === 0) {
    return json({ error: "NO_VALID_FIELDS", message: "Aucun champ valide fourni." }, 400);
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: session, error: sessionError } = await sb
      .from("user_sessions")
      .select("user_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError || !session) return json({ error: "SESSION_INVALID" }, 401);
    const userId = String(session.user_id);

    if (action === "block_user" || action === "unblock_user") {
      const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      if (!targetUserId) return json({ error: "TARGET_USER_REQUIRED" }, 400);
      if (targetUserId === userId) return json({ error: "CANNOT_BLOCK_SELF" }, 400);

      const { data: target, error: targetError } = await sb.from("users")
        .select("id,status")
        .eq("id", targetUserId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target || target.status === "supprime") return json({ error: "TARGET_USER_NOT_FOUND" }, 404);

      if (action === "block_user") {
        const { error } = await sb.from("user_blocks").upsert({
          blocker_user_id: userId,
          blocked_user_id: targetUserId,
          reason: reason || null,
        }, { onConflict: "blocker_user_id,blocked_user_id" });
        if (error) throw error;
        return json({ success: true, blocked: true, target_user_id: targetUserId });
      }

      const { error } = await sb.from("user_blocks").delete()
        .eq("blocker_user_id", userId)
        .eq("blocked_user_id", targetUserId);
      if (error) throw error;
      return json({ success: true, blocked: false, target_user_id: targetUserId });
    }

    if (action === "list_blocked_users") {
      const { data: blocks, error: blocksError } = await sb.from("user_blocks")
        .select("blocked_user_id,reason,created_at")
        .eq("blocker_user_id", userId)
        .order("created_at", { ascending: false });
      if (blocksError) throw blocksError;

      const blockedIds = (blocks || []).map((row: { blocked_user_id: string }) => row.blocked_user_id);
      const { data: blockedUsers, error: usersError } = blockedIds.length
        ? await sb.from("users").select("id,full_name,status").in("id", blockedIds)
        : { data: [], error: null };
      if (usersError) throw usersError;
      const nameMap = new Map((blockedUsers || []).map((row: { id: string; full_name: string }) => [row.id, row.full_name] as const));

      return json({
        success: true,
        blocked_users: (blocks || []).map((row: { blocked_user_id: string; reason?: string | null; created_at: string }) => ({
          user_id: row.blocked_user_id,
          full_name: nameMap.get(row.blocked_user_id) || "Utilisateur",
          reason: row.reason || null,
          blocked_at: row.created_at,
        })),
      });
    }

    if (action === "delete_account") {
      const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
      const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      const source = body.source === "web" ? "web" : "app";

      if (!currentPassword || confirmation !== "SUPPRIMER") {
        return json({ error: "DELETION_CONFIRMATION_REQUIRED", message: "Confirmation de suppression invalide." }, 400);
      }

      const { data: account, error: accountError } = await sb.from("users")
        .select("id,email,password_hash,status")
        .eq("id", userId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account || account.status === "supprime") {
        return json({ error: "ACCOUNT_UNAVAILABLE", message: "Ce compte est déjà supprimé ou inaccessible." }, 410);
      }
      if (String(account.email || "").toLowerCase() === "test@omniaglobalacademy.com") {
        return json({ error: "DEMO_ACCOUNT_PROTECTED", message: "Le compte de démonstration ne peut pas être supprimé." }, 403);
      }

      const passwordValid = await bcrypt.compare(currentPassword, String(account.password_hash || ""));
      if (!passwordValid) {
        return json({ error: "INVALID_PASSWORD", message: "Mot de passe actuel incorrect." }, 403);
      }

      const { data: deletion, error: deletionError } = await sb.rpc("omnia_delete_user_account", {
        p_user_id: userId,
        p_reason: reason || null,
        p_source: source,
      });
      if (deletionError) {
        const message = String(deletionError.message || "");
        if (message.includes("LAST_SUPER_ADMIN_PROTECTED")) {
          return json({ error: "LAST_SUPER_ADMIN_PROTECTED", message: "Le dernier Super-admin actif ne peut pas supprimer son compte." }, 409);
        }
        if (message.includes("DEMO_ACCOUNT_PROTECTED")) {
          return json({ error: "DEMO_ACCOUNT_PROTECTED", message: "Le compte de démonstration ne peut pas être supprimé." }, 403);
        }
        throw deletionError;
      }

      return json({
        success: true,
        account_deleted: true,
        deletion_reference: deletion?.deletion_reference || null,
        deleted_at: deletion?.deleted_at || new Date().toISOString(),
        retained_categories: deletion?.retained_categories || [],
      });
    }

    if (userUpdates.email) {
      const { data: existing } = await sb.from("users")
        .select("id")
        .eq("email", String(userUpdates.email).trim().toLowerCase())
        .neq("id", userId)
        .maybeSingle();
      if (existing) return json({ error: "EMAIL_TAKEN" }, 409);
      userUpdates.email = String(userUpdates.email).trim().toLowerCase();
    }

    if (userUpdates.phone_number) {
      const { data: existing } = await sb.from("users")
        .select("id")
        .eq("phone_number", String(userUpdates.phone_number).trim())
        .neq("id", userId)
        .maybeSingle();
      if (existing) return json({ error: "PHONE_TAKEN" }, 409);
      userUpdates.phone_number = String(userUpdates.phone_number).trim();
    }

    if (Object.keys(userUpdates).length > 0) {
      userUpdates.updated_at = new Date().toISOString();
      const { error: updateError } = await sb.from("users").update(userUpdates).eq("id", userId);
      if (updateError) throw updateError;
    }

    let professorProfile: Record<string, unknown> | null = null;
    if (Object.keys(professorUpdates).length > 0) {
      const { data: professorRole, error: roleError } = await sb.from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "professeur")
        .maybeSingle();
      if (roleError) throw roleError;
      if (!professorRole) return json({ error: "PROFESSOR_ROLE_REQUIRED" }, 403);

      const { data, error } = await sb.from("professeur_profiles")
        .upsert({ user_id: userId, ...professorUpdates }, { onConflict: "user_id" })
        .select("bio,expertise_domain,cv_diploma_url,kyc_status,signature_url")
        .single();
      if (error) throw error;
      professorProfile = data as Record<string, unknown>;
    } else {
      const { data } = await sb.from("professeur_profiles")
        .select("bio,expertise_domain,cv_diploma_url,kyc_status,signature_url")
        .eq("user_id", userId)
        .maybeSingle();
      professorProfile = data as Record<string, unknown> | null;
    }

    const { data: user, error: userError } = await sb.from("users")
      .select("id,full_name,email,phone_number,country_code,avatar_url,allow_email,allow_sms,allow_push,subscribe_newsletter,ai_tokens")
      .eq("id", userId)
      .maybeSingle();
    if (userError) throw userError;

    return json({ success: true, user, professor_profile: professorProfile });
  } catch (error) {
    console.error("auth-update-profile", error);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
