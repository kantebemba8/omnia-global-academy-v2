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

    if (req.method === "GET") {
      const { data: splits } = await sb.from("school_revenue_splits").select("*").order("created_at", { ascending: false });
      const enriched = await Promise.all((splits ?? []).map(async (s) => {
        const ss = s as { course_id: string; school_percent: number; platform_percent: number; school_amount_xof: number; platform_amount_xof: number; accepted_by_director: boolean; created_at: string };
        const { data: course } = await sb.from("courses").select("title,instructor_id,establishment_id").eq("id", ss.course_id).maybeSingle();
        return { ...ss, course };
      }));
      return json({ splits: enriched });
    }

    const body = await req.json() as {
      course_id: string;
      action: "propose" | "director_accept" | "director_reject";
      split_data?: { school_percent: number; platform_percent: number; school_amount_xof: number; platform_amount_xof: number };
    };
    const { course_id, action, split_data } = body;
    if (!course_id || !["propose", "director_accept", "director_reject"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const now = new Date().toISOString();

    if (action === "propose") {
      if (!split_data) return json({ error: "INVALID_PARAMS" }, 400);
      if (split_data.school_percent + split_data.platform_percent !== 100) return json({ error: "PERCENTAGES_MUST_SUM_100" }, 400);
      await sb.from("school_revenue_splits").upsert({ course_id, ...split_data, accepted_by_director: false, created_by: adminId }, { onConflict: "course_id" });

      // Notify Directeur via Brevo
      const { data: course } = await sb.from("courses").select("establishment_id,title").eq("id", course_id).maybeSingle();
      const cc = course as { establishment_id?: string; title?: string } | null;
      if (cc?.establishment_id) {
        const { data: etab } = await sb.from("etablissement_profiles").select("user_id").eq("id", cc.establishment_id).maybeSingle();
        if (etab) {
          const { data: u } = await sb.from("users").select("email,full_name").eq("id", (etab as { user_id: string }).user_id).maybeSingle();
          const brevoKey = Deno.env.get("BREVO_API_KEY");
          if (brevoKey && u) {
            const uu = u as { email: string; full_name: string };
            await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { "api-key": brevoKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                templateId: 5,
                to: [{ email: uu.email, name: uu.full_name }],
                params: { COURSE_TITLE: cc.title, SCHOOL_PERCENT: split_data.school_percent, PLATFORM_PERCENT: split_data.platform_percent, SCHOOL_AMOUNT: split_data.school_amount_xof },
                sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
              }),
            });
          }
        }
      }
    } else if (action === "director_accept") {
      await sb.from("school_revenue_splits").update({ accepted_by_director: true, accepted_at: now }).eq("course_id", course_id);
    } else if (action === "director_reject") {
      await sb.from("school_revenue_splits").update({ accepted_by_director: false }).eq("course_id", course_id);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
