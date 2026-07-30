import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = (req.headers.get("x-cron-secret") || "").trim();
  const authorized = Boolean(serviceRoleKey && bearerToken === serviceRoleKey) ||
    Boolean(cronSecret && (bearerToken === cronSecret || headerSecret === cronSecret));
  if (!authorized) return json({ error: "UNAUTHORIZED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Find inactive learners (no access in 7+ days, relance not yet sent, course not completed)
    const { data: inactive } = await sb.rpc("get_inactive_learners").catch(() => ({ data: null }));

    // Fallback raw query if RPC not available
    let rows: Array<{
      user_id: string;
      course_id: string;
      title: string;
      completion_percent: number;
      last_lesson_id: string | null;
    }> = [];

    if (!inactive) {
      // Use a direct join query via multiple requests
      const { data: staleAccess } = await sb
        .from("course_last_access")
        .select("user_id, course_id, last_accessed_at")
        .eq("anti_abandon_sent", false)
        .lt("last_accessed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      for (const row of staleAccess ?? []) {
        // Check enrollment still active
        const { data: enrollment } = await sb
          .from("user_enrollments")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("course_id", row.course_id)
          .maybeSingle();
        if (!enrollment) continue;

        // Get course title
        const { data: course } = await sb
          .from("courses")
          .select("title")
          .eq("id", row.course_id)
          .maybeSingle();
        if (!course) continue;

        // Calculate completion
        const [{ count: total }, { count: done }] = await Promise.all([
          sb.from("user_lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", row.user_id).eq("course_id", row.course_id),
          sb.from("user_lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", row.user_id).eq("course_id", row.course_id).eq("is_completed", true),
        ]);

        const pct = total ? Math.round(((done ?? 0) / total) * 100) : 0;
        if (pct >= 100) continue;

        // Last accessed lesson
        const { data: lastLesson } = await sb
          .from("user_lesson_progress")
          .select("lesson_id")
          .eq("user_id", row.user_id)
          .eq("course_id", row.course_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        rows.push({
          user_id: row.user_id,
          course_id: row.course_id,
          title: course.title,
          completion_percent: pct,
          last_lesson_id: lastLesson?.lesson_id ?? null,
        });
      }
    } else {
      rows = inactive;
    }

    let processed = 0;

    for (const row of rows) {
      try {
        const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/notify-dispatch`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "anti_abandon",
            payload: {
              userId: row.user_id,
              course_id: row.course_id,
              formation_titre: row.title,
              completion_percent: row.completion_percent,
              last_lesson_id: row.last_lesson_id,
            },
          }),
        });
        if (!notificationResponse.ok) {
          throw new Error(`NOTIFY_DISPATCH_FAILED:${notificationResponse.status}`);
        }

        const { error: markError } = await sb.from("course_last_access")
          .update({ anti_abandon_sent: true, anti_abandon_sent_at: new Date().toISOString() })
          .eq("user_id", row.user_id)
          .eq("course_id", row.course_id);
        if (markError) throw markError;

        processed++;
      } catch (error) {
        console.error("Anti-abandon notification failed", row.user_id, row.course_id, error);
      }
    }

    return json({ success: true, processed, total_inactive: rows.length });
  } catch (err) {
    return json({ error: "INTERNAL", message: (err as Error).message }, 500);
  }
});
