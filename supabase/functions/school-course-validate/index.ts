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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const directorId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", directorId).eq("role", "etablissement_directeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json();
    const { course_id, action, comment } = body as { course_id: string; action: "approve" | "reject"; comment?: string };
    if (!course_id || !["approve", "reject"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);
    if (action === "reject" && !comment) return json({ error: "COMMENT_REQUIRED", message: "Un commentaire est requis pour un rejet." }, 400);

    // Verify course belongs to this establishment
    const { data: etab } = await sb.from("etablissement_profiles").select("id").eq("user_id", directorId).maybeSingle();
    if (!etab) return json({ error: "ESTABLISHMENT_NOT_FOUND" }, 404);
    const estabId = (etab as unknown as { id: string }).id;

    const { data: course } = await sb.from("courses").select("id,pending_school_validation,instructor_id,title").eq("id", course_id).eq("establishment_id", estabId).maybeSingle();
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
    const c = course as unknown as { id: string; pending_school_validation: boolean; instructor_id: string; title: string };
    if (!c.pending_school_validation) return json({ error: "NOT_PENDING_VALIDATION" }, 400);

    if (action === "approve") {
      await sb.from("courses").update({ pending_school_validation: false, status: "en_attente_validation_manuelle" }).eq("id", course_id);
    } else {
      await sb.from("courses").update({ pending_school_validation: false, status: "modification_demandee", admin_comment: comment }).eq("id", course_id);

      // Notify teacher via Brevo
      const { data: teacherUser } = await sb.from("users").select("email,full_name").eq("id", c.instructor_id).maybeSingle();
      const brevoKey = Deno.env.get("BREVO_API_KEY");
      if (brevoKey && teacherUser) {
        const tu = teacherUser as unknown as { email: string; full_name: string };
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: 3,
            to: [{ email: tu.email, name: tu.full_name }],
            params: { COURSE_TITLE: c.title, STATUS: "modification_demandee", COMMENT: comment },
            sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
          }),
        });
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
