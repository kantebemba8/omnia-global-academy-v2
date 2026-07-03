import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifyAdminOrModerator(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;

  const { data: role } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", (sess as { user_id: string }).user_id)
    .in("role", ["super_admin", "moderateur"])
    .maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const userId = await verifyAdminOrModerator(sb, token);
    if (!userId) return json({ error: "FORBIDDEN" }, 403);

    // Total count
    const { count: total_count } = await sb
      .from("waitlist")
      .select("*", { count: "exact", head: true });

    // By country
    const { data: byCountryRaw } = await sb
      .from("waitlist")
      .select("country_code")
      .not("country_code", "is", null);

    const countryMap: Record<string, number> = {};
    for (const row of byCountryRaw ?? []) {
      const cc = (row as { country_code: string }).country_code;
      countryMap[cc] = (countryMap[cc] ?? 0) + 1;
    }
    const by_country = Object.entries(countryMap)
      .map(([country_code, count]) => ({ country_code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // By day (last 30 days)
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rawDays } = await sb
      .from("waitlist")
      .select("created_at")
      .gte("created_at", since30);

    const dayMap: Record<string, number> = {};
    for (const row of rawDays ?? []) {
      const day = (row as { created_at: string }).created_at.slice(0, 10);
      dayMap[day] = (dayMap[day] ?? 0) + 1;
    }
    const by_day_30 = Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Recent signups — mask email: show first char + *** + @domain
    const { data: recentRaw } = await sb
      .from("waitlist")
      .select("email, first_name, country_code, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const recent_signups = (recentRaw ?? []).map((r: { email: string; first_name: string | null; country_code: string | null; created_at: string }) => {
      const [local, domain] = r.email.split("@");
      const masked = `${local[0]}***@${domain}`;
      return { email: masked, first_name: r.first_name, country_code: r.country_code, created_at: r.created_at };
    });

    return json({ total_count: total_count ?? 0, by_country, by_day_30, recent_signups });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
