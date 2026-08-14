import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

import { getActiveOmniaSessionResult, isOmniaInternalRequest } from "../_shared/omnia-auth.ts";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type Supabase = ReturnType<typeof createClient>;
type Session = { userId: string; roles: string[] };

function text(value: unknown, max = 4096): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeActionUrl(value: unknown): string | null {
  const url = text(value, 1200);
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!["omniaglobalacademy.com", "www.omniaglobalacademy.com"].includes(parsed.hostname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

async function authenticate(sb: Supabase, req: Request): Promise<Session | null> {
  const explicit = text(req.headers.get("x-omnia-session-token"), 500);
  const bearer = text(req.headers.get("authorization"), 600).replace(/^Bearer\s+/i, "");
  const token = explicit || bearer;
  if (!token) return null;
  const { data: session, error } = await getActiveOmniaSessionResult(sb, token);
  if (error || !session?.user_id) return null;
  const userId = String(session.user_id);
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (roles || []).map((row: { role: string }) => String(row.role)) };
}

function providerConfiguration() {
  return {
    android: Boolean(Deno.env.get("FIREBASE_PROJECT_ID") && Deno.env.get("FIREBASE_CLIENT_EMAIL") && Deno.env.get("FIREBASE_PRIVATE_KEY")),
    ios: Boolean(Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_PRIVATE_KEY") && Deno.env.get("APNS_BUNDLE_ID")),
  };
}

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemBytes(value: string): Uint8Array {
  const base64 = value.replace(/\\n/g, "\n").replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function googleAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "";
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(`FCM_OAUTH_${response.status}`);
  return String(result.access_token);
}

async function apnsJwt(): Promise<string> {
  const teamId = Deno.env.get("APNS_TEAM_ID") || "";
  const keyId = Deno.env.get("APNS_KEY_ID") || "";
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY") || "";
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function sendFcm(token: string, title: string, message: string, actionUrl: string | null, data: Record<string, unknown>) {
  const project = Deno.env.get("FIREBASE_PROJECT_ID") || "";
  const accessToken = await googleAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token,
      notification: { title, body: message },
      data: Object.fromEntries(Object.entries({ ...data, action_url: actionUrl || "" }).map(([key, value]) => [key, String(value ?? "")])),
      android: { priority: "high", notification: { channel_id: "omnia-general" } },
    } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`FCM_${response.status}_${text(result?.error?.status || result?.error?.message, 120)}`);
  return text(result.name, 500) || null;
}

async function sendApns(token: string, title: string, message: string, actionUrl: string | null, data: Record<string, unknown>) {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") || "";
  const environment = (Deno.env.get("APNS_ENVIRONMENT") || "sandbox").toLowerCase() === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const response = await fetch(`https://${environment}/3/device/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${await apnsJwt()}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({ aps: { alert: { title, body: message }, sound: "default" }, ...data, action_url: actionUrl }),
  });
  if (!response.ok) throw new Error(`APNS_${response.status}_${text(await response.text().catch(() => ""), 160)}`);
  return response.headers.get("apns-id");
}

async function dispatchToUser(sb: Supabase, userId: string, notificationId: string | null, title: string, message: string, actionUrl: string | null, payload: Record<string, unknown>) {
  const config = providerConfiguration();
  const { data: installs, error } = await sb.from("mobile_push_installations").select("id,platform,push_token")
    .eq("user_id", userId).eq("active", true);
  if (error) throw error;
  const deliveries = [];
  for (const install of installs || []) {
    const platform = String(install.platform);
    const provider = platform === "android" ? "fcm" : "apns";
    if ((platform === "android" && !config.android) || (platform === "ios" && !config.ios)) {
      deliveries.push({ user_id: userId, installation_id: install.id, notification_id: notificationId, provider, status: "skipped", error_message: "PROVIDER_NOT_CONFIGURED" });
      continue;
    }
    try {
      const pushPayload = { ...payload, notification_id: notificationId || "", source: "mobile" };
      const reference = platform === "android"
        ? await sendFcm(String(install.push_token), title, message, actionUrl, pushPayload)
        : await sendApns(String(install.push_token), title, message, actionUrl, pushPayload);
      deliveries.push({ user_id: userId, installation_id: install.id, notification_id: notificationId, provider, status: "sent", provider_reference: reference });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "PUSH_SEND_FAILED";
      deliveries.push({ user_id: userId, installation_id: install.id, notification_id: notificationId, provider, status: "failed", error_message: errorMessage });
      if (/UNREGISTERED|BadDeviceToken|Unregistered|NOT_FOUND/.test(errorMessage)) {
        await sb.from("mobile_push_installations").update({ active: false, disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", install.id);
      }
    }
  }
  if (deliveries.length) {
    const { error: deliveryError } = await sb.from("mobile_notification_deliveries").insert(deliveries);
    if (deliveryError) throw deliveryError;
  }
  return deliveries;
}

async function syncInbox(sb: Supabase, userId: string, cursor: string | null, limit: number) {
  const from = cursor && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor).toISOString() : null;
  const applyCursor = (query: any) => from ? query.gt("created_at", from) : query;
  const [mobile, live, talent, unreadMobile, unreadLive, unreadTalent] = await Promise.all([
    applyCursor(sb.from("mobile_notification_inbox").select("*").eq("user_id", userId).is("dismissed_at", null)).order("created_at", { ascending: true }).limit(limit),
    applyCursor(sb.from("live_notification_inbox").select("*").eq("user_id", userId).is("dismissed_at", null)).order("created_at", { ascending: true }).limit(limit),
    applyCursor(sb.from("talent_notifications").select("*").eq("user_id", userId)).order("created_at", { ascending: true }).limit(limit),
    sb.from("mobile_notification_inbox").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null).is("dismissed_at", null),
    sb.from("live_notification_inbox").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null).is("dismissed_at", null),
    sb.from("talent_notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  for (const result of [mobile, live, talent, unreadMobile, unreadLive, unreadTalent]) if (result.error) throw result.error;
  const rows = [
    ...(mobile.data || []).map((row: any) => ({ ...row, source: "mobile" })),
    ...(live.data || []).map((row: any) => ({ ...row, source: "live" })),
    ...(talent.data || []).map((row: any) => ({ ...row, source: "talent", priority: row.payload?.priority || "normal" })),
  ].sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at))).slice(0, limit).map((row: any) => ({
    id: String(row.id), source: row.source, notification_type: String(row.notification_type || "notification"),
    title: String(row.title || row.payload?.title || "Omnia Global Academy"), message: String(row.message || row.payload?.message || ""),
    action_url: safeActionUrl(row.action_url || row.payload?.action_url), payload: row.payload || {}, priority: String(row.priority || "normal"),
    read_at: row.read_at || null, created_at: row.created_at,
  }));
  return {
    notifications: rows,
    cursor: rows.at(-1)?.created_at || from || new Date().toISOString(),
    unread_count: Number(unreadMobile.count || 0) + Number(unreadLive.count || 0) + Number(unreadTalent.count || 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const action = new URL(req.url).searchParams.get("action") || "status";
  const session = await authenticate(sb, req);
  const internalAuthorized = isOmniaInternalRequest(req);
  if (!session && !internalAuthorized) return json({ error: "UNAUTHORIZED" }, 401);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const config = providerConfiguration();

  try {
    if (action === "status") return json({ success: true, provider_configured: config, installation_count: session ? (await sb.from("mobile_push_installations").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("active", true)).count || 0 : 0 });

    if (action === "register") {
      if (!session) return json({ error: "UNAUTHORIZED" }, 401);
      const platform = text(body.platform, 20);
      const installationId = text(body.installation_id, 220);
      const pushToken = text(body.push_token, 4096);
      if (!installationId || !pushToken || !["android", "ios"].includes(platform)) return json({ error: "INVALID_INSTALLATION" }, 400);
      const now = new Date().toISOString();
      const { error: tokenReleaseError } = await sb.from("mobile_push_installations")
        .update({ active: false, disabled_at: now, updated_at: now })
        .eq("platform", platform).eq("push_token", pushToken).eq("active", true);
      if (tokenReleaseError) throw tokenReleaseError;
      const row = {
        user_id: session.userId, installation_id: installationId, platform, push_token: pushToken,
        app_version: text(body.app_version, 80) || null, app_build: text(body.app_build, 80) || null,
        device_model: text(body.device_model, 160) || null, device_manufacturer: text(body.device_manufacturer, 160) || null,
        os_version: text(body.os_version, 120) || null, locale: text(body.locale, 40) || null, timezone: text(body.timezone, 100) || null,
        permission_status: "granted", active: true, disabled_at: null, last_seen_at: now, updated_at: now,
      };
      const { data, error } = await sb.from("mobile_push_installations").upsert(row, { onConflict: "user_id,platform,installation_id" }).select("id,platform,active,last_seen_at").single();
      if (error) throw error;
      return json({ success: true, installation: data, provider_configured: platform === "android" ? config.android : config.ios });
    }

    if (action === "unregister") {
      if (!session) return json({ error: "UNAUTHORIZED" }, 401);
      const installationId = text(body.installation_id, 220);
      if (!installationId) return json({ error: "INSTALLATION_REQUIRED" }, 400);
      const now = new Date().toISOString();
      const { error } = await sb.from("mobile_push_installations").update({ active: false, permission_status: "denied", disabled_at: now, updated_at: now })
        .eq("user_id", session.userId).eq("installation_id", installationId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "sync") {
      if (!session) return json({ error: "UNAUTHORIZED" }, 401);
      const result = await syncInbox(sb, session.userId, text(body.cursor, 80) || null, Math.min(200, Math.max(1, Number(body.limit || 100))));
      return json({ success: true, ...result, provider_configured: config.android || config.ios });
    }

    if (action === "mark") {
      if (!session) return json({ error: "UNAUTHORIZED" }, 401);
      const source = text(body.source, 20);
      const id = text(body.id, 80);
      const operation = text(body.action, 20);
      const table = source === "mobile" ? "mobile_notification_inbox" : source === "live" ? "live_notification_inbox" : source === "talent" ? "talent_notifications" : "";
      if (!table || !id || !["read", "dismiss"].includes(operation)) return json({ error: "INVALID_MARK_REQUEST" }, 400);
      const patch = operation === "read" ? { read_at: new Date().toISOString() } : source === "talent" ? { read_at: new Date().toISOString() } : { dismissed_at: new Date().toISOString() };
      const { error } = await sb.from(table).update(patch).eq("id", id).eq("user_id", session.userId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "test") {
      if (!session) return json({ error: "UNAUTHORIZED" }, 401);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const recent = await sb.from("mobile_notification_deliveries").select("id", { count: "exact", head: true }).eq("user_id", session.userId).gte("created_at", fiveMinutesAgo);
      if (Number(recent.count || 0) >= 3) return json({ error: "RATE_LIMITED" }, 429);
      const title = "Notifications Omnia activées";
      const message = "Votre appareil peut recevoir les rappels et informations de la plateforme.";
      const { data: inbox, error } = await sb.from("mobile_notification_inbox").insert({ user_id: session.userId, notification_type: "mobile_test", title, message, action_url: "/accueil", payload: { action_url: "/accueil" } }).select("id").single();
      if (error) throw error;
      const deliveries = await dispatchToUser(sb, session.userId, String(inbox.id), title, message, "/accueil", { notification_type: "mobile_test" });
      return json({ success: true, provider_configured: config, deliveries });
    }

    if (action === "dispatch") {
      const admin = session?.roles.includes("super_admin") || internalAuthorized;
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const userId = text(body.user_id, 80);
      const title = text(body.title, 180) || "Omnia Global Academy";
      const message = text(body.message, 1000);
      if (!userId || !message) return json({ error: "MISSING_PARAMS" }, 400);
      const { data: targetUser, error: targetUserError } = await sb.from("users")
        .select("id,allow_push,status")
        .eq("id", userId)
        .maybeSingle();
      if (targetUserError) throw targetUserError;
      if (!targetUser || targetUser.status === "suspendu") return json({ error: "USER_NOT_AVAILABLE" }, 404);
      if (targetUser.allow_push !== true) return json({ success: true, skipped: true, reason: "PUSH_NOT_ALLOWED" });
      const actionUrl = safeActionUrl(body.action_url);
      const notificationType = text(body.notification_type, 100) || "mobile";
      const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {};
      const { data: inbox, error } = await sb.from("mobile_notification_inbox").insert({ user_id: userId, notification_type: notificationType, title, message, action_url: actionUrl, payload, priority: ["low","normal","high","critical"].includes(text(body.priority, 20)) ? text(body.priority, 20) : "normal" }).select("id").single();
      if (error) throw error;
      const deliveries = await dispatchToUser(sb, userId, String(inbox.id), title, message, actionUrl, { ...payload, notification_type: notificationType });
      return json({ success: true, notification_id: inbox.id, deliveries });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("mobile-notifications", action, error);
    return json({ error: "MOBILE_NOTIFICATIONS_FAILED", message: error instanceof Error ? error.message : "UNKNOWN" }, 500);
  }
});
