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

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const mandatory = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  const rest = Array.from({ length: length - 4 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...mandatory, ...rest].sort(() => Math.random() - 0.5).join("");
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const { data: mods } = await sb.from("user_roles").select("user_id").eq("role", "moderateur");
      const modIds = (mods ?? []).map((m) => (m as { user_id: string }).user_id);
      if (modIds.length === 0) return json({ moderators: [] });
      const { data: users } = await sb.from("users").select("id,full_name,email,status,created_at").in("id", modIds);
      const enriched = await Promise.all((users ?? []).map(async (u) => {
        const uu = u as { id: string; full_name: string; email: string; status: string; created_at: string };
        const { data: perms } = await sb.from("moderator_permissions").select("*").eq("moderator_user_id", uu.id).maybeSingle();
        const permCount = perms ? Object.values(perms).filter((v) => v === true).length : 0;
        return { ...uu, permissions: perms, permissions_count: permCount };
      }));
      return json({ moderators: enriched });
    }

    const body = await req.json() as { full_name?: string; email?: string; phone_number?: string; permissions?: Record<string, boolean> };
    if (!body.full_name || !body.email) return json({ error: "INVALID_PARAMS" }, 400);

    // Check duplicates
    const { data: existing } = await sb.from("users").select("id").eq("email", body.email).maybeSingle();
    if (existing) return json({ error: "EMAIL_TAKEN" }, 409);

    const tempPassword = generatePassword(12);
    const passwordHash = await sha256(tempPassword);

    const { data: newUser } = await sb.from("users").insert({
      full_name: body.full_name, email: body.email,
      phone_number: body.phone_number ?? null,
      password_hash: passwordHash, status: "actif", force_password_change: true,
    }).select("id").maybeSingle();
    if (!newUser) return json({ error: "USER_CREATION_FAILED" }, 500);
    const userId = (newUser as { id: string }).id;

    await sb.from("user_roles").insert([{ user_id: userId, role: "apprenant" }, { user_id: userId, role: "moderateur" }]);

    // All permissions OFF by default — override with submitted ones
    const safePerms: Record<string, boolean> = {
      can_see_pending_courses: false, can_validate_course_price: false, can_reject_course: false,
      can_transmit_course_to_admin: false, can_validate_professor_kyc: false, can_validate_establishment_kyc: false,
      can_see_learners_list: false, can_see_professors_list: false, can_suspend_account: false,
      can_moderate_forum: false, can_post_job_offers: false, can_moderate_jobs: false,
      can_manage_support: false, can_view_moderation_log: false, can_view_analytics: false,
      can_view_financial_summary: false,
    };
    for (const [k, v] of Object.entries(body.permissions ?? {})) {
      if (k in safePerms) safePerms[k] = !!v;
    }
    await sb.from("moderator_permissions").insert({ moderator_user_id: userId, ...safePerms });

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: 1,
          to: [{ email: body.email, name: body.full_name }],
          params: { ROLE_NAME: "Modérateur", EMAIL: body.email, TEMPORARY_PASSWORD: tempPassword, LOGIN_URL: "/connexion" },
          sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
        }),
      });
    }

    return json({ success: true, moderator_id: userId });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
