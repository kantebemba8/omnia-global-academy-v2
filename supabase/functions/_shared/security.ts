import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const SECURITY_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-demo-heartbeat-token",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function makeCorsHeaders(origin?: string): Record<string, string> {
  return {
    ...SECURITY_HEADERS,
    "Access-Control-Allow-Origin":
      origin ?? Deno.env.get("ALLOWED_ORIGIN") ?? "https://omniaglobalacademy.com",
  };
}

export function getClientIP(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function checkIPBlocklist(
  supabase: SupabaseClient,
  ip: string
): Promise<boolean> {
  const { data } = await supabase
    .from("ip_blocklist")
    .select("blocked_until")
    .eq("ip_address", ip)
    .maybeSingle();
  if (!data) return false;
  if (!data.blocked_until) return true;
  return new Date(data.blocked_until) > new Date();
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("rate_key", key)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= maxRequests) {
    return { allowed: false, retryAfter: windowSeconds };
  }

  await supabase.from("rate_limit_log").insert({
    rate_key: key,
    created_at: new Date().toISOString(),
  });

  return { allowed: true };
}

export async function logSecurityEvent(
  supabase: SupabaseClient,
  event: {
    event_type: string;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    details?: object;
    severity?: "info" | "warning" | "critical";
  }
): Promise<void> {
  await supabase.from("security_audit_log").insert({
    ...event,
    severity: event.severity ?? "info",
  });
}
