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
      const isRatingInvitation = job.event_type === "rating_invitation";
      const allowedStatuses = isRatingInvitation ? ["completed"] : ["confirmed", "ready", "in_progress"];
      if (!coachingSession || !allowedStatuses.includes(String(coachingSession.status))) {
        await sb.from("coaching_notification_jobs").update({ status: "cancelled" }).eq("id", job.id);
        continue;
      }
      if (isRatingInvitation) {
        const { data: existingRating } = await sb.from("coaching_ratings").select("id").eq("session_id", coachingSession.id).maybeSingle();
        if (existingRating) {
          await sb.from("coaching_notification_jobs").update({ status: "cancelled" }).eq("id", job.id);
          continue;
        }
      }
      const type = isRatingInvitation ? "coaching_rating_invitation" : job.event_type === "session_started" ? "coaching_session_started" : "coaching_reminder";
      await dispatch(type, {
        userId: job.user_id,
        audience: job.audience,
        reminder_type: job.event_type,
        session_id: coachingSession.id,
        coach_name: coachingSession.coach_name_snapshot,
        offer_title: coachingSession.offer_title_snapshot,
        scheduled_start: coachingSession.scheduled_start,
        duration_minutes: coachingSession.duration_minutes,
        action_url: isRatingInvitation ? `/dashboard/coaching/sessions/${coachingSession.id}/suivi` : `/coaching/sessions/${coachingSession.id}/room`,
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

async function sessionSettings(sb: Supabase) {
  const { data, error } = await sb.from("coaching_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return {
    room_access_before_minutes: Number(data?.room_access_before_minutes ?? 30),
    no_show_grace_minutes: Number(data?.no_show_grace_minutes ?? 15),
    auto_complete_after_minutes: Number(data?.auto_complete_after_minutes ?? 30),
  };
}

async function autoRefundNoShowCoach(sb: Supabase, coachingSession: Record<string, unknown>) {
  const { data: order } = await sb.from("coaching_payment_orders").select("*").eq("session_id", coachingSession.id).eq("payment_status", "paid").maybeSingle();
  if (!order) return null;
  const { data: existing } = await sb.from("coaching_refund_requests").select("id,status").eq("session_id", coachingSession.id).in("status", ["pending", "under_review", "approved", "partially_approved"]).maybeSingle();
  if (existing) return existing;
  const result = await sb.from("coaching_refund_requests").insert({
    order_id: order.id,
    session_id: coachingSession.id,
    user_id: coachingSession.learner_user_id,
    coach_id: coachingSession.coach_id,
    initiated_by: "system",
    requested_amount_xof: Number(order.amount_xof || 0),
    reason_code: "no_show_coach",
    reason_details: "Aucune présence du coach n’a été enregistrée pendant la session.",
    status: "pending",
    policy_snapshot: order.policy_snapshot || coachingSession.policy_snapshot || {},
  }).select("id,status").single();
  if (result.error) throw result.error;
  return result.data;
}

async function reconcileFinishedSessions(sb: Supabase, settings: Awaited<ReturnType<typeof sessionSettings>>) {
  const closeDelayMinutes = Math.max(settings.no_show_grace_minutes, settings.auto_complete_after_minutes);
  const dueBefore = new Date(Date.now() - closeDelayMinutes * 60000).toISOString();
  const { data: sessions, error } = await sb.from("coaching_sessions")
    .select("*")
    .in("status", ["confirmed", "ready", "in_progress"])
    .eq("payment_status", "paid")
    .lte("scheduled_end", dueBefore)
    .order("scheduled_end")
    .limit(100);
  if (error) throw error;
  let completed = 0;
  let noShowCoach = 0;
  let noShowLearner = 0;
  for (const coachingSession of sessions || []) {
    const now = new Date().toISOString();
    await sb.rpc("coaching_close_open_attendance", { p_session_id: coachingSession.id, p_user_id: null, p_left_at: now });
    const { data: attendance, error: attendanceError } = await sb.rpc("coaching_attendance_summary", { p_session_id: coachingSession.id });
    if (attendanceError) throw attendanceError;
    const coachSeconds = Number((attendance || []).find((row: Record<string, unknown>) => row.participant_role === "coach")?.duration_seconds || 0);
    const learnerSeconds = Number((attendance || []).find((row: Record<string, unknown>) => row.participant_role === "learner")?.duration_seconds || 0);
    const status = coachSeconds <= 0 ? "no_show_coach" : learnerSeconds <= 0 ? "no_show_learner" : "completed";
    const update = await sb.from("coaching_sessions").update({ status, actual_ended_at: now, completion_source: "system", no_show_marked_at: status.startsWith("no_show") ? now : null }).eq("id", coachingSession.id).in("status", ["confirmed", "ready", "in_progress"]).select("id").maybeSingle();
    if (update.error) throw update.error;
    if (!update.data) continue;
    const { data: room } = await sb.from("coaching_rooms").select("id").eq("session_id", coachingSession.id).maybeSingle();
    if (room) {
      await sb.from("coaching_rooms").update({ status: "ended", ends_at: now }).eq("id", room.id);
      await sb.from("coaching_room_members").update({ access_status: "left", left_at: now, last_seen_at: now }).eq("room_id", room.id).eq("access_status", "admitted");
    }
    if (status === "no_show_coach") await autoRefundNoShowCoach(sb, coachingSession);
    const { data: coach } = await sb.from("coach_profiles").select("user_id").eq("id", coachingSession.coach_id).maybeSingle();
    await dispatch("coaching_session_closed", { userId: coachingSession.learner_user_id, status, offer_title: coachingSession.offer_title_snapshot, coach_name: coachingSession.coach_name_snapshot, session_id: coachingSession.id, action_url: "/dashboard/coaching" });
    if (coach?.user_id) await dispatch("coaching_session_closed", { userId: coach.user_id, status, offer_title: coachingSession.offer_title_snapshot, coach_name: coachingSession.coach_name_snapshot, session_id: coachingSession.id, action_url: "/coach/sessions" });
    await sb.from("coaching_session_actions").insert({ session_id: coachingSession.id, room_id: room?.id || null, actor_user_id: null, action: "session_closed", metadata: { status, source: "system", coach_duration_seconds: coachSeconds, learner_duration_seconds: learnerSeconds } });
    if (status === "completed") completed += 1;
    if (status === "no_show_coach") noShowCoach += 1;
    if (status === "no_show_learner") noShowLearner += 1;
  }
  return { found: (sessions || []).length, completed, no_show_coach: noShowCoach, no_show_learner: noShowLearner };
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!await authorized(req)) return json({ error: "FORBIDDEN" }, 403);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: expired, error: expireError } = await sb.rpc("coaching_expire_payment_holds");
    if (expireError) throw expireError;

    const settings = await sessionSettings(sb);
    const { error: readyError } = await sb.from("coaching_sessions")
      .update({ status: "ready" })
      .eq("status", "confirmed")
      .lte("scheduled_start", new Date(Date.now() + settings.room_access_before_minutes * 60000).toISOString())
      .gte("scheduled_end", new Date().toISOString());
    if (readyError) throw readyError;

    const reconciled = await reconcileFinishedSessions(sb, settings);
    const { data: released, error: releaseError } = await sb.rpc("coaching_release_eligible_earnings");
    if (releaseError) throw releaseError;
    for (const earning of released || []) {
      await dispatch("coaching_revenue_available", {
        userId: earning.coach_user_id,
        session_id: earning.session_id,
        amount_xof: Number(earning.amount_xof || 0),
        action_url: "/coach/revenus",
      });
    }
    const jobs = await processJobs(sb);
    return json({ success: true, expired_payment_holds: Number(expired || 0), reconciled_sessions: reconciled, released_earnings: (released || []).length, notifications: jobs });
  } catch (error) {
    console.error("[coaching-cron]", error);
    return json({ error: "INTERNAL", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
