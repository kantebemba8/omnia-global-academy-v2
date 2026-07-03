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

    const { data: permsRow } = await sb.from("moderator_permissions").select("can_see_pending_courses,can_validate_course_price,can_reject_course,can_request_course_modification,can_approve_transmit_course").eq("moderator_user_id", modId).maybeSingle();
    const perms = permsRow as unknown as Record<string, boolean> | null ?? {};

    // GET — list courses
    if (req.method === "GET") {
      if (!perms.can_see_pending_courses) return json({ error: "FORBIDDEN", message: "Permission can_see_pending_courses requise." }, 403);

      const { data: courses } = await sb.from("courses").select("id,title,category,level,status,score_calcule,prix_provisoire_xof,price_xof,requested_cpd,final_validation_type,instructor_id,created_at,admin_comment,rejection_reason")
        .in("status", ["en_attente_validation_manuelle", "validee", "rejetee", "modification_demandee"])
        .order("created_at", { ascending: true });

      const enriched = await Promise.all((courses ?? []).map(async (c) => {
        const cc = c as unknown as Record<string, unknown>;
        const { data: instr } = await sb.from("users").select("full_name").eq("id", cc.instructor_id as string).maybeSingle();
        const { data: mods } = await sb.from("modules").select("id,title,position").eq("course_id", cc.id as string).order("position");
        const moduleIds = (mods ?? []).map((m) => (m as unknown as { id: string }).id);
        let lessonCount = 0;
        let modulesWithLessons: unknown[] = [];
        if (moduleIds.length > 0) {
          const { data: lessons } = await sb.from("lessons").select("id,title,position,module_id").in("module_id", moduleIds).order("position");
          lessonCount = lessons?.length ?? 0;
          modulesWithLessons = (mods ?? []).map((m) => {
            const mm = m as unknown as { id: string; title: string; position: number };
            return { ...mm, lessons: (lessons ?? []).filter((l) => (l as unknown as { module_id: string }).module_id === mm.id).map((l) => ({ title: (l as unknown as { title: string }).title })) };
          });
        }
        return { ...cc, instructor_name: (instr as unknown as { full_name: string } | null)?.full_name ?? "—", module_count: mods?.length ?? 0, lesson_count: lessonCount, modules: modulesWithLessons };
      }));

      return json({ courses: enriched });
    }

    // POST — action
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.json();
    const { course_id, action, price_xof, comment } = body as { course_id: string; action: string; price_xof?: number; comment?: string };

    if (!course_id || !action) return json({ error: "MISSING_FIELDS" }, 400);

    // Permission checks per action
    const permMap: Record<string, string> = {
      validate: "can_validate_course_price",
      reject: "can_reject_course",
      request_modification: "can_request_course_modification",
      transmit_to_admin: "can_approve_transmit_course",
    };
    if (!permMap[action]) return json({ error: "INVALID_ACTION" }, 400);
    if (!perms[permMap[action]]) return json({ error: "FORBIDDEN", message: `Permission ${permMap[action]} requise.` }, 403);

    // Anti-conflict of interest
    const { data: courseRow } = await sb.from("courses").select("id,instructor_id,title").eq("id", course_id).maybeSingle();
    if (!courseRow) return json({ error: "COURSE_NOT_FOUND" }, 404);
    const cr = courseRow as unknown as { id: string; instructor_id: string; title: string };
    if (cr.instructor_id === modId) {
      return json({ error: "CONFLICT_OF_INTEREST", message: "Vous ne pouvez pas modérer votre propre formation. Dossier réassigné au Super-admin." }, 403);
    }

    let update: Record<string, unknown> = { moderated_by: modId, moderated_at: new Date().toISOString() };
    let logAction = "";
    let brevoTemplateParams: Record<string, string> = { COURSE_TITLE: cr.title };

    if (action === "validate") {
      update = { ...update, status: "validee", price_xof: price_xof ?? undefined };
      logAction = "course_approved";
      brevoTemplateParams.STATUS = "validee";
      if (price_xof) brevoTemplateParams.PRIX = `${price_xof.toLocaleString()} XOF`;
    } else if (action === "reject") {
      if (!comment) return json({ error: "COMMENT_REQUIRED" }, 400);
      update = { ...update, status: "rejetee", rejection_reason: comment };
      logAction = "course_rejected";
      brevoTemplateParams.STATUS = "rejetee";
      brevoTemplateParams.REASON = comment;
    } else if (action === "request_modification") {
      if (!comment) return json({ error: "COMMENT_REQUIRED" }, 400);
      update = { ...update, status: "modification_demandee", admin_comment: comment };
      logAction = "course_modification_requested";
      brevoTemplateParams.STATUS = "modification_demandee";
      brevoTemplateParams.COMMENT = comment;
    } else if (action === "transmit_to_admin") {
      logAction = "course_transmitted_to_admin";
      // Do NOT change status — stays 'validee', super-admin publishes
    }

    if (Object.keys(update).length > 2) {
      await sb.from("courses").update(update).eq("id", course_id);
    }

    // Log decision
    await sb.from("moderation_log").insert({ moderator_id: modId, action_type: logAction, target_type: "course", target_id: course_id, comment: comment ?? null });

    // Notify instructor via Brevo
    const { data: instructor } = await sb.from("users").select("email,full_name").eq("id", cr.instructor_id).maybeSingle();
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && instructor && action !== "transmit_to_admin") {
      const iu = instructor as unknown as { email: string; full_name: string };
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: 3,
          to: [{ email: iu.email, name: iu.full_name }],
          params: brevoTemplateParams,
          sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
        }),
      });
    }

    const message = action === "transmit_to_admin"
      ? "Formation transmise au Super-admin pour approbation finale et publication."
      : "Action effectuée avec succès.";
    return json({ success: true, message });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
