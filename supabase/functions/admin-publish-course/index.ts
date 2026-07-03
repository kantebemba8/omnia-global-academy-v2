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
      course_id: string;
      action: "publish" | "reject" | "request_modification";
      final_price_xof?: number;
      commission_override?: { professor_percent: number; platform_percent: number };
      school_split?: { school_percent: number; platform_percent: number; school_amount_xof: number; platform_amount_xof: number };
      comment?: string;
    };

    const { course_id, action, final_price_xof, school_split, comment } = body;
    if (!course_id || !["publish", "reject", "request_modification"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const { data: course } = await sb.from("courses").select("id,title,instructor_id,establishment_id,status").eq("id", course_id).maybeSingle();
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
    const cr = course as { id: string; title: string; instructor_id: string; establishment_id: string | null; status: string };
    const now = new Date().toISOString();

    if (action === "publish") {
      if (cr.establishment_id) {
        // Check school_revenue_splits accepted
        const { data: split } = await sb.from("school_revenue_splits").select("accepted_by_director").eq("course_id", course_id).maybeSingle();
        const s = split as { accepted_by_director?: boolean } | null;
        if (!split) return json({ error: "SPLIT_REQUIRED", message: "Proposez d'abord une répartition financière au Directeur." }, 400);
        if (!s?.accepted_by_director) return json({ error: "SPLIT_NOT_ACCEPTED", message: "Le Directeur n'a pas encore accepté la répartition." }, 400);
      }

      await sb.from("courses").update({
        status: "publiee", is_published: true, moderated_by: adminId, moderated_at: now,
        ...(final_price_xof != null ? { price_xof: final_price_xof } : {}),
      }).eq("id", course_id);

      // Trigger RAG indexation asynchronously (fire-and-forget)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/rag-index-course`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ course_id }),
      }).catch(() => {});

      // Notify instructor via Brevo
      const { data: u } = await sb.from("users").select("email,full_name").eq("id", cr.instructor_id).maybeSingle();
      const brevoKey = Deno.env.get("BREVO_API_KEY");
      if (brevoKey && u) {
        const uu = u as { email: string; full_name: string };
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: 3,
            to: [{ email: uu.email, name: uu.full_name }],
            params: { STATUS: "Publiée", PRIX: String(final_price_xof ?? "") },
            sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
          }),
        });
      }
    } else if (action === "reject") {
      await sb.from("courses").update({ status: "rejetee", moderated_by: adminId, moderated_at: now, admin_comment: comment ?? null }).eq("id", course_id);
    } else if (action === "request_modification") {
      await sb.from("courses").update({ status: "modification_demandee", admin_comment: comment ?? null }).eq("id", course_id);
    }

    if (school_split && action === "publish") {
      await sb.from("school_revenue_splits").upsert({ course_id, ...school_split, created_by: adminId }, { onConflict: "course_id" });
    }

    await sb.from("moderation_log").insert({ moderator_id: adminId, action_type: `course_${action}`, target_type: "course", target_id: course_id, comment: comment ?? null });
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
