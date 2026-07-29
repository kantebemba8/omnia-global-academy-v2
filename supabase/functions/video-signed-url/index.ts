import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { makeCorsHeaders, getClientIP, logSecurityEvent } from "../_shared/security.ts";

async function signCfUrl(uid: string, keyId: string, pemBase64: string): Promise<string> {
  const pem = atob(pemBase64);
  const key = await crypto.subtle.importKey("pkcs8", new TextEncoder().encode(pem).buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: uid, kid: keyId, exp: now + 60, accessRules: [{ type: "any", action: "allow" }] };
  const header = { alg: "RS256", kid: keyId };
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const sigInput = `${enc(header)}.${enc(payload)}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `https://videodelivery.net/${uid}/manifest/video.m3u8?token=${sigInput}.${sigB64}`;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders();
  const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { action?: string; lesson_id?: string; course_id?: string; device_id?: string; seconds?: number };
  try { body = await req.json(); } catch { return json({ error: "INVALID_BODY" }, 400); }
  const action = body.action ?? "stream";
  const { lesson_id, course_id } = body;
  if (!lesson_id || !course_id) return json({ error: "LESSON_AND_COURSE_REQUIRED" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id as string;
    const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", course_id).maybeSingle();
    if (!enroll) return json({ error: "NOT_ENROLLED", message: "Cette formation n’est pas accessible avec ce compte." }, 403);
    const { data: lesson } = await sb.from("course_lessons").select("id,cloudflare_stream_uid,video_url,duration_seconds,module_id").eq("id", lesson_id).maybeSingle();
    if (!lesson) return json({ error: "LESSON_NOT_FOUND" }, 404);
    const { data: lessonModule } = await sb.from("course_modules").select("course_id").eq("id", lesson.module_id).maybeSingle();
    if (!lessonModule || lessonModule.course_id !== course_id) {
      return json({ error: "LESSON_COURSE_MISMATCH", message: "Cette leçon n’appartient pas à la formation demandée." }, 403);
    }

    if (action === "offline_authorize") {
      if (!body.device_id) return json({ error: "DEVICE_REQUIRED" }, 400);
      const { data: course } = await sb.from("courses").select("is_published").eq("id", course_id).maybeSingle();
      if (!course?.is_published) return json({ error: "COURSE_NOT_PUBLISHED" }, 403);
      const { data: setting } = await sb.from("course_resilient_access_settings").select("enabled,max_offline_days,max_devices,allow_text_cache,allow_transcript_cache,allow_audio_stream,allow_low_resolution,allow_video_cache").eq("course_id", course_id).maybeSingle();
      if (!setting?.enabled) return json({ error: "RESILIENT_ACCESS_DISABLED", message: "L’accès hors connexion n’est pas activé pour cette formation." }, 403);
      const now = new Date();
      const { data: activeDevices } = await sb.from("user_resilient_access_devices").select("device_id").eq("user_id", userId).eq("course_id", course_id).eq("status", "active").gt("expires_at", now.toISOString());
      const unique = new Set((activeDevices ?? []).map((row: any) => row.device_id));
      if (!unique.has(body.device_id) && unique.size >= Number(setting.max_devices || 2)) return json({ error: "DEVICE_LIMIT_REACHED", message: "Le nombre maximal d’appareils autorisés est atteint." }, 409);
      const expires = new Date(now.getTime() + Math.max(1, Math.min(30, Number(setting.max_offline_days || 7))) * 86400000);
      await sb.from("user_resilient_access_devices").upsert({ user_id: userId, course_id, device_id: body.device_id, status: "active", authorized_at: now.toISOString(), last_validated_at: now.toISOString(), expires_at: expires.toISOString() }, { onConflict: "user_id,course_id,device_id" });
      await sb.from("resilient_access_sync_logs").insert({ user_id: userId, course_id, lesson_id, device_id: body.device_id, event_type: "authorized", seconds_reported: 0, accepted: true });
      return json({
        success: true, expires_at: expires.toISOString(),
        policy: { text: setting.allow_text_cache, transcription: setting.allow_transcript_cache, audio_stream: setting.allow_audio_stream, low_resolution: setting.allow_low_resolution, video_cache: false },
        message: "Accès résilient autorisé. Les vidéos restent protégées et ne sont pas téléchargées.",
      });
    }

    if (action === "offline_sync") {
      if (!body.device_id) return json({ error: "DEVICE_REQUIRED" }, 400);
      const { data: device } = await sb.from("user_resilient_access_devices").select("id,status,expires_at").eq("user_id", userId).eq("course_id", course_id).eq("device_id", body.device_id).maybeSingle();
      const valid = device?.status === "active" && new Date(device.expires_at).getTime() > Date.now();
      const requested = Math.max(0, Math.floor(Number(body.seconds || 0)));
      const acceptedSeconds = valid ? Math.min(requested, 3600, Math.max(0, Number(lesson.duration_seconds || 0))) : 0;
      if (valid && acceptedSeconds > 0) {
        const { data: progress } = await sb.from("user_lesson_progress").select("time_spent_seconds,quiz_passed,is_completed").eq("user_id", userId).eq("lesson_id", lesson_id).maybeSingle();
        const next = Math.min(Number(lesson.duration_seconds || acceptedSeconds), Number(progress?.time_spent_seconds || 0) + acceptedSeconds);
        await sb.from("user_lesson_progress").upsert({ user_id: userId, course_id, lesson_id, time_spent_seconds: next, quiz_passed: Boolean(progress?.quiz_passed), is_completed: Boolean(progress?.is_completed), updated_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
        await sb.from("user_resilient_access_devices").update({ last_validated_at: new Date().toISOString() }).eq("id", device.id);
      }
      await sb.from("resilient_access_sync_logs").insert({ user_id: userId, course_id, lesson_id, device_id: body.device_id, event_type: "progress_sync", seconds_reported: requested, seconds_accepted: acceptedSeconds, accepted: valid, rejection_reason: valid ? null : "Droits expirés ou révoqués" });
      if (!valid) return json({ error: "OFFLINE_RIGHTS_EXPIRED", message: "Les droits hors connexion doivent être renouvelés." }, 403);
      return json({ success: true, seconds_accepted: acceptedSeconds });
    }

    const clientIP = getClientIP(req);
    await logSecurityEvent(sb, { event_type: "video_access", user_id: userId, ip_address: clientIP, endpoint: "video-signed-url", severity: "info", details: { lesson_id, course_id, stream_uid: lesson.cloudflare_stream_uid } });
    const { data: recentAccess } = await sb.from("security_audit_log").select("ip_address").eq("user_id", userId).eq("event_type", "video_access").gte("created_at", new Date(Date.now() - 60_000).toISOString());
    const uniqueIPs = new Set((recentAccess ?? []).map((r: any) => r.ip_address).filter(Boolean));
    if (uniqueIPs.size >= 3) await logSecurityEvent(sb, { event_type: "drm_violation_suspected", user_id: userId, ip_address: clientIP, endpoint: "video-signed-url", severity: "critical", details: { lesson_id, unique_ips: Array.from(uniqueIPs) } });
    const keyId = Deno.env.get("CF_STREAM_KEY_ID");
    const pem = Deno.env.get("CF_STREAM_PEM");
    if (keyId && pem && lesson.cloudflare_stream_uid) {
      try { return json({ url: await signCfUrl(lesson.cloudflare_stream_uid, keyId, pem), expires_in: 55 }); } catch { /* fallback */ }
    }
    return json({ url: lesson.video_url ?? null, expires_in: null });
  } catch (err) {
    console.error("video-signed-url", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});
