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

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function json(d: unknown, s = 200) {
    return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const clientIP = getClientIP(req);

  let body: { lesson_id?: string; course_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { lesson_id, course_id } = body;
  if (!lesson_id || !course_id) return json({ error: "lesson_id + course_id requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = (sess as { user_id: string }).user_id;

    const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", course_id).maybeSingle();
    if (!enroll) return json({ error: "NOT_ENROLLED" }, 403);

    const { data: lesson } = await sb.from("course_lessons").select("cloudflare_stream_uid,video_url").eq("id", lesson_id).maybeSingle();
    if (!lesson) return json({ error: "LESSON_NOT_FOUND" }, 404);

    // Log video access for DRM audit
    await logSecurityEvent(sb, {
      event_type: "video_access",
      user_id: userId,
      ip_address: clientIP,
      endpoint: "video-signed-url",
      severity: "info",
      details: { lesson_id, course_id, stream_uid: lesson.cloudflare_stream_uid },
    });

    // Anti-sharing: check for 3+ unique IPs accessing video in last 60s
    const { data: recentAccess } = await sb
      .from("security_audit_log")
      .select("ip_address")
      .eq("user_id", userId)
      .eq("event_type", "video_access")
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());

    if (recentAccess && recentAccess.length > 0) {
      const uniqueIPs = new Set((recentAccess as Array<{ ip_address: string }>).map((r) => r.ip_address).filter(Boolean));
      if (uniqueIPs.size >= 3) {
        await logSecurityEvent(sb, {
          event_type: "drm_violation_suspected",
          user_id: userId,
          ip_address: clientIP,
          endpoint: "video-signed-url",
          severity: "critical",
          details: { lesson_id, unique_ips: Array.from(uniqueIPs) },
        });
      }
    }

    const keyId = Deno.env.get("CF_STREAM_KEY_ID");
    const pem = Deno.env.get("CF_STREAM_PEM");
    if (keyId && pem && lesson.cloudflare_stream_uid) {
      try { return json({ url: await signCfUrl(lesson.cloudflare_stream_uid, keyId, pem), expires_in: 55 }); }
      catch { /* fall through */ }
    }
    return json({ url: lesson.video_url ?? null, expires_in: null });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
