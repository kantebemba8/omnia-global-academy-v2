import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { fedaPayConfiguration } from "../_shared/fedapay-security.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Client-Info,Apikey,x-omnia-session-token",
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

async function admin(sb: any, req: Request) {
  const token = (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  ).replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: session } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  const { data: role } = await sb.from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();
  return role ? session.user_id : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!await admin(sb, req)) return json({ error: "FORBIDDEN" }, 403);

    const { data: rows } = await sb.from("site_settings")
      .select("key,value")
      .in("key", ["payment_provider_primary", "payment_provider_mode"]);

    const settings: Record<string, unknown> = {};
    for (const row of rows || []) settings[row.key] = row.value;

    let configuration:
      | ReturnType<typeof fedaPayConfiguration>
      | {
        requested_mode: "invalid";
        effective_mode: "sandbox";
        api_base: "https://sandbox-api.fedapay.com/v1";
        live_enabled: false;
        live_blocked: true;
        configuration_error: string;
      };

    try {
      configuration = fedaPayConfiguration();
    } catch (error) {
      configuration = {
        requested_mode: "invalid",
        effective_mode: "sandbox",
        api_base: "https://sandbox-api.fedapay.com/v1",
        live_enabled: false,
        live_blocked: true,
        configuration_error: error instanceof Error ? error.message : String(error),
      };
    }

    const provider = String(settings.payment_provider_primary || "fedapay");
    const fedapayConfigured = Boolean(Deno.env.get("FEDAPAY_SECRET_KEY"));
    const webhookConfigured = Boolean(Deno.env.get("FEDAPAY_WEBHOOK_SECRET"));

    return json({
      success: true,
      active_provider: provider,
      providers: [{
        id: "fedapay",
        label: "FedaPay",
        implemented: true,
        configured: fedapayConfigured,
        webhook_configured: webhookConfigured,
        requested_mode: configuration.requested_mode,
        effective_mode: configuration.effective_mode,
        live_enabled: configuration.live_enabled,
        live_blocked: configuration.live_blocked,
        configuration_error: "configuration_error" in configuration
          ? configuration.configuration_error
          : null,
      }],
      secrets_exposed: false,
    });
  } catch (error) {
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
