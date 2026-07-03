import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { session_token, new_password } = await req.json();

    if (!session_token || !new_password) {
      return new Response(JSON.stringify({ success: false, message: "Token de session et nouveau mot de passe requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Mot de passe trop court (minimum 8 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find active session
    const { data: session } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at")
      .eq("session_token", session_token.trim())
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ success: false, message: "Session invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "Session expirée. Reconnectez-vous." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newPasswordHash = hashSync(new_password, 12);

    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: newPasswordHash,
        force_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user_id);

    if (updateError) throw updateError;

    // Issue a fresh session (old one remains valid since the user stays logged in)
    const newToken = crypto.randomUUID();
    await supabase.from("user_sessions").insert({
      user_id: session.user_id,
      session_token: newToken,
      expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
    });

    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name, phone_number, status, avatar_url")
      .eq("id", session.user_id)
      .maybeSingle();

    const { data: rolesData } = await supabase
      .from("user_roles").select("role").eq("user_id", session.user_id);
    const roles = (rolesData || []).map((r: { role: string }) => r.role);

    return new Response(JSON.stringify({
      success: true,
      session_token: newToken,
      user: { ...user, roles },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-change-password error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
