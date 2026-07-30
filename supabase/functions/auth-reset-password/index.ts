import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import {
  consumeRateLimit,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const rawToken = typeof body.reset_token === "string"
      ? body.reset_token.trim()
      : typeof body.token === "string"
      ? body.token.trim()
      : "";
    const newPassword = typeof body.new_password === "string"
      ? body.new_password
      : "";

    if (!rawToken || !newPassword) {
      return json({
        success: false,
        message: "Token et nouveau mot de passe requis",
      }, 400);
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return json({
        success: false,
        message: "Le mot de passe doit contenir entre 8 et 128 caractères",
      }, 400);
    }

    const clientIP = getClientIP(req);
    const tokenHash = await sha256Hex(rawToken);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipLimit = await consumeRateLimit(
      supabase,
      `auth-reset-password:ip:${clientIP}`,
      10,
      60 * 60,
    );
    const tokenLimit = await consumeRateLimit(
      supabase,
      `auth-reset-password:token:${tokenHash}`,
      5,
      60 * 60,
    );
    if (!ipLimit.allowed || !tokenLimit.allowed) {
      return json({
        success: false,
        message: "Trop de tentatives. Réessayez plus tard.",
        retry_after: Math.max(ipLimit.retryAfter, tokenLimit.retryAfter),
      }, 429);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { data, error } = await supabase.rpc("reset_password_with_token", {
      p_token_hash: tokenHash,
      p_legacy_token: rawToken,
      p_password_hash: passwordHash,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const status = String(result?.status ?? "invalid");

    if (status === "expired") {
      return json({
        success: false,
        message: "Lien ou token expiré. Demandez une nouvelle réinitialisation.",
      }, 400);
    }
    if (status !== "success") {
      return json({
        success: false,
        message: "Lien ou token invalide ou déjà utilisé",
      }, 400);
    }

    return json({
      success: true,
      message: "Mot de passe mis à jour avec succès. Connectez-vous.",
    });
  } catch (error) {
    console.error("auth-reset-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
