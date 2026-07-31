import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokenFrom(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function verifySession(
  sb: ReturnType<typeof createClient>,
  token: string,
) {
  const { data: session, error: sessionError } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !session) return null;

  const { data: user, error: userError } = await sb
    .from("users")
    .select("id,status")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user || user.status !== "actif") return null;
  return user as { id: string; status: string };
}

function statusFor(error: string) {
  if (error === "INSUFFICIENT_TOKENS") return 402;
  if (error === "DOCUMENT_NOT_FOUND") return 404;
  if (error === "USER_NOT_ACTIVE") return 401;
  return 400;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const token = tokenFrom(req);
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const user = await verifySession(sb, token);
    if (!user) {
      return json({
        error: "SESSION_INVALID",
        message: "Session invalide ou expirée.",
      }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action !== "prepare_pdf") {
      return json({ error: "UNKNOWN_ACTION" }, 400);
    }

    const documentId = String(body.document_id || "").trim();
    const docType = String(body.doc_type || "").trim();
    const requestId = String(body.request_id || crypto.randomUUID()).trim();

    if (!documentId || !requestId) {
      return json({
        error: "MISSING_FIELDS",
        message: "Le document et l'identifiant de requête sont obligatoires.",
      }, 400);
    }

    if (docType !== "cv" && docType !== "lm") {
      return json({ error: "INVALID_DOC_TYPE" }, 400);
    }

    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    const { data, error } = await sb.rpc("career_prepare_pdf_export", {
      p_user_id: user.id,
      p_document_id: documentId,
      p_doc_type: docType,
      p_title: body.title ? String(body.title) : null,
      p_template_key: body.template_key ? String(body.template_key) : null,
      p_request_id: requestId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error("career_prepare_pdf_export RPC error", error);
      return json({
        error: "EXPORT_PREPARATION_FAILED",
        message: "Impossible de préparer l'export PDF.",
      }, 500);
    }

    const result = (data || {}) as Record<string, unknown>;
    if (result.success !== true) {
      const code = String(result.error || "EXPORT_PREPARATION_FAILED");
      return json(result, statusFor(code));
    }

    return json(result);
  } catch (error) {
    console.error("career-studio-export error", error);
    return json({
      error: "SERVER_ERROR",
      message: "Une erreur interne a empêché la préparation du PDF.",
    }, 500);
  }
});
