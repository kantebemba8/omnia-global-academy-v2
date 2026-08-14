import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { makeCorsHeaders } from "../_shared/auth-security.ts";
import { getOmniaSessionToken, revokeOmniaSession } from "../_shared/omnia-auth.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const sessionToken = getOmniaSessionToken(req, body);
    if (!sessionToken) return json({ success: false, message: "Token de session requis" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    await revokeOmniaSession(supabase, sessionToken);
    return json({ success: true });
  } catch (error) {
    console.error("auth-logout error:", error);
    return json({ success: false, message: "Erreur serveur" }, 500);
  }
});
