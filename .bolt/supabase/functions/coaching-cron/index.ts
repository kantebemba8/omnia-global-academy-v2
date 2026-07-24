import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-cron-secret",
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type Supabase = ReturnType<typeof createClient>;

async function authorized(req: Request) {
  const expected = Deno.env.get("COACHING_CRON_SECRET") || Deno.env.get("CRON_SECRET") || "";
  const supplied = req.headers.get("x-cron-secret") || "";
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return Boolean((expected && supplied === expected) || (service && bearer === service));
}

async function dispatch(type: string, payload: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const response = await fetch(`${url}/functions/v1/notify-dispatch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
  if (!response.ok) throw new Error(`NOTIFY_${response.status}:${await response.text()}`);
}

async function processJobs(sb: Supabase) {
  const now = new Date().toISOString();
  const { data: jobs, error } = await sb
    .from("coaching_notification_jobs")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("scheduled_for", now)
    .lt("attempts", 5)
    .order("scheduled_for")
    .limit(100);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const job of jobs || []) {
    const claimed = await sb.from("coaching_notification_jobs")
      .update({ status: "processing", attempts: Number(job.attempts || 0) + 1, last_error: null })
      .eq("id", job.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed.data) continue;

    try {
      const { data: coachingSession } = await sb.from("coaching_sessions").select("*").eq("id", job.session_id).maybeSingle();
      if (!coachingSession || !["confirmed", "ready", "in_progress"].includes(String(coachingSession.status))) {
        await sb.from("coaching_notification_jobs").update({ status: "cancelled" }).eq("id", job.id);
        continue;
      }
      const type = job.event_type === "session_started" ? "coaching_session_started" : "coaching_reminder";
      await dispatch(type, {
        userId: job.user_id,
        audience: job.audience,
        reminder_type: job.event_type,
        session_id: coachingSession.id,
        coach_name: coachingSession.coach_name_snapshot,
        offer_title: coachingSession.offer_title_snapshot,
        scheduled_start: coachingSession.scheduled_start,
        duration_minutes: coachingSession.duration_minutes,
        action_url: job.audience === "coach" ? "/coach/sessions" : "/dashboard/coaching",
      });
      await sb.from("coaching_notification_jobs").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
      sent += 1;
    } catch (error) {
      await sb.from("coaching_notification_jobs").update({ status: "failed", last_error: String(error instanceof Error ? error.message : error).slice(0, 1500) }).eq("id", job.id);
      failed += 1;
    }
  }
  return { found: (jobs || []).length, sent, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!await authorized(req)) return json({ error: "FORBIDDEN" }, 403);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: expired, error: expireError } = await sb.rpc("coaching_expire_payment_holds");
    if (expireError) throw expireError;

    const { error: readyError } = await sb.from("coaching_sessions")
      .update({ status: "ready" })
      .eq("status", "confirmed")
      .lte("scheduled_start", new Date(Date.now() + 30 * 60000).toISOString())
      .gte("scheduled_end", new Date().toISOString());
    if (readyError) throw readyError;

    const jobs = await processJobs(sb);
    return json({ success: true, expired_payment_holds: Number(expired || 0), notifications: jobs });
  } catch (error) {
    console.error("[coaching-cron]", error);
    return json({ error: "INTERNAL", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
