import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

function asAmount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: session } = await getActiveOmniaSessionResult(sb, token);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);

    const { data: config } = await sb
      .from("referral_program_config")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    const enabled = config?.enabled === true;
    const referrerReward = enabled ? asAmount(config?.reward_referrer_xof) : 0;
    const referredReward = enabled ? asAmount(config?.reward_referred_xof) : 0;
    if (!enabled) {
      return json({
        enabled: false,
        referral_link: null,
        reward_referrer_xof: 0,
        reward_referred_xof: 0,
        total_filleuls: 0,
        total_recompenses_xof: 0,
        filleuls: [],
      });
    }

    const userId = session.user_id;
    const { data: userRow } = await sb.from("users").select("referral_code").eq("id", userId).maybeSingle();
    const { data: referrals, error: referralsError } = await sb
      .from("referrals")
      .select("id,status,reward_referrer_xof,rewarded_at,created_at,users!referred_id(full_name,country_code)")
      .eq("referrer_id", userId)
      .in("status", ["pending", "rewarded"])
      .order("created_at", { ascending: false });
    if (referralsError) throw referralsError;

    const filleuls = (referrals ?? []).map((row) => {
      const referral = row as unknown as {
        id: string;
        status: string;
        reward_referrer_xof: number;
        rewarded_at: string | null;
        created_at: string;
        users: { full_name: string; country_code: string } | null;
      };
      const name = referral.users?.full_name?.trim() || "Utilisateur";
      const parts = name.split(/\s+/);
      const anonymized = parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];

      return {
        id: referral.id,
        anonymized_name: anonymized,
        country_code: referral.users?.country_code ?? null,
        status: referral.status,
        reward_xof: referral.status === "rewarded" ? (referral.reward_referrer_xof ?? 0) : 0,
        rewarded_at: referral.rewarded_at,
        joined_at: referral.created_at,
      };
    });

    const totalRewards = filleuls.reduce((sum, item) => sum + item.reward_xof, 0);
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://omniaglobalacademy.com";

    return json({
      enabled: true,
      referral_code: userRow?.referral_code || null,
      referral_link: userRow?.referral_code ? `${siteUrl}/inscription?ref=${encodeURIComponent(userRow.referral_code)}` : null,
      reward_referrer_xof: referrerReward,
      reward_referred_xof: referredReward,
      trigger_mode: config?.trigger_mode || "any",
      triggers: config?.triggers || [],
      total_filleuls: filleuls.length,
      total_recompenses_xof: totalRewards,
      filleuls,
    });
  } catch (error) {
    console.error("referral-info", error);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
