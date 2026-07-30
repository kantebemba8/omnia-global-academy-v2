import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

  if (Object.keys(userUpdates).length === 0 && Object.keys(professorUpdates).length === 0) {
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
