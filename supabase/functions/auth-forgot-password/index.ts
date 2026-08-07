import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  consumeRateLimit,
  generateOpaqueToken,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: "Adresse e-mail invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const emailHash = await sha256Hex(email);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const ipLimit = await consumeRateLimit(supabase, `auth-forgot-password:ip:${clientIP}`, 10, 60 * 60);
    const emailLimit = await consumeRateLimit(supabase, `auth-forgot-password:email:${emailHash}`, 3, 60 * 60);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return json({ success: false, message: "Trop de demandes. Réessayez plus tard.", retry_after: Math.max(ipLimit.retryAfter, emailLimit.retryAfter) }, 429);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,email,full_name,status,suspension_source")
      .eq("email", email)
      .maybeSingle();
    if (userError) throw userError;

    // Réponse identique pour empêcher l’énumération des comptes.
    if (!user || user.status === "supprime" || (user.status === "suspendu" && user.suspension_source !== "self")) {
      return json({ success: true, method: "email" });
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from("password_reset_tokens").update({ used: true }).eq("user_id", user.id).eq("used", false);
    const { error: tokenError } = await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      reset_token: null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (tokenError) throw tokenError;

    const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
    const resetUrl = `${appUrl}/reinitialiser-mot-de-passe?token=${encodeURIComponent(rawToken)}`;
    const sent = await sendOmniaEmail({
      to: { email: user.email, name: user.full_name || undefined },
      templateKey: "auth_password_reset",
      params: { PRENOM: String(user.full_name || "").split(" ")[0], RESET_URL: resetUrl },
      senderEmail: Deno.env.get("BREVO_AUTH_SENDER_EMAIL") || Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
      userId: String(user.id),
      sb: supabase,
    });
    if (!sent) console.error("Password-reset email delivery failed for user:", user.id);

    return json({ success: true, method: "email" });
  } catch (error) {
    console.error("auth-forgot-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
