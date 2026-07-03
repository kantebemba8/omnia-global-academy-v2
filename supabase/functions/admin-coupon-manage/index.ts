import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const { data: coupons } = await sb.from("coupons").select("*").order("created_at", { ascending: false });
      return json({ coupons: coupons ?? [] });
    }

    const body = await req.json() as {
      action: "create" | "deactivate" | "delete";
      coupon_data?: { code: string; discount_type: string; discount_value: number; max_uses?: number; applicable_to?: string; applicable_id?: string; expires_at?: string };
      coupon_id?: string;
    };
    const { action, coupon_data, coupon_id } = body;

    if (action === "create") {
      if (!coupon_data) return json({ error: "INVALID_PARAMS" }, 400);
      if (!coupon_data.code || !coupon_data.discount_type || !coupon_data.discount_value) return json({ error: "INVALID_PARAMS" }, 400);
      if (coupon_data.discount_type === "percentage" && coupon_data.discount_value > 100) return json({ error: "INVALID_PERCENT" }, 400);
      const { data: existing } = await sb.from("coupons").select("id").eq("code", coupon_data.code.toUpperCase()).maybeSingle();
      if (existing) return json({ error: "CODE_EXISTS" }, 409);
      const { data: created } = await sb.from("coupons").insert({ ...coupon_data, code: coupon_data.code.toUpperCase(), created_by: adminId }).select("id").maybeSingle();
      return json({ success: true, coupon_id: (created as { id: string } | null)?.id });
    } else if (action === "deactivate") {
      if (!coupon_id) return json({ error: "INVALID_PARAMS" }, 400);
      await sb.from("coupons").update({ is_active: false }).eq("id", coupon_id);
      return json({ success: true });
    } else if (action === "delete") {
      if (!coupon_id) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: c } = await sb.from("coupons").select("used_count").eq("id", coupon_id).maybeSingle();
      if ((c as { used_count?: number } | null)?.used_count ?? 0 > 0) return json({ error: "COUPON_USED" }, 400);
      await sb.from("coupons").delete().eq("id", coupon_id);
      return json({ success: true });
    }
    return json({ error: "INVALID_ACTION" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
