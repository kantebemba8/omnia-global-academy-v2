import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Demo-Heartbeat-Token",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const heartbeatToken = req.headers.get("X-Demo-Heartbeat-Token") ?? "";
  if (!heartbeatToken) return json({ error: "HEARTBEAT_TOKEN_REQUIRED" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: demoConfig } = await sb
    .from("demo_account_config")
    .select("id, heartbeat_token, active_session_token, expires_at, is_online")
    .order("configured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!demoConfig || demoConfig.heartbeat_token !== heartbeatToken) {
    return json({ error: "INVALID_HEARTBEAT_TOKEN" }, 401);
  }

  const now = new Date();
  const expiresAt = demoConfig.expires_at ? new Date(demoConfig.expires_at) : null;

  if (!expiresAt || expiresAt <= now) {
    // Invalidate session on expiry
    await sb.from("demo_account_config")
      .update({ is_online: false, active_session_token: null, heartbeat_token: null })
      .eq("id", demoConfig.id);

    if (demoConfig.active_session_token) {
      await sb.from("user_sessions")
        .update({ expires_at: now.toISOString() })
        .eq("session_token", demoConfig.active_session_token);
    }

    return json({ expired: true, time_remaining_seconds: 0 });
  }

  const timeRemainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

  await sb.from("demo_account_config")
    .update({ last_seen_at: now.toISOString(), is_online: true })
    .eq("id", demoConfig.id);

  return json({ active: true, time_remaining_seconds: timeRemainingSeconds, expires_at: demoConfig.expires_at });
});
