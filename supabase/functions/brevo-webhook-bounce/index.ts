import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { event, email } = body as { event: string; email: string };

    if (!email) return json({ received: true });

    if (event === "hard_bounce" || event === "spam") {
      // Mark email as invalid — no more emails will be sent to this address
      await sb.from("users")
        .update({ email_status: "invalide" })
        .eq("email", email);

      // Find user for logging
      const { data: user } = await sb.from("users").select("id").eq("email", email).maybeSingle();

      await sb.from("notification_log").insert({
        user_id: user?.id ?? null,
        channel: "email",
        template_id: "bounce",
        recipient: email,
        status: "bounced",
        error_message: `Brevo event: ${event}`,
        metadata: body,
      });
    }

    if (event === "soft_bounce") {
      const { data: user } = await sb.from("users").select("id").eq("email", email).maybeSingle();
      await sb.from("notification_log").insert({
        user_id: user?.id ?? null,
        channel: "email",
        template_id: "soft_bounce",
        recipient: email,
        status: "bounced",
        error_message: `Brevo soft bounce`,
        metadata: body,
      });
    }

    return json({ received: true });
  } catch (err) {
    return json({ error: "INTERNAL", message: (err as Error).message }, 500);
  }
});
