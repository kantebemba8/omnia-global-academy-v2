import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";

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

const DEMO_EMAIL = "test@omniaglobalacademy.com";

const ALL_DEMO_ROLES = ["apprenant", "professeur", "responsable_structure", "moderateur"];
const LEGACY_ROLE_MAP: Record<string, string> = {
  etablissement_directeur: "responsable_structure",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const { data: config } = await sb
        .from("demo_account_config")
        .select("id, expires_at, is_online, last_seen_at, configured_at, configured_by, demo_roles, demo_course_ids")
        .order("configured_at", { ascending: false })
        .limit(10);

      // Fetch latest config's course titles for display
      const latest = config?.[0] ?? null;
      let courseTitles: Record<string, string> = {};
      if (latest?.demo_course_ids && Array.isArray(latest.demo_course_ids) && latest.demo_course_ids.length > 0) {
        const { data: courses } = await sb.from("courses").select("id, title").in("id", latest.demo_course_ids);
        (courses ?? []).forEach((c: { id: string; title: string }) => { courseTitles[c.id] = c.title; });
      }

      // Fetch all published courses for selection UI
      const { data: publishedCourses } = await sb.from("courses").select("id, title").eq("is_published", true).order("title");

      // Admin name for each config
      const adminIds = [...new Set((config ?? []).map((c: { configured_by: string }) => c.configured_by).filter(Boolean))];
      let adminNames: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: admins } = await sb.from("users").select("id, full_name").in("id", adminIds);
        (admins ?? []).forEach((a: { id: string; full_name: string }) => { adminNames[a.id] = a.full_name; });
      }

      const enriched = (config ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        configured_by_name: adminNames[(c.configured_by as string) ?? ""] ?? "—",
      }));

      // Online status from latest config
      const latestConfig = enriched[0] ?? null;
      const status = latestConfig
        ? (() => {
            const expiresMs = latestConfig.expires_at ? new Date(latestConfig.expires_at as string).getTime() : 0;
            const lastSeenMs = latestConfig.last_seen_at ? new Date(latestConfig.last_seen_at as string).getTime() : 0;
            const heartbeatFresh = lastSeenMs > 0 && Date.now() - lastSeenMs <= 90_000;
            return {
              is_active: Boolean(latestConfig.is_online) && heartbeatFresh && expiresMs > Date.now(),
              last_activity: latestConfig.last_seen_at ?? null,
              time_remaining_seconds: expiresMs > 0
                ? Math.max(0, Math.floor((expiresMs - Date.now()) / 1000))
                : 0,
            };
          })()
        : null;

      return json({
        configs: enriched,
        status,
        available_roles: ALL_DEMO_ROLES,
        published_courses: publishedCourses ?? [],
        course_titles: courseTitles,
      });
    }

    const body = await req.json() as {
      new_password: string;
      expires_at: string;
      note?: string;
      demo_roles?: string[];
      demo_course_ids?: string[];
    };
    const { new_password, expires_at, demo_roles, demo_course_ids } = body;
    if (!new_password || !expires_at) return json({ error: "INVALID_PARAMS" }, 400);
    if (new_password.length < 6) return json({ error: "PASSWORD_TOO_SHORT" }, 400);
    if (new_password.length > 72) return json({ error: "PASSWORD_TOO_LONG" }, 400);
    if (new Date(expires_at) <= new Date()) return json({ error: "EXPIRY_IN_PAST" }, 400);

    const passwordHash = hashSync(new_password, 10);
    const now = new Date().toISOString();

    const requestedRoles = Array.isArray(demo_roles) && demo_roles.length > 0 ? demo_roles : ["apprenant"];
    const selectedRoles = [...new Set(
      requestedRoles
        .map((role) => LEGACY_ROLE_MAP[role] ?? role)
        .filter((role) => ALL_DEMO_ROLES.includes(role))
    )];
    if (selectedRoles.length === 0) return json({ error: "NO_VALID_DEMO_ROLE" }, 400);

    const requestedCourseIds: string[] = Array.isArray(demo_course_ids) ? [...new Set(demo_course_ids)] : [];
    let selectedCourseIds: string[] = [];
    if (requestedCourseIds.length > 0) {
      const { data: validCourses, error: coursesError } = await sb
        .from("courses")
        .select("id")
        .in("id", requestedCourseIds)
        .eq("is_published", true);
      if (coursesError) throw coursesError;
      selectedCourseIds = (validCourses ?? []).map((c: { id: string }) => c.id);
    }

    // Fetch demo user
    const { data: demoUser } = await sb.from("users").select("id").eq("email", DEMO_EMAIL).maybeSingle();
    if (demoUser) {
      const demoId = (demoUser as { id: string }).id;
      // Invalidate all existing sessions
      await sb.from("user_sessions").delete().eq("user_id", demoId);
      // Update password hash
      await sb.from("users").update({ password_hash: passwordHash }).eq("id", demoId);

      // Keep demo enrollments exactly synchronized with the current configuration.
      await sb.from("user_enrollments").delete().eq("user_id", demoId);
      if (selectedCourseIds.length > 0) {
        const enrollments = selectedCourseIds.map((courseId) => ({
          user_id: demoId,
          course_id: courseId,
          enrolled_at: now,
          status: "active",
        }));
        const { error: enrollmentError } = await sb
          .from("user_enrollments")
          .upsert(enrollments, { onConflict: "user_id,course_id" });
        if (enrollmentError) throw enrollmentError;
      }
    }

    // Clear heartbeat and session on all existing configs
    await sb.from("demo_account_config")
      .update({ active_session_token: null, heartbeat_token: null, is_online: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    await sb.from("demo_account_config").insert({
      expires_at,
      is_online: false,
      configured_by: adminId,
      configured_at: now,
      demo_roles: selectedRoles,
      demo_course_ids: selectedCourseIds,
    });

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
