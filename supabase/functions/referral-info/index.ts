import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: referrals } = await sb.from("referrals")
      .select("id,status,reward_referrer_xof,rewarded_at,created_at,users!referred_id(full_name,country_code)")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://omniaglobalacademy.com";

    const filleuls = (referrals ?? []).map((r) => {
      const ref = r as unknown as {
        id: string; status: string; reward_referrer_xof: number; rewarded_at: string | null; created_at: string;
        users: { full_name: string; country_code: string } | null;
      };
      // Anonymize name: "Sidi T." format
      const name = ref.users?.full_name ?? "Utilisateur";
      const parts = name.trim().split(" ");
      const anonymized = parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
      return {
        id: ref.id,
        anonymized_name: anonymized,
        country_code: ref.users?.country_code ?? "ML",
        status: ref.status,
        reward_xof: ref.reward_referrer_xof,
        rewarded_at: ref.rewarded_at,
        joined_at: ref.created_at,
      };
    });

    const totalRewards = filleuls.reduce((sum, f) => sum + (f.reward_xof ?? 0), 0);

    return json({
      referral_link: `${siteUrl}/inscription?ref=${userId}`,
      total_filleuls: filleuls.length,
      total_recompenses_xof: totalRewards,
      filleuls,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
